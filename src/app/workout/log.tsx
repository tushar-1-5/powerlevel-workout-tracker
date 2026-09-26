import { Ionicons } from '@expo/vector-icons';
import { useCallback, useMemo, useRef, useState } from 'react';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
  type ListRenderItemInfo,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BlurView } from 'expo-blur';

import { useBlurTarget } from '@/components/BlurTarget';
import { DragList } from '@/components/DragList';
import { EmptyState } from '@/components/EmptyState';
import { ExercisePage } from '@/components/ExercisePageV2';
import { GlassSheen, GlassSurface } from '@/components/GlassSurface';
import { OverflowMenu } from '@/components/OverflowMenu';
import { PrimaryButton } from '@/components/PrimaryButton';
import { RemarkSheet } from '@/components/RemarkSheet';
import type { AppSettings, Exercise, Workout, WorkoutExercise } from '@/db/types';
import { useWorkoutTimer } from '@/hooks/useWorkoutTimer';
import { formatDuration } from '@/lib/format';
import * as haptics from '@/lib/haptics';
import { TODAY, exercisesAddToWorkoutHref, exercisesSwapHref } from '@/lib/routes';
import { toggledMode, weightModeMenuLabel } from '@/lib/weightMode';
import { getExercisesByIds, updateExercise } from '@/queries/exercises';
import { getSettings } from '@/queries/settings';
import { removeExerciseFromDay, reorderDayExercises } from '@/queries/splits';
import {
  finishWorkout,
  getWorkout,
  getWorkoutExercises,
  removeExerciseFromWorkout,
  reorderWorkoutExercises,
} from '@/queries/workouts';
import { colors, font, glass, radius, spacing } from '@/theme/tokens';

/**
 * The real logging screen: a horizontal pager, one full page per exercise in
 * today's workout, each page a self-contained `ExercisePage`. All pages stay
 * mounted at once (virtualization disabled — a workout is a handful of
 * exercises, not hundreds) so each keeps its own in-progress entry state
 * while you swipe away and back.
 */
export default function WorkoutLogScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { width } = useWindowDimensions();
  const { workoutId, backfillDurationSeconds, backfillDurationUnknown } = useLocalSearchParams<{
    workoutId: string;
    /** Only set when backfill was given a remembered duration. Mutually exclusive with `backfillDurationUnknown`. */
    backfillDurationSeconds?: string;
    /** Only set when backfill's "I don't remember" toggle was checked. */
    backfillDurationUnknown?: string;
  }>();
  // True for either backfill shape — a live ticking timer makes no sense
  // when `started_at` is a past date: it would tick up from "hours/days
  // ago" for the whole session, unrelated to any duration already entered
  // on the backfill screen.
  const isBackfill = backfillDurationSeconds !== undefined || backfillDurationUnknown === 'true';
  const listRef = useRef<FlatList<WorkoutExercise>>(null);

  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [workout, setWorkout] = useState<Workout | null>(null);
  const [workoutExercises, setWorkoutExercises] = useState<WorkoutExercise[]>([]);
  const [exerciseMap, setExerciseMap] = useState<Map<string, Exercise>>(new Map());
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [pageIndex, setPageIndex] = useState(0);
  const [finishing, setFinishing] = useState(false);
  const [reordering, setReordering] = useState(false);
  const [editingRemark, setEditingRemark] = useState(false);

  // `null` when backfilling — the hook's own null-guard returns a static
  // '0:00' instead of ticking from a past `started_at`. What actually
  // renders in the header is `timerDisplay`, computed after `workout` loads.
  const liveTimer = useWorkoutTimer(isBackfill ? null : (workout?.started_at ?? null));

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;

      (async () => {
        setLoading(true);
        const found = await getWorkout(workoutId);
        if (cancelled) return;

        if (!found) {
          setNotFound(true);
          setLoading(false);
          return;
        }

        const exercises = await getWorkoutExercises(found.id);
        const [exMap, appSettings] = await Promise.all([
          getExercisesByIds(exercises.map((e) => e.exercise_id)),
          getSettings(),
        ]);
        if (cancelled) return;

        setWorkout(found);
        setWorkoutExercises(exercises);
        setExerciseMap(exMap);
        setSettings(appSettings);
        setLoading(false);
      })();

      return () => {
        cancelled = true;
      };
    }, [workoutId]),
  );

  const currentExercise = workoutExercises[pageIndex]
    ? exerciseMap.get(workoutExercises[pageIndex].exercise_id)
    : null;

  const goTo = useCallback(
    (index: number) => {
      if (index < 0 || index >= workoutExercises.length) return;
      haptics.tick();
      listRef.current?.scrollToIndex({ index, animated: true });
      setPageIndex(index);
    },
    [workoutExercises.length],
  );

  const getItemLayout = useMemo(
    () => (_: unknown, index: number) => ({ length: width, offset: width * index, index }),
    [width],
  );

  const renderPage = useCallback(
    ({ item }: ListRenderItemInfo<WorkoutExercise>) => {
      const exercise = exerciseMap.get(item.exercise_id);
      if (!exercise || !workout || !settings) return <View style={{ width }} />;

      return (
        <View style={{ width }}>
          <ExercisePage
            workoutId={workout.id}
            workoutExerciseId={item.id}
            exercise={exercise}
            settings={settings}
          />
        </View>
      );
    },
    [exerciseMap, workout, settings, width],
  );

  const handleFinish = useCallback(async () => {
    if (!workout || finishing) return;
    setFinishing(true);
    haptics.confirm();
    await finishWorkout(
      workout.id,
      backfillDurationUnknown === 'true'
        ? null
        : backfillDurationSeconds
          ? Number(backfillDurationSeconds)
          : undefined,
    );
    // `replace`, not `push` — the finished workout should never be one back-
    // press away from Finish again once you're looking at its summary.
    router.replace({ pathname: '/workout/summary', params: { workoutId: workout.id } });
  }, [workout, finishing, backfillDurationSeconds, backfillDurationUnknown, router]);

  const doRemove = useCallback(async (we: WorkoutExercise) => {
    await removeExerciseFromWorkout(we.id);
    if (we.source_split_day_exercise_id) {
      await removeExerciseFromDay(we.source_split_day_exercise_id);
    }
    setWorkoutExercises((prev) => {
      const removedIndex = prev.findIndex((x) => x.id === we.id);
      const next = prev.filter((x) => x.id !== we.id);
      const newIndex = Math.max(0, Math.min(removedIndex, next.length - 1));
      setPageIndex(newIndex);
      requestAnimationFrame(() => {
        listRef.current?.scrollToIndex({ index: newIndex, animated: false });
      });
      return next;
    });
  }, []);

  /**
   * Both per-exercise settings reachable from the overflow menu — weight mode
   * and the remark — are columns on `exercises`, so they go through the same
   * `updateExercise` writer the day editor uses, and they're sticky: the next
   * session, and every past one, reads the same row.
   *
   * After the write, `exerciseMap` is patched in place rather than reloaded.
   * Each pager page receives its `exercise` from this map as a prop, so the
   * patch re-renders the open page — new stepper caption, new set-row suffix —
   * without remounting it, which would throw away whatever weight/reps you'd
   * dialled in but not yet logged.
   */
  const patchExercise = useCallback(
    async (exercise: Exercise, patch: Partial<Pick<Exercise, 'weight_mode' | 'notes'>>) => {
      setExerciseMap((prev) => {
        const next = new Map(prev);
        next.set(exercise.id, { ...exercise, ...patch });
        return next;
      });
      await updateExercise(exercise.id, patch);
    },
    [],
  );

  const handleRemoveExercise = useCallback(() => {
    const we = workoutExercises[pageIndex] ?? null;
    if (!we || workoutExercises.length <= 1) return;
    const name = exerciseMap.get(we.exercise_id)?.name ?? 'This exercise';
    Alert.alert(
      `Remove ${name}?`,
      we.source_split_day_exercise_id
        ? "This removes it from today's workout and from your split."
        : "This removes it from today's workout.",
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: () => {
            haptics.warn();
            void doRemove(we);
          },
        },
      ],
    );
  }, [workoutExercises, pageIndex, exerciseMap, doRemove]);

  if (loading) {
    return (
      <View style={[styles.screen, styles.centre]}>
        <ActivityIndicator color={colors.accent} size="large" />
      </View>
    );
  }

  if (notFound || !workout || !settings) {
    return (
      <View style={[styles.screen, { paddingTop: insets.top }]}>
        <EmptyState
          title="Workout not found"
          body="This session may have been deleted."
          actionLabel="Back to Today"
          onAction={() => router.replace(TODAY)}
        />
      </View>
    );
  }

  const timerDisplay = backfillDurationUnknown === 'true'
    ? '—'
    : backfillDurationSeconds !== undefined
      ? formatDuration(Number(backfillDurationSeconds))
      : liveTimer;

  const currentWorkoutExercise = workoutExercises[pageIndex] ?? null;
  const menuItems = [
    // Per-exercise settings first: they're the ones reached for mid-set.
    ...(currentExercise
      ? [
          {
            label: weightModeMenuLabel(currentExercise),
            onPress: () => {
              void patchExercise(currentExercise, { weight_mode: toggledMode(currentExercise.weight_mode) });
            },
          },
          { label: currentExercise.notes ? 'Edit Remarks' : 'Add Remarks', onPress: () => setEditingRemark(true) },
        ]
      : []),
    ...(currentWorkoutExercise
      ? [{ label: 'Swap Exercise', onPress: () => router.push(exercisesSwapHref(currentWorkoutExercise.id)) }]
      : []),
    { label: 'Add Exercise', onPress: () => router.push(exercisesAddToWorkoutHref(workout.id)) },
    ...(workoutExercises.length > 1
      ? [
          { label: 'Reorder Exercises', onPress: () => setReordering(true) },
          { label: 'Remove Exercise', onPress: handleRemoveExercise },
        ]
      : []),
  ];

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      <OverflowMenu items={menuItems} />

      <View style={styles.header}>
        <View style={styles.headerTop}>
          <Text style={styles.dayName} allowFontScaling={false}>
            {workout.day_name}
          </Text>
          <Text style={styles.timer} allowFontScaling={false}>
            {timerDisplay}
          </Text>
        </View>

        <View style={styles.pagerNav}>
          <Pressable
            onPress={() => goTo(pageIndex - 1)}
            disabled={pageIndex === 0}
            hitSlop={8}
            style={styles.navArrow}>
            <Ionicons
              name="chevron-back"
              size={24}
              color={pageIndex === 0 ? colors.textMuted : colors.accent}
            />
          </Pressable>
          <Text style={styles.exerciseName} numberOfLines={1} allowFontScaling={false}>
            {currentExercise?.name ?? ''}
          </Text>
          <Text style={styles.pagerCount} allowFontScaling={false}>
            {pageIndex + 1} of {workoutExercises.length}
          </Text>
          <Pressable
            onPress={() => goTo(pageIndex + 1)}
            disabled={pageIndex === workoutExercises.length - 1}
            hitSlop={8}
            style={styles.navArrow}>
            <Ionicons
              name="chevron-forward"
              size={24}
              color={pageIndex === workoutExercises.length - 1 ? colors.textMuted : colors.accent}
            />
          </Pressable>
        </View>

        {/* The sticky remark, always in view for the page you're on. It lives
            here in the fixed header rather than inside ExercisePage: that
            page's entry section is a sticky header already fighting for
            height, and anywhere in its scroll area would scroll out of reach
            exactly when the set list gets long. One line, truncated — tap it
            for the whole thing. */}
        {currentExercise?.notes ? (
          <Pressable onPress={() => setEditingRemark(true)} hitSlop={6} style={styles.remark}>
            <Ionicons name="document-text-outline" size={14} color={colors.accent} />
            <Text style={styles.remarkText} numberOfLines={1} allowFontScaling={false}>
              {currentExercise.notes}
            </Text>
          </Pressable>
        ) : null}

        <View style={styles.dots}>
          {workoutExercises.map((we, i) => (
            <View key={we.id} style={[styles.dot, i === pageIndex && styles.dotActive]} />
          ))}
        </View>
      </View>

      <FlatList
        ref={listRef}
        style={styles.pager}
        data={workoutExercises}
        keyExtractor={(we) => we.id}
        renderItem={renderPage}
        // FlatList skips re-rendering cells whose `data` item is unchanged.
        // A weight-mode flip or remark edit changes `exerciseMap`, not
        // `workoutExercises`, so this is what tells it the open page's
        // `exercise` prop is stale.
        extraData={exerciseMap}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        initialNumToRender={workoutExercises.length}
        windowSize={workoutExercises.length + 2}
        removeClippedSubviews={false}
        getItemLayout={getItemLayout}
        onMomentumScrollEnd={(e) => {
          const idx = Math.round(e.nativeEvent.contentOffset.x / width);
          setPageIndex(idx);
        }}
      />

      <View style={[styles.footer, { paddingBottom: insets.bottom + spacing.lg }]}>
        <PrimaryButton label="Finish Workout" onPress={handleFinish} loading={finishing} compact />
      </View>

      {currentExercise ? (
        <RemarkSheet
          visible={editingRemark}
          exerciseName={currentExercise.name}
          remark={currentExercise.notes}
          onClose={() => setEditingRemark(false)}
          onSave={(remark) => patchExercise(currentExercise, { notes: remark })}
        />
      ) : null}

      <Modal visible={reordering} transparent animationType="slide" onRequestClose={() => setReordering(false)}>
        <ReorderSheetBody
          workoutExercises={workoutExercises}
          exerciseMap={exerciseMap}
          insetsBottom={insets.bottom}
          onClose={() => setReordering(false)}
          onReorder={(next) => {
            setWorkoutExercises(next);
            void reorderWorkoutExercises(next.map((we) => we.id));
            const linkedIds = next
              .map((we) => we.source_split_day_exercise_id)
              .filter((id): id is string => id !== null);
            if (linkedIds.length > 0) {
              void reorderDayExercises(linkedIds);
            }
          }}
        />
      </Modal>
    </View>
  );
}

/* ------------------------------------------------------------- reorder sheet */

interface ReorderSheetBodyProps {
  workoutExercises: WorkoutExercise[];
  exerciseMap: Map<string, Exercise>;
  insetsBottom: number;
  onClose: () => void;
  onReorder: (next: WorkoutExercise[]) => void;
}

/**
 * Split out from the Modal's JSX so it can call `useBlurTarget()` itself.
 * Currently resolves to `null` everywhere — see `BlurTarget.tsx`'s own
 * comment: `BlurTargetView`'s native view manager isn't in the currently
 * installed dev client, so nothing mounts a `BlurTargetRoot` yet. Once a
 * rebuild picks that up, wrapping this Modal's own content in a local
 * `BlurTargetRoot` (it can't see the app-root one — a Modal portals into its
 * own native window) is what restores blur here, same as `GlassSurface`
 * restores automatically for ordinary screens.
 */
function ReorderSheetBody({
  workoutExercises,
  exerciseMap,
  insetsBottom,
  onClose,
  onReorder,
}: ReorderSheetBodyProps) {
  const blurTarget = useBlurTarget();

  return (
    <View style={styles.reorderBackdrop}>
      <View style={[styles.reorderSheet, { paddingBottom: insetsBottom + spacing.lg }]}>
        <BlurView
          blurTarget={blurTarget ?? undefined}
          intensity={36}
          tint="dark"
          blurMethod="dimezisBlurView"
          style={StyleSheet.absoluteFill}
        />
        <GlassSheen />
        <View style={styles.reorderHead}>
          <Text style={styles.reorderTitle}>Reorder Exercises</Text>
          <Pressable onPress={onClose} hitSlop={8}>
            <Text style={styles.reorderDone}>Done</Text>
          </Pressable>
        </View>
        <DragList
          data={workoutExercises}
          keyExtractor={(we) => we.id}
          itemHeight={56}
          onReorder={onReorder}
          renderItem={(we) => (
            <GlassSurface style={styles.reorderRow}>
              <Text style={styles.reorderRowText}>{exerciseMap.get(we.exercise_id)?.name ?? ''}</Text>
            </GlassSurface>
          )}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  centre: { alignItems: 'center', justifyContent: 'center' },
  header: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.sm,
    gap: spacing.xs,
    borderBottomWidth: 1,
    borderBottomColor: glass.border,
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    paddingRight: 48, // clears the absolutely-positioned OverflowMenu trigger
  },
  dayName: {
    color: colors.textMuted,
    fontSize: font.micro,
    fontWeight: '700',
    letterSpacing: 1.4,
    textTransform: 'uppercase',
  },
  timer: {
    color: colors.accent,
    fontSize: font.label,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  pager: { flex: 1 },
  pagerNav: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  navArrow: { width: 28, alignItems: 'center', justifyContent: 'center' },
  exerciseName: { flex: 1, color: colors.text, fontSize: font.title, fontWeight: '700' },
  pagerCount: { color: colors.textSecondary, fontSize: font.caption, fontWeight: '600' },
  // Indented to line up with the exercise name, past the 28px back chevron
  // and the pager row's 8px gap.
  remark: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingLeft: 36, paddingRight: spacing.sm },
  remarkText: { flex: 1, color: colors.textSecondary, fontSize: font.caption, fontStyle: 'italic' },
  dots: { flexDirection: 'row', gap: 6, justifyContent: 'center' },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.border },
  dotActive: { backgroundColor: colors.accent },
  // `paddingTop: 0` on purpose — ExercisePage's own `logSetFooter` owns the
  // full 12px gap between the Log Set and Finish Workout buttons. Any top
  // padding here would stack on top of that and reopen the old 24px gap.
  footer: { paddingHorizontal: spacing.lg, paddingTop: 0 },
  reorderBackdrop: { flex: 1, backgroundColor: colors.overlay, justifyContent: 'flex-end' },
  // Not a `<GlassSurface>` directly — its uniform border radius would fight
  // this sheet's intentional top-only rounding. `overflow: 'hidden'` here is
  // what clips the BlurView/sheen to those corners instead.
  reorderSheet: {
    backgroundColor: glass.panelRaised,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    borderWidth: 1,
    borderColor: glass.borderStrong,
    padding: spacing.lg,
    maxHeight: '75%',
    overflow: 'hidden',
  },
  reorderHead: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  reorderTitle: { color: colors.text, fontSize: font.heading, fontWeight: '800' },
  reorderDone: { color: colors.accent, fontSize: font.body, fontWeight: '700' },
  // `flex: 1` (not a percentage height) — DragList's row wraps this in a
  // cross-axis-centered container, so a percentage height here would resolve
  // against an undefined parent size. Padding gives it real height instead.
  reorderRow: {
    flex: 1,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    borderRadius: radius.md,
  },
  reorderRowText: { color: colors.text, fontSize: font.body, fontWeight: '600' },
});
