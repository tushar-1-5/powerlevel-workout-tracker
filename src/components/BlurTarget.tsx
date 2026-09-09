import { createContext, useContext, useRef, type ReactNode, type RefObject } from 'react';
import { StyleSheet, type View } from 'react-native';
import { BlurTargetView } from 'expo-blur';

const BlurTargetContext = createContext<RefObject<View | null> | null>(null);

/**
 * On Android, `expo-blur`'s `dimezisBlurView` method has no system-level
 * backdrop blur to lean on (the way iOS does) — it works by capturing
 * whatever's rendered inside a designated `BlurTargetView` and sampling it
 * live, so every `BlurView` elsewhere in the tree needs a ref to a target
 * that actually contains the content behind it. A single target is enough
 * to back any number of `BlurView`s, as long as they fall within its
 * bounds — the library's own docs say so directly.
 *
 * NOT currently mounted anywhere in the app. `BlurTargetView` resolves, on
 * Android, to its own separate native view manager (`ExpoBlurTargetView`,
 * distinct from the `ExpoBlurView` that plain `BlurView` already uses
 * successfully) — and mounting it crashes the app outright, both wrapping
 * the whole root `<Stack>` and wrapping a single ordinary screen's own
 * content. That crash pattern — works fine until the exact moment a new
 * native view actually mounts, completely independent of where in the tree
 * it sits — matches this project's own well-established "forgot the EAS
 * rebuild after adding native code" failure mode (see the `docs/teaching.html`
 * writeup of the export/import backup feature) rather than anything about
 * *how* it's wrapped: the installed dev client's compiled `expo-blur` native
 * module predates `ExpoBlurTargetView` entirely, so requesting it fails hard.
 * Once a fresh `eas build --profile development --platform android` actually
 * includes it, wrap the real app content (`_layout.tsx`'s `<Stack>`, and each
 * Modal's own content separately, since a Modal portals into its own native
 * window the app-root target can't reach) in `BlurTargetRoot` again.
 */
export function BlurTargetRoot({ children }: { children: ReactNode }) {
  const ref = useRef<View>(null);

  return (
    <BlurTargetContext.Provider value={ref}>
      <BlurTargetView ref={ref} style={styles.fill}>
        {children}
      </BlurTargetView>
    </BlurTargetContext.Provider>
  );
}

/** `null` outside `BlurTargetRoot` (or before the target has mounted) — callers pass it straight through to `BlurView`'s `blurTarget`, which treats a missing target as a graceful no-blur fallback rather than an error. */
export function useBlurTarget(): RefObject<View | null> | null {
  return useContext(BlurTargetContext);
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
});
