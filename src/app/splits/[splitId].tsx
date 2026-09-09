import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import { useCallback, useRef, useState } from 'react';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import {
  ActivityIndicator,
  Alert,
  Keyboard,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { DragList } from '@/components/DragList';
import { EmptyState } from '@/components/EmptyState';
import { GlassSurface } from '@/components/GlassSurface';
import type { ScheduleMode, Split, SplitDay } from '@/db/types';
import * as haptics from '@/lib/haptics';
import { WEEKDAY_LABELS } from '@/lib/format';
import {
  createSplitDay,
  deleteSplitDay,
  getSplit,
  getSplitDays,
  reorderSplitDays,
  updateSplit,
  updateSplitDay,
} from '@/queries/splits';
import { colors, font, glass, radius, spacing } from '@/theme/tokens';

const ROW_HEIGHT = 84;

/** The split editor from the PRD's nav table: schedule mode, day-groups w/ drag-reorder, weekday assignment. */
export default function SplitEditorScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { splitId } = useLocalSearchParams<{ splitId: string }>();

  const [loading, setLoading] = useState(true);
  const [split, setSplit] = useState<Split | null>(null);
  const [days, setDays] = useState<SplitDay[]>([]);
  const [editingName, setEditingName] = useState(false);
  const [nameDraft, setNameDraft] = useState('');
  const [newDayName, setNewDayName] = useState('');
  const scrollRef = useRef<ScrollView>(null);

  const load = useCallback(async () => {
    const [s, d] = await Promise.all([getSplit(splitId), getSplitDays(splitId)]);
    setSplit(s);
    setDays(d);
    setLoading(false);
  }, [splitId]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const setMode = async (mode: ScheduleMode) => {
    if (!split || mode === split.schedule_mode) return;
    haptics.tick();
    await updateSplit(split.id, { scheduleMode: mode });
    await load();
  };

  const commitName = async () => {
    setEditingName(false);
    const trimmed = nameDraft.trim();
    if (!split || trimmed.length === 0 || trimmed === split.name) return;
    await updateSplit(split.id, { name: trimmed });
    await load();
  };

  const handleReorder = async (next: SplitDay[]) => {
    setDays(next);
    await reorderSplitDays(next.map((d) => d.id));
  };

  const assignWeekday = async (dayId: string, weekday: number) => {
    haptics.tick();
    const target = days.find((d) => d.id === dayId);
    const holder = days.find((d) => d.weekday === weekday && d.id !== dayId);
    if (holder) await updateSplitDay(holder.id, { weekday: null });
    await updateSplitDay(dayId, { weekday: target?.weekday === weekday ? null : weekday });
    await load();
  };

  const handleAddDay = async () => {
    const trimmed = newDayName.trim();
    if (!split || trimmed.length === 0) return;
    haptics.confirm();
    setNewDayName('');
    await createSplitDay(split.id, trimmed);
    await load();
    // The new day lands at the end of the list, directly above the add-row
    // input the keyboard was just open for — without dismissing it and
    // scrolling, the freshly-added row can render right behind the keyboard
    // and never actually become visible, even though it mounted correctly.
    Keyboard.dismiss();
    requestAnimationFrame(() => scrollRef.current?.scrollToEnd({ animated: true }));
  };

  const handleDeleteDay = (day: SplitDay) => {
    Alert.alert(`Delete "${day.name}"?`, 'Its exercises are removed too. Past workouts keep their own record.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => {
          haptics.warn();
          void deleteSplitDay(day.id).then(load);
        },
      },
    ]);
  };

  if (loading || !split) {
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
          <Text style={styles.back}>Splits</Text>
        </Pressable>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView ref={scrollRef} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
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
              setNameDraft(split.name);
              setEditingName(true);
            }}>
            <Text style={styles.title}>{split.name}</Text>
            <Text style={styles.titleHint}>Tap to rename</Text>
          </Pressable>
        )}

        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Schedule mode</Text>
          <View style={styles.segmented}>
            <SegmentButton label="Rotation" active={split.schedule_mode === 'rotation'} onPress={() => setMode('rotation')} />
            <SegmentButton label="Calendar" active={split.schedule_mode === 'calendar'} onPress={() => setMode('calendar')} />
          </View>
          <Text style={styles.sectionHint}>
            {split.schedule_mode === 'rotation'
              ? 'Today suggests whichever day comes after your last finished workout.'
              : 'Assign each day-group to a weekday below. Unassigned weekdays are rest days.'}
          </Text>
        </View>

        <View style={styles.section}>
          <View style={styles.sectionLabelRow}>
            <Text style={styles.sectionLabel}>Day groups — drag</Text>
            <MaterialIcons name="drag-handle" size={14} color={colors.textMuted} />
            <Text style={styles.sectionLabel}>to reorder</Text>
          </View>

          {days.length === 0 ? (
            <EmptyState title="No day-groups yet" body="Add one below to start building this split." />
          ) : (
            <DragList
              data={days}
              keyExtractor={(d) => d.id}
              itemHeight={ROW_HEIGHT}
              onReorder={handleReorder}
              renderItem={(day) => (
                <DayRow
                  day={day}
                  scheduleMode={split.schedule_mode}
                  onOpen={() =>
                    router.push({
                      pathname: '/splits/[splitId]/day/[dayId]',
                      params: { splitId: split.id, dayId: day.id },
                    })
                  }
                  onDelete={() => handleDeleteDay(day)}
                  onAssignWeekday={(weekday) => assignWeekday(day.id, weekday)}
                />
              )}
            />
          )}

          <View style={styles.addRow}>
            <TextInput
              value={newDayName}
              onChangeText={setNewDayName}
              placeholder="New day-group name"
              placeholderTextColor={colors.textMuted}
              style={styles.addInput}
              onSubmitEditing={handleAddDay}
              returnKeyType="done"
            />
            <Pressable onPress={handleAddDay} hitSlop={8}>
              <GlassSurface style={styles.addButton}>
                <Text style={styles.addButtonText}>+ Add</Text>
              </GlassSurface>
            </Pressable>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

/* ------------------------------------------------------------------- rows */

function SegmentButton({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <Pressable
      onPress={() => {
        haptics.tick();
        onPress();
      }}
      style={[styles.segment, active && styles.segmentActive]}>
      <Text style={[styles.segmentText, active && styles.segmentTextActive]}>{label}</Text>
    </Pressable>
  );
}

interface DayRowProps {
  day: SplitDay;
  scheduleMode: ScheduleMode;
  onOpen: () => void;
  onDelete: () => void;
  onAssignWeekday: (weekday: number) => void;
}

function DayRow({ day, scheduleMode, onOpen, onDelete, onAssignWeekday }: DayRowProps) {
  return (
    <View style={styles.dayRow}>
      <Pressable style={styles.dayCard} onPress={onOpen}>
        <View style={styles.dayCardTop}>
          <Text style={styles.dayName}>{day.name}</Text>
          <Pressable onPress={onDelete} hitSlop={8}>
            <Ionicons name="close" size={18} color={colors.textMuted} />
          </Pressable>
        </View>
        {scheduleMode === 'calendar' ? (
          <View style={styles.weekdayRow}>
            {WEEKDAY_LABELS.map((label, index) => {
              const active = day.weekday === index;
              return (
                <Pressable
                  key={label}
                  onPress={() => onAssignWeekday(index)}
                  style={[styles.weekdayChip, active && styles.weekdayChipActive]}
                  hitSlop={4}>
                  <Text style={[styles.weekdayText, active && styles.weekdayTextActive]}>{label[0]}</Text>
                </Pressable>
              );
            })}
          </View>
        ) : (
          <Text style={styles.dayHint}>Tap to edit exercises ›</Text>
        )}
      </Pressable>
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
  content: { padding: spacing.lg, paddingBottom: spacing.xxxl, gap: spacing.xl },
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
  section: { gap: spacing.sm },
  sectionLabelRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  sectionLabel: {
    color: colors.textMuted,
    fontSize: font.micro,
    fontWeight: '700',
    letterSpacing: 1.4,
    textTransform: 'uppercase',
  },
  sectionHint: { color: colors.textSecondary, fontSize: font.caption },
  segmented: { flexDirection: 'row', gap: spacing.sm },
  segment: {
    flex: 1,
    minHeight: 48,
    borderRadius: radius.md,
    backgroundColor: glass.panel,
    borderWidth: 1,
    borderColor: glass.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  segmentActive: { backgroundColor: colors.accent, borderColor: colors.accent },
  segmentText: { color: colors.textSecondary, fontSize: font.label, fontWeight: '700' },
  segmentTextActive: { color: colors.onAccent },
  dayRow: { paddingVertical: 4, paddingRight: spacing.xs },
  // `minHeight` + `justifyContent: 'center'` are a deliberate floor, not
  // decoration — inside DragList's fixed-height row, this card's own height
  // otherwise depends entirely on its children sizing themselves correctly,
  // and on-device this card has been reported rendering collapsed to just
  // its own padding (which, at this radius, reads as a pill with nothing in
  // it). A hard minimum height means that can't happen regardless of what's
  // causing the collapse.
  dayCard: {
    flex: 1,
    minHeight: 68,
    padding: spacing.md,
    borderRadius: radius.md,
    backgroundColor: glass.panel,
    borderWidth: 1,
    borderColor: glass.border,
    gap: spacing.xs,
    justifyContent: 'center',
  },
  dayCardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 24,
  },
  dayName: { color: colors.text, fontSize: font.body, fontWeight: '700', lineHeight: 22 },
  dayHint: { color: colors.textMuted, fontSize: font.caption, lineHeight: 16 },
  weekdayRow: { flexDirection: 'row', gap: 6 },
  weekdayChip: {
    width: 28,
    height: 28,
    borderRadius: radius.pill,
    backgroundColor: glass.panelRaised,
    borderWidth: 1,
    borderColor: glass.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  weekdayChipActive: { backgroundColor: colors.accent, borderColor: colors.accent },
  weekdayText: { color: colors.textSecondary, fontSize: font.micro, fontWeight: '700' },
  weekdayTextActive: { color: colors.onAccent },
  addRow: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.sm },
  addInput: {
    flex: 1,
    minHeight: 48,
    borderRadius: radius.md,
    backgroundColor: glass.panel,
    borderWidth: 1,
    borderColor: glass.border,
    color: colors.text,
    fontSize: font.body,
    paddingHorizontal: spacing.md,
  },
  addButton: {
    minHeight: 48,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.md,
    backgroundColor: colors.accentSoft,
    borderColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addButtonText: { color: colors.accent, fontSize: font.label, fontWeight: '700' },
});
