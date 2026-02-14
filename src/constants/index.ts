// Design tokens and constants for the app

// Utility functions for color manipulation
function hexToHSL(hex: string): { h: number; s: number; l: number } {
  // Remove # if present
  hex = hex.replace('#', '');
  
  // Convert hex to RGB
  const r = parseInt(hex.substring(0, 2), 16) / 255;
  const g = parseInt(hex.substring(2, 4), 16) / 255;
  const b = parseInt(hex.substring(4, 6), 16) / 255;
  
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const delta = max - min;
  
  let h = 0;
  let s = 0;
  const l = (max + min) / 2;
  
  if (delta !== 0) {
    s = l > 0.5 ? delta / (2 - max - min) : delta / (max + min);
    
    switch (max) {
      case r:
        h = ((g - b) / delta + (g < b ? 6 : 0)) / 6;
        break;
      case g:
        h = ((b - r) / delta + 2) / 6;
        break;
      case b:
        h = ((r - g) / delta + 4) / 6;
        break;
    }
  }
  
  return {
    h: h * 360,
    s: s * 100,
    l: l * 100,
  };
}

function hslToHex(h: number, s: number, l: number): string {
  s = s / 100;
  l = l / 100;
  
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - c / 2;
  
  let r = 0, g = 0, b = 0;
  
  if (h >= 0 && h < 60) {
    r = c; g = x; b = 0;
  } else if (h >= 60 && h < 120) {
    r = x; g = c; b = 0;
  } else if (h >= 120 && h < 180) {
    r = 0; g = c; b = x;
  } else if (h >= 180 && h < 240) {
    r = 0; g = x; b = c;
  } else if (h >= 240 && h < 300) {
    r = x; g = 0; b = c;
  } else {
    r = c; g = 0; b = x;
  }
  
  const toHex = (n: number) => {
    const hex = Math.round((n + m) * 255).toString(16);
    return hex.length === 1 ? '0' + hex : hex;
  };
  
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`.toUpperCase();
}

function adjustLightness(hex: string, amount: number): string {
  const hsl = hexToHSL(hex);
  hsl.l = Math.max(0, Math.min(100, hsl.l + amount));
  return hslToHex(hsl.h, hsl.s, hsl.l);
}

// Base accent color
const ACCENT_PRIMARY = '#2F06FF';
const SIGNAL_NEGATIVE = '#FF0651';
const SIGNAL_POSITIVE = '#1CAA00';
const SIGNAL_WARNING = '#FFBD06';
const BORDER_DIMMED = 'rgba(0, 0, 0, 0.08)';

export const COLORS = {
  // Core colors
  background: '#E3E6E0',    // Default background
  backgroundCanvas: '#EFEAEA',  // Page background (like Today tab)
  backgroundContainer: '#D0D1CD', // Bottom nav background
  canvas: '#1C1C1E',        // Card/container background (dark mode)
  container: '#2C2C2E',     // Secondary container
  cardBackground: '#E3E3DE', // Card background (light)
  activeCard: '#FBF7F7',    // Active/default card state
  
  // Primary actions
  primary: SIGNAL_POSITIVE,       // Green for actions
  primarySoft: adjustLightness(SIGNAL_POSITIVE, -35),   // Soft green background
  
  // Secondary/accent
  secondary: '#007AFF',     // Blue
  secondarySoft: '#1C2A3A', // Soft blue background
  accentPrimary: ACCENT_PRIMARY,        // Orange for highlights (gradient start)
  accentPrimaryLight: adjustLightness(ACCENT_PRIMARY, 30), // 30% lighter
  accentPrimaryDark: adjustLightness(ACCENT_PRIMARY, -8),  // 8% darker
  accentPrimaryDimmed: '#CDD5FF',       // Light blue background for selected states
  accentSecondary: '#E3E3E3',           // Secondary accent color for buttons
  
  // Text
  text: '#1B1B1B',              // Default text color (dark)
  textPrimary: '#FFFFFF',          // Primary text (white)
  textSecondary: '#3C3C43', // Secondary text
  textMeta: '#817B77',          // Metadata/labels
  textMetaSoft: '#CBC8C7',      // Soft metadata/dividers
  textDisabled: '#C7C7CC',      // Disabled text
  
  // Borders & dividers
  border: '#D2D3CF',        // Subtle borders
  disabledBorder: '#D2D2D2', // Disabled button border
  borderDimmed: BORDER_DIMMED, // Dimmed dividers
  divider: BORDER_DIMMED,       // Dividers
  overlay: 'rgba(0, 0, 0, 0.2)', // Bottom sheet overlays
  containerBackground: '#E6DFDF', // Container background
  
  // Status colors
  signalNegative: SIGNAL_NEGATIVE,
  signalPositive: SIGNAL_POSITIVE,
  signalWarning: SIGNAL_WARNING,
  success: SIGNAL_POSITIVE,
  warning: SIGNAL_WARNING,
  error: SIGNAL_NEGATIVE,
  
  // Exercise categories
  chest: SIGNAL_NEGATIVE,
  back: '#4ECDC4',
  legs: SIGNAL_WARNING,
  shoulders: '#A8E6CF',
  arms: '#FF8B94',
  core: '#C7CEEA',
};

// Muted background colors for cycle/plan grouping on the calendar
export const CYCLE_COLORS = [
  '#D6E4F0', // soft blue
  '#D9F0D6', // soft green
  '#F0E8D6', // soft amber
  '#F0D6DE', // soft rose
  '#E0D6F0', // soft violet
  '#D6F0EC', // soft teal
];

export const GRADIENTS = {
  accentPrimary: {
    colors: [ACCENT_PRIMARY, '#FF8C38'] as const,
    start: { x: 0.42, y: 0.42 },
    end: { x: 1, y: 1 },
  },
  backgroundLight: {
    colors: ['#E3E6E0', '#D4D6D1'] as const,
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
    fontWeight: '300' as const,
  },
  h2: {
    fontSize: 24,
    fontWeight: '400' as const,
  },
  h3: {
    fontSize: 20,
    fontWeight: '400' as const,
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
    shadowOpacity: 0.2,
    shadowRadius: 1.41,
    elevation: 2,
  },
  md: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.23,
    shadowRadius: 2.62,
    elevation: 4,
  },
  lg: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 4.65,
    elevation: 8,
  },
};

export const CARDS = {
  cardFlat: {
    backgroundColor: '#FBF7F7', // activeCard
    borderRadius: 16,  // Squircle-friendly
    borderCurve: 'continuous' as const,
    borderWidth: 0,
    borderColor: 'transparent',
  },
  cardDeep: {
    // Outer card container (no external shadows)
    outer: {
      backgroundColor: '#FBF7F7', // activeCard
      borderRadius: 16,  // Squircle-friendly
      borderCurve: 'continuous' as const,
      overflow: 'hidden' as const,
      borderWidth: 0,
      borderColor: 'transparent',
    },
    // Inner card without borders (flat)
    inner: {
      backgroundColor: '#FBF7F7', // activeCard
      borderRadius: 16,  // Squircle-friendly
      borderCurve: 'continuous' as const,
    },
  },
  cardDeepDimmed: {
    // No external shadows (dimmed state)
    outer: {
      backgroundColor: '#FBF7F7', // activeCard
      borderRadius: 16,  // Squircle-friendly
      borderCurve: 'continuous' as const,
      overflow: 'hidden' as const,
      borderWidth: 0,
      borderColor: 'transparent',
    },
    // Inner card WITHOUT borders (dimmed state)
    inner: {
      backgroundColor: '#FBF7F7', // activeCard
      borderRadius: 16,  // Squircle-friendly
      borderCurve: 'continuous' as const,
    },
  },
  cardDeepDisabled: {
    // No external shadows (disabled state)
    // Outer card with disabled border color
    outer: {
      backgroundColor: '#E3E3DE',
      borderRadius: 16,  // Squircle-friendly
      borderCurve: 'continuous' as const,
      overflow: 'hidden' as const,
      borderWidth: 0,
      borderColor: 'transparent',
    },
    // Inner card without borders (disabled state)
    inner: {
      backgroundColor: '#E2E3DF',
      borderRadius: 16,  // Squircle-friendly
      borderCurve: 'continuous' as const,
    },
  },
};

// Button styles
export const BUTTONS = {
  primaryButtonNoLabel: {
    width: 80,
    height: 80,
    borderRadius: 20,  // Squircle-friendly (25% of 80 for true squircle proportion)
    borderCurve: 'continuous' as const,
    backgroundColor: '#1B1B1B',
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  primaryButtonLabeled: {
    height: 56,
    borderRadius: 16,  // md (16px)
    borderCurve: 'continuous' as const,
    backgroundColor: '#1B1B1B',
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


