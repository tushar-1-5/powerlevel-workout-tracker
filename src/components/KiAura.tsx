import { useEffect, useRef } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  cancelAnimation,
  interpolateColor,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';

import * as haptics from '@/lib/haptics';
import { aura } from '@/theme/tokens';

export interface KiAuraProps {
  /** Called once, either when the animation completes or you tap to skip it. */
  onDone: () => void;
  /** Milliseconds — the PRD's §9 calls for "roughly 2.5s". */
  duration?: number;
}

const PARTICLE_COUNT = 14;
const CRACKLE_COUNT = 8;

/**
 * The workout-finish charge-up from the PRD's §9: rising particles, a glow
 * that intensifies as the numbers count up, a screen shake and a crackle
 * near the peak, then a white-hot release. Fires only from the summary
 * screen (Block 7), nowhere else — original art only, no copyrighted
 * characters or names, per the project's DBZ-theming rule.
 *
 * Colour is a fixed charge (orange) → crackle (blue) → release (white)
 * story, deliberately independent of the app's own accent colour — see
 * `theme/tokens.ts`'s `aura` export.
 *
 * An absolute-fill overlay, not a themed background: it's meant to sit on
 * top of the summary screen's real numbers while they count up underneath
 * (that count-up lives in `summary.tsx`, not here — this component only
 * owns the glow/particle/shake/flash effects, not what number is showing).
 */
export function KiAura({ onDone, duration = 2500 }: KiAuraProps) {
  const glow = useSharedValue(0);
  const shake = useSharedValue(0);
  const flash = useSharedValue(0);
  /** 0 = charge phase colours, 1 = crackle phase colours. Crossfades rather
   * than cutting instantly, and drives the glow/particles together so they
   * never fall out of sync with each other. */
  const phaseColor = useSharedValue(0);
  const doneRef = useRef(false);

  const finish = () => {
    if (doneRef.current) return;
    doneRef.current = true;
    onDone();
  };

  useEffect(() => {
    // Three phases, timed as fractions of `duration` rather than fixed
    // milliseconds, so a caller passing a different duration keeps the same
    // shape (mostly charging, a shake and crackle near the peak, then flash).
    glow.value = withTiming(1, { duration: duration * 0.72, easing: Easing.out(Easing.cubic) });
    shake.value = withDelay(
      duration * 0.55,
      withRepeat(withSequence(withTiming(1, { duration: 40 }), withTiming(-1, { duration: 40 })), 8, true),
    );
    flash.value = withDelay(
      duration * 0.82,
      withTiming(1, { duration: duration * 0.18, easing: Easing.out(Easing.quad) }),
    );
    // A quick 150ms crossfade at the same moment the shake starts — the
    // charge and crackle phases are sequential, not continuously blended,
    // so this is two colour sets swapped at a boundary, not a gradient tied
    // to the whole timeline.
    phaseColor.value = withDelay(duration * 0.55, withTiming(1, { duration: 150 }));

    // Haptics, scheduled on the JS thread against the exact same phase
    // fractions above — the scheduling math already lives here (it's plain
    // numbers, not worklet state), so plain setTimeouts are enough; no
    // runOnJS/UI-thread bridging needed. One tick per shake reversal (8,
    // matching the withRepeat count above), then the strongest tier at the
    // flash/release.
    const shakeStart = duration * 0.55;
    const shakeStep = 80; // matches the 40ms + 40ms withSequence cycle inside the shake's withRepeat
    const flashStart = duration * 0.82;
    const hapticTimers: ReturnType<typeof setTimeout>[] = [];
    for (let i = 0; i < 8; i += 1) {
      hapticTimers.push(setTimeout(() => haptics.tick(), shakeStart + i * shakeStep));
    }
    hapticTimers.push(setTimeout(() => haptics.heavy(), flashStart));

    const timer = setTimeout(finish, duration);
    return () => {
      clearTimeout(timer);
      hapticTimers.forEach(clearTimeout);
      cancelAnimation(glow);
      cancelAnimation(shake);
      cancelAnimation(flash);
      cancelAnimation(phaseColor);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [duration]);

  const containerStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: shake.value * 6 }],
  }));

  const glowStyle = useAnimatedStyle(() => {
    const color = interpolateColor(phaseColor.value, [0, 1], [aura.charge, aura.crackle]);
    return {
      opacity: glow.value,
      backgroundColor: color,
      shadowColor: color,
      transform: [{ scale: 0.6 + glow.value * 0.8 }],
    };
  });

  const flashStyle = useAnimatedStyle(() => ({ opacity: flash.value }));

  const crackleStyle = useAnimatedStyle(() => ({
    opacity: Math.min(1, Math.abs(shake.value)) * 0.9,
  }));

  return (
    <Pressable
      style={StyleSheet.absoluteFill}
      onPress={finish}
      accessibilityRole="button"
      accessibilityLabel="Skip animation">
      <Animated.View style={[StyleSheet.absoluteFill, styles.wrap, containerStyle]} pointerEvents="none">
        <Animated.View style={[styles.glow, glowStyle]} />
        <Animated.View style={[styles.crackleWrap, crackleStyle]}>
          {Array.from({ length: CRACKLE_COUNT }).map((_, i) => {
            const angle = (i / CRACKLE_COUNT) * 360;
            return (
              <View key={i} style={[styles.crackleBolt, { transform: [{ rotate: `${angle}deg` }, { translateY: -150 }] }]} />
            );
          })}
        </Animated.View>
        {Array.from({ length: PARTICLE_COUNT }).map((_, i) => (
          <Particle key={i} index={i} phaseColor={phaseColor} />
        ))}
      </Animated.View>
      <Animated.View style={[StyleSheet.absoluteFill, styles.flash, flashStyle]} pointerEvents="none" />
    </Pressable>
  );
}

/** One rising ember — fades and drifts upward on an endless loop; the parent unmounting is what actually stops it. */
function Particle({ index, phaseColor }: { index: number; phaseColor: SharedValue<number> }) {
  const progress = useSharedValue(0);
  const angle = (index / PARTICLE_COUNT) * Math.PI * 2;
  const radius = 40 + (index % 3) * 18;
  const startX = Math.cos(angle) * radius;
  const startDelay = (index * 47) % 600;

  useEffect(() => {
    progress.value = withDelay(
      startDelay,
      withRepeat(withTiming(1, { duration: 900, easing: Easing.out(Easing.quad) }), -1, false),
    );
    return () => cancelAnimation(progress);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const style = useAnimatedStyle(() => ({
    opacity: 1 - progress.value,
    backgroundColor: interpolateColor(phaseColor.value, [0, 1], [aura.charge, aura.crackle]),
    transform: [
      { translateX: startX },
      { translateY: -progress.value * 90 },
      { scale: 0.4 + (1 - progress.value) * 0.6 },
    ],
  }));

  return <Animated.View style={[styles.particle, style]} />;
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', justifyContent: 'center' },
  glow: {
    width: 260,
    height: 260,
    borderRadius: 130,
    shadowOpacity: 0.9,
    shadowRadius: 60,
    elevation: 40,
  },
  crackleWrap: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
  },
  crackleBolt: {
    position: 'absolute',
    width: 3,
    height: 46,
    borderRadius: 2,
    backgroundColor: aura.crackle,
    shadowColor: aura.crackle,
    shadowOpacity: 0.85,
    shadowRadius: 6,
    elevation: 6,
  },
  particle: {
    position: 'absolute',
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  flash: { backgroundColor: aura.flash },
});
