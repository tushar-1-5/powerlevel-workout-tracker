/**
 * Which stock exercises are entered as "the load on ONE side".
 *
 * The rule, applied to every name below: you load or hold a separate
 * implement/stack per limb, or you work one limb at a time against a
 * separately-loaded implement. So a pair of dumbbells is per-side (7.5 kg on
 * Hammer Curl means 7.5 in each hand, 15 kg moved), and a single dumbbell held
 * in both hands is not — Goblet Squat and Overhead Dumbbell Extension are
 * deliberately absent for that reason, as is anything on a barbell, a single
 * cable stack, or a bilateral machine.
 *
 * FROZEN once released. Migration v3 and the first-launch seeder both read this
 * list, and they run on different installs at different times: editing it later
 * would leave an upgraded phone disagreeing with a freshly installed one about
 * what the defaults are. New defaults belong in a NEW migration.
 *
 * None of this is binding on the user — every row is a per-exercise toggle in
 * the day editor and in the logging screen's overflow menu.
 */
export const PER_SIDE_SEED_NAMES: ReadonlySet<string> = new Set([
  // ---- Chest --------------------------------------------------------------
  // The cable flyes included here are the two-stack kind: each side's stack is
  // dialled to the shown weight independently, which is per-side by the rule
  // above even though nothing is being held in a pair.
  'Dumbbell Bench Press',
  'Incline Dumbbell Bench Press',
  'Decline Dumbbell Press',
  'Dumbbell Fly',
  'Incline Dumbbell Fly',
  'Cable Fly',
  'Low-to-High Cable Fly',
  'High-to-Low Cable Fly',

  // ---- Back ---------------------------------------------------------------
  'Dumbbell Row',
  'Chest-Supported Dumbbell Row',

  // ---- Shoulders ----------------------------------------------------------
  'Dumbbell Shoulder Press',
  'Seated Dumbbell Shoulder Press',
  'Arnold Press',
  'Lateral Raise',
  'Cable Lateral Raise',
  'Front Raise',
  'Rear Delt Fly',

  // ---- Traps --------------------------------------------------------------
  'Dumbbell Shrug',
  'Farmers Walk',

  // ---- Biceps -------------------------------------------------------------
  // Rope Hammer Curl is absent on purpose: one rope, both hands, one stack.
  'Dumbbell Curl',
  'Alternating Dumbbell Curl',
  'Hammer Curl',
  'Incline Dumbbell Curl',
  'Concentration Curl',
  'Spider Curl',
  'Bayesian Cable Curl',

  // ---- Triceps ------------------------------------------------------------
  'Tricep Kickback',
  'Single-Arm Cable Pushdown',

  // ---- Quads --------------------------------------------------------------
  // The split-squat/lunge family: one leg at a time, holding a dumbbell per
  // hand — the shown number is one dumbbell either way.
  'Bulgarian Split Squat',
  'Walking Lunge',
  'Reverse Lunge',
  'Step-Up',

  // ---- Hamstrings ---------------------------------------------------------
  'Dumbbell Romanian Deadlift',
  'Standing Leg Curl',

  // ---- Glutes -------------------------------------------------------------
  'Cable Glute Kickback',

  // ---- Calves -------------------------------------------------------------
  'Dumbbell Calf Raise',
]);
