import { CycleTemplateId, UserPrefs, DayPlan, Exercise, CycleDraft } from '../types/workout';
import { getTemplates, getTemplateById } from '../data/templates';

// Helper to generate unique IDs
function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

export { getTemplates, getTemplateById };

/**
 * Map a template to day titles based on daysPerWeek
 */
export function mapTemplateDays(templateId: CycleTemplateId, daysPerWeek: number): string[] {
  switch (templateId) {
    case 'full_body':
      if (daysPerWeek <= 2) {
        return ['Full Body A', 'Full Body B'].slice(0, daysPerWeek);
      } else if (daysPerWeek === 3) {
        return ['Full Body A', 'Full Body B', 'Full Body C'];
      } else {
        return ['Full Body A', 'Full Body B', 'Full Body C', 'Full Body D', 'Full Body A', 'Full Body B', 'Full Body C']
          .slice(0, daysPerWeek);
      }

    case 'upper_lower':
      if (daysPerWeek === 3) {
        return ['Upper A', 'Lower A', 'Upper B'];
      } else if (daysPerWeek === 4) {
        return ['Upper A', 'Lower A', 'Upper B', 'Lower B'];
      } else if (daysPerWeek === 5) {
        return ['Upper A', 'Lower A', 'Upper B', 'Lower B', 'Arms + Core'];
      } else if (daysPerWeek >= 6) {
        return ['Upper A', 'Lower A', 'Upper B', 'Lower B', 'Arms + Core', 'Conditioning']
          .slice(0, daysPerWeek);
      } else {
        return ['Upper', 'Lower'].slice(0, daysPerWeek);
      }

    case 'ppl':
      if (daysPerWeek === 3) {
        return ['Push', 'Pull', 'Legs'];
      } else if (daysPerWeek === 4) {
        return ['Push', 'Pull', 'Legs', 'Push'];
      } else if (daysPerWeek >= 5) {
        return ['Push', 'Pull', 'Legs', 'Push', 'Pull', 'Legs'].slice(0, Math.min(daysPerWeek, 6));
      } else {
        return ['Push', 'Pull'].slice(0, daysPerWeek);
      }

    case 'bro_split':
      if (daysPerWeek === 5) {
        return ['Chest', 'Back', 'Legs', 'Shoulders', 'Arms'];
      } else if (daysPerWeek === 4) {
        return ['Chest + Triceps', 'Back + Biceps', 'Legs', 'Shoulders + Arms'];
      } else if (daysPerWeek === 3) {
        return ['Upper A', 'Lower', 'Upper B (Arms + Shoulders)'];
      } else if (daysPerWeek >= 6) {
        return ['Chest', 'Back', 'Legs', 'Shoulders', 'Arms', 'Full Body'].slice(0, daysPerWeek);
      } else {
        return ['Upper', 'Lower'].slice(0, daysPerWeek);
      }

    case 'strength_531':
      if (daysPerWeek === 3) {
        return ['Squat Day', 'Bench Day', 'Deadlift Day'];
      } else if (daysPerWeek >= 4) {
        return ['Squat Day', 'Bench Day', 'Deadlift Day', 'Overhead Press Day', 'Squat Day', 'Bench Day', 'Deadlift Day']
          .slice(0, daysPerWeek);
      } else {
        return ['Squat Day', 'Bench Day'].slice(0, daysPerWeek);
      }

    case 'powerbuilding':
      if (daysPerWeek === 4) {
        return ['Upper Strength', 'Lower Strength', 'Upper Hypertrophy', 'Lower Hypertrophy'];
      } else if (daysPerWeek === 3) {
        return ['Upper Strength', 'Lower Strength', 'Full Body Hypertrophy'];
      } else if (daysPerWeek >= 5) {
        return ['Upper Strength', 'Lower Strength', 'Upper Hypertrophy', 'Lower Hypertrophy', 'Full Body']
          .slice(0, daysPerWeek);
      } else {
        return ['Upper Strength', 'Lower Strength'].slice(0, daysPerWeek);
      }

    case 'hybrid':
      if (daysPerWeek === 3) {
        return ['Strength A', 'Conditioning', 'Strength B'];
      } else if (daysPerWeek === 4) {
        return ['Strength A', 'Conditioning', 'Strength B', 'Conditioning + Core'];
      } else if (daysPerWeek >= 5) {
        return ['Strength A', 'Conditioning', 'Strength B', 'Conditioning', 'Full Body']
          .slice(0, daysPerWeek);
      } else {
        return ['Strength A', 'Conditioning'].slice(0, daysPerWeek);
      }

    case 'custom':
      return Array.from({ length: daysPerWeek }, (_, i) => `Day ${i + 1}`);

    default:
      return Array.from({ length: daysPerWeek }, (_, i) => `Day ${i + 1}`);
  }
}

/**
 * Get default exercises for a given day title
 */
export function getDefaultExercisesForDay(templateId: CycleTemplateId, dayTitle: string): Exercise[] {
  const createExercise = (name: string, sets: number = 3, reps: string = '8-12', restSec: number = 90): Exercise => ({
    id: generateId(),
    name,
    sets,
    reps,
    restSec,
  });

  const dayLower = dayTitle.toLowerCase();

  // Push exercises
  if (dayLower.includes('push') || dayLower.includes('chest') || dayTitle === 'Upper Strength' || dayTitle === 'Upper Hypertrophy' || dayLower.includes('upper a')) {
    return [
      createExercise('Bench Press', 4, '5', 180),
      createExercise('Incline Dumbbell Press', 3, '8-10', 90),
      createExercise('Overhead Press', 3, '8-10', 120),
      createExercise('Lateral Raise', 3, '12-15', 60),
      createExercise('Triceps Pushdown', 3, '12-15', 60),
    ];
  }

  // Pull exercises
  if (dayLower.includes('pull') || dayLower.includes('back')) {
    return [
      createExercise('Pull-up', 4, '6-8', 120),
      createExercise('Barbell Row', 4, '8-10', 120),
      createExercise('Lat Pulldown', 3, '10-12', 90),
      createExercise('Face Pull', 3, '15-20', 60),
      createExercise('Dumbbell Curl', 3, '10-12', 60),
    ];
  }

  // Legs exercises
  if (dayLower.includes('leg') || dayLower.includes('lower')) {
    return [
      createExercise('Barbell Back Squat', 4, '5-8', 180),
      createExercise('Romanian Deadlift (RDL)', 3, '8-10', 120),
      createExercise('Leg Curl', 3, '10-12', 90),
      createExercise('Leg Extension', 3, '12-15', 60),
      createExercise('Calf Raise', 3, '15-20', 60),
    ];
  }

  // Shoulders
  if (dayLower.includes('shoulder')) {
    return [
      createExercise('Overhead Press', 4, '6-8', 120),
      createExercise('Lateral Raise', 4, '12-15', 60),
      createExercise('Front Raise', 3, '12-15', 60),
      createExercise('Face Pull', 3, '15-20', 60),
      createExercise('Shrugs', 3, '12-15', 60),
    ];
  }

  // Arms
  if (dayLower.includes('arm') || dayLower.includes('tricep') || dayLower.includes('bicep')) {
    return [
      createExercise('Barbell Curl', 3, '8-10', 90),
      createExercise('Hammer Curl', 3, '10-12', 60),
      createExercise('Triceps Pushdown', 3, '10-12', 60),
      createExercise('Overhead Triceps Extension', 3, '10-12', 60),
      createExercise('Cable Curl', 3, '12-15', 60),
    ];
  }

  // Strength days (5/3/1 or powerbuilding strength)
  if (dayLower.includes('squat day')) {
    return [
      createExercise('Barbell Back Squat', 4, '5', 240),
      createExercise('Front Squat', 3, '6-8', 180),
      createExercise('Leg Curl', 3, '8-12', 90),
      createExercise('Leg Extension', 3, '12-15', 60),
      createExercise('Plank', 3, '60s', 60),
    ];
  }

  if (dayLower.includes('bench day')) {
    return [
      createExercise('Bench Press', 4, '5', 240),
      createExercise('Incline Bench Press', 3, '6-8', 180),
      createExercise('Dumbbell Row', 3, '8-10', 90),
      createExercise('Triceps Pushdown', 3, '12-15', 60),
      createExercise('Face Pull', 3, '15-20', 60),
    ];
  }

  if (dayLower.includes('deadlift day')) {
    return [
      createExercise('Deadlift', 4, '5', 240),
      createExercise('Barbell Row', 3, '6-8', 180),
      createExercise('Pull-up', 3, '8-10', 120),
      createExercise('Leg Curl', 3, '10-12', 90),
      createExercise('Ab Wheel Rollout', 3, '10-15', 60),
    ];
  }

  if (dayLower.includes('overhead press day') || dayLower.includes('ohp day')) {
    return [
      createExercise('Overhead Press', 4, '5', 240),
      createExercise('Dumbbell Shoulder Press', 3, '8-10', 120),
      createExercise('Lateral Raise', 3, '12-15', 60),
      createExercise('Barbell Curl', 3, '8-10', 90),
      createExercise('Hammer Curl', 3, '10-12', 60),
    ];
  }

  // Conditioning
  if (dayLower.includes('conditioning') || dayLower.includes('cardio')) {
    return [
      createExercise('Rowing Machine', 1, '20min', 0),
      createExercise('Assault Bike Intervals', 5, '1min on / 1min off', 60),
      createExercise('Farmer\'s Walk', 4, '40m', 90),
      createExercise('Jump Rope', 3, '2min', 60),
      createExercise('Burpees', 3, '15', 60),
    ];
  }

  // Full Body fallback
  return [
    createExercise('Barbell Back Squat', 4, '6-8', 180),
    createExercise('Bench Press', 4, '6-8', 180),
    createExercise('Barbell Row', 3, '8-10', 120),
    createExercise('Overhead Press', 3, '8-10', 120),
    createExercise('Romanian Deadlift (RDL)', 3, '8-10', 120),
    createExercise('Plank', 3, '60s', 60),
  ];
}

/**
 * Generate a complete draft from a template
 */
export function generateDraftFromTemplate(templateId: CycleTemplateId, prefs: UserPrefs): CycleDraft {
  const template = getTemplateById(templateId);
  const templateName = template?.name || 'Custom Template';
  const dayTitles = mapTemplateDays(templateId, prefs.daysPerWeek);

  const days: DayPlan[] = dayTitles.map((title, index) => ({
    dayIndex: index + 1,
    title,
    exercises: getDefaultExercisesForDay(templateId, title),
  }));

  return {
    prefs,
    templateId,
    templateName,
    days,
    source: 'template',
  };
}

