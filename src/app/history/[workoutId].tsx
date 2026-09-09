import { Ionicons } from '@expo/vector-icons';
import { useCallback, useEffect, useState } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { EmptyState } from '@/components/EmptyState';
import { GlassSurface } from '@/components/GlassSurface';
import { PrimaryButton } from '@/components/PrimaryButton';
import { Stepper } from '@/components/Stepper';
import type { AppSettings, Exercise, Workout, WorkoutExercise, WorkoutSet } from '@/db/types';
import * as haptics from '@/lib/haptics';
import { formatDuration, formatLongDate } from '@/lib/format';
import { displayStep, formatWeight, fromDisplay, toDisplay, UNIT_LABEL } from '@/lib/units';
import { getExercisesByIds } from '@/queries/exercises';
import { getSettings } from '@/queries/settings';
import {
  deleteSet,
  deleteWorkout,
  getSetsFor,
  getWorkout,
  getWorkoutExercises,
  updateSet,
} from '@/queries/workouts';
import { colors, font, glass, radius, spacing } from '@/theme/tokens';

interface ExerciseSection {
  workoutExercise: WorkoutExercise;
  exercise: Exercise;
  sets: WorkoutSet[];
}

/**
 * A past session — Phase 2 makes this fully editable (the PRD's §6): edit
 * any logged set, or delete the whole session. Block 12 shipped this same
 * screen read-only; the load/render shape is unchanged, this just adds
 * mutation on top of it.
 */
export default function SessionDetailScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { workoutId } = useLocalSearchParams<{ workoutId: string }>();

  const [loading, setLoading] = useState(true);
  const [workout, setWorkout] = useState<Workout | null>(null);
  const [sections, setSections] = useState<ExerciseSection[]>([]);
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [editingSetId, setEditingSetId] = useState<string | null>(null);
  const [draftWeight, setDraftWeight] = useState(0);
  const [draftReps, setDraftReps] = useState(0);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    const [w, appSettings] = await Promise.all([getWorkout(workoutId), getSettings()]);
    if (!w) {
      setWorkout(null);
      setLoading(false);
      return;
    }

    const workoutExercises = await getWorkoutExercises(workoutId);
    const exMap = await getExercisesByIds(workoutExercises.map((we) => we.exercise_id));
    const withSets = await Promise.all(
      workoutExercises.map(async (we) => ({
        workoutExercise: we,
        exercise: exMap.get(we.exercise_id),
        sets: await getSetsFor(we.id),
      })),
    );

    setWorkout(w);
    setSettings(appSettings);
    setSections(
      withSets
        .filter((s): s is ExerciseSection => s.exercise != null)
        .map((s) => ({ ...s, exercise: s.exercise! })),
    );
    setLoading(false);
  }, [workoutId]);

  useEffect(() => {
    void load();
  }, [load]);

  const beginEdit = (set: WorkoutSet) => {
    if (!settings) return;
    setEditingSetId(set.id);
    setDraftWeight(toDisplay(set.weight_kg, settings.units));
    setDraftReps(set.reps);
  };

  const cancelEdit = () => setEditingSetId(null);

  const saveEdit = async () => {
    if (!editingSetId || !settings || saving) return;
    setSaving(true);
    haptics.confirm();
    try {
      await updateSet(editingSetId, {
        weightKg: fromDisplay(draftWeight, settings.units),
        reps: draftReps,
      });
      setEditingSetId(null);
      await load();
    } finally {
      setSaving(false);
    }
  };

  const openMenu = (set: WorkoutSet, label: string) => {
    if (!settings) return;
    Alert.alert(
      label,
      `${formatWeight(toDisplay(set.weight_kg, settings.units))} ${UNIT_LABEL[settings.units]} × ${set.reps}`,
      [
        { text: 'Edit', onPress: () => beginEdit(set) },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            haptics.warn();
            void deleteSet(set.id).then(load);
          },
        },
        { text: 'Cancel', style: 'cancel' },
      ],
    );
  };

  const handleDeleteWorkout = () => {
    if (!workout) return;
    Alert.alert('Delete this workout?', 'This removes the whole session and every set in it.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => {
          haptics.warn();
          void deleteWorkout(workout.id).then(() => router.replace('/history'));
        },
      },
    ]);
  };

  if (loading || (workout && !settings)) {
    return (
      <View style={[styles.screen, styles.centre]}>
        <ActivityIndicator color={colors.accent} size="large" />
      </View>
    );
  }

  if (!workout || !settings) {
    return (
      <View style={[styles.screen, { paddingTop: insets.top }]}>
        <EmptyState
          title="Workout not found"
          body="This session may have been deleted."
          actionLabel="Back"
          onAction={() => router.back()}
        />
      </View>
    );
  }

  const unitLabel = UNIT_LABEL[settings.units];
  const step = displayStep(settings);

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={12} style={styles.backButton}>
          <Ionicons name="chevron-back" size={20} color={colors.accent} />
          <Text style={styles.back}>History</Text>
        </Pressable>
        <Pressable onPress={handleDeleteWorkout} hitSlop={12}>
          <Text style={styles.deleteWorkout}>Delete</Text>
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={styles.titleWrap}>
          <Text style={styles.dayName}>{workout.day_name}</Text>
          <Text style={styles.date}>{formatLongDate(workout.started_at)}</Text>
          <Text style={styles.duration}>{formatDuration(workout.duration_seconds)}</Text>
        </View>

        {sections.map((section) => {
          const topLevel = section.sets.filter((s) => s.parent_set_id === null);
          const childrenOf = (parentId: string) =>
            section.sets.filter((s) => s.parent_set_id === parentId).sort((a, b) => a.position - b.position);

          const label = (set: WorkoutSet, index: number, drop: boolean) =>
            drop ? `${section.exercise.name}, drop` : `${section.exercise.name}, set ${index}`;

          return (
            <GlassSurface key={section.workoutExercise.id} style={styles.card}>
              <Text style={styles.exerciseName}>{section.exercise.name}</Text>
              {topLevel.map((set, index) => (
                <View key={set.id} style={styles.setGroup}>
                  {editingSetId === set.id ? (
                    <EditCard
                      weight={draftWeight}
                      reps={draftReps}
                      step={step}
                      unitLabel={unitLabel}
                      onWeightChange={setDraftWeight}
                      onRepsChange={setDraftReps}
                      onCancel={cancelEdit}
                      onSave={saveEdit}
                      saving={saving}
                    />
                  ) : (
                    <SetRow
                      index={index + 1}
                      set={set}
                      unitLabel={unitLabel}
                      units={settings.units}
                      onMenu={() => openMenu(set, label(set, index + 1, false))}
                    />
                  )}
                  {childrenOf(set.id).map((child) =>
                    editingSetId === child.id ? (
                      <EditCard
                        key={child.id}
                        weight={draftWeight}
                        reps={draftReps}
                        step={step}
                        unitLabel={unitLabel}
                        onWeightChange={setDraftWeight}
                        onRepsChange={setDraftReps}
                        onCancel={cancelEdit}
                        onSave={saveEdit}
                        saving={saving}
                        drop
                      />
                    ) : (
                      <SetRow
                        key={child.id}
                        set={child}
                        unitLabel={unitLabel}
                        units={settings.units}
                        onMenu={() => openMenu(child, label(child, 0, true))}
                        drop
                      />
                    ),
                  )}
                </View>
              ))}
            </GlassSurface>
          );
        })}
      </ScrollView>
    </View>
  );
}

function SetRow({
  set,
  unitLabel,
  units,
  index,
  drop,
  onMenu,
}: {
  set: WorkoutSet;
  unitLabel: string;
  units: 'kg' | 'lb';
  index?: number;
  drop?: boolean;
  onMenu: () => void;
}) {
  return (
    <View style={[styles.row, drop && styles.rowDrop]}>
      <Text style={[styles.rowIndex, drop && styles.rowIndexDrop]}>{drop ? '→' : index}</Text>
      <Text style={[styles.rowText, drop && styles.rowTextDrop]}>
        {formatWeight(toDisplay(set.weight_kg, units))} {unitLabel} × {set.reps}
      </Text>
      {set.set_type === 'warmup' ? <Text style={[styles.tag, styles.tagWarmup]}>WU</Text> : null}
      {set.to_failure === 1 ? <Text style={[styles.tag, styles.tagFailure]}>TF</Text> : null}
      <Pressable onPress={onMenu} hitSlop={8}>
        <Ionicons name="ellipsis-vertical" size={16} color={colors.textMuted} />
      </Pressable>
    </View>
  );
}

interface EditCardProps {
  weight: number;
  reps: number;
  step: number;
  unitLabel: string;
  onWeightChange: (v: number) => void;
  onRepsChange: (v: number) => void;
  onCancel: () => void;
  onSave: () => void;
  saving: boolean;
  drop?: boolean;
}

function EditCard({
  weight,
  reps,
  step,
  unitLabel,
  onWeightChange,
  onRepsChange,
  onCancel,
  onSave,
  saving,
  drop,
}: EditCardProps) {
  return (
    <View style={[styles.editCard, drop && styles.rowDrop]}>
      <View style={styles.editHead}>
        <Text style={styles.editLabel}>Editing</Text>
        <Pressable onPress={onCancel} hitSlop={8}>
          <Text style={styles.editCancel}>Cancel</Text>
        </Pressable>
      </View>
      <Stepper
        value={weight}
        onChange={onWeightChange}
        step={step}
        min={0}
        max={500}
        format={formatWeight}
        unitLabel={unitLabel}
        allowDecimal
        accessibilityLabel="weight"
      />
      <Stepper value={reps} onChange={onRepsChange} step={1} min={1} max={100} unitLabel="reps" accessibilityLabel="reps" />
      <PrimaryButton label="Save Changes" onPress={onSave} loading={saving} />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  centre: { alignItems: 'center', justifyContent: 'center' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  backButton: { flexDirection: 'row', alignItems: 'center' },
  back: { color: colors.accent, fontSize: font.body, fontWeight: '700' },
  deleteWorkout: { color: colors.danger, fontSize: font.body, fontWeight: '700' },
  content: { padding: spacing.lg, paddingTop: 0, paddingBottom: spacing.xxxl, gap: spacing.xl },
  titleWrap: { alignItems: 'center', gap: 2, marginBottom: spacing.md },
  dayName: { color: colors.text, fontSize: font.title, fontWeight: '800' },
  date: { color: colors.textSecondary, fontSize: font.label },
  duration: { color: colors.accent, fontSize: font.caption, fontWeight: '700', marginTop: 2 },
  card: { padding: spacing.lg, gap: spacing.md },
  exerciseName: { color: colors.text, fontSize: font.body, fontWeight: '700', marginBottom: spacing.xs },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    backgroundColor: glass.panel,
    borderRadius: radius.sm,
  },
  setGroup: { gap: spacing.md },
  rowDrop: { marginLeft: spacing.xl, backgroundColor: 'transparent' },
  rowIndex: {
    color: colors.textMuted,
    fontSize: font.caption,
    fontWeight: '700',
    minWidth: 18,
    fontVariant: ['tabular-nums'],
  },
  rowIndexDrop: { color: colors.drop },
  rowText: { flex: 1, color: colors.text, fontSize: font.body, fontWeight: '600', fontVariant: ['tabular-nums'] },
  rowTextDrop: { color: colors.drop, fontSize: font.label },
  tag: {
    fontSize: font.micro,
    fontWeight: '800',
    letterSpacing: 0.6,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: radius.sm,
    overflow: 'hidden',
  },
  tagWarmup: { color: colors.warmup, backgroundColor: 'rgba(91, 168, 255, 0.14)' },
  tagFailure: { color: colors.failure, backgroundColor: 'rgba(255, 138, 61, 0.14)' },
  editCard: {
    padding: spacing.md,
    gap: spacing.sm,
    backgroundColor: glass.panelRaised,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: glass.borderStrong,
    marginBottom: spacing.xs,
  },
  editHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  editLabel: {
    color: colors.textMuted,
    fontSize: font.micro,
    fontWeight: '700',
    letterSpacing: 1.4,
    textTransform: 'uppercase',
  },
  editCancel: { color: colors.textSecondary, fontSize: font.label, fontWeight: '600' },
});
