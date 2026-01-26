import { useStore } from '../store';
import dayjs from 'dayjs';

/**
 * Adds sample workout history data for demo purposes
 * Call this from a dev menu or temporarily from a screen
 */
export const addSampleHistoryData = async () => {
  const store = useStore.getState();
  
  // Sample exercises from our exercise database
  const sampleExercises = [
    { id: 'bench-press', name: 'Bench Press', sets: 4, reps: 8, weight: 185 },
    { id: 'squat', name: 'Squat', sets: 4, reps: 10, weight: 225 },
    { id: 'deadlift', name: 'Deadlift', sets: 3, reps: 5, weight: 315 },
    { id: 'overhead-press', name: 'Overhead Press', sets: 3, reps: 8, weight: 135 },
    { id: 'barbell-row', name: 'Barbell Row', sets: 4, reps: 10, weight: 155 },
    { id: 'pullup', name: 'Pull-ups', sets: 3, reps: 10, weight: 0 },
    { id: 'dip', name: 'Dips', sets: 3, reps: 12, weight: 0 },
    { id: 'leg-press', name: 'Leg Press', sets: 4, reps: 12, weight: 360 },
    { id: 'lat-pulldown', name: 'Lat Pulldown', sets: 3, reps: 12, weight: 150 },
    { id: 'cable-fly', name: 'Cable Fly', sets: 3, reps: 15, weight: 40 },
  ];

  // Create sample workout templates
  const templates = [
    {
      id: 'template-push-1',
      kind: 'workout' as const,
      name: 'Push Day',
      warmupItems: [],
      items: [
        { id: '1', exerciseId: 'bench-press', order: 0, sets: 4, reps: '8', weight: 185 },
        { id: '2', exerciseId: 'overhead-press', order: 1, sets: 3, reps: '8', weight: 135 },
        { id: '3', exerciseId: 'dip', order: 2, sets: 3, reps: '12', weight: 0 },
        { id: '4', exerciseId: 'cable-fly', order: 3, sets: 3, reps: '15', weight: 40 },
      ],
      createdAt: dayjs().subtract(30, 'days').toISOString(),
      updatedAt: dayjs().subtract(30, 'days').toISOString(),
      lastUsedAt: dayjs().subtract(2, 'days').toISOString(),
      usageCount: 5,
      source: 'user' as const,
    },
    {
      id: 'template-pull-1',
      kind: 'workout' as const,
      name: 'Pull Day',
      warmupItems: [],
      items: [
        { id: '1', exerciseId: 'deadlift', order: 0, sets: 3, reps: '5', weight: 315 },
        { id: '2', exerciseId: 'barbell-row', order: 1, sets: 4, reps: '10', weight: 155 },
        { id: '3', exerciseId: 'pullup', order: 2, sets: 3, reps: '10', weight: 0 },
        { id: '4', exerciseId: 'lat-pulldown', order: 3, sets: 3, reps: '12', weight: 150 },
      ],
      createdAt: dayjs().subtract(30, 'days').toISOString(),
      updatedAt: dayjs().subtract(30, 'days').toISOString(),
      lastUsedAt: dayjs().subtract(4, 'days').toISOString(),
      usageCount: 5,
      source: 'user' as const,
    },
    {
      id: 'template-legs-1',
      kind: 'workout' as const,
      name: 'Leg Day',
      warmupItems: [],
      items: [
        { id: '1', exerciseId: 'squat', order: 0, sets: 4, reps: '10', weight: 225 },
        { id: '2', exerciseId: 'leg-press', order: 1, sets: 4, reps: '12', weight: 360 },
      ],
      createdAt: dayjs().subtract(30, 'days').toISOString(),
      updatedAt: dayjs().subtract(30, 'days').toISOString(),
      lastUsedAt: dayjs().subtract(6, 'days').toISOString(),
      usageCount: 4,
      source: 'user' as const,
    },
  ];

  // Add templates to store
  for (const template of templates) {
    await store.addWorkoutTemplate(template);
  }

  // Create sample scheduled workouts (completed)
  const scheduledWorkouts = [
    // Push Day - 2 days ago (from plan)
    {
      id: 'scheduled-1',
      date: dayjs().subtract(2, 'days').format('YYYY-MM-DD'),
      templateId: 'template-push-1',
      titleSnapshot: 'Push Day',
      warmupSnapshot: [],
      exercisesSnapshot: templates[0].items,
      warmupCompletion: { completedItems: [] },
      workoutCompletion: { completedExercises: {}, completedSets: {} },
      status: 'completed' as const,
      startedAt: dayjs().subtract(2, 'days').hour(10).minute(0).toISOString(),
      completedAt: dayjs().subtract(2, 'days').hour(11).minute(15).toISOString(),
      source: 'cycle' as const,
      programId: 'plan-ppl-1',
      programName: '4-Week PPL Plan',
      weekIndex: 2,
      dayIndex: 0,
      isLocked: true,
    },
    // Pull Day - 4 days ago (single workout)
    {
      id: 'scheduled-2',
      date: dayjs().subtract(4, 'days').format('YYYY-MM-DD'),
      templateId: 'template-pull-1',
      titleSnapshot: 'Pull Day',
      warmupSnapshot: [],
      exercisesSnapshot: templates[1].items,
      warmupCompletion: { completedItems: [] },
      workoutCompletion: { completedExercises: {}, completedSets: {} },
      status: 'completed' as const,
      startedAt: dayjs().subtract(4, 'days').hour(14).minute(30).toISOString(),
      completedAt: dayjs().subtract(4, 'days').hour(15).minute(45).toISOString(),
      source: 'manual' as const,
      programId: null,
      programName: null,
      weekIndex: null,
      dayIndex: null,
      isLocked: true,
    },
    // Leg Day - 6 days ago (from plan)
    {
      id: 'scheduled-3',
      date: dayjs().subtract(6, 'days').format('YYYY-MM-DD'),
      templateId: 'template-legs-1',
      titleSnapshot: 'Leg Day',
      warmupSnapshot: [],
      exercisesSnapshot: templates[2].items,
      warmupCompletion: { completedItems: [] },
      workoutCompletion: { completedExercises: {}, completedSets: {} },
      status: 'completed' as const,
      startedAt: dayjs().subtract(6, 'days').hour(9).minute(0).toISOString(),
      completedAt: dayjs().subtract(6, 'days').hour(10).minute(20).toISOString(),
      source: 'cycle' as const,
      programId: 'plan-ppl-1',
      programName: '4-Week PPL Plan',
      weekIndex: 1,
      dayIndex: 2,
      isLocked: true,
    },
    // Push Day - 9 days ago (single workout)
    {
      id: 'scheduled-4',
      date: dayjs().subtract(9, 'days').format('YYYY-MM-DD'),
      templateId: 'template-push-1',
      titleSnapshot: 'Push Day',
      warmupSnapshot: [],
      exercisesSnapshot: templates[0].items,
      warmupCompletion: { completedItems: [] },
      workoutCompletion: { completedExercises: {}, completedSets: {} },
      status: 'completed' as const,
      startedAt: dayjs().subtract(9, 'days').hour(16).minute(0).toISOString(),
      completedAt: dayjs().subtract(9, 'days').hour(17).minute(10).toISOString(),
      source: 'manual' as const,
      programId: null,
      programName: null,
      weekIndex: null,
      dayIndex: null,
      isLocked: true,
    },
    // Pull Day - 12 days ago (from plan)
    {
      id: 'scheduled-5',
      date: dayjs().subtract(12, 'days').format('YYYY-MM-DD'),
      templateId: 'template-pull-1',
      titleSnapshot: 'Pull Day',
      warmupSnapshot: [],
      exercisesSnapshot: templates[1].items,
      warmupCompletion: { completedItems: [] },
      workoutCompletion: { completedExercises: {}, completedSets: {} },
      status: 'completed' as const,
      startedAt: dayjs().subtract(12, 'days').hour(11).minute(30).toISOString(),
      completedAt: dayjs().subtract(12, 'days').hour(12).minute(50).toISOString(),
      source: 'cycle' as const,
      programId: 'plan-ppl-1',
      programName: '4-Week PPL Plan',
      weekIndex: 1,
      dayIndex: 1,
      isLocked: true,
    },
  ];

  // Add completed workouts to store with progress data
  const currentScheduledWorkouts = store.scheduledWorkouts;
  const newScheduledWorkouts = [...currentScheduledWorkouts, ...scheduledWorkouts];
  
  // Update store
  const { set } = useStore;
  set({ scheduledWorkouts: newScheduledWorkouts });
  
  // Add progress for each workout (mark all sets as completed)
  for (const workout of scheduledWorkouts) {
    const workoutKey = `${workout.templateId}-${workout.date}`;
    
    for (const exercise of workout.exercisesSnapshot) {
      const sets = Array.from({ length: exercise.sets }, (_, i) => ({
        setNumber: i + 1,
        weight: exercise.weight || 0,
        reps: typeof exercise.reps === 'string' ? parseInt(exercise.reps) : exercise.reps,
        completed: true,
      }));
      
      await store.saveExerciseProgress(workoutKey, exercise.exerciseId, {
        exerciseId: exercise.exerciseId,
        sets,
        skipped: false,
      });
    }
  }
  
  // Save to storage
  const storage = await import('../storage');
  await storage.saveScheduledWorkouts(newScheduledWorkouts);
  
  console.log('✅ Added 5 sample completed workouts to history');
};
