import { Pressable, StyleSheet, Text, View } from 'react-native';

import * as haptics from '@/lib/haptics';
import { colors, font, glass, hit, radius, spacing } from '@/theme/tokens';

export interface RepChipsProps {
  /** The configured quick-pick values, e.g. [8, 10, 12]. */
  chips: number[];
  value: number;
  onSelect: (reps: number) => void;
  /**
   * Reps done on this set number last session. Shown as an extra chip when it
   * isn't already one of the configured values, so repeating last week is one
   * tap even at an odd rep count.
   */
  lastReps?: number | null;
  disabled?: boolean;
}

export function RepChips({ chips, value, onSelect, lastReps, disabled }: RepChipsProps) {
  const showLast = lastReps != null && lastReps > 0 && !chips.includes(lastReps);

  const pick = (reps: number) => {
    if (disabled || reps === value) return;
    haptics.tick();
    onSelect(reps);
  };

  return (
    <View style={styles.row}>
      {chips.map((reps) => (
        <Chip
          key={reps}
          label={String(reps)}
          active={reps === value}
          disabled={disabled}
          onPress={() => pick(reps)}
        />
      ))}

      {showLast ? (
        <Chip
          label={String(lastReps)}
          caption="last"
          active={lastReps === value}
          disabled={disabled}
          onPress={() => pick(lastReps)}
        />
      ) : null}
    </View>
  );
}

interface ChipProps {
  label: string;
  caption?: string;
  active: boolean;
  disabled?: boolean;
  onPress: () => void;
}

function Chip({ label, caption, active, disabled, onPress }: ChipProps) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      accessibilityLabel={caption ? `${label} reps, last session` : `${label} reps`}
      style={({ pressed }) => [
        styles.chip,
        active && styles.chipActive,
        pressed && !active && styles.chipPressed,
      ]}>
      <Text style={[styles.chipText, active && styles.chipTextActive]} allowFontScaling={false}>
        {label}
      </Text>
      {caption ? (
        <Text
          style={[styles.chipCaption, active && styles.chipCaptionActive]}
          allowFontScaling={false}>
          {caption}
        </Text>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap: spacing.sm,
    justifyContent: 'center',
    flexWrap: 'wrap',
  },
  chip: {
    minWidth: 72,
    minHeight: hit.min,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.md,
    backgroundColor: glass.panel,
    borderWidth: 1,
    borderColor: glass.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chipPressed: {
    backgroundColor: glass.panelRaised,
    borderColor: glass.borderStrong,
  },
  chipActive: {
    backgroundColor: colors.accent,
    borderColor: colors.accent,
  },
  chipText: {
    color: colors.text,
    fontSize: font.heading,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  chipTextActive: {
    color: colors.onAccent,
  },
  chipCaption: {
    color: colors.textMuted,
    fontSize: font.micro,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    marginTop: -2,
  },
  chipCaptionActive: {
    color: colors.onAccent,
    opacity: 0.7,
  },
});
