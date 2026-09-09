import type { ReactNode } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';

import { useBlurTarget } from '@/components/BlurTarget';
import { glass, radius } from '@/theme/tokens';

export interface GlassSurfaceProps {
  children?: ReactNode;
  style?: StyleProp<ViewStyle>;
  /** 'raised' is brighter/stronger-bordered — for a card that's currently active. */
  variant?: 'panel' | 'raised';
  /**
   * Set false to skip the native blur layer — for surfaces that repeat many
   * times in an unvirtualized, always-mounted list (a workout's logged
   * sets), where stacking one BlurView per row is a real Android rendering
   * cost for not much visual payoff at that size. The tint/border/sheen
   * treatment stays either way, so this is a performance knob, not an
   * on/off for the "glass" look itself.
   */
  blur?: boolean;
}

/**
 * The shared glass container for block-level surfaces: cards, banners,
 * modals and sheets. Individual controls (chips, arrow buttons) pull the
 * same tokens from `theme/tokens.ts` directly instead of wrapping in this —
 * those render at high frequency mid-set, and nesting an extra View inside
 * every Pressable buys nothing visually there.
 *
 * Real blur (`expo-blur`'s `BlurView`), not just translucency — layered
 * UNDER the existing tint/sheen/border, not instead of them: blur alone
 * reads inconsistently across whatever content sits behind a panel, and the
 * combination is what actually reads as "glass". `blurMethod` is set
 * explicitly because `expo-blur` defaults to `'none'` on Android (a plain
 * semi-transparent view, no real blur at all) — this app is Android-only,
 * so leaving it at the default would make every `BlurView` here a no-op.
 * `'dimezisBlurView'`, not the SDK-31-plus variant, so blur actually renders
 * on every Android version this app might run on, not just recent ones.
 *
 * `dimezisBlurView` also needs a `blurTarget` — a ref to the `BlurTargetView`
 * that actually contains the content to sample and blur, since Android has
 * no system-level backdrop blur to lean on the way iOS does. `useBlurTarget`
 * reads whatever `BlurTargetRoot` is nearest above this component — see
 * `BlurTarget.tsx` for why nothing currently mounts one (a real, not-yet-
 * rebuilt native dependency), which leaves this at its safe fallback: no
 * target, `blurMethod="dimezisBlurView"` silently behaves as `'none'`.
 */
export function GlassSurface({ children, style, variant = 'panel', blur = true }: GlassSurfaceProps) {
  const blurTarget = useBlurTarget();

  return (
    <View style={[styles.base, variant === 'raised' && styles.raised, style]}>
      {blur ? (
        <BlurView
          blurTarget={blurTarget ?? undefined}
          intensity={variant === 'raised' ? 36 : 24}
          tint="dark"
          blurMethod="dimezisBlurView"
          style={StyleSheet.absoluteFill}
        />
      ) : null}
      <GlassSheen />
      {children}
    </View>
  );
}

/** The faint top-edge highlight sheen, factored out so non-`GlassSurface` spots (a bottom sheet with its own corner styling) can reuse the exact same treatment. */
export function GlassSheen() {
  return <LinearGradient colors={[glass.highlight, 'transparent']} style={styles.sheen} pointerEvents="none" />;
}

const styles = StyleSheet.create({
  base: {
    backgroundColor: glass.panel,
    borderWidth: 1,
    borderColor: glass.border,
    borderRadius: radius.lg,
    overflow: 'hidden',
    elevation: 3,
    shadowColor: '#000',
    shadowOpacity: 0.28,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
  },
  raised: {
    backgroundColor: glass.panelRaised,
    borderColor: glass.borderStrong,
  },
  sheen: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 32,
  },
});
