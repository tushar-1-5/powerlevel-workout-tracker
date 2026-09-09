import { ActivityIndicator, Pressable, StyleSheet, Text } from 'react-native';
import { BlurView } from 'expo-blur';

import { useBlurTarget } from '@/components/BlurTarget';
import { GlassSheen } from '@/components/GlassSurface';
import { colors, font, glass, hit, radius } from '@/theme/tokens';

export interface PrimaryButtonProps {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  /** Swaps the label for a spinner and treats the button as disabled — the
   * guard against a double-tap firing a second Start/Resume/Finish. */
  loading?: boolean;
  /**
   * 56dp instead of `hit.primary`'s 62 — for the logging screen, where two of
   * these stack at the bottom of a screen that also has to fit the entry
   * cards and the logged-sets list. Still on `hit.min`, the floor for
   * anything tapped mid-set.
   */
  compact?: boolean;
}

/**
 * The one big call to action — Start/Resume Workout, Finish Workout, Log
 * Set. Glass, like every other surface in the app — a deliberate reversal of
 * this component's original "always opaque, glass at rest / solid when it
 * matters" rule, made with eyes open rather than silently walked back (see
 * `docs/lessons.html`). Can't wrap `<GlassSurface>` directly — needs its own
 * `pressed`/`disabled` states layered underneath the blur — so it replicates
 * the same blur+sheen recipe inline instead, the same way `ReorderSheetBody`
 * already does for its own non-standard shape.
 *
 * Text switched from `colors.onAccent` to `colors.accent` — not cosmetic.
 * `onAccent` was WCAG-tuned specifically against a *solid* bright-purple
 * fill; against this button's new translucent `accentSoft` background over
 * the app's near-black `bg`, that near-black text would be almost
 * unreadable. `colors.accent` reads clearly against both the translucent
 * fill and the dark backdrop behind it.
 */
export function PrimaryButton({ label, onPress, disabled, loading, compact }: PrimaryButtonProps) {
  const isDisabled = disabled || loading;
  const blurTarget = useBlurTarget();

  return (
    <Pressable
      onPress={onPress}
      disabled={isDisabled}
      style={({ pressed }) => [
        styles.button,
        compact && styles.buttonCompact,
        isDisabled && styles.disabled,
        pressed && !isDisabled && styles.pressed,
      ]}
      accessibilityRole="button"
      accessibilityState={{ disabled: isDisabled, busy: loading }}>
      <BlurView
        blurTarget={blurTarget ?? undefined}
        intensity={40}
        tint="dark"
        blurMethod="dimezisBlurView"
        style={StyleSheet.absoluteFill}
      />
      <GlassSheen />
      {loading ? (
        <ActivityIndicator color={colors.accent} />
      ) : (
        <Text style={[styles.text, isDisabled && styles.textDisabled]} allowFontScaling={false}>
          {label}
        </Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    height: hit.primary,
    borderRadius: radius.lg,
    backgroundColor: colors.accentSoft,
    borderWidth: 1.5,
    borderColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  buttonCompact: { height: hit.min },
  pressed: { backgroundColor: 'rgba(181, 99, 248, 0.28)' },
  disabled: { backgroundColor: glass.panel, borderColor: glass.border },
  text: {
    color: colors.accent,
    fontSize: font.heading,
    fontWeight: '800',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  textDisabled: { color: colors.textMuted },
});
