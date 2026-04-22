import { useStore } from '../store';
import * as storage from '../storage';
import dayjs from 'dayjs';

/**
 * Seeds a single fake detailedWorkoutProgress entry for Bench Press only.
 * Does NOT touch other exercises — they use their real logged data.
 *
 * Bench Press: 185 lb × 6 reps × 3 sets
 * With default rule (8-12 reps, double, +2.5 lb):
 *   6 < 12 → repeat → card shows 185 lb, target 8 reps
 */
export async function addFakeProgressionLogs() {
  const store = useStore.getState();
  const exercises = store.exercises;

  const benchPress = exercises.find(e => e.name === 'Bench Press');
  if (!benchPress) {
    console.log('❌ Could not find Bench Press. Available:', exercises.map(e => e.name));
    return;
  }

  const fakeDate = dayjs().subtract(3, 'days').format('YYYY-MM-DD');
  const fakeTemplateId = 'fake-progression-tmpl';
  const fakeWorkoutKey = `${fakeTemplateId}-${fakeDate}`;
  const itemId = `fake-item-${benchPress.id}`;

  // Fake template with only Bench Press
  const fakeTemplate: any = {
    id: fakeTemplateId,
    cycleId: 'fake-cycle',
    name: 'Fake Progression Template',
    workoutType: 'Push',
    orderIndex: 999,
    exercises: [],
    items: [{
      id: itemId,
      exerciseId: benchPress.id,
      orderIndex: 0,
      targetSets: 3,
      targetRepsMin: 8,
      progressionType: 'double',
    }],
  };

  const existingTemplates = store.workoutTemplates.filter(t => t.id !== fakeTemplateId);
  useStore.setState({ workoutTemplates: [...existingTemplates, fakeTemplate] });

  // Write detailedWorkoutProgress entry for Bench Press only
  const existingProgress = { ...store.detailedWorkoutProgress };
  // Clean up any previous fake entry
  delete existingProgress[fakeWorkoutKey];
  Object.keys(existingProgress).forEach(k => { if (k.startsWith(fakeTemplateId)) delete existingProgress[k]; });

  existingProgress[fakeWorkoutKey] = {
    workoutKey: fakeWorkoutKey,
    exercises: {
      [itemId]: {
        exerciseId: benchPress.id,
        sets: [
          { setNumber: 0, weight: 185, reps: 6, completed: true },
          { setNumber: 1, weight: 185, reps: 6, completed: true },
          { setNumber: 2, weight: 185, reps: 6, completed: true },
        ],
        skipped: false,
      },
    },
    lastUpdated: dayjs().subtract(3, 'days').toISOString(),
  };

  useStore.setState({ detailedWorkoutProgress: existingProgress });
  await storage.saveDetailedWorkoutProgress(existingProgress);

  console.log(`✅ Seeded Bench Press log: 185 lb × 6 reps × 3 sets (${fakeWorkoutKey})`);
  console.log('   Other exercises untouched — they use real logs.');
}
