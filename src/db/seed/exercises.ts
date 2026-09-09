import type { Equipment, MuscleGroup } from '../types';

/** [name, muscle group, equipment] */
export type SeedExercise = readonly [string, MuscleGroup, Equipment];

/**
 * The stock exercise library. Seeded once on first launch; every row is
 * editable and deletable afterwards, and custom additions sit alongside these.
 * Split templates resolve their exercises by `name`, so renaming one here after
 * release would orphan a template reference.
 */
export const SEED_EXERCISES: readonly SeedExercise[] = [
  // ---- Chest --------------------------------------------------------------
  ['Barbell Bench Press', 'chest', 'barbell'],
  ['Incline Barbell Bench Press', 'chest', 'barbell'],
  ['Decline Barbell Bench Press', 'chest', 'barbell'],
  ['Smith Machine Bench Press', 'chest', 'machine'],
  ['Dumbbell Bench Press', 'chest', 'dumbbell'],
  ['Incline Dumbbell Bench Press', 'chest', 'dumbbell'],
  ['Decline Dumbbell Press', 'chest', 'dumbbell'],
  ['Dumbbell Fly', 'chest', 'dumbbell'],
  ['Incline Dumbbell Fly', 'chest', 'dumbbell'],
  ['Cable Fly', 'chest', 'cable'],
  ['Low-to-High Cable Fly', 'chest', 'cable'],
  ['High-to-Low Cable Fly', 'chest', 'cable'],
  ['Chest Press Machine', 'chest', 'machine'],
  ['Incline Chest Press Machine', 'chest', 'machine'],
  ['Pec Deck', 'chest', 'machine'],
  ['Push-Up', 'chest', 'bodyweight'],
  ['Chest Dip', 'chest', 'bodyweight'],

  // ---- Back ---------------------------------------------------------------
  ['Deadlift', 'back', 'barbell'],
  ['Rack Pull', 'back', 'barbell'],
  ['Barbell Row', 'back', 'barbell'],
  ['Pendlay Row', 'back', 'barbell'],
  ['T-Bar Row', 'back', 'barbell'],
  ['Meadows Row', 'back', 'barbell'],
  ['Dumbbell Row', 'back', 'dumbbell'],
  ['Chest-Supported Dumbbell Row', 'back', 'dumbbell'],
  ['Seated Cable Row', 'back', 'cable'],
  ['Wide-Grip Seated Cable Row', 'back', 'cable'],
  ['Lat Pulldown', 'back', 'cable'],
  ['Wide-Grip Lat Pulldown', 'back', 'cable'],
  ['Close-Grip Lat Pulldown', 'back', 'cable'],
  ['Reverse-Grip Lat Pulldown', 'back', 'cable'],
  ['Straight-Arm Pulldown', 'back', 'cable'],
  ['Pull-Up', 'back', 'bodyweight'],
  ['Chin-Up', 'back', 'bodyweight'],
  ['Neutral-Grip Pull-Up', 'back', 'bodyweight'],
  ['Inverted Row', 'back', 'bodyweight'],
  ['Machine Row', 'back', 'machine'],
  ['Machine Pullover', 'back', 'machine'],

  // ---- Shoulders ----------------------------------------------------------
  ['Overhead Press', 'shoulders', 'barbell'],
  ['Seated Barbell Overhead Press', 'shoulders', 'barbell'],
  ['Push Press', 'shoulders', 'barbell'],
  ['Landmine Press', 'shoulders', 'barbell'],
  ['Upright Row', 'shoulders', 'barbell'],
  ['Dumbbell Shoulder Press', 'shoulders', 'dumbbell'],
  ['Seated Dumbbell Shoulder Press', 'shoulders', 'dumbbell'],
  ['Arnold Press', 'shoulders', 'dumbbell'],
  ['Lateral Raise', 'shoulders', 'dumbbell'],
  ['Cable Lateral Raise', 'shoulders', 'cable'],
  ['Machine Lateral Raise', 'shoulders', 'machine'],
  ['Front Raise', 'shoulders', 'dumbbell'],
  ['Rear Delt Fly', 'shoulders', 'dumbbell'],
  ['Reverse Pec Deck', 'shoulders', 'machine'],
  ['Face Pull', 'shoulders', 'cable'],
  ['Machine Shoulder Press', 'shoulders', 'machine'],

  // ---- Traps --------------------------------------------------------------
  ['Barbell Shrug', 'traps', 'barbell'],
  ['Dumbbell Shrug', 'traps', 'dumbbell'],
  ['Cable Shrug', 'traps', 'cable'],
  ['Machine Shrug', 'traps', 'machine'],
  ['Farmers Walk', 'traps', 'dumbbell'],

  // ---- Biceps -------------------------------------------------------------
  ['Barbell Curl', 'biceps', 'barbell'],
  ['EZ-Bar Curl', 'biceps', 'barbell'],
  ['Reverse Curl', 'biceps', 'barbell'],
  ['Preacher Curl', 'biceps', 'barbell'],
  ['Machine Preacher Curl', 'biceps', 'machine'],
  ['Dumbbell Curl', 'biceps', 'dumbbell'],
  ['Alternating Dumbbell Curl', 'biceps', 'dumbbell'],
  ['Hammer Curl', 'biceps', 'dumbbell'],
  ['Incline Dumbbell Curl', 'biceps', 'dumbbell'],
  ['Concentration Curl', 'biceps', 'dumbbell'],
  ['Spider Curl', 'biceps', 'dumbbell'],
  ['Cable Curl', 'biceps', 'cable'],
  ['Rope Hammer Curl', 'biceps', 'cable'],
  ['Bayesian Cable Curl', 'biceps', 'cable'],

  // ---- Triceps ------------------------------------------------------------
  ['Close-Grip Bench Press', 'triceps', 'barbell'],
  ['Skull Crusher', 'triceps', 'barbell'],
  ['JM Press', 'triceps', 'barbell'],
  ['Overhead Dumbbell Extension', 'triceps', 'dumbbell'],
  ['Tricep Kickback', 'triceps', 'dumbbell'],
  ['Tricep Pushdown (Bar)', 'triceps', 'cable'],
  ['Tricep Pushdown (Rope)', 'triceps', 'cable'],
  ['Single-Arm Cable Pushdown', 'triceps', 'cable'],
  ['Overhead Cable Extension', 'triceps', 'cable'],
  ['Machine Tricep Extension', 'triceps', 'machine'],
  ['Tricep Dip', 'triceps', 'bodyweight'],
  ['Bench Dip', 'triceps', 'bodyweight'],
  ['Diamond Push-Up', 'triceps', 'bodyweight'],

  // ---- Quads --------------------------------------------------------------
  ['Back Squat', 'quads', 'barbell'],
  ['Front Squat', 'quads', 'barbell'],
  ['Smith Machine Squat', 'quads', 'machine'],
  ['Hack Squat', 'quads', 'machine'],
  ['Pendulum Squat', 'quads', 'machine'],
  ['Belt Squat', 'quads', 'machine'],
  ['Leg Press', 'quads', 'machine'],
  ['Leg Extension', 'quads', 'machine'],
  ['Goblet Squat', 'quads', 'dumbbell'],
  ['Bulgarian Split Squat', 'quads', 'dumbbell'],
  ['Walking Lunge', 'quads', 'dumbbell'],
  ['Reverse Lunge', 'quads', 'dumbbell'],
  ['Step-Up', 'quads', 'dumbbell'],
  ['Sissy Squat', 'quads', 'bodyweight'],

  // ---- Hamstrings ---------------------------------------------------------
  ['Romanian Deadlift', 'hamstrings', 'barbell'],
  ['Dumbbell Romanian Deadlift', 'hamstrings', 'dumbbell'],
  ['Stiff-Leg Deadlift', 'hamstrings', 'barbell'],
  ['Good Morning', 'hamstrings', 'barbell'],
  ['Lying Leg Curl', 'hamstrings', 'machine'],
  ['Seated Leg Curl', 'hamstrings', 'machine'],
  ['Standing Leg Curl', 'hamstrings', 'machine'],
  ['Nordic Curl', 'hamstrings', 'bodyweight'],
  ['Glute-Ham Raise', 'hamstrings', 'bodyweight'],
  ['Cable Pull-Through', 'hamstrings', 'cable'],

  // ---- Glutes -------------------------------------------------------------
  ['Hip Thrust', 'glutes', 'barbell'],
  ['Machine Hip Thrust', 'glutes', 'machine'],
  ['Glute Bridge', 'glutes', 'barbell'],
  ['Sumo Deadlift', 'glutes', 'barbell'],
  ['Cable Glute Kickback', 'glutes', 'cable'],
  ['Hip Abduction Machine', 'glutes', 'machine'],
  ['Hip Adduction Machine', 'glutes', 'machine'],

  // ---- Calves -------------------------------------------------------------
  ['Standing Calf Raise', 'calves', 'machine'],
  ['Seated Calf Raise', 'calves', 'machine'],
  ['Leg Press Calf Raise', 'calves', 'machine'],
  ['Smith Machine Calf Raise', 'calves', 'machine'],
  ['Dumbbell Calf Raise', 'calves', 'dumbbell'],
  ['Single-Leg Calf Raise', 'calves', 'bodyweight'],

  // ---- Core ---------------------------------------------------------------
  ['Plank', 'core', 'bodyweight'],
  ['Side Plank', 'core', 'bodyweight'],
  ['Hanging Leg Raise', 'core', 'bodyweight'],
  ['Hanging Knee Raise', 'core', 'bodyweight'],
  ['Toes-to-Bar', 'core', 'bodyweight'],
  ['Crunch', 'core', 'bodyweight'],
  ['Decline Sit-Up', 'core', 'bodyweight'],
  ['Dead Bug', 'core', 'bodyweight'],
  ['Back Extension', 'core', 'bodyweight'],
  ['Machine Crunch', 'core', 'machine'],
  ['Cable Crunch', 'core', 'cable'],
  ['Pallof Press', 'core', 'cable'],
  ['Cable Wood Chop', 'core', 'cable'],
  ['Ab Wheel Rollout', 'core', 'other'],
  ['Russian Twist', 'core', 'other'],

  // ---- Forearms -----------------------------------------------------------
  ['Wrist Curl', 'forearms', 'barbell'],
  ['Reverse Wrist Curl', 'forearms', 'barbell'],
  ['Behind-the-Back Wrist Curl', 'forearms', 'barbell'],
  ['Dead Hang', 'forearms', 'bodyweight'],
  ['Plate Pinch', 'forearms', 'other'],

  // ---- Full body ----------------------------------------------------------
  ['Power Clean', 'full_body', 'barbell'],
  ['Clean and Press', 'full_body', 'barbell'],
  ['Snatch', 'full_body', 'barbell'],
  ['Thruster', 'full_body', 'barbell'],
  ['Kettlebell Swing', 'full_body', 'kettlebell'],
  ['Turkish Get-Up', 'full_body', 'kettlebell'],
  ['Burpee', 'full_body', 'bodyweight'],

  // ---- Cardio -------------------------------------------------------------
  ['Treadmill Run', 'cardio', 'other'],
  ['Incline Treadmill Walk', 'cardio', 'other'],
  ['Stationary Bike', 'cardio', 'other'],
  ['Rowing Machine', 'cardio', 'other'],
  ['Stair Climber', 'cardio', 'other'],
  ['Elliptical', 'cardio', 'other'],
  ['Jump Rope', 'cardio', 'other'],
];
