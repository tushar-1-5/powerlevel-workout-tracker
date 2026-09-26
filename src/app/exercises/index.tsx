import { Ionicons } from '@expo/vector-icons';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { EmptyState } from '@/components/EmptyState';
import { GlassSurface } from '@/components/GlassSurface';
import {
  EQUIPMENT_LABELS,
  MUSCLE_LABELS,
  type Equipment,
  type Exercise,
  type MuscleGroup,
} from '@/db/types';
import * as haptics from '@/lib/haptics';
import { addExerciseToDay, getDayExercise, swapExerciseInDay } from '@/queries/splits';
import { getExercise, listExercises } from '@/queries/exercises';
import { addExerciseToWorkout, getWorkout, getWorkoutExercise, swapWorkoutExercise } from '@/queries/workouts';
import { colors, font, glass, radius, spacing } from '@/theme/tokens';

const MUSCLE_GROUPS = Object.keys(MUSCLE_LABELS) as MuscleGroup[];
const EQUIPMENT_TYPES = Object.keys(EQUIPMENT_LABELS) as Equipment[];

/**
 * The exercise library from the PRD's nav table — and, opened with one of
 * four optional params, the same screen doubles as a picker for four
 * different callers instead of four near-identical screens:
 *
 *  - `dayId` — the day editor's "add from library" (Block 9)
 *  - `workoutId` — the logging pager's "add exercise", ad-hoc for today AND
 *    (always, unprompted) appended to the running workout's split day too
 *  - `swapId` — the logging pager's "swap exercise" — a `workout_exercise`
 *    id, replacing what's trained in that slot for today, and (whenever that
 *    slot has a known split link) the same slot in the split
 *  - `swapDayExerciseId` — the Today screen's "swap exercise", before any
 *    workout exists — a `split_day_exercises` id, so this one edits the
 *    split itself and persists to every future suggestion of this day
 *
 * At most one of these is ever set by a given caller; browse mode (none set)
 * makes a tap on a row a no-op, since there's no exercise-detail screen yet.
 * Both swap modes pre-filter the muscle-group chip to the outgoing
 * exercise's muscle group and exclude that exercise from the list, so the
 * picker opens showing likely substitutes first without hiding anything.
 */
export default function ExercisesScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { dayId, workoutId, swapId, swapDayExerciseId } = useLocalSearchParams<{
    dayId?: string;
    workoutId?: string;
    swapId?: string;
    swapDayExerciseId?: string;
  }>();
  const isPicker = !!dayId || !!workoutId || !!swapId || !!swapDayExerciseId;

  const [loading, setLoading] = useState(true);
  const [all, setAll] = useState<Exercise[]>([]);
  const [search, setSearch] = useState('');
  const [muscle, setMuscle] = useState<MuscleGroup | null>(null);
  const [equipment, setEquipment] = useState<Equipment | null>(null);
  const [adding, setAdding] = useState<string | null>(null);
  const [addToSplitDayId, setAddToSplitDayId] = useState<string | null>(null);
  const [excludeExerciseId, setExcludeExerciseId] = useState<string | null>(null);
  const [swapSourceSplitDayExerciseId, setSwapSourceSplitDayExerciseId] = useState<string | null>(null);

  // The ad-hoc-add flow (§5) always also adds the exercise to the split
  // permanently — that needs the running workout's `split_day_id`, which
  // isn't in the route params (only its id is), so it's fetched once here.
  useEffect(() => {
    if (!workoutId) return;
    void getWorkout(workoutId).then((w) => {
      if (w?.split_day_id) setAddToSplitDayId(w.split_day_id);
    });
  }, [workoutId]);

  // Workout-side swap: look up the outgoing workout_exercise to exclude it
  // from the list, prefill the muscle-group filter with its muscle group,
  // and carry its split link forward so the pick can sync the split slot.
  useEffect(() => {
    if (!swapId) return;
    void getWorkoutExercise(swapId).then((we) => {
      if (!we) return;
      setExcludeExerciseId(we.exercise_id);
      setSwapSourceSplitDayExerciseId(we.source_split_day_exercise_id);
      void getExercise(we.exercise_id).then((ex) => {
        if (ex) setMuscle(ex.muscle_group);
      });
    });
  }, [swapId]);

  // Split-side swap (Today screen, pre-workout): same exclusion/prefill,
  // no session link to carry — this one already edits the split directly.
  useEffect(() => {
    if (!swapDayExerciseId) return;
    void getDayExercise(swapDayExerciseId).then((de) => {
      if (!de) return;
      setExcludeExerciseId(de.exercise_id);
      void getExercise(de.exercise_id).then((ex) => {
        if (ex) setMuscle(ex.muscle_group);
      });
    });
  }, [swapDayExerciseId]);

  // Reload on every focus, not just mount — returning here after "+ New
  // Exercise" (a separate pushed screen) must show the exercise you just
  // created without the screen ever remounting.
  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      (async () => {
        const exercises = await listExercises();
        if (!cancelled) {
          setAll(exercises);
          setLoading(false);
        }
      })();
      return () => {
        cancelled = true;
      };
    }, []),
  );

  // ~150-200 rows total — filtering client-side after one load is simpler
  // and faster than a DB round trip per keystroke.
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return all.filter((ex) => {
      if (excludeExerciseId && ex.id === excludeExerciseId) return false;
      if (q && !ex.name.toLowerCase().includes(q)) return false;
      if (muscle && ex.muscle_group !== muscle) return false;
      if (equipment && ex.equipment !== equipment) return false;
      return true;
    });
  }, [all, search, muscle, equipment, excludeExerciseId]);

  const handlePick = useCallback(
    async (exercise: Exercise) => {
      if (!isPicker || adding) return;
      setAdding(exercise.id);
      haptics.confirm();
      try {
        if (swapDayExerciseId) {
          await swapExerciseInDay(swapDayExerciseId, exercise.id);
        } else if (swapId) {
          await swapWorkoutExercise(swapId, exercise.id);
          if (swapSourceSplitDayExerciseId) {
            await swapExerciseInDay(swapSourceSplitDayExerciseId, exercise.id);
          }
        } else if (workoutId) {
          // Always synced to the split when the running workout has one —
          // add to the split first so its new row id can be carried onto the
          // workout-side row, letting a later swap/reorder/remove find it.
          const sourceSplitDayExerciseId = addToSplitDayId
            ? await addExerciseToDay(addToSplitDayId, exercise.id)
            : null;
          await addExerciseToWorkout(workoutId, exercise.id, { isAdHoc: true, sourceSplitDayExerciseId });
        } else if (dayId) {
          await addExerciseToDay(dayId, exercise.id);
        }
        router.back();
      } finally {
        setAdding(null);
      }
    },
    [isPicker, adding, dayId, workoutId, swapId, swapDayExerciseId, addToSplitDayId, swapSourceSplitDayExerciseId, router],
  );

  const title =
    swapId || swapDayExerciseId
      ? 'Swap Exercise'
      : workoutId
        ? 'Add Exercise'
        : dayId
          ? 'Add Exercise'
          : 'Exercises';

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={12} style={styles.backButton}>
          <Ionicons name="chevron-back" size={20} color={colors.accent} />
          <Text style={styles.back}>Back</Text>
        </Pressable>
        <Text style={styles.title}>{title}</Text>
        <Pressable onPress={() => router.push('/exercises/new')} hitSlop={12}>
          <Text style={styles.add}>+ New</Text>
        </Pressable>
      </View>

      <View style={styles.searchWrap}>
        <TextInput
          value={search}
          onChangeText={setSearch}
          placeholder="Search exercises"
          placeholderTextColor={colors.textMuted}
          style={styles.search}
          returnKeyType="search"
        />
      </View>

      <FilterChipRow
        label="All muscles"
        options={MUSCLE_GROUPS}
        labels={MUSCLE_LABELS}
        value={muscle}
        onChange={setMuscle}
      />
      <View style={styles.chipGap} />
      <FilterChipRow
        label="All equipment"
        options={EQUIPMENT_TYPES}
        labels={EQUIPMENT_LABELS}
        value={equipment}
        onChange={setEquipment}
      />

      {loading ? (
        <View style={styles.centre}>
          <ActivityIndicator color={colors.accent} />
        </View>
      ) : filtered.length === 0 ? (
        <EmptyState title="No exercises found" body="Try a different search or filter, or add a custom one." />
      ) : (
        <ScrollView contentContainerStyle={styles.list}>
          <GlassSurface style={styles.card}>
            {filtered.map((exercise, index) => (
              <Pressable
                key={exercise.id}
                onPress={() => handlePick(exercise)}
                disabled={!isPicker}
                style={[styles.row, index < filtered.length - 1 && styles.rowDivider]}>
                <View style={styles.rowInfo}>
                  <Text style={styles.rowName}>{exercise.name}</Text>
                  <Text style={styles.rowMeta}>
                    {MUSCLE_LABELS[exercise.muscle_group]} · {EQUIPMENT_LABELS[exercise.equipment]}
                    {exercise.is_custom ? ' · Custom' : ''}
                  </Text>
                </View>
                {isPicker ? (
                  adding === exercise.id ? (
                    <ActivityIndicator color={colors.accent} />
                  ) : (
                    <Text style={styles.rowAdd}>{swapId || swapDayExerciseId ? 'Swap' : '+ Add'}</Text>
                  )
                ) : null}
              </Pressable>
            ))}
          </GlassSurface>
        </ScrollView>
      )}
    </View>
  );
}

/* ------------------------------------------------------------------- rows */

interface FilterChipRowProps<T extends string> {
  label: string;
  options: T[];
  labels: Record<T, string>;
  value: T | null;
  onChange: (value: T | null) => void;
}

function FilterChipRow<T extends string>({ label, options, labels, value, onChange }: FilterChipRowProps<T>) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
      <Chip label={label} active={value === null} onPress={() => onChange(null)} />
      {options.map((opt) => (
        <Chip key={opt} label={labels[opt]} active={value === opt} onPress={() => onChange(opt)} />
      ))}
    </ScrollView>
  );
}

function Chip({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <Pressable
      onPress={() => {
        haptics.tick();
        onPress();
      }}
      style={[styles.chip, active && styles.chipActive]}>
      <Text style={[styles.chipText, active && styles.chipTextActive]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  centre: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  backButton: { flexDirection: 'row', alignItems: 'center' },
  back: { color: colors.accent, fontSize: font.body, fontWeight: '700' },
  add: { color: colors.accent, fontSize: font.body, fontWeight: '700' },
  title: { color: colors.text, fontSize: font.heading, fontWeight: '800' },
  searchWrap: { paddingHorizontal: spacing.lg, marginBottom: spacing.sm },
  search: {
    minHeight: 48,
    borderRadius: radius.md,
    backgroundColor: glass.panel,
    borderWidth: 1,
    borderColor: glass.border,
    color: colors.text,
    fontSize: font.body,
    paddingHorizontal: spacing.lg,
  },
  chipRow: { gap: spacing.sm, paddingHorizontal: spacing.lg },
  chipGap: { height: spacing.md },
  chip: {
    minHeight: 40,
    paddingHorizontal: spacing.md,
    borderRadius: radius.pill,
    backgroundColor: glass.panel,
    borderWidth: 1,
    borderColor: glass.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chipActive: { backgroundColor: colors.accent, borderColor: colors.accent },
  chipText: { color: colors.textSecondary, fontSize: font.caption, fontWeight: '700' },
  chipTextActive: { color: colors.onAccent },
  list: { padding: spacing.lg, paddingTop: spacing.md, paddingBottom: spacing.xxxl },
  card: { padding: spacing.md },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xs,
    gap: spacing.md,
  },
  rowDivider: { borderBottomWidth: 1, borderBottomColor: colors.border },
  rowInfo: { flex: 1 },
  rowName: { color: colors.text, fontSize: font.body, fontWeight: '600' },
  rowMeta: { color: colors.textSecondary, fontSize: font.caption, marginTop: 1 },
  rowAdd: { color: colors.accent, fontSize: font.caption, fontWeight: '700' },
});
