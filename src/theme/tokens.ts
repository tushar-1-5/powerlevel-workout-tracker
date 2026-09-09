/**
 * PowerLevel design tokens.
 *
 * Dark, high-contrast, gym-first. One bright accent (ki gold) carries every
 * primary action; green/red are reserved exclusively for "better/worse than
 * last session" so they never lose their meaning.
 */

export const colors = {
  /** Page background — near-black, not pure black, so elevation reads. */
  bg: '#0A0A0B',
  /** Cards, rows, inputs. */
  surface: '#141417',
  /** Raised/pressed surface. */
  surfaceAlt: '#1D1D22',
  /** Selected/active fill behind chips and tabs. */
  surfaceActive: '#2A2A32',
  border: '#26262E',
  borderStrong: '#3A3A45',

  text: '#FFFFFF',
  textSecondary: '#9A9AA6',
  textMuted: '#63636F',
  /**
   * Text/icon on top of the accent fill. Stays dark, not white, even though
   * the accent below is a fairly saturated purple — WCAG luminance is
   * green-channel-dominated, and #B563F8 is green-poor, so its relative
   * luminance is lower than it looks: black-ish text clears ~6.1:1 contrast
   * (comfortably past the 4.5:1 AA minimum) while white text only reaches
   * ~3.44:1 (under it). Re-hued toward violet rather than reused verbatim
   * from the old gold-tinted near-black, so it doesn't read as a leftover.
   */
  onAccent: '#1B0F2E',

  /** The single primary accent — was ki gold (#FFC233), now purple. */
  accent: '#B563F8',
  accentPressed: '#9747E0',
  accentSoft: 'rgba(181, 99, 248, 0.14)',

  /** Comparison colours. Only ever used for last-session deltas. */
  up: '#3DDC84',
  upSoft: 'rgba(61, 220, 132, 0.14)',
  down: '#FF5C5C',
  downSoft: 'rgba(255, 92, 92, 0.14)',

  /** Set-type markers. */
  warmup: '#5BA8FF',
  failure: '#FF8A3D',
  drop: '#C77DFF',

  danger: '#FF5C5C',
  overlay: 'rgba(0, 0, 0, 0.72)',
} as const;

/**
 * Glass surfaces — resting containers (cards, chips, buttons) float as
 * translucent dark panels over `colors.bg` instead of solid fills, with a
 * ki-gold hairline standing in for a plain grey border. This is the one
 * place that tint lives, so every panel in the app reads as the same pane
 * of glass rather than each screen inventing its own translucency.
 *
 * Deliberately NOT used on anything a set depends on being legible: the
 * primary "Log Set" button, active/selected chips, and the accent fill all
 * stay fully opaque (`colors.accent`) — glass is for rest state, solid is
 * for the moment you're actually relying on it mid-set, sweaty hands, bad
 * gym light.
 */
export const glass = {
  panel: 'rgba(22, 22, 26, 0.62)',
  panelRaised: 'rgba(34, 34, 41, 0.74)',
  border: 'rgba(181, 99, 248, 0.16)',
  borderStrong: 'rgba(181, 99, 248, 0.34)',
  /** The faint top-edge line where light would catch a real pane of glass. */
  highlight: 'rgba(255, 255, 255, 0.07)',
} as const;

/**
 * Ki-aura colours — deliberately NOT `colors.accent`. The finish-workout
 * animation has its own fixed charge → crackle → release colour story
 * (orange energy building, a blue electrical crackle at the shake/peak,
 * then a white-hot release) that shouldn't shift every time the app's own
 * accent theme does — see `KiAura.tsx`.
 */
export const aura = {
  charge: '#FF8C42',
  crackle: '#29B6F6',
  flash: '#FFFFFF',
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
  xxxl: 48,
} as const;

export const radius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 22,
  pill: 999,
} as const;

export const font = {
  /** Big numeric readouts — weight and reps. */
  display: 56,
  title: 28,
  heading: 20,
  body: 16,
  label: 14,
  caption: 12,
  micro: 11,
} as const;

export const weight = {
  regular: '400',
  medium: '500',
  semibold: '600',
  bold: '700',
  heavy: '800',
} as const;

/**
 * Minimum 56dp on anything you tap mid-set. Sweaty hands, bad light.
 */
export const hit = {
  min: 56,
  arrow: 68,
  primary: 62,
} as const;

export const duration = {
  fast: 120,
  base: 200,
  slow: 360,
} as const;
