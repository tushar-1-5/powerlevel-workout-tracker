import { Ionicons } from '@expo/vector-icons';
import { useCallback, useState } from 'react';
import { useFocusEffect, useRouter } from 'expo-router';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { DragList } from '@/components/DragList';
import { EmptyState } from '@/components/EmptyState';
import { ExerciseList } from '@/components/ExerciseList';
import { GlassSurface } from '@/components/GlassSurface';
import { GroupSelectorRow } from '@/components/GroupSelectorRow';
import { OverflowMenu } from '@/components/OverflowMenu';
import { PrimaryButton } from '@/components/PrimaryButton';
import { TodayHeader } from '@/components/TodayHeader';
import { MUSCLE_LABELS, type Exercise, type Split, type SplitDay, type Workout } from '@/db/types';
import * as haptics from '@/lib/haptics';
import { EXERCISES, ONBOARDING, SPLITS, exercisesSwapDayHref } from '@/lib/routes';
import { describeSuggestion, resolveSuggestedDay, type DaySuggestion } from '@/lib/scheduling';
import { getExercisesByIds, resolveOrderedExercises } from '@/queries/exercises';
import { getSettings, updateSettings } from '@/queries/settings';
import {
  getDayExercises,
  getDefaultSplit,
  getSplitDays,
  listSplits,
  reorderDayExercises,
} from '@/queries/splits';
import {
  getActiveWorkout,
  getLastFinishedWorkout,
  getWorkoutExercises,
  startWorkout,
} from '@/queries/workouts';
import { colors, font, radius, spacing } from '@/theme/tokens';

const SUGGESTED_ROW_HEIGHT = 68;

interface SuggestedRow {
  exercise: Exercise;
  dayExerciseId: string;
}

interface DayExerciseLoad {
  exercises: Exercise[];
  /** Same order/length as `exercises` — the `split_day_exercises` row id behind each one, for swapping. */
  dayExerciseIds: string[];
}

async function loadDayExercises(dayId: string): Promise<DayExerciseLoad> {
  const dayExercises = await getDayExercises(dayId);
  const exMap = await getExercisesByIds(dayExercises.map((de) => de.exercise_id));
  const pairs = dayExercises
    .map((de) => {
      const exercise = exMap.get(de.exercise_id);
      return exercise ? { exercise, dayExerciseId: de.id } : null;
    })
    .filter((p): p is { exercise: Exercise; dayExerciseId: string } => p !== null);
  return { exercises: pairs.map((p) => p.exercise), dayExerciseIds: pairs.map((p) => p.dayExerciseId) };
}

/**
 * The home screen. Shows either the workout already in progress (Resume), or
 * the scheduling suggestion for the default split (group selector + ordered
 * exercise list + Start). "Start Workout" is deliberately the full extent of
 * this block's session handling — it creates a real `workouts` row and hands
 * off to the stub logging screen; the real set-logging pager is later work.
 */
export default function TodayScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  const [activeWorkout, setActiveWorkout] = useState<Workout | null>(null);
  const [activeExercises, setActiveExercises] = useState<Exercise[]>([]);

  const [split, setSplit] = useState<Split | null>(null);
  const [days, setDays] = useState<SplitDay[]>([]);
  const [suggestion, setSuggestion] = useState<DaySuggestion | null>(null);
  const [selectedDayId, setSelectedDayId] = useState<string | null>(null);
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [dayExerciseIds, setDayExerciseIds] = useState<string[]>([]);

  const [starting, setStarting] = useState(false);

  // Reloads every time Today regains focus, not just on mount — returning
  // here from the workout stub screen after Finish must pick up the
  // now-advanced rotation suggestion without the screen ever remounting.
  useFocusEffect(
    useCallback(() => {
      let cancelled = false;

      (async () => {
        try {
          setLoading(true);
          setError(null);

          // First-launch gate. A split already existing here means either a
          // real returning user, or (during this build) a dev/test database
          // seeded before onboarding existed — either way, that's proof
          // setup already happened, so it's marked done rather than
          // re-prompting. Only a genuinely empty, never-onboarded database
          // gets sent to the wizard.
          const settings = await getSettings();
          if (!settings.onboarded) {
            const existingSplits = await listSplits();
            if (existingSplits.length > 0) {
              await updateSettings({ onboarded: true });
            } else {
              if (!cancelled) router.replace(ONBOARDING);
              return;
            }
          }

          const active = await getActiveWorkout();
          if (active) {
            const workoutExercises = await getWorkoutExercises(active.id);
            const exMap = await getExercisesByIds(workoutExercises.map((we) => we.exercise_id));
            if (cancelled) return;
            setActiveWorkout(active);
            setActiveExercises(resolveOrderedExercises(workoutExercises, exMap));
            return;
          }

          const defaultSplit = await getDefaultSplit();
          if (!defaultSplit) {
            if (cancelled) return;
            setActiveWorkout(null);
            setSplit(null);
            return;
          }

          const splitDays = await getSplitDays(defaultSplit.id);
          const lastFinished = await getLastFinishedWorkout(defaultSplit.id);
          const nextSuggestion = resolveSuggestedDay({
            mode: defaultSplit.schedule_mode,
            days: splitDays,
            lastFinishedDayId: lastFinished?.split_day_id ?? null,
          });

          const dayId = nextSuggestion.day?.id ?? null;
          const loaded = dayId ? await loadDayExercises(dayId) : { exercises: [], dayExerciseIds: [] };

          if (cancelled) return;
          setActiveWorkout(null);
          setSplit(defaultSplit);
          setDays(splitDays);
          setSuggestion(nextSuggestion);
          setSelectedDayId(dayId);
          setExercises(loaded.exercises);
          setDayExerciseIds(loaded.dayExerciseIds);
        } catch (err) {
          if (!cancelled) setError(err instanceof Error ? err.message : String(err));
        } finally {
          if (!cancelled) setLoading(false);
        }
      })();

      return () => {
        cancelled = true;
      };
    }, [reloadKey, router]),
  );

  // A manual pick is local-only — it never calls a query to persist an
  // override. The PRD is explicit: the suggestion is a default, not a lock,
  // and re-anchoring only happens once a workout is actually finished on the
  // picked day (which `resolveSuggestedDay` already handles next time round).
  const selectDay = useCallback((dayId: string) => {
    setSelectedDayId(dayId);
    setExercises([]);
    setDayExerciseIds([]);
    void loadDayExercises(dayId).then((loaded) => {
      setExercises(loaded.exercises);
      setDayExerciseIds(loaded.dayExerciseIds);
    });
  }, []);

  // Swapping here edits the split day itself — permanent, same as editing it
  // from the Splits tab — since there's no workout session yet to scope a
  // one-off swap to. `useFocusEffect` above already re-fetches on return
  // from the picker, so no extra state update is needed here.
  const handleSwap = useCallback(
    (dayExerciseId: string) => {
      router.push(exercisesSwapDayHref(dayExerciseId));
    },
    [router],
  );

  // Reordering here is the same permanent-split-edit semantics as swapping
  // above — DragList's own `onReorder` already gives the array in its new
  // order, so the local state and the persisted position both update from
  // the exact same array, never out of sync with each other.
  const handleReorderSuggested = useCallback((next: SuggestedRow[]) => {
    setExercises(next.map((r) => r.exercise));
    setDayExerciseIds(next.map((r) => r.dayExerciseId));
    void reorderDayExercises(next.map((r) => r.dayExerciseId));
  }, []);

  const handleStart = useCallback(async () => {
    if (!split || !selectedDayId || exercises.length === 0 || starting) return;
    const day = days.find((d) => d.id === selectedDayId);
    if (!day) return;

    setStarting(true);
    haptics.confirm();
    try {
      const workoutId = await startWorkout({
        splitId: split.id,
        splitDayId: selectedDayId,
        dayName: day.name,
        exerciseIds: exercises.map((e) => e.id),
      });
      router.push({ pathname: '/workout/log', params: { workoutId } });
    } catch (err) {
      setStarting(false);
      setError(err instanceof Error ? err.message : String(err));
    }
  }, [split, selectedDayId, exercises, starting, days, router]);

  const handleResume = useCallback(() => {
    if (!activeWorkout) return;
    router.push({ pathname: '/workout/log', params: { workoutId: activeWorkout.id } });
  }, [activeWorkout, router]);

  // Settings is a bottom tab now, not a menu item — always one tap away, so
  // it no longer needs a second path through here.
  const menuItems = [
    { label: 'Splits', onPress: () => router.push(SPLITS) },
    { label: 'Exercises', onPress: () => router.push(EXERCISES) },
    { label: 'Bodyweight', onPress: () => router.push('/bodyweight') },
  ];

  if (loading) {
    return (
      <View style={[styles.screen, styles.centre]}>
        <ActivityIndicator color={colors.accent} size="large" />
      </View>
    );
  }

  if (error) {
    return (
      <View style={[styles.screen, { paddingTop: insets.top }]}>
        <EmptyState
          title="Something went wrong"
          body={error}
          actionLabel="Retry"
          onAction={() => setReloadKey((k) => k + 1)}
        />
      </View>
    );
  }

  if (activeWorkout) {
    return (
      <View style={[styles.screen, { paddingTop: insets.top + spacing.lg }]}>
        <OverflowMenu items={menuItems} />
        <ScrollView contentContainerStyle={styles.content}>
          <TodayHeader dayName={activeWorkout.day_name} startedAt={activeWorkout.started_at} />
          <View style={styles.list}>
            <ExerciseList exercises={activeExercises} />
          </View>
        </ScrollView>
        <View style={styles.footer}>
          <PrimaryButton label="Resume Workout" onPress={handleResume} />
        </View>
      </View>
    );
  }

  if (!split) {
    return (
      <View style={[styles.screen, { paddingTop: insets.top }]}>
        <OverflowMenu items={menuItems} />
        <EmptyState
          title="No split yet"
          body="Create one to start training."
          actionLabel="New Split"
          onAction={() => router.push('/splits/new')}
        />
      </View>
    );
  }

  if (suggestion?.reason === 'empty') {
    return (
      <View style={[styles.screen, { paddingTop: insets.top }]}>
        <OverflowMenu items={menuItems} />
        <EmptyState title={split.name} body={describeSuggestion(suggestion, split.schedule_mode)} />
      </View>
    );
  }

  const selectedDay = days.find((d) => d.id === selectedDayId) ?? null;
  const isRest = suggestion?.reason === 'rest';
  const headerDayName = selectedDay?.name ?? (isRest ? 'Rest day' : split.name);
  const showCaption =
    !!suggestion && (isRest || (!!suggestion.day && selectedDayId === suggestion.day.id));

  return (
    <View style={[styles.screen, { paddingTop: insets.top + spacing.lg }]}>
      <OverflowMenu items={menuItems} />
      <ScrollView contentContainerStyle={styles.content}>
        <TodayHeader
          dayName={headerDayName}
          suggestionCaption={
            showCaption && suggestion ? describeSuggestion(suggestion, split.schedule_mode) : null
          }
        />
        <GroupSelectorRow days={days} selectedDayId={selectedDayId} onSelect={selectDay} />
        <View style={styles.list}>
          {exercises.length === 0 ? (
            <GlassSurface style={styles.emptyCard}>
              <Text style={styles.emptyText}>Pick a group above to see its exercises.</Text>
            </GlassSurface>
          ) : (
            <DragList
              data={exercises.map((exercise, i) => ({ exercise, dayExerciseId: dayExerciseIds[i] }))}
              keyExtractor={(row) => row.dayExerciseId}
              itemHeight={SUGGESTED_ROW_HEIGHT}
              dragWholeRow
              onReorder={handleReorderSuggested}
              renderItem={(row) => (
                <View style={styles.dragRowWrap}>
                  <GlassSurface style={styles.dragCard}>
                    <View style={styles.dragRowInfo}>
                      <Text style={styles.dragRowName}>{row.exercise.name}</Text>
                      <Text style={styles.dragRowMuscle}>{MUSCLE_LABELS[row.exercise.muscle_group]}</Text>
                    </View>
                    <Pressable onPress={() => handleSwap(row.dayExerciseId)} hitSlop={8} style={styles.dragRowSwap}>
                      <Ionicons name="swap-horizontal" size={18} color={colors.textMuted} />
                    </Pressable>
                  </GlassSurface>
                </View>
              )}
            />
          )}
        </View>
      </ScrollView>
      <View style={styles.footer}>
        <PrimaryButton
          label="Start Workout"
          onPress={handleStart}
          disabled={!selectedDayId || exercises.length === 0}
          loading={starting}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  centre: { alignItems: 'center', justifyContent: 'center' },
  content: { paddingBottom: spacing.xxxl, gap: spacing.lg },
  list: { paddingHorizontal: spacing.lg },
  footer: { padding: spacing.lg },
  emptyCard: { padding: spacing.md },
  emptyText: { color: colors.textMuted, fontSize: font.body, textAlign: 'center', paddingVertical: spacing.md },
  dragRowWrap: { flex: 1, paddingVertical: 4 },
  dragCard: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radius.md,
  },
  dragRowInfo: { flex: 1 },
  dragRowName: { color: colors.text, fontSize: font.body, fontWeight: '600' },
  dragRowMuscle: { color: colors.textSecondary, fontSize: font.caption, marginTop: 1 },
  dragRowSwap: { padding: spacing.xs },
});
