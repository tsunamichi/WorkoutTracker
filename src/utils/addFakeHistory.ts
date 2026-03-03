import { useStore } from '../store';
import * as storage from '../storage';
import dayjs from 'dayjs';

/**
 * Adds fake workout history for testing the history feature on exercise detail screens
 */
export async function addFakeHistory() {
  const store = useStore.getState();
  
  const barbellRow = store.exercises.find(e => e.name === 'Barbell Row');
  const hammerCurl = store.exercises.find(e => e.name === 'Hammer Curl');
  const rearDeltRow = store.exercises.find(e => e.name.includes('Rear Delt'));
  
  if (!barbellRow || !hammerCurl || !rearDeltRow) {
    console.log('❌ Could not find exercises. Available:', store.exercises.map(e => e.name));
    return;
  }
  
  const sessions = [];
  
  sessions.push({
    id: `fake-session-${Date.now()}-1`,
    date: dayjs().subtract(21, 'days').format('YYYY-MM-DD'),
    startTime: dayjs().subtract(21, 'days').hour(10).minute(0).toISOString(),
    endTime: dayjs().subtract(21, 'days').hour(11).minute(30).toISOString(),
    notes: 'Good session',
    sets: [
      { id: `set-1-1`, sessionId: `fake-session-${Date.now()}-1`, exerciseId: barbellRow.id, setIndex: 0, weight: 135, reps: 8, isCompleted: true },
      { id: `set-1-2`, sessionId: `fake-session-${Date.now()}-1`, exerciseId: barbellRow.id, setIndex: 1, weight: 135, reps: 8, isCompleted: true },
      { id: `set-1-3`, sessionId: `fake-session-${Date.now()}-1`, exerciseId: barbellRow.id, setIndex: 2, weight: 135, reps: 7, isCompleted: true },
      { id: `set-1-4`, sessionId: `fake-session-${Date.now()}-1`, exerciseId: rearDeltRow.id, setIndex: 0, weight: 80, reps: 12, isCompleted: true },
      { id: `set-1-5`, sessionId: `fake-session-${Date.now()}-1`, exerciseId: rearDeltRow.id, setIndex: 1, weight: 80, reps: 12, isCompleted: true },
      { id: `set-1-6`, sessionId: `fake-session-${Date.now()}-1`, exerciseId: rearDeltRow.id, setIndex: 2, weight: 80, reps: 11, isCompleted: true },
      { id: `set-1-7`, sessionId: `fake-session-${Date.now()}-1`, exerciseId: hammerCurl.id, setIndex: 0, weight: 35, reps: 12, isCompleted: true },
      { id: `set-1-8`, sessionId: `fake-session-${Date.now()}-1`, exerciseId: hammerCurl.id, setIndex: 1, weight: 35, reps: 12, isCompleted: true },
      { id: `set-1-9`, sessionId: `fake-session-${Date.now()}-1`, exerciseId: hammerCurl.id, setIndex: 2, weight: 35, reps: 11, isCompleted: true },
    ],
  });
  
  for (const session of sessions) {
    await store.addSession(session);
  }
  
  console.log(`✅ Added ${sessions.length} fake workout sessions with history!`);
}

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
