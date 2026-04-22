// Design tokens and constants for the app
export { hexToRgba } from '../theme/colorUtils';
import { basePalette } from '../theme/basePalette';

// Muted background colors for cycle/plan grouping on the calendar (dark theme)
export const CYCLE_COLORS = [
  `${basePalette.info}29`, // info at 16% opacity — cycle strip background
  '#1A3A1A', // dark green
  '#3A2A1A', // dark amber
  '#3A1A2A', // dark rose
  '#2A1A3A', // dark violet
  '#1A3A34', // dark teal
];

export const GRADIENTS = {
  accentPrimary: {
    colors: [basePalette.accentPrimary, '#A8C41A'] as const,
    start: { x: 0.42, y: 0.42 },
    end: { x: 1, y: 1 },
  },
  backgroundLight: {
    colors: ['#121212', '#0D0D0D'] as const,
    start: { x: 0, y: 0 },
    end: { x: 0, y: 1 },
  },
};

export const SPACING = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
};

export const TYPOGRAPHY = {
  // Headers
  h1: {
    fontSize: 32,
    lineHeight: 36,
    fontWeight: '500' as const,
  },
  h2: {
    fontSize: 24,
    fontWeight: '400' as const,
  },
  h3: {
    fontSize: 20,
    fontWeight: '400' as const,
  },
  /**
   * Large display line (e.g. exercise names in Up Next / queues).
   * Not the same as h1 — h1 is light weight for marketing-style titles.
   */
  displayLarge: {
    fontSize: 32,
    lineHeight: 36,
    fontWeight: '500' as const,
    letterSpacing: -0.4,
  },

  // Body text
  body: {
    fontSize: 16,
    fontWeight: '400' as const,
  },
  bodyBold: {
    fontSize: 16,
    fontWeight: '600' as const,
  },
  
  // Small text
  meta: {
    fontSize: 14,
    fontWeight: '400' as const,
  },
  metaBold: {
    fontSize: 14,
    fontWeight: '600' as const,
  },
  /**
   * Uppercase section label (e.g. add-workout stack, schedule deck meta headers).
   * Use with `textMeta` or other semantic text colors.
   */
  sectionHeader: {
    fontSize: 14,
    fontWeight: '600' as const,
    letterSpacing: 0.6,
    textTransform: 'uppercase' as const,
  },
  legal: {
    fontSize: 12,
    fontWeight: '400' as const,
  },
  note: {
    fontSize: 10,
    fontWeight: '400' as const,
    textTransform: 'uppercase' as const,
  },
  
  // Buttons
  button: {
    fontSize: 17,
    lineHeight: 22,
    fontWeight: '600' as const,
  },
  
  // Numbers/data
  number: {
    fontSize: 20,
    lineHeight: 24,
    fontWeight: '600' as const,
  },
  /**
   * Large single-line metric (value + unit share this style).
   * Used e.g. Explore v2 Current card hero weight/reps.
   */
  metricDisplay: {
    fontSize: 56,
    lineHeight: 60,
    fontWeight: '400' as const,
    letterSpacing: -0.6,
  },
  /** Extra-large editable value display (Explore current card). */
  valueDisplay: {
    fontSize: 96,
    lineHeight: 96,
    fontWeight: '400' as const,
  },
  
  // Timer display
  timer: {
    fontSize: 80,
    lineHeight: 80,
    fontWeight: '300' as const,
  },
};

export const BORDER_RADIUS = {
  sm: 12,   // Squircle-friendly (increased from 8)
  md: 16,   // Squircle-friendly (increased from 12)
  lg: 20,   // Squircle-friendly (increased from 16)
  xl: 24,   // Squircle-friendly (increased from 20)
  round: 999,
};

export const SHADOW = {
  sm: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.4,
    shadowRadius: 2,
    elevation: 2,
  },
  md: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.5,
    shadowRadius: 4,
    elevation: 4,
  },
  lg: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.6,
    shadowRadius: 8,
    elevation: 8,
  },
};

export const CARDS = {
  cardFlat: {
    backgroundColor: '#1C1C1E',
    borderRadius: 16,
    borderCurve: 'continuous' as const,
    borderWidth: 0,
    borderColor: 'transparent',
  },
  cardDeep: {
    outer: {
      backgroundColor: '#161617',
      borderRadius: 16,
      borderCurve: 'continuous' as const,
      overflow: 'hidden' as const,
      borderWidth: 0,
      borderColor: 'transparent',
    },
    inner: {
      backgroundColor: '#161617',
      borderRadius: 16,
      borderCurve: 'continuous' as const,
    },
  },
  cardDeepDimmed: {
    outer: {
      backgroundColor: '#1C1C1E',
      borderRadius: 16,
      borderCurve: 'continuous' as const,
      overflow: 'hidden' as const,
      borderWidth: 0,
      borderColor: 'transparent',
    },
    inner: {
      backgroundColor: '#1C1C1E',
      borderRadius: 16,
      borderCurve: 'continuous' as const,
    },
  },
  cardDeepDisabled: {
    outer: {
      backgroundColor: '#2C2C2E',
      borderRadius: 16,
      borderCurve: 'continuous' as const,
      overflow: 'hidden' as const,
      borderWidth: 0,
      borderColor: 'transparent',
    },
    inner: {
      backgroundColor: '#2C2C2E',
      borderRadius: 16,
      borderCurve: 'continuous' as const,
    },
  },
};

// Button styles
export const BUTTONS = {
  primaryButtonNoLabel: {
    width: 80,
    height: 80,
    borderRadius: 20,
    borderCurve: 'continuous' as const,
    backgroundColor: basePalette.accentPrimary,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  primaryButtonLabeled: {
    height: 56,
    borderRadius: 16,
    borderCurve: 'continuous' as const,
    backgroundColor: basePalette.accentPrimary,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    paddingHorizontal: 24,
  },
};

// Seed exercises for initial app state
export const SEED_EXERCISES = [
  // Chest
  { name: 'Barbell Bench Press', category: 'Chest', equipment: 'Other' },
  { name: 'Incline Barbell Bench Press', category: 'Chest', equipment: 'Other' },
  { name: 'Dumbbell Bench Press', category: 'Chest', equipment: 'Other' },
  { name: 'Incline Dumbbell Press', category: 'Chest', equipment: 'Other' },
  { name: 'Decline Bench Press', category: 'Chest', equipment: 'Other' },
  { name: 'Chest Press Machine', category: 'Chest', equipment: 'Other' },
  { name: 'Dumbbell Fly (Flat)', category: 'Chest', equipment: 'Other' },
  { name: 'Incline Dumbbell Fly', category: 'Chest', equipment: 'Other' },
  { name: 'Cable Fly (High to Low)', category: 'Chest', equipment: 'Other' },
  { name: 'Cable Fly (Low to High)', category: 'Chest', equipment: 'Other' },
  { name: 'Pec Deck', category: 'Chest', equipment: 'Other' },
  { name: 'Push-Ups', category: 'Chest', equipment: 'Other' },
  { name: 'Chest Dips', category: 'Chest', equipment: 'Other' },
  
  // Back (Lats & Mid-Back)
  { name: 'Pull-Ups', category: 'Back (Lats & Mid-Back)', equipment: 'Other' },
  { name: 'Chin-Ups', category: 'Back (Lats & Mid-Back)', equipment: 'Other' },
  { name: 'Lat Pulldown (Wide)', category: 'Back (Lats & Mid-Back)', equipment: 'Other' },
  { name: 'Lat Pulldown (Neutral)', category: 'Back (Lats & Mid-Back)', equipment: 'Other' },
  { name: 'Single-Arm Lat Pulldown', category: 'Back (Lats & Mid-Back)', equipment: 'Other' },
  { name: 'Seated Cable Row', category: 'Back (Lats & Mid-Back)', equipment: 'Other' },
  { name: 'Chest-Supported Row (Machine)', category: 'Back (Lats & Mid-Back)', equipment: 'Other' },
  { name: 'Chest-Supported Dumbbell Row', category: 'Back (Lats & Mid-Back)', equipment: 'Other' },
  { name: 'Barbell Row', category: 'Back (Lats & Mid-Back)', equipment: 'Other' },
  { name: 'Pendlay Row', category: 'Back (Lats & Mid-Back)', equipment: 'Other' },
  { name: 'Single-Arm Dumbbell Row', category: 'Back (Lats & Mid-Back)', equipment: 'Other' },
  { name: 'T-Bar Row', category: 'Back (Lats & Mid-Back)', equipment: 'Other' },
  { name: 'Inverted Row', category: 'Back (Lats & Mid-Back)', equipment: 'Other' },

  // Back (Upper / Scapular)
  { name: 'Face Pull', category: 'Back (Upper / Scapular)', equipment: 'Other' },
  { name: 'Rear Delt Row (Cable or Dumbbell)', category: 'Back (Upper / Scapular)', equipment: 'Other' },
  { name: 'High Cable Row', category: 'Back (Upper / Scapular)', equipment: 'Other' },
  { name: 'Band Pull-Apart', category: 'Back (Upper / Scapular)', equipment: 'Other' },
  { name: 'Prone Y Raise', category: 'Back (Upper / Scapular)', equipment: 'Other' },
  { name: 'Prone T Raise', category: 'Back (Upper / Scapular)', equipment: 'Other' },
  { name: 'Reverse Pec Deck', category: 'Back (Upper / Scapular)', equipment: 'Other' },
  { name: 'Scapular Pull-Ups', category: 'Back (Upper / Scapular)', equipment: 'Other' },
  
  // Shoulders (Delts)
  { name: 'Overhead Barbell Press', category: 'Shoulders (Delts)', equipment: 'Other' },
  { name: 'Seated Dumbbell Shoulder Press', category: 'Shoulders (Delts)', equipment: 'Other' },
  { name: 'Arnold Press', category: 'Shoulders (Delts)', equipment: 'Other' },
  { name: 'Machine Shoulder Press', category: 'Shoulders (Delts)', equipment: 'Other' },
  { name: 'Lateral Raise (Dumbbell)', category: 'Shoulders (Delts)', equipment: 'Other' },
  { name: 'Cable Lateral Raise', category: 'Shoulders (Delts)', equipment: 'Other' },
  { name: 'Front Raise (Dumbbell or Plate)', category: 'Shoulders (Delts)', equipment: 'Other' },
  { name: 'Upright Row (EZ Bar or Cable)', category: 'Shoulders (Delts)', equipment: 'Other' },
  { name: 'Rear Delt Fly (Dumbbell)', category: 'Shoulders (Delts)', equipment: 'Other' },

  // Biceps
  { name: 'Barbell Curl', category: 'Biceps', equipment: 'Other' },
  { name: 'EZ-Bar Curl', category: 'Biceps', equipment: 'Other' },
  { name: 'Dumbbell Curl', category: 'Biceps', equipment: 'Other' },
  { name: 'Alternating Dumbbell Curl', category: 'Biceps', equipment: 'Other' },
  { name: 'Incline Dumbbell Curl', category: 'Biceps', equipment: 'Other' },
  { name: 'Preacher Curl (Machine or EZ)', category: 'Biceps', equipment: 'Other' },
  { name: 'Cable Curl', category: 'Biceps', equipment: 'Other' },
  { name: 'Hammer Curl', category: 'Biceps', equipment: 'Other' },
  { name: 'Cross-Body Hammer Curl', category: 'Biceps', equipment: 'Other' },
  { name: 'Concentration Curl', category: 'Biceps', equipment: 'Other' },

  // Triceps
  { name: 'Close-Grip Bench Press', category: 'Triceps', equipment: 'Other' },
  { name: 'Triceps Pushdown (Rope)', category: 'Triceps', equipment: 'Other' },
  { name: 'Triceps Pushdown (Bar)', category: 'Triceps', equipment: 'Other' },
  { name: 'Overhead Triceps Extension (Cable)', category: 'Triceps', equipment: 'Other' },
  { name: 'Dumbbell Overhead Extension', category: 'Triceps', equipment: 'Other' },
  { name: 'Skullcrushers (EZ Bar)', category: 'Triceps', equipment: 'Other' },
  { name: 'Bench Dips', category: 'Triceps', equipment: 'Other' },
  { name: 'Assisted Dips', category: 'Triceps', equipment: 'Other' },
  { name: 'Single-Arm Cable Kickback', category: 'Triceps', equipment: 'Other' },
  
  // Legs (Quads)
  { name: 'Back Squat', category: 'Legs (Quads)', equipment: 'Other' },
  { name: 'Front Squat', category: 'Legs (Quads)', equipment: 'Other' },
  { name: 'Goblet Squat', category: 'Legs (Quads)', equipment: 'Other' },
  { name: 'Hack Squat', category: 'Legs (Quads)', equipment: 'Other' },
  { name: 'Leg Press', category: 'Legs (Quads)', equipment: 'Other' },
  { name: 'Bulgarian Split Squat', category: 'Legs (Quads)', equipment: 'Other' },
  { name: 'Step-Ups', category: 'Legs (Quads)', equipment: 'Other' },
  { name: 'Spanish Squat', category: 'Legs (Quads)', equipment: 'Other' },
  { name: 'Wall Sit', category: 'Legs (Quads)', equipment: 'Other' },
  { name: 'Sissy Squat (Assisted)', category: 'Legs (Quads)', equipment: 'Other' },

  // Legs (Hamstrings)
  { name: 'Romanian Deadlift', category: 'Legs (Hamstrings)', equipment: 'Other' },
  { name: 'Stiff-Leg Deadlift', category: 'Legs (Hamstrings)', equipment: 'Other' },
  { name: 'Seated Hamstring Curl', category: 'Legs (Hamstrings)', equipment: 'Other' },
  { name: 'Lying Hamstring Curl', category: 'Legs (Hamstrings)', equipment: 'Other' },
  { name: 'Nordic Hamstring Curl (Assisted)', category: 'Legs (Hamstrings)', equipment: 'Other' },
  { name: 'Single-Leg Romanian Deadlift', category: 'Legs (Hamstrings)', equipment: 'Other' },
  { name: 'Hip Hinge Machine', category: 'Legs (Hamstrings)', equipment: 'Other' },

  // Glutes
  { name: 'Hip Thrust (Barbell)', category: 'Glutes', equipment: 'Other' },
  { name: 'Hip Thrust (Machine)', category: 'Glutes', equipment: 'Other' },
  { name: 'Glute Bridge', category: 'Glutes', equipment: 'Other' },
  { name: 'Cable Kickback', category: 'Glutes', equipment: 'Other' },
  { name: 'Reverse Lunge', category: 'Glutes', equipment: 'Other' },
  { name: 'Walking Lunge', category: 'Glutes', equipment: 'Other' },
  { name: 'Step-Back Lunge', category: 'Glutes', equipment: 'Other' },
  { name: 'Curtsy Lunge', category: 'Glutes', equipment: 'Other' },
  
  // Adductors / Abductors
  { name: 'Adductor Machine', category: 'Adductors / Abductors', equipment: 'Other' },
  { name: 'Abductor Machine', category: 'Adductors / Abductors', equipment: 'Other' },
  { name: 'Copenhagen Plank', category: 'Adductors / Abductors', equipment: 'Other' },
  { name: 'Lateral Lunge', category: 'Adductors / Abductors', equipment: 'Other' },
  { name: 'Cable Hip Adduction', category: 'Adductors / Abductors', equipment: 'Other' },
  { name: 'Cable Hip Abduction', category: 'Adductors / Abductors', equipment: 'Other' },

  // Calves
  { name: 'Standing Calf Raise', category: 'Calves', equipment: 'Other' },
  { name: 'Seated Calf Raise', category: 'Calves', equipment: 'Other' },
  { name: 'Single-Leg Calf Raise', category: 'Calves', equipment: 'Other' },
  { name: 'Donkey Calf Raise', category: 'Calves', equipment: 'Other' },
  { name: 'Calf Press (Leg Press Machine)', category: 'Calves', equipment: 'Other' },

  // Core (Anti-Extension / Stability)
  { name: 'Plank', category: 'Core (Anti-Extension / Stability)', equipment: 'Other' },
  { name: 'Side Plank', category: 'Core (Anti-Extension / Stability)', equipment: 'Other' },
  { name: 'Dead Bug', category: 'Core (Anti-Extension / Stability)', equipment: 'Other' },
  { name: 'Bird Dog', category: 'Core (Anti-Extension / Stability)', equipment: 'Other' },
  { name: 'Pallof Press', category: 'Core (Anti-Extension / Stability)', equipment: 'Other' },
  { name: 'Stability Ball Rollout', category: 'Core (Anti-Extension / Stability)', equipment: 'Other' },
  { name: 'Ab Wheel Rollout', category: 'Core (Anti-Extension / Stability)', equipment: 'Other' },
  
  // Core (Flexion / Rotation)
  { name: 'Hanging Knee Raise', category: 'Core (Flexion / Rotation)', equipment: 'Other' },
  { name: 'Hanging Leg Raise', category: 'Core (Flexion / Rotation)', equipment: 'Other' },
  { name: "Captain's Chair Leg Raise", category: 'Core (Flexion / Rotation)', equipment: 'Other' },
  { name: 'Cable Crunch', category: 'Core (Flexion / Rotation)', equipment: 'Other' },
  { name: 'Decline Sit-Up', category: 'Core (Flexion / Rotation)', equipment: 'Other' },
  { name: 'Russian Twist (Controlled)', category: 'Core (Flexion / Rotation)', equipment: 'Other' },
  { name: 'Cable Woodchop', category: 'Core (Flexion / Rotation)', equipment: 'Other' },
  { name: 'Cable Lift', category: 'Core (Flexion / Rotation)', equipment: 'Other' },

  // Carry / Athletic
  { name: "Farmer's Carry", category: 'Carry / Athletic', equipment: 'Other' },
  { name: 'Suitcase Carry', category: 'Carry / Athletic', equipment: 'Other' },
  { name: 'Front Rack Carry', category: 'Carry / Athletic', equipment: 'Other' },
  { name: 'Overhead Carry', category: 'Carry / Athletic', equipment: 'Other' },
  { name: 'Sled Push', category: 'Carry / Athletic', equipment: 'Other' },
  { name: 'Sled Pull', category: 'Carry / Athletic', equipment: 'Other' },

  // Conditioning (Low-Impact)
  { name: 'Assault Bike', category: 'Conditioning (Low-Impact)', equipment: 'Other' },
  { name: 'Row Erg', category: 'Conditioning (Low-Impact)', equipment: 'Other' },
  { name: 'Ski Erg', category: 'Conditioning (Low-Impact)', equipment: 'Other' },
  { name: 'Incline Treadmill Walk', category: 'Conditioning (Low-Impact)', equipment: 'Other' },
  { name: 'Stair Climber', category: 'Conditioning (Low-Impact)', equipment: 'Other' },
];


