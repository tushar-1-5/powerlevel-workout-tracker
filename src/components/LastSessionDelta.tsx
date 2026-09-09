import { StyleSheet, Text, View } from 'react-native';

import { colors, font, glass, radius, spacing } from '@/theme/tokens';

export interface LastSessionDeltaProps {
  /** What you are about to log. */
  current: number;
  /** The same set number last session, or null if there is no history. */
  previous: number | null;
  format?: (value: number) => string;
  /** Trailing unit, e.g. "kg". Omitted for reps. */
  suffix?: string;
}

/**
 * The "last 57.5 ↑" line under a number.
 *
 * Green and red are reserved app-wide for exactly this comparison — they appear
 * nowhere else, so the colour always means one thing: better or worse than last
 * time. Equal values stay neutral rather than green, because matching your last
 * session is not an improvement.
 */
export function LastSessionDelta({
  current,
  previous,
  format = String,
  suffix,
}: LastSessionDeltaProps) {
  if (previous === null) {
    return (
      <View style={styles.wrap}>
        <Text style={styles.empty} allowFontScaling={false}>
          first time
        </Text>
      </View>
    );
  }

  const direction = current > previous ? 'up' : current < previous ? 'down' : 'same';
  const tone =
    direction === 'up' ? styles.up : direction === 'down' ? styles.down : styles.same;
  const arrow = direction === 'up' ? '↑' : direction === 'down' ? '↓' : '';

  // Only `color` goes on the Text elements — the full `tone` (which also
  // carries `backgroundColor`, and for "same" a border too) stays on the
  // outer pill alone. Text accepts those same style keys, so spreading the
  // whole tone onto it used to paint its own sharp-cornered fill on top of
  // the correctly-rounded pill underneath — a box inside the capsule.
  const toneColor = { color: tone.color };

  return (
    <View style={[styles.wrap, tone]}>
      <Text style={[styles.label, toneColor]} allowFontScaling={false}>
        last {format(previous)}
        {suffix ? ` ${suffix}` : ''}
      </Text>
      {arrow ? (
        <Text style={[styles.arrow, toneColor]} allowFontScaling={false}>
          {arrow}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderRadius: radius.pill,
  },
  label: {
    fontSize: font.caption,
    fontWeight: '600',
    letterSpacing: 0.3,
    fontVariant: ['tabular-nums'],
  },
  arrow: {
    fontSize: font.caption,
    fontWeight: '700',
  },
  empty: {
    fontSize: font.caption,
    color: colors.textMuted,
    letterSpacing: 0.3,
  },
  up: { color: colors.up, backgroundColor: colors.upSoft },
  down: { color: colors.down, backgroundColor: colors.downSoft },
  same: {
    color: colors.textSecondary,
    backgroundColor: glass.panel,
    borderWidth: 1,
    borderColor: glass.border,
  },
});
