import { Pressable, StyleSheet, Text } from 'react-native';

import type { Exercise } from '@/db/types';
import * as haptics from '@/lib/haptics';
import { isPerSide, weightModeChipLabel } from '@/lib/weightMode';
import { colors, font, glass, radius, spacing } from '@/theme/tokens';

export interface WeightModeChipProps {
  exercise: Exercise;
  /** Called with no argument — the chip only ever flips; the caller writes the new mode. */
  onToggle: () => void;
}

/**
 * The small "EACH ARM" / "TOTAL" toggle on a day-editor row.
 *
 * Styled after `TogglePill` on the logging screen: accent-soft fill + accent
 * border when on, the plain glass panel when off. Deliberately NOT a
 * `GlassSurface` — this sits inside every row of a `DragList`, and blur per row
 * is exactly the cost `GlassSurface`'s own `blur={false}` knob exists to avoid.
 *
 * It's a plain `Pressable` with a short tap, so it coexists with DragList's
 * long-press-to-drag the same way the row's existing remove "×" does.
 */
export function WeightModeChip({ exercise, onToggle }: WeightModeChipProps) {
  const on = isPerSide(exercise);

  return (
    <Pressable
      onPress={() => {
        haptics.tick();
        onToggle();
      }}
      hitSlop={8}
      accessibilityRole="switch"
      accessibilityState={{ checked: on }}
      accessibilityLabel={`${exercise.name} weight entry: ${on ? 'per side' : 'total'}`}
      style={[styles.chip, on && styles.chipOn]}>
      <Text style={[styles.text, on && styles.textOn]} allowFontScaling={false}>
        {weightModeChipLabel(exercise)}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  chip: {
    minWidth: 76,
    paddingHorizontal: spacing.sm,
    paddingVertical: 6,
    borderRadius: radius.pill,
    backgroundColor: glass.panel,
    borderWidth: 1,
    borderColor: glass.border,
    alignItems: 'center',
  },
  chipOn: { backgroundColor: colors.accentSoft, borderColor: colors.accent },
  text: { color: colors.textMuted, fontSize: font.micro, fontWeight: '800', letterSpacing: 0.8 },
  textOn: { color: colors.accent },
});
