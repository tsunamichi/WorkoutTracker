import { DayPlan, Exercise, UserPrefs } from '../types/workout';

// Helper to generate unique IDs
function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Parse raw workout plan text into structured DayPlan array
 * Best-effort parsing - never throws, always returns something
 */
export function parsePlanText(rawText: string, prefs: UserPrefs): DayPlan[] {
  const { daysPerWeek } = prefs;
  
  if (!rawText || !rawText.trim()) {
    return createEmptyDays(daysPerWeek);
  }

  try {
    const lines = rawText.split('\n').map(line => line.trim()).filter(Boolean);
    
    // Try to detect day sections
    const dayPattern = /^(day\s*\d+|monday|tuesday|wednesday|thursday|friday|saturday|sunday|upper|lower|push|pull|legs?|full\s*body|chest|back|shoulders?|arms?)/i;
    
    const days: DayPlan[] = [];
    let currentDay: DayPlan | null = null;
    let dayCounter = 1;

    for (const line of lines) {
      // Check if this is a day heading
      if (dayPattern.test(line) && line.length < 40) {
        // Save previous day if exists
        if (currentDay) {
          days.push(currentDay);
        }
        
        // Start new day
        currentDay = {
          dayIndex: dayCounter++,
          title: cleanDayTitle(line),
          exercises: [],
        };
        continue;
      }

      // Try to parse as exercise
      if (currentDay) {
        const exercise = parseExerciseLine(line);
        if (exercise) {
          currentDay.exercises.push(exercise);
        }
      } else {
        // No day started yet, create first day
        currentDay = {
          dayIndex: dayCounter++,
          title: `Day ${dayCounter - 1}`,
          exercises: [],
        };
        const exercise = parseExerciseLine(line);
        if (exercise) {
          currentDay.exercises.push(exercise);
        }
      }
    }

    // Save last day
    if (currentDay) {
      days.push(currentDay);
    }

    // Ensure we have exactly daysPerWeek days
    return normalizeDayCount(days, daysPerWeek);
  } catch (error) {
    console.warn('Parse error, returning empty days:', error);
    return createEmptyDays(daysPerWeek);
  }
}

/**
 * Parse a single exercise line
 * Patterns: "3x8 Bench Press", "Squats 4x5", "Bench Press - 3 sets x 8 reps"
 */
function parseExerciseLine(line: string): Exercise | null {
  if (!line || line.length < 3) return null;

  // Remove leading bullets/dashes
  line = line.replace(/^[-•*]\s*/, '').trim();

  const exercise: Exercise = {
    id: generateId(),
    name: line,
    sets: 3,
    reps: '8-12',
    restSec: 90,
  };

  // Pattern: 3x8, 3 x 8, 3x8-12
  const pattern1 = /(\d+)\s*x\s*(\d+(-\d+)?)/i;
  const match1 = line.match(pattern1);
  if (match1) {
    exercise.sets = parseInt(match1[1], 10);
    exercise.reps = match1[2];
    exercise.name = line.replace(pattern1, '').trim().replace(/^[-:,]\s*/, '').trim();
    return exercise;
  }

  // Pattern: "3 sets x 8 reps", "3 sets of 8"
  const pattern2 = /(\d+)\s*sets?\s*[xof×]\s*(\d+(-\d+)?)\s*(reps?)?/i;
  const match2 = line.match(pattern2);
  if (match2) {
    exercise.sets = parseInt(match2[1], 10);
    exercise.reps = match2[2];
    exercise.name = line.replace(pattern2, '').trim().replace(/^[-:,]\s*/, '').trim();
    return exercise;
  }

  // Pattern: exercise name first, then sets/reps
  const pattern3 = /^(.*?)\s*[-:]\s*(\d+)\s*x\s*(\d+(-\d+)?)/i;
  const match3 = line.match(pattern3);
  if (match3) {
    exercise.name = match3[1].trim();
    exercise.sets = parseInt(match3[2], 10);
    exercise.reps = match3[3];
    return exercise;
  }

  // Just a name - return with defaults
  if (line.length > 2 && line.length < 100) {
    exercise.name = line;
    return exercise;
  }

  return null;
}

function cleanDayTitle(title: string): string {
  // Remove "Day 1:", "Day1", etc and capitalize properly
  title = title.replace(/^day\s*\d+\s*:?\s*/i, '').trim();
  
  if (!title) {
    return 'Workout';
  }

  // Capitalize first letter of each word
  return title
    .split(/\s+/)
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
}

function createEmptyDays(count: number): DayPlan[] {
  return Array.from({ length: count }, (_, i) => ({
    dayIndex: i + 1,
    title: `Day ${i + 1}`,
    exercises: [],
  }));
}

function normalizeDayCount(days: DayPlan[], targetCount: number): DayPlan[] {
  if (days.length === targetCount) {
    return days;
  }

  if (days.length > targetCount) {
    return days.slice(0, targetCount);
  }

  // Need more days
  const result = [...days];
  while (result.length < targetCount) {
    result.push({
      dayIndex: result.length + 1,
      title: `Day ${result.length + 1}`,
      exercises: [],
    });
  }

  return result;
}

