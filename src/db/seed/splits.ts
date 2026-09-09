import type { ScheduleMode } from '../types';

export interface SeedSplitDay {
  name: string;
  /** Exact names from SEED_EXERCISES — a typo here silently orphans a slot. */
  exercises: readonly string[];
}

export interface SeedSplit {
  name: string;
  scheduleMode: ScheduleMode;
  isDefault: boolean;
  days: readonly SeedSplitDay[];
}

/**
 * Starter split templates — onboarding's template picker (`app/onboarding`)
 * is what actually creates one of these, via `createSplitFromTemplate` in
 * `./index.ts`, once you pick it.
 *
 * Order matters: "Push Pull Legs" must stay first. It's the only template
 * flagged `isDefault`, which the onboarding screen reads to show a
 * "Recommended" badge — a nudge for a first-time user facing 4 equally
 * plausible choices, not a functional requirement of any query.
 */
export const SEED_SPLITS: readonly SeedSplit[] = [
  {
    name: 'Push Pull Legs',
    scheduleMode: 'rotation',
    isDefault: true,
    days: [
      {
        name: 'Push',
        exercises: [
          'Barbell Bench Press',
          'Overhead Press',
          'Incline Dumbbell Bench Press',
          'Lateral Raise',
          'Tricep Pushdown (Rope)',
        ],
      },
      {
        name: 'Pull',
        exercises: ['Deadlift', 'Barbell Row', 'Lat Pulldown', 'Face Pull', 'Barbell Curl'],
      },
      {
        name: 'Legs',
        exercises: [
          'Back Squat',
          'Romanian Deadlift',
          'Leg Press',
          'Leg Extension',
          'Standing Calf Raise',
        ],
      },
    ],
  },
  {
    name: 'Upper Lower',
    scheduleMode: 'rotation',
    isDefault: false,
    days: [
      {
        name: 'Upper',
        exercises: [
          'Barbell Bench Press',
          'Barbell Row',
          'Overhead Press',
          'Lat Pulldown',
          'Barbell Curl',
          'Tricep Pushdown (Rope)',
        ],
      },
      {
        name: 'Lower',
        exercises: [
          'Back Squat',
          'Romanian Deadlift',
          'Leg Press',
          'Lying Leg Curl',
          'Standing Calf Raise',
        ],
      },
    ],
  },
  {
    name: 'Bro Split',
    scheduleMode: 'rotation',
    isDefault: false,
    days: [
      {
        name: 'Chest & Triceps',
        exercises: [
          'Barbell Bench Press',
          'Incline Dumbbell Bench Press',
          'Cable Fly',
          'Tricep Pushdown (Rope)',
          'Skull Crusher',
        ],
      },
      {
        name: 'Back & Biceps',
        exercises: ['Deadlift', 'Barbell Row', 'Lat Pulldown', 'Barbell Curl', 'Hammer Curl'],
      },
      {
        name: 'Shoulders',
        exercises: ['Overhead Press', 'Lateral Raise', 'Rear Delt Fly', 'Face Pull', 'Barbell Shrug'],
      },
      {
        name: 'Legs',
        exercises: [
          'Back Squat',
          'Romanian Deadlift',
          'Leg Press',
          'Leg Extension',
          'Standing Calf Raise',
        ],
      },
    ],
  },
  {
    name: 'Full Body',
    scheduleMode: 'rotation',
    isDefault: false,
    days: [
      {
        name: 'Full Body A',
        exercises: ['Back Squat', 'Barbell Bench Press', 'Barbell Row', 'Standing Calf Raise', 'Plank'],
      },
      {
        name: 'Full Body B',
        exercises: ['Deadlift', 'Overhead Press', 'Lat Pulldown', 'Leg Press', 'Hanging Leg Raise'],
      },
      {
        name: 'Full Body C',
        exercises: [
          'Front Squat',
          'Incline Dumbbell Bench Press',
          'Dumbbell Row',
          'Lying Leg Curl',
          'Cable Crunch',
        ],
      },
    ],
  },
] as const;
