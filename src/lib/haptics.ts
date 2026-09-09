import * as Haptics from 'expo-haptics';

/**
 * Haptics, globally switchable and rate-limited.
 *
 * The stepper can fire ~16 times a second at full hold speed. Every one of
 * those is an async call into the OS vibration motor, and Android will happily
 * queue them until the buzz lags seconds behind your thumb. `tick()` therefore
 * drops any request that arrives too soon after the last one — the pulses you
 * feel stay locked to the number you see.
 */

let enabled = true;
let lastTickAt = 0;

/** Minimum gap between two stepper ticks. Below this they blur into one buzz. */
const TICK_GAP_MS = 45;

/** Mirrors the user's Settings toggle. Called once when settings load or change. */
export function setHapticsEnabled(next: boolean): void {
  enabled = next;
}

/** One light tap — a single step of an arrow. Rate-limited. */
export function tick(): void {
  if (!enabled) return;
  const now = Date.now();
  if (now - lastTickAt < TICK_GAP_MS) return;
  lastTickAt = now;
  void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {
    // A device with no vibration motor is not an error worth surfacing.
  });
}

/** Heavier confirmation — logging a set, finishing a workout. */
export function confirm(): void {
  if (!enabled) return;
  void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
}

/** The strongest impact tier — reserved for the ki-aura's peak release, so it stays distinct from confirm(). */
export function heavy(): void {
  if (!enabled) return;
  void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy).catch(() => {});
}

/** Reserved for beating a personal record. */
export function celebrate(): void {
  if (!enabled) return;
  void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
}

/** Something was rejected — an invalid typed weight, a blocked action. */
export function warn(): void {
  if (!enabled) return;
  void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
}
