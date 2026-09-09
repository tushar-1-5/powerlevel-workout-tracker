import { StyleSheet, Text, View } from 'react-native';

import { useWorkoutTimer } from '@/hooks/useWorkoutTimer';
import { formatLongDate } from '@/lib/format';
import { colors, font, spacing } from '@/theme/tokens';

export interface TodayHeaderProps {
  dayName: string;
  /** Shown only when the selected day is genuinely the suggested one — never
   * label a manually-picked day as "next in your rotation". */
  suggestionCaption?: string | null;
  /** Non-null renders the in-progress state instead of the idle one. */
  startedAt?: number | null;
}

export function TodayHeader({ dayName, suggestionCaption, startedAt = null }: TodayHeaderProps) {
  const timer = useWorkoutTimer(startedAt);

  if (startedAt !== null) {
    return (
      <View style={styles.wrap}>
        <Text style={styles.activeLabel}>Workout in progress</Text>
        <Text style={styles.timer}>{timer}</Text>
        <Text style={styles.dayName}>{dayName}</Text>
      </View>
    );
  }

  return (
    <View style={styles.wrap}>
      <Text style={styles.date}>{formatLongDate(Date.now())}</Text>
      <Text style={styles.dayName}>{dayName}</Text>
      {suggestionCaption ? <Text style={styles.caption}>{suggestionCaption}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { paddingHorizontal: spacing.lg, gap: 2 },
  date: {
    color: colors.textMuted,
    fontSize: font.micro,
    fontWeight: '700',
    letterSpacing: 1.6,
    textTransform: 'uppercase',
  },
  dayName: { color: colors.text, fontSize: font.title, fontWeight: '700' },
  caption: { color: colors.textSecondary, fontSize: font.label },
  activeLabel: {
    color: colors.accent,
    fontSize: font.micro,
    fontWeight: '700',
    letterSpacing: 1.6,
    textTransform: 'uppercase',
  },
  timer: {
    color: colors.text,
    fontSize: font.display,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
    marginVertical: 2,
  },
});
