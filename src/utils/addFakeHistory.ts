import { useStore } from '../store';
import dayjs from 'dayjs';

/**
 * Adds fake workout history for testing the history feature on exercise detail screens
 */
export async function addFakeHistory() {
  const store = useStore.getState();
  
  // Find exercise IDs from the seed exercises
  const barbellRow = store.exercises.find(e => e.name === 'Barbell Row');
  const hammerCurl = store.exercises.find(e => e.name === 'Hammer Curl');
  const rearDeltRow = store.exercises.find(e => e.name.includes('Rear Delt'));
  
  if (!barbellRow || !hammerCurl || !rearDeltRow) {
    console.log('❌ Could not find exercises. Available exercises:', store.exercises.map(e => e.name));
    return;
  }
  
  console.log('✅ Found exercises:', { barbellRow: barbellRow.id, hammerCurl: hammerCurl.id, rearDeltRow: rearDeltRow.id });
  
  // Create fake sessions for the past 4 weeks
  const sessions = [];
  
  // Week 1 - 21 days ago
  sessions.push({
    id: `fake-session-${Date.now()}-1`,
    date: dayjs().subtract(21, 'days').format('YYYY-MM-DD'),
    startTime: dayjs().subtract(21, 'days').hour(10).minute(0).toISOString(),
    endTime: dayjs().subtract(21, 'days').hour(11).minute(30).toISOString(),
    notes: 'Good session',
    sets: [
      // Barbell Row - 3 sets
      { id: `set-1-1`, sessionId: `fake-session-${Date.now()}-1`, exerciseId: barbellRow.id, setIndex: 0, weight: 95, reps: 10, isCompleted: true },
      { id: `set-1-2`, sessionId: `fake-session-${Date.now()}-1`, exerciseId: barbellRow.id, setIndex: 1, weight: 95, reps: 10, isCompleted: true },
      { id: `set-1-3`, sessionId: `fake-session-${Date.now()}-1`, exerciseId: barbellRow.id, setIndex: 2, weight: 95, reps: 9, isCompleted: true },
      
      // Rear Delt Row - 3 sets
      { id: `set-1-4`, sessionId: `fake-session-${Date.now()}-1`, exerciseId: rearDeltRow.id, setIndex: 0, weight: 110, reps: 10, isCompleted: true },
      { id: `set-1-5`, sessionId: `fake-session-${Date.now()}-1`, exerciseId: rearDeltRow.id, setIndex: 1, weight: 110, reps: 10, isCompleted: true },
      { id: `set-1-6`, sessionId: `fake-session-${Date.now()}-1`, exerciseId: rearDeltRow.id, setIndex: 2, weight: 110, reps: 9, isCompleted: true },
      
      // Hammer Curl - 3 sets
      { id: `set-1-7`, sessionId: `fake-session-${Date.now()}-1`, exerciseId: hammerCurl.id, setIndex: 0, weight: 25, reps: 10, isCompleted: true },
      { id: `set-1-8`, sessionId: `fake-session-${Date.now()}-1`, exerciseId: hammerCurl.id, setIndex: 1, weight: 25, reps: 10, isCompleted: true },
      { id: `set-1-9`, sessionId: `fake-session-${Date.now()}-1`, exerciseId: hammerCurl.id, setIndex: 2, weight: 25, reps: 8, isCompleted: true },
    ],
  });
  
  // Week 2 - 14 days ago
  sessions.push({
    id: `fake-session-${Date.now()}-2`,
    date: dayjs().subtract(14, 'days').format('YYYY-MM-DD'),
    startTime: dayjs().subtract(14, 'days').hour(10).minute(0).toISOString(),
    endTime: dayjs().subtract(14, 'days').hour(11).minute(30).toISOString(),
    notes: 'Felt stronger',
    sets: [
      // Barbell Row - 3 sets (slight progression)
      { id: `set-2-1`, sessionId: `fake-session-${Date.now()}-2`, exerciseId: barbellRow.id, setIndex: 0, weight: 100, reps: 10, isCompleted: true },
      { id: `set-2-2`, sessionId: `fake-session-${Date.now()}-2`, exerciseId: barbellRow.id, setIndex: 1, weight: 100, reps: 10, isCompleted: true },
      { id: `set-2-3`, sessionId: `fake-session-${Date.now()}-2`, exerciseId: barbellRow.id, setIndex: 2, weight: 100, reps: 10, isCompleted: true },
      
      // Rear Delt Row - 3 sets
      { id: `set-2-4`, sessionId: `fake-session-${Date.now()}-2`, exerciseId: rearDeltRow.id, setIndex: 0, weight: 115, reps: 10, isCompleted: true },
      { id: `set-2-5`, sessionId: `fake-session-${Date.now()}-2`, exerciseId: rearDeltRow.id, setIndex: 1, weight: 115, reps: 10, isCompleted: true },
      { id: `set-2-6`, sessionId: `fake-session-${Date.now()}-2`, exerciseId: rearDeltRow.id, setIndex: 2, weight: 115, reps: 10, isCompleted: true },
      
      // Hammer Curl - 3 sets
      { id: `set-2-7`, sessionId: `fake-session-${Date.now()}-2`, exerciseId: hammerCurl.id, setIndex: 0, weight: 27.5, reps: 10, isCompleted: true },
      { id: `set-2-8`, sessionId: `fake-session-${Date.now()}-2`, exerciseId: hammerCurl.id, setIndex: 1, weight: 27.5, reps: 10, isCompleted: true },
      { id: `set-2-9`, sessionId: `fake-session-${Date.now()}-2`, exerciseId: hammerCurl.id, setIndex: 2, weight: 27.5, reps: 9, isCompleted: true },
    ],
  });
  
  // Week 3 - 7 days ago
  sessions.push({
    id: `fake-session-${Date.now()}-3`,
    date: dayjs().subtract(7, 'days').format('YYYY-MM-DD'),
    startTime: dayjs().subtract(7, 'days').hour(10).minute(0).toISOString(),
    endTime: dayjs().subtract(7, 'days').hour(11).minute(30).toISOString(),
    notes: 'Great workout!',
    sets: [
      // Barbell Row - 3 sets
      { id: `set-3-1`, sessionId: `fake-session-${Date.now()}-3`, exerciseId: barbellRow.id, setIndex: 0, weight: 105, reps: 10, isCompleted: true },
      { id: `set-3-2`, sessionId: `fake-session-${Date.now()}-3`, exerciseId: barbellRow.id, setIndex: 1, weight: 105, reps: 10, isCompleted: true },
      { id: `set-3-3`, sessionId: `fake-session-${Date.now()}-3`, exerciseId: barbellRow.id, setIndex: 2, weight: 105, reps: 10, isCompleted: true },
      
      // Rear Delt Row - 3 sets (progression!)
      { id: `set-3-4`, sessionId: `fake-session-${Date.now()}-3`, exerciseId: rearDeltRow.id, setIndex: 0, weight: 120, reps: 10, isCompleted: true },
      { id: `set-3-5`, sessionId: `fake-session-${Date.now()}-3`, exerciseId: rearDeltRow.id, setIndex: 1, weight: 120, reps: 10, isCompleted: true },
      { id: `set-3-6`, sessionId: `fake-session-${Date.now()}-3`, exerciseId: rearDeltRow.id, setIndex: 2, weight: 120, reps: 10, isCompleted: true },
      
      // Hammer Curl - 3 sets
      { id: `set-3-7`, sessionId: `fake-session-${Date.now()}-3`, exerciseId: hammerCurl.id, setIndex: 0, weight: 27.5, reps: 10, isCompleted: true },
      { id: `set-3-8`, sessionId: `fake-session-${Date.now()}-3`, exerciseId: hammerCurl.id, setIndex: 1, weight: 27.5, reps: 10, isCompleted: true },
      { id: `set-3-9`, sessionId: `fake-session-${Date.now()}-3`, exerciseId: hammerCurl.id, setIndex: 2, weight: 27.5, reps: 10, isCompleted: true },
    ],
  });
  
  // Add all sessions to the store
  for (const session of sessions) {
    await store.addSession(session);
  }
  
  console.log(`✅ Added ${sessions.length} fake workout sessions with history!`);
  console.log('📊 Sessions:', sessions.map(s => ({ date: s.date, exercises: s.sets.length })));
}
