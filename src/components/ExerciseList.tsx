import { StyleSheet, Text, View } from 'react-native';

import { GlassSurface } from '@/components/GlassSurface';
import { MUSCLE_LABELS, type Exercise } from '@/db/types';
import { colors, font, spacing } from '@/theme/tokens';

export interface ExerciseListProps {
  exercises: Exercise[];
  /** Shown in place of the list when `exercises` is empty. */
  emptyLabel?: string;
}

/**
 * An ordered, read-only list of exercises — no tap action, no drag handle, no
 * ad-hoc add. Generic on purpose: both the Today screen's active-workout view
 * and the in-workout stub screen render the exact same list for the exact
 * same exercises, just at different points before/after a workout exists.
 * The pre-workout suggested-day view on Today is reorderable and swappable,
 * so it uses `DragList` directly instead of this component.
 */
export function ExerciseList({
  exercises,
  emptyLabel = 'Pick a group above to see its exercises.',
}: ExerciseListProps) {
  if (exercises.length === 0) {
    return (
      <GlassSurface style={styles.card}>
        <Text style={styles.empty}>{emptyLabel}</Text>
      </GlassSurface>
    );
  }

  return (
    <GlassSurface style={styles.card}>
      {exercises.map((exercise, index) => (
        <View
          key={exercise.id}
          style={[styles.row, index < exercises.length - 1 && styles.rowDivider]}>
          <Text style={styles.position}>{index + 1}</Text>
          <View style={styles.info}>
            <Text style={styles.name}>{exercise.name}</Text>
            <Text style={styles.muscle}>{MUSCLE_LABELS[exercise.muscle_group]}</Text>
          </View>
        </View>
      ))}
    </GlassSurface>
  );
}

const styles = StyleSheet.create({
  card: { padding: spacing.md },
  empty: {
    color: colors.textMuted,
    fontSize: font.body,
    textAlign: 'center',
    paddingVertical: spacing.md,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xs,
  },
  rowDivider: {
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  position: {
    color: colors.textMuted,
    fontSize: font.caption,
    fontWeight: '700',
    minWidth: 18,
    fontVariant: ['tabular-nums'],
  },
  info: { flex: 1 },
  name: { color: colors.text, fontSize: font.body, fontWeight: '600' },
  muscle: { color: colors.textSecondary, fontSize: font.caption, marginTop: 1 },
});
