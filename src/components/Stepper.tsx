import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import {
  Animated,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { Pressable as GestureAwarePressable } from 'react-native-gesture-handler';

import { LinearGradient } from 'expo-linear-gradient';

import * as haptics from '@/lib/haptics';
import { clamp, stepFrom } from '@/lib/units';
import { colors, font, glass, hit, radius, spacing } from '@/theme/tokens';

/* ------------------------------------------------------------------ tuning */

/**
 * Hold-to-accelerate curve. These four numbers are the entire feel of the app,
 * so they live together, named, at the top of the file.
 */

/** A press shorter than this is a single step — no repeating. */
const HOLD_DELAY_MS = 400;
/** Interval between the first few repeats. Slow enough to release on target. */
const START_INTERVAL_MS = 240;
/** Fastest repeat: ~16 steps per second. */
const MIN_INTERVAL_MS = 62;
/** How long the hold takes to reach full speed. */
const RAMP_MS = 1500;

/** Number size in `compact` mode, against `font.display`'s 56. */
const COMPACT_DISPLAY = 44;

type Direction = 1 | -1;

export interface StepperProps {
  value: number;
  onChange: (next: number) => void;
  /** Increment per press, in the same units as `value`. */
  step: number;
  min?: number;
  max?: number;
  /** Turns the value into the string shown. Defaults to `String(value)`. */
  format?: (value: number) => string;
  /** Small caption under the number — "kg", "reps". */
  unitLabel?: string;
  /** Rendered below the caption. This is where the last-session line goes. */
  footer?: ReactNode;
  /** Allow a decimal point when typing. Weight yes, reps no. */
  allowDecimal?: boolean;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
  /**
   * Shorter variant for the workout logging screen, where two of these stack
   * above a logged-sets list on one non-scrolling-at-rest screen and the
   * full-size readout crowded the list out entirely. Arrows stay at 56dp —
   * `hit.min`, the floor this app sets for anything tapped mid-set — so this
   * trades number size for vertical room, never tap-target size.
   */
  compact?: boolean;
}

/**
 * The number control used for both weight and reps.
 *
 * Three ways to change the value, all landing in the same place:
 *   - tap an arrow for one step
 *   - hold an arrow to repeat, accelerating from ~4/sec to ~16/sec
 *   - tap the number itself and type it on the OS keyboard
 */
export function Stepper({
  value,
  onChange,
  step,
  min = 0,
  max = 9999,
  format,
  unitLabel,
  footer,
  allowDecimal = false,
  disabled = false,
  style,
  accessibilityLabel,
  compact = false,
}: StepperProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');

  /**
   * The repeat loop runs inside a setTimeout closure, which captures whatever
   * `value` was when the hold began. Reading through a ref instead means every
   * tick sees the value the previous tick just wrote — without this, holding
   * the arrow would apply one step over and over from the same starting number.
   */
  const latest = useRef({ value, step, min, max, onChange });
  latest.current = { value, step, min, max, onChange };

  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const rampStart = useRef(0);

  /**
   * Bumped on every stop and on every fresh press-in. Each scheduled tick
   * captures the token that was current when it was scheduled and checks it
   * against `holdToken.current` before doing anything — so even if a release
   * event is ever missed (this arrow sits inside a horizontally swiping
   * pager, and a parent scroll gesture can steal the touch mid-hold — see
   * `cancelable={false}` below) or two presses land close together, a stale
   * timer can only ever no-op, never keep applying steps forever. Belt and
   * braces on top of `clearTimeout`, which alone isn't enough if a timer
   * from an earlier, no-longer-tracked hold is still in flight.
   */
  const holdToken = useRef(0);

  const stopHold = useCallback(() => {
    holdToken.current += 1;
    if (timer.current !== null) {
      clearTimeout(timer.current);
      timer.current = null;
    }
  }, []);

  // Clear any pending timer if the screen unmounts mid-hold. Without this the
  // callback would fire against a component that no longer exists.
  useEffect(() => stopHold, [stopHold]);

  /** Applies one step. Returns false when the value is already at its limit. */
  const applyStep = useCallback((direction: Direction): boolean => {
    const state = latest.current;
    const next = clamp(stepFrom(state.value, state.step, direction), state.min, state.max);
    if (next === state.value) return false;

    // Write to the ref immediately: the next tick may fire before React has
    // re-rendered with the new prop.
    latest.current = { ...state, value: next };
    state.onChange(next);
    haptics.tick();
    return true;
  }, []);

  const scheduleRepeat = useCallback(
    function repeat(direction: Direction, myToken: number) {
      const elapsed = Date.now() - rampStart.current;
      const progress = Math.min(1, elapsed / RAMP_MS);
      const interval =
        START_INTERVAL_MS + (MIN_INTERVAL_MS - START_INTERVAL_MS) * progress;

      timer.current = setTimeout(() => {
        if (holdToken.current !== myToken) return; // superseded — do nothing, don't reschedule

        // Stop the loop at the limit rather than spinning a timer forever.
        if (applyStep(direction)) repeat(direction, myToken);
        else stopHold();
      }, interval);
    },
    [applyStep, stopHold],
  );

  const handlePressIn = useCallback(
    (direction: Direction) => {
      if (disabled) return;

      // Guarantee a clean slate even if a previous press's release event was
      // ever missed — see the note on `holdToken` above.
      stopHold();
      const myToken = holdToken.current;

      // One immediate step, so a quick tap is always exactly one increment.
      applyStep(direction);

      timer.current = setTimeout(() => {
        if (holdToken.current !== myToken) return;
        rampStart.current = Date.now();
        scheduleRepeat(direction, myToken);
      }, HOLD_DELAY_MS);
    },
    [applyStep, disabled, scheduleRepeat, stopHold],
  );

  /* ------------------------------------------------------------- typing */

  const beginEditing = useCallback(() => {
    if (disabled) return;
    stopHold();
    setDraft(format ? format(value) : String(value));
    setEditing(true);
  }, [disabled, format, stopHold, value]);

  const commitEditing = useCallback(() => {
    setEditing(false);

    const parsed = Number.parseFloat(draft.replace(',', '.'));
    if (!Number.isFinite(parsed)) {
      haptics.warn();
      return; // Keep the previous value rather than writing NaN.
    }

    // A typed number is taken literally — it is NOT snapped to the step grid.
    // If you type 62.3, you meant 62.3.
    const next = clamp(allowDecimal ? parsed : Math.round(parsed), min, max);
    if (next !== value) onChange(next);
  }, [allowDecimal, draft, max, min, onChange, value]);

  const display = format ? format(value) : String(value);

  return (
    <View style={[styles.row, style]}>
      <ArrowButton
        direction={-1}
        disabled={disabled || value <= min}
        onPressIn={handlePressIn}
        onRelease={stopHold}
        compact={compact}
        accessibilityLabel={`Decrease ${accessibilityLabel ?? 'value'}`}
      />

      <View style={styles.centre}>
        {editing ? (
          <TextInput
            value={draft}
            onChangeText={setDraft}
            onBlur={commitEditing}
            onSubmitEditing={commitEditing}
            keyboardType={allowDecimal ? 'decimal-pad' : 'number-pad'}
            returnKeyType="done"
            autoFocus
            selectTextOnFocus
            allowFontScaling={false}
            style={[styles.value, compact && styles.valueCompact, styles.valueInput]}
            maxLength={7}
          />
        ) : (
          <Pressable
            onPress={beginEditing}
            disabled={disabled}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel={`${accessibilityLabel ?? 'Value'} ${display}. Tap to type.`}>
            <Text
              style={[styles.value, compact && styles.valueCompact]}
              numberOfLines={1}
              adjustsFontSizeToFit
              allowFontScaling={false}>
              {display}
            </Text>
          </Pressable>
        )}

        {unitLabel ? (
          <Text style={styles.unit} allowFontScaling={false}>
            {unitLabel}
          </Text>
        ) : null}
        {footer ? <View style={styles.footer}>{footer}</View> : null}
      </View>

      <ArrowButton
        direction={1}
        disabled={disabled || value >= max}
        onPressIn={handlePressIn}
        onRelease={stopHold}
        compact={compact}
        accessibilityLabel={`Increase ${accessibilityLabel ?? 'value'}`}
      />
    </View>
  );
}

/* ------------------------------------------------------------------ arrow */

interface ArrowButtonProps {
  direction: Direction;
  disabled: boolean;
  onPressIn: (direction: Direction) => void;
  onRelease: () => void;
  accessibilityLabel: string;
  compact?: boolean;
}

function ArrowButton({
  direction,
  disabled,
  onPressIn,
  onRelease,
  accessibilityLabel,
  compact = false,
}: ArrowButtonProps) {
  // `useNativeDriver: true` hands the animation to the OS thread, so the button
  // keeps responding even while JavaScript is busy writing the set to SQLite.
  const press = useRef(new Animated.Value(0)).current;

  const animate = useCallback(
    (to: number) => {
      Animated.timing(press, {
        toValue: to,
        duration: 90,
        useNativeDriver: true,
      }).start();
    },
    [press],
  );

  const scale = press.interpolate({ inputRange: [0, 1], outputRange: [1, 0.93] });
  const glow = press.interpolate({ inputRange: [0, 1], outputRange: [0, 1] });

  return (
    <GestureAwarePressable
      disabled={disabled}
      // This arrow lives inside the workout screen's horizontally-swiping
      // exercise pager. Without this, the pager's own swipe gesture can
      // steal the touch mid-hold — which reads as "release never fires" and
      // is exactly what let a held arrow run away instead of stopping the
      // instant you lift your finger. `cancelable` is a gesture-handler
      // Pressable prop (plain react-native's Pressable doesn't expose it),
      // which is why this one import is swapped for this component only.
      cancelable={false}
      onPressIn={() => {
        animate(1);
        onPressIn(direction);
      }}
      onPressOut={() => {
        animate(0);
        onRelease();
      }}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}>
      <Animated.View
        style={[
          styles.arrow,
          compact && styles.arrowCompact,
          disabled && styles.arrowDisabled,
          { transform: [{ scale }] },
        ]}>
        <LinearGradient
          colors={[glass.highlight, 'transparent']}
          style={styles.arrowSheen}
          pointerEvents="none"
        />
        <Animated.View style={[styles.arrowGlow, { opacity: glow }]} pointerEvents="none" />
        <Text
          style={[
            styles.arrowGlyph,
            compact && styles.arrowGlyphCompact,
            disabled && styles.arrowGlyphDisabled,
          ]}
          allowFontScaling={false}>
          {direction === 1 ? '+' : '−'}
        </Text>
      </Animated.View>
    </GestureAwarePressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  centre: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  value: {
    color: colors.text,
    fontSize: font.display,
    fontWeight: '700',
    lineHeight: font.display * 1.08,
    textAlign: 'center',
    // Keeps digits the same width, so the number doesn't jitter as it changes.
    fontVariant: ['tabular-nums'],
    minWidth: 150,
  },
  // ~21% smaller than `font.display`. Still the biggest thing on the screen
  // and readable at arm's length, but it's what buys the logged-sets list
  // back its vertical room.
  valueCompact: {
    fontSize: COMPACT_DISPLAY,
    lineHeight: COMPACT_DISPLAY * 1.08,
    minWidth: 110,
  },
  valueInput: {
    padding: 0,
    borderBottomWidth: 2,
    borderBottomColor: colors.accent,
  },
  unit: {
    color: colors.textSecondary,
    fontSize: font.label,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    marginTop: 2,
  },
  footer: {
    marginTop: spacing.xs,
    alignItems: 'center',
  },
  arrow: {
    width: hit.arrow,
    height: hit.arrow,
    borderRadius: radius.lg,
    backgroundColor: glass.panel,
    borderWidth: 1,
    borderColor: glass.border,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    elevation: 2,
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
  },
  // `hit.min` (56dp), not smaller — the floor tokens.ts sets for anything
  // tapped mid-set.
  arrowCompact: { width: hit.min, height: hit.min, borderRadius: radius.md },
  arrowDisabled: {
    backgroundColor: 'transparent',
    borderColor: colors.border,
    elevation: 0,
    shadowOpacity: 0,
  },
  arrowSheen: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 22,
  },
  arrowGlow: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    backgroundColor: colors.accentSoft,
  },
  arrowGlyph: {
    color: colors.accent,
    fontSize: 34,
    fontWeight: '700',
    lineHeight: 38,
  },
  arrowGlyphCompact: {
    fontSize: 28,
    lineHeight: 32,
  },
  arrowGlyphDisabled: {
    color: colors.textMuted,
  },
});
