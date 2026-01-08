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
const ACCENT_PRIMARY = '#FC6B00';

export const COLORS = {
  // Core colors
  background: '#E3E6E0',    // Default background
  backgroundCanvas: '#E2E3DF',  // Page background (like Today tab)
  backgroundContainer: '#D0D1CD', // Bottom nav background
  canvas: '#1C1C1E',        // Card/container background (dark mode)
  container: '#2C2C2E',     // Secondary container
  cardBackground: '#E3E3DE', // Card background (light)
  
  // Primary actions
  primary: '#227132',       // Green for actions
  primarySoft: '#1E3A24',   // Soft green background
  
  // Secondary/accent
  secondary: '#007AFF',     // Blue
  secondarySoft: '#1C2A3A', // Soft blue background
  accentPrimary: ACCENT_PRIMARY,        // Orange for highlights (gradient start)
  accentPrimaryLight: adjustLightness(ACCENT_PRIMARY, 30), // 30% lighter
  accentPrimaryDark: adjustLightness(ACCENT_PRIMARY, -8),  // 8% darker
  
  // Text
  text: '#1B1B1B',              // Default text color (dark)
  textPrimary: '#FFFFFF',          // Primary text (white)
  textSecondary: '#3C3C43', // Secondary text
  textMeta: '#817B77',          // Metadata/labels
  textDisabled: '#C7C7CC',      // Disabled text
  
  // Borders & dividers
  border: '#AEAEAB',        // Subtle borders
  disabledBorder: '#D2D2D2', // Disabled button border
  divider: '#48484A',       // Dividers
  overlay: 'rgba(0, 0, 0, 0.2)', // Bottom sheet overlays
  
  // Status colors
  signalPositive: '#227132',
  success: '#227132',
  warning: '#FF9500',
  error: '#FF3B30',
  
  // Exercise categories
  chest: '#FF6B6B',
  back: '#4ECDC4',
  legs: '#FFD93D',
  shoulders: '#A8E6CF',
  arms: '#FF8B94',
  core: '#C7CEEA',
};

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
    backgroundColor: '#E3E3DE',
    borderRadius: 16,  // Squircle-friendly
    borderCurve: 'continuous' as const,
    borderWidth: 1,
    borderColor: '#AEAEAB',
  },
  cardDeep: {
    // Outer card (black shadow layer)
    blackShadow: {
      shadowColor: '#000000',
      shadowOffset: { width: -1, height: -1 },
      shadowOpacity: 0.08,
      shadowRadius: 1,
      elevation: 2,
    },
    // Middle layer (white shadow)
    whiteShadow: {
      shadowColor: '#FFFFFF',
      shadowOffset: { width: 1, height: 1 },
      shadowOpacity: 1,
      shadowRadius: 1,
      elevation: 1,
    },
    // Outer card container
    outer: {
      backgroundColor: '#E3E3DE',
      borderRadius: 16,  // Squircle-friendly
      borderCurve: 'continuous' as const,
      borderWidth: 1,
      borderColor: '#AEAEAB',
      overflow: 'hidden' as const,
    },
    // Inner card with borders for depth
    inner: {
      backgroundColor: '#E2E3DF',
      borderRadius: 16,  // Squircle-friendly
      borderCurve: 'continuous' as const,
      borderTopWidth: 2,
      borderLeftWidth: 2,
      borderBottomWidth: 2,
      borderRightWidth: 2,
      borderTopColor: 'rgba(255, 255, 255, 0.75)',
      borderLeftColor: 'rgba(255, 255, 255, 0.75)',
      borderBottomColor: 'rgba(0, 0, 0, 0.08)',
      borderRightColor: 'rgba(0, 0, 0, 0.08)',
    },
  },
  cardDeepDimmed: {
    // Same shadows as default
    blackShadow: {
      shadowColor: '#000000',
      shadowOffset: { width: -1, height: -1 },
      shadowOpacity: 0.08,
      shadowRadius: 1,
      elevation: 2,
    },
    whiteShadow: {
      shadowColor: '#FFFFFF',
      shadowOffset: { width: 1, height: 1 },
      shadowOpacity: 1,
      shadowRadius: 1,
      elevation: 1,
    },
    outer: {
      backgroundColor: '#E3E3DE',
      borderRadius: 16,  // Squircle-friendly
      borderCurve: 'continuous' as const,
      borderWidth: 1,
      borderColor: '#AEAEAB',
      overflow: 'hidden' as const,
    },
    // Inner card WITHOUT borders (dimmed state)
    inner: {
      backgroundColor: '#E2E3DF',
      borderRadius: 16,  // Squircle-friendly
      borderCurve: 'continuous' as const,
      borderTopWidth: 2,
      borderLeftWidth: 2,
      borderBottomWidth: 2,
      borderRightWidth: 2,
      borderTopColor: 'transparent',
      borderLeftColor: 'transparent',
      borderBottomColor: 'transparent',
      borderRightColor: 'transparent',
    },
  },
  cardDeepDisabled: {
    // Same shadows as default
    blackShadow: {
      shadowColor: '#000000',
      shadowOffset: { width: -1, height: -1 },
      shadowOpacity: 0.08,
      shadowRadius: 1,
      elevation: 2,
    },
    whiteShadow: {
      shadowColor: '#FFFFFF',
      shadowOffset: { width: 1, height: 1 },
      shadowOpacity: 1,
      shadowRadius: 1,
      elevation: 1,
    },
    // Outer card with disabled border color
    outer: {
      backgroundColor: '#E3E3DE',
      borderRadius: 16,  // Squircle-friendly
      borderCurve: 'continuous' as const,
      borderWidth: 1,
      borderColor: '#D2D2D2', // disabledBorder color
      overflow: 'hidden' as const,
    },
    // Inner card WITHOUT borders (disabled state)
    inner: {
      backgroundColor: '#E2E3DF',
      borderRadius: 16,  // Squircle-friendly
      borderCurve: 'continuous' as const,
      borderTopWidth: 2,
      borderLeftWidth: 2,
      borderBottomWidth: 2,
      borderRightWidth: 2,
      borderTopColor: 'transparent',
      borderLeftColor: 'transparent',
      borderBottomColor: 'transparent',
      borderRightColor: 'transparent',
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
};

// Seed exercises for initial app state
export const SEED_EXERCISES = [
  // Chest
  { name: 'Bench Press', category: 'Chest', equipment: 'Barbell' },
  { name: 'Incline Dumbbell Press', category: 'Chest', equipment: 'Dumbbell' },
  { name: 'Chest Fly', category: 'Chest', equipment: 'Dumbbell' },
  { name: 'Push-ups', category: 'Chest', equipment: 'Bodyweight' },
  { name: 'Dips', category: 'Chest', equipment: 'Bodyweight' },
  
  // Back
  { name: 'Deadlift', category: 'Back', equipment: 'Barbell' },
  { name: 'Pull-ups', category: 'Back', equipment: 'Bodyweight' },
  { name: 'Barbell Row', category: 'Back', equipment: 'Barbell' },
  { name: 'Lat Pulldown', category: 'Back', equipment: 'Machine' },
  { name: 'Dumbbell Row', category: 'Back', equipment: 'Dumbbell' },
  { name: 'Face Pulls', category: 'Back', equipment: 'Cable' },
  
  // Legs
  { name: 'Squat', category: 'Legs', equipment: 'Barbell' },
  { name: 'Romanian Deadlift', category: 'Legs', equipment: 'Barbell' },
  { name: 'Leg Press', category: 'Legs', equipment: 'Machine' },
  { name: 'Leg Curl', category: 'Legs', equipment: 'Machine' },
  { name: 'Leg Extension', category: 'Legs', equipment: 'Machine' },
  { name: 'Lunges', category: 'Legs', equipment: 'Dumbbell' },
  { name: 'Calf Raises', category: 'Legs', equipment: 'Machine' },
  
  // Shoulders
  { name: 'Overhead Press', category: 'Shoulders', equipment: 'Barbell' },
  { name: 'Dumbbell Shoulder Press', category: 'Shoulders', equipment: 'Dumbbell' },
  { name: 'Lateral Raises', category: 'Shoulders', equipment: 'Dumbbell' },
  { name: 'Front Raises', category: 'Shoulders', equipment: 'Dumbbell' },
  { name: 'Rear Delt Fly', category: 'Shoulders', equipment: 'Dumbbell' },
  
  // Arms
  { name: 'Barbell Curl', category: 'Arms', equipment: 'Barbell' },
  { name: 'Hammer Curl', category: 'Arms', equipment: 'Dumbbell' },
  { name: 'Tricep Pushdown', category: 'Arms', equipment: 'Cable' },
  { name: 'Overhead Tricep Extension', category: 'Arms', equipment: 'Dumbbell' },
  { name: 'Close-Grip Bench Press', category: 'Arms', equipment: 'Barbell' },
  
  // Core
  { name: 'Plank', category: 'Core', equipment: 'Bodyweight' },
  { name: 'Russian Twists', category: 'Core', equipment: 'Bodyweight' },
  { name: 'Cable Crunch', category: 'Core', equipment: 'Cable' },
  { name: 'Hanging Leg Raises', category: 'Core', equipment: 'Bodyweight' },
];


