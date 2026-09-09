import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import { useCallback, useState } from 'react';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { DragList } from '@/components/DragList';
import { EmptyState } from '@/components/EmptyState';
import { GlassSurface } from '@/components/GlassSurface';
import type { Exercise, SplitDay } from '@/db/types';
import * as haptics from '@/lib/haptics';
import { exercisesPickerHref } from '@/lib/routes';
import { getExercisesByIds } from '@/queries/exercises';
import {
  getSplitDays,
  getDayExercises,
  removeExerciseFromDay,
  reorderDayExercises,
  updateSplitDay,
  type DayExercise,
} from '@/queries/splits';
import { colors, font, radius, spacing } from '@/theme/tokens';

const ROW_HEIGHT = 68;

interface Row {
  dayExerciseId: string;
  exercise: Exercise;
}

/** The day editor from the PRD's nav table: ordered exercises, drag-reorder, add from library. */
export default function DayEditorScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { splitId, dayId } = useLocalSearchParams<{ splitId: string; dayId: string }>();

  const [loading, setLoading] = useState(true);
  const [day, setDay] = useState<SplitDay | null>(null);
  const [rows, setRows] = useState<Row[]>([]);
  const [editingName, setEditingName] = useState(false);
  const [nameDraft, setNameDraft] = useState('');

  const load = useCallback(async () => {
    const [days, dayExercises] = await Promise.all([getSplitDays(splitId), getDayExercises(dayId)]);
    const thisDay = days.find((d) => d.id === dayId) ?? null;
    const exMap = await getExercisesByIds(dayExercises.map((de: DayExercise) => de.exercise_id));
    setDay(thisDay);
    setRows(
      dayExercises
        .map((de: DayExercise) => {
          const exercise = exMap.get(de.exercise_id);
          return exercise ? { dayExerciseId: de.id, exercise } : null;
        })
        .filter((r): r is Row => r !== null),
    );
    setLoading(false);
  }, [splitId, dayId]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const commitName = async () => {
    setEditingName(false);
    const trimmed = nameDraft.trim();
    if (!day || trimmed.length === 0 || trimmed === day.name) return;
    await updateSplitDay(day.id, { name: trimmed });
    await load();
  };

  const handleReorder = async (next: Row[]) => {
    setRows(next);
    await reorderDayExercises(next.map((r) => r.dayExerciseId));
  };

  const handleRemove = async (row: Row) => {
    haptics.warn();
    await removeExerciseFromDay(row.dayExerciseId);
    await load();
  };

  if (loading || !day) {
    return (
      <View style={[styles.screen, styles.centre]}>
        <ActivityIndicator color={colors.accent} size="large" />
      </View>
    );
  }

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={12} style={styles.backButton}>
          <Ionicons name="chevron-back" size={20} color={colors.accent} />
          <Text style={styles.back}>Back</Text>
        </Pressable>
        <View style={styles.headerSpacer} />
      </View>

      <View style={styles.titleWrap}>
        {editingName ? (
          <TextInput
            value={nameDraft}
            onChangeText={setNameDraft}
            onBlur={commitName}
            onSubmitEditing={commitName}
            autoFocus
            selectTextOnFocus
            style={styles.titleInput}
          />
        ) : (
          <Pressable
            onPress={() => {
              setNameDraft(day.name);
              setEditingName(true);
            }}>
            <Text style={styles.title}>{day.name}</Text>
            <Text style={styles.titleHint}>Tap to rename</Text>
          </Pressable>
        )}
      </View>

      {rows.length === 0 ? (
        <EmptyState
          title="No exercises yet"
          body="Add from the library to build this day-group."
          actionLabel="Add from Library"
          onAction={() => router.push(exercisesPickerHref(day.id))}
        />
      ) : (
        <View style={styles.list}>
          <View style={styles.sectionLabelRow}>
            <Text style={styles.sectionLabel}>Exercises — drag</Text>
            <MaterialIcons name="drag-handle" size={14} color={colors.textMuted} />
            <Text style={styles.sectionLabel}>to reorder</Text>
          </View>
          <DragList
            data={rows}
            keyExtractor={(r) => r.dayExerciseId}
            itemHeight={ROW_HEIGHT}
            onReorder={handleReorder}
            renderItem={(row) => (
              <GlassSurface style={styles.row}>
                <View style={styles.rowInfo}>
                  <Text style={styles.rowName}>{row.exercise.name}</Text>
                  <Text style={styles.rowMeta}>{row.exercise.muscle_group}</Text>
                </View>
                <Pressable onPress={() => handleRemove(row)} hitSlop={8}>
                  <Ionicons name="close" size={18} color={colors.textMuted} />
                </Pressable>
              </GlassSurface>
            )}
          />
        </View>
      )}

      <View style={[styles.footer, { paddingBottom: insets.bottom + spacing.md }]}>
        <Pressable
          onPress={() => router.push(exercisesPickerHref(day.id))}
          style={styles.addButton}>
          <Text style={styles.addButtonText}>+ Add from Library</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  centre: { alignItems: 'center', justifyContent: 'center' },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.lg, paddingVertical: spacing.md },
  backButton: { flexDirection: 'row', alignItems: 'center' },
  back: { color: colors.accent, fontSize: font.body, fontWeight: '700' },
  headerSpacer: { flex: 1 },
  titleWrap: { paddingHorizontal: spacing.lg, marginBottom: spacing.md },
  title: { color: colors.text, fontSize: font.title, fontWeight: '800' },
  titleHint: { color: colors.textMuted, fontSize: font.caption, marginTop: 2 },
  titleInput: {
    color: colors.text,
    fontSize: font.title,
    fontWeight: '800',
    borderBottomWidth: 2,
    borderBottomColor: colors.accent,
    paddingVertical: 2,
  },
  list: { flex: 1, paddingHorizontal: spacing.lg, gap: spacing.sm },
  sectionLabelRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  sectionLabel: {
    color: colors.textMuted,
    fontSize: font.micro,
    fontWeight: '700',
    letterSpacing: 1.4,
    textTransform: 'uppercase',
  },
  row: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    borderRadius: radius.md,
  },
  rowInfo: { flex: 1 },
  rowName: { color: colors.text, fontSize: font.body, fontWeight: '600' },
  rowMeta: { color: colors.textSecondary, fontSize: font.caption, textTransform: 'capitalize', marginTop: 1 },
  footer: { padding: spacing.lg, paddingTop: spacing.sm },
  addButton: {
    minHeight: 52,
    borderRadius: radius.lg,
    backgroundColor: colors.accentSoft,
    borderWidth: 1,
    borderColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addButtonText: { color: colors.accent, fontSize: font.body, fontWeight: '700' },
});
