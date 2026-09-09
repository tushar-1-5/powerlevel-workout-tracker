import { Ionicons } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useRouter } from 'expo-router';
import { Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { GlassSurface } from '@/components/GlassSurface';
import { PrimaryButton } from '@/components/PrimaryButton';
import { Stepper } from '@/components/Stepper';
import type { Split, SplitDay } from '@/db/types';
import * as haptics from '@/lib/haptics';
import { formatLongDate } from '@/lib/format';
import { getDayExercises, getSplitDays, listSplits } from '@/queries/splits';
import { startWorkout } from '@/queries/workouts';
import { colors, font, glass, radius, spacing } from '@/theme/tokens';

/**
 * "Log a Past Workout" from the PRD's §6 — picks a date, split, day, and a
 * duration (asked up front since `finishWorkout`'s usual wall-clock math
 * would be nonsense for a session you're logging days later), then reuses
 * the real logging pager for the actual set entry. No separate "backfill
 * entry UI" exists — this screen's only job is creating the workout row
 * `workout/log.tsx` then takes over completely.
 */
export default function BackfillScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const [date, setDate] = useState(() => new Date());
  const [showPicker, setShowPicker] = useState(false);
  const [splits, setSplits] = useState<Split[]>([]);
  const [splitId, setSplitId] = useState<string | null>(null);
  const [days, setDays] = useState<SplitDay[]>([]);
  const [dayId, setDayId] = useState<string | null>(null);
  const [minutes, setMinutes] = useState(45);
  const [durationUnknown, setDurationUnknown] = useState(false);
  const [starting, setStarting] = useState(false);

  useEffect(() => {
    void listSplits().then((list) => {
      setSplits(list);
      if (list.length > 0) setSplitId(list[0].id);
    });
  }, []);

  useEffect(() => {
    if (!splitId) {
      setDays([]);
      setDayId(null);
      return;
    }
    void getSplitDays(splitId).then((list) => {
      setDays(list);
      setDayId(list[0]?.id ?? null);
    });
  }, [splitId]);

  const canStart = !!splitId && !!dayId && !starting;

  const handleStart = async () => {
    if (!canStart || !dayId) return;
    const day = days.find((d) => d.id === dayId);
    if (!day || !splitId) return;

    setStarting(true);
    haptics.confirm();
    try {
      const dayExercises = await getDayExercises(dayId);
      // Noon, not midnight — sidesteps any DST/timezone edge landing the
      // timestamp on the wrong side of a day boundary elsewhere in the app.
      const startedAt = new Date(date.getFullYear(), date.getMonth(), date.getDate(), 12).getTime();

      const workoutId = await startWorkout({
        splitId,
        splitDayId: dayId,
        dayName: day.name,
        exerciseIds: dayExercises.map((de) => de.exercise_id),
        startedAt,
      });

      router.replace({
        pathname: '/workout/log',
        params: durationUnknown
          ? { workoutId, backfillDurationUnknown: 'true' }
          : { workoutId, backfillDurationSeconds: String(minutes * 60) },
      });
    } catch {
      haptics.warn();
      setStarting(false);
    }
  };

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={12} style={styles.backButton}>
          <Ionicons name="chevron-back" size={20} color={colors.accent} />
          <Text style={styles.back}>Cancel</Text>
        </Pressable>
        <Text style={styles.title}>Log a Past Workout</Text>
        <View style={styles.backSpacer} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.section}>
          <Text style={styles.label}>Date</Text>
          <Pressable style={styles.dateButton} onPress={() => setShowPicker(true)}>
            <Text style={styles.dateText}>{formatLongDate(date.getTime())}</Text>
          </Pressable>
          {showPicker ? (
            <DateTimePicker
              value={date}
              mode="date"
              display={Platform.OS === 'ios' ? 'inline' : 'default'}
              maximumDate={new Date()}
              onChange={(event, selected) => {
                setShowPicker(Platform.OS === 'ios');
                if (event.type === 'set' && selected) setDate(selected);
              }}
            />
          ) : null}
        </View>

        {splits.length === 0 ? (
          <Text style={styles.hint}>Create a split first to backfill a workout against it.</Text>
        ) : (
          <>
            <View style={styles.section}>
              <Text style={styles.label}>Split</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
                {splits.map((s) => (
                  <Chip key={s.id} label={s.name} active={s.id === splitId} onPress={() => setSplitId(s.id)} />
                ))}
              </ScrollView>
            </View>

            <View style={styles.section}>
              <Text style={styles.label}>Day</Text>
              {days.length === 0 ? (
                <Text style={styles.hint}>This split has no day-groups yet.</Text>
              ) : (
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
                  {days.map((d) => (
                    <Chip key={d.id} label={d.name} active={d.id === dayId} onPress={() => setDayId(d.id)} />
                  ))}
                </ScrollView>
              )}
            </View>
          </>
        )}

        <View style={styles.section}>
          <Text style={styles.label}>How long did it take?</Text>
          <GlassSurface style={[styles.stepCard, durationUnknown && styles.stepCardDisabled]}>
            <View pointerEvents={durationUnknown ? 'none' : 'auto'}>
              <Stepper
                value={minutes}
                onChange={setMinutes}
                step={5}
                min={5}
                max={240}
                unitLabel="minutes"
                accessibilityLabel="workout duration"
                disabled={durationUnknown}
              />
            </View>
          </GlassSurface>
          <Pressable
            onPress={() => {
              haptics.tick();
              setDurationUnknown((v) => !v);
            }}
            style={styles.unknownToggle}
            accessibilityRole="checkbox"
            accessibilityState={{ checked: durationUnknown }}>
            <Ionicons
              name={durationUnknown ? 'checkbox' : 'square-outline'}
              size={20}
              color={durationUnknown ? colors.accent : colors.textMuted}
            />
            <Text style={[styles.unknownToggleText, durationUnknown && styles.unknownToggleTextActive]}>
              I don't remember
            </Text>
          </Pressable>
        </View>
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: insets.bottom + spacing.md }]}>
        <PrimaryButton label="Start Logging" onPress={handleStart} disabled={!canStart} loading={starting} />
      </View>
    </View>
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
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  backButton: { flexDirection: 'row', alignItems: 'center' },
  back: { color: colors.accent, fontSize: font.body, fontWeight: '700' },
  backSpacer: { width: 60 },
  title: { color: colors.text, fontSize: font.heading, fontWeight: '800' },
  content: { padding: spacing.lg, paddingBottom: spacing.xxxl, gap: spacing.xl },
  section: { gap: spacing.sm },
  label: {
    color: colors.textMuted,
    fontSize: font.micro,
    fontWeight: '700',
    letterSpacing: 1.4,
    textTransform: 'uppercase',
  },
  hint: { color: colors.textSecondary, fontSize: font.caption },
  dateButton: {
    minHeight: 52,
    borderRadius: radius.md,
    backgroundColor: glass.panel,
    borderWidth: 1,
    borderColor: glass.border,
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
  },
  dateText: { color: colors.text, fontSize: font.body, fontWeight: '700' },
  chipRow: { gap: spacing.sm },
  chip: {
    minHeight: 44,
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
  stepCard: { padding: spacing.lg },
  stepCardDisabled: { opacity: 0.4 },
  unknownToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    minHeight: 44,
    paddingHorizontal: spacing.xs,
  },
  unknownToggleText: { color: colors.textMuted, fontSize: font.label, fontWeight: '600' },
  unknownToggleTextActive: { color: colors.text },
  footer: { padding: spacing.lg, paddingTop: spacing.sm },
});
