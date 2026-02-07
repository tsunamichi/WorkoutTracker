import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * Migration utility to recover data from old storage keys
 */

// Old keys that might have been used in previous versions
const OLD_KEY_MAPPINGS: Record<string, string> = {
  // Old key -> New key
  'workout_sessions': '@workout_tracker_sessions',
  'workoutSessions': '@workout_tracker_sessions',
  'sessions': '@workout_tracker_sessions',
  'workout_templates': '@workout_tracker_workout_templates',
  'workoutTemplates': '@workout_tracker_workout_templates',
  'cycle_plans': '@workout_tracker_cycle_plans',
  'cyclePlans': '@workout_tracker_cycle_plans',
  'scheduled_workouts': '@workout_tracker_scheduled_workouts',
  'scheduledWorkouts': '@workout_tracker_scheduled_workouts',
  'exercises': '@workout_tracker_exercises',
  'workout_progress': '@workout_tracker_workout_progress',
  'workoutProgress': '@workout_tracker_workout_progress',
  'detailed_progress': '@workout_tracker_detailed_progress',
  'detailedProgress': '@workout_tracker_detailed_progress',
};

/**
 * Check for data in old storage keys and migrate to new keys
 */
export async function migrateOldStorageKeys(): Promise<{
  success: boolean;
  migratedKeys: string[];
  errors: string[];
}> {
  const migratedKeys: string[] = [];
  const errors: string[] = [];
  
  try {
    console.log('🔄 Checking for old storage keys to migrate...');
    
    const allKeys = await AsyncStorage.getAllKeys();
    console.log(`Found ${allKeys.length} total keys in storage`);
    
    for (const [oldKey, newKey] of Object.entries(OLD_KEY_MAPPINGS)) {
      try {
        // Check if old key exists
        if (!allKeys.includes(oldKey)) {
          continue;
        }
        
        // Check if new key already has data
        const existingData = await AsyncStorage.getItem(newKey);
        if (existingData) {
          const existing = JSON.parse(existingData);
          if (Array.isArray(existing) && existing.length > 0) {
            console.log(`⏭️  Skipping ${oldKey} -> ${newKey} (new key already has data)`);
            continue;
          }
          if (typeof existing === 'object' && Object.keys(existing).length > 0) {
            console.log(`⏭️  Skipping ${oldKey} -> ${newKey} (new key already has data)`);
            continue;
          }
        }
        
        // Get data from old key
        const oldData = await AsyncStorage.getItem(oldKey);
        if (!oldData) {
          continue;
        }
        
        // Validate it's not empty
        try {
          const parsed = JSON.parse(oldData);
          const isEmpty = Array.isArray(parsed) 
            ? parsed.length === 0 
            : Object.keys(parsed).length === 0;
          
          if (isEmpty) {
            console.log(`⏭️  Skipping ${oldKey} (empty data)`);
            continue;
          }
        } catch (e) {
          // Not JSON, might be raw string
        }
        
        // Copy to new key
        await AsyncStorage.setItem(newKey, oldData);
        console.log(`✅ Migrated: ${oldKey} -> ${newKey}`);
        migratedKeys.push(oldKey);
        
      } catch (error) {
        const errorMsg = `Error migrating ${oldKey}: ${error}`;
        console.error(errorMsg);
        errors.push(errorMsg);
      }
    }
    
    if (migratedKeys.length > 0) {
      console.log(`✅ Migration complete! Migrated ${migratedKeys.length} keys`);
    } else {
      console.log('ℹ️  No old keys found to migrate');
    }
    
    return {
      success: true,
      migratedKeys,
      errors,
    };
  } catch (error) {
    console.error('❌ Migration failed:', error);
    return {
      success: false,
      migratedKeys,
      errors: [...errors, String(error)],
    };
  }
}

/**
 * Scan ALL keys and show detailed info about sessions data
 */
export async function scanForOldData(): Promise<{
  potentialOldKeys: Array<{ key: string; size: number; preview: string }>;
  sessionsInfo: {
    key: string;
    count: number;
    sample?: any;
  } | null;
}> {
  try {
    console.log('🔍 Scanning ALL storage keys...');
    
    const allKeys = await AsyncStorage.getAllKeys();
    const newKeyPrefix = '@workout_tracker_';
    
    // Check ALL keys and show their content
    const potentialOldKeys: Array<{ key: string; size: number; preview: string }> = [];
    let sessionsInfo: { key: string; count: number; sample?: any } | null = null;
    
    for (const key of allKeys) {
      const value = await AsyncStorage.getItem(key);
      if (!value) {
        continue;
      }
      
      try {
        const parsed = JSON.parse(value);
        let preview = '';
        
        if (Array.isArray(parsed)) {
          preview = `Array with ${parsed.length} items`;
          
          // Special handling for sessions keys
          if (key.includes('session') || key.includes('Session')) {
            sessionsInfo = {
              key,
              count: parsed.length,
              sample: parsed[0],
            };
            console.log(`🎯 FOUND SESSIONS DATA in ${key}:`, {
              count: parsed.length,
              sample: parsed[0],
            });
          }
          
          if (parsed.length > 0 && parsed[0]) {
            preview += ` (first: ${JSON.stringify(parsed[0]).substring(0, 50)}...)`;
          }
        } else if (typeof parsed === 'object') {
          const keys = Object.keys(parsed);
          preview = `Object with ${keys.length} keys`;
          if (keys.length > 0) {
            preview += ` (${keys.slice(0, 3).join(', ')})`;
          }
        } else {
          preview = String(parsed).substring(0, 100);
        }
        
        potentialOldKeys.push({
          key,
          size: value.length,
          preview,
        });
        
        console.log(`📦 ${key}:`, preview);
      } catch (e) {
        // Not JSON
        const preview = value.substring(0, 100);
        potentialOldKeys.push({
          key,
          size: value.length,
          preview,
        });
        console.log(`📦 ${key}: Raw string (${value.length} bytes)`);
      }
    }
    
    console.log(`\n📊 Summary:`);
    console.log(`  Total keys: ${allKeys.length}`);
    console.log(`  Keys with data: ${potentialOldKeys.length}`);
    console.log(`  Sessions found: ${sessionsInfo ? 'YES' : 'NO'}`);
    if (sessionsInfo) {
      console.log(`  Sessions count: ${sessionsInfo.count}`);
    }
    
    return { potentialOldKeys, sessionsInfo };
  } catch (error) {
    console.error('Error scanning for old data:', error);
    return { potentialOldKeys: [], sessionsInfo: null };
  }
}

/**
 * Validate and repair session data that's already in the correct key
 * This handles cases where data exists but isn't loading properly
 */
export async function validateAndRepairSessions(): Promise<{
  success: boolean;
  sessionsCount: number;
  repaired: boolean;
  error?: string;
}> {
  try {
    console.log('🔧 Validating sessions data...');
    
    // Get the sessions data
    const sessionsData = await AsyncStorage.getItem('@workout_tracker_sessions');
    
    if (!sessionsData) {
      console.log('⚠️ No sessions data found');
      return { success: true, sessionsCount: 0, repaired: false };
    }
    
    try {
      const sessions = JSON.parse(sessionsData);
      
      if (!Array.isArray(sessions)) {
        console.error('❌ Sessions data is not an array');
        return { success: false, sessionsCount: 0, repaired: false, error: 'Data is not an array' };
      }
      
      console.log(`✅ Found ${sessions.length} sessions in storage`);
      
      // Validate and repair each session
      let needsRepair = false;
      const repairedSessions = sessions.map((session: any, index: number) => {
        let repaired = { ...session };
        let sessionNeedsRepair = false;
        
        // Ensure required fields exist
        if (!repaired.id) {
          repaired.id = `session-${Date.now()}-${index}`;
          sessionNeedsRepair = true;
          console.log(`🔧 Added missing id to session ${index}`);
        }
        
        if (!repaired.date) {
          repaired.date = new Date().toISOString().split('T')[0];
          sessionNeedsRepair = true;
          console.log(`🔧 Added missing date to session ${index}`);
        }
        
        if (!repaired.startTime) {
          repaired.startTime = new Date().toISOString();
          sessionNeedsRepair = true;
          console.log(`🔧 Added missing startTime to session ${index}`);
        }
        
        // Ensure sets array exists and is valid
        if (!Array.isArray(repaired.sets)) {
          repaired.sets = [];
          sessionNeedsRepair = true;
          console.log(`🔧 Initialized missing sets array for session ${index}`);
        }
        
        // Validate each set
        repaired.sets = repaired.sets.map((set: any, setIndex: number) => {
          let repairedSet = { ...set };
          let setNeedsRepair = false;
          
          if (!repairedSet.id) {
            repairedSet.id = `set-${session.id || index}-${setIndex}`;
            setNeedsRepair = true;
          }
          
          if (!repairedSet.sessionId) {
            repairedSet.sessionId = repaired.id;
            setNeedsRepair = true;
          }
          
          if (typeof repairedSet.setIndex !== 'number') {
            repairedSet.setIndex = setIndex;
            setNeedsRepair = true;
          }
          
          if (typeof repairedSet.weight !== 'number') {
            repairedSet.weight = 0;
            setNeedsRepair = true;
          }
          
          if (typeof repairedSet.reps !== 'number') {
            repairedSet.reps = 0;
            setNeedsRepair = true;
          }
          
          if (typeof repairedSet.isCompleted !== 'boolean') {
            repairedSet.isCompleted = true; // Assume completed if in history
            setNeedsRepair = true;
          }
          
          if (setNeedsRepair) {
            sessionNeedsRepair = true;
            console.log(`🔧 Repaired set ${setIndex} in session ${index}`);
          }
          
          return repairedSet;
        });
        
        if (sessionNeedsRepair) {
          needsRepair = true;
          console.log(`🔧 Session ${index} repaired:`, {
            id: repaired.id,
            date: repaired.date,
            setsCount: repaired.sets.length,
          });
        }
        
        return repaired;
      });
      
      // Save repaired data if needed
      if (needsRepair) {
        console.log('💾 Saving repaired sessions data...');
        await AsyncStorage.setItem('@workout_tracker_sessions', JSON.stringify(repairedSessions));
        console.log('✅ Repaired sessions saved');
      }
      
      return {
        success: true,
        sessionsCount: repairedSessions.length,
        repaired: needsRepair,
      };
    } catch (parseError) {
      console.error('❌ Error parsing sessions data:', parseError);
      return {
        success: false,
        sessionsCount: 0,
        repaired: false,
        error: `Parse error: ${parseError}`,
      };
    }
  } catch (error) {
    console.error('❌ Error validating sessions:', error);
    return {
      success: false,
      sessionsCount: 0,
      repaired: false,
      error: String(error),
    };
  }
}

/**
 * Convert partial workout progress into complete sessions
 * This recovers data from workouts that were started but not finished
 */
export async function convertPartialWorkoutsToSessions(): Promise<{
  success: boolean;
  sessionsCreated: number;
  workoutsProcessed: number;
  error?: string;
}> {
  try {
    console.log('🔄 Converting partial workouts to complete sessions...');
    
    // Get existing sessions
    const existingSessionsData = await AsyncStorage.getItem('@workout_tracker_sessions');
    const existingSessions = existingSessionsData ? JSON.parse(existingSessionsData) : [];
    const existingSessionDates = new Set(existingSessions.map((s: any) => s.date));
    
    // Get detailed workout progress
    const progressData = await AsyncStorage.getItem('@workout_tracker_detailed_progress');
    if (!progressData) {
      console.log('⚠️ No detailed workout progress found');
      return { success: true, sessionsCreated: 0, workoutsProcessed: 0 };
    }
    
    const detailedProgress = JSON.parse(progressData);
    console.log(`📊 Found ${Object.keys(detailedProgress).length} workout progress entries`);
    
    const newSessions: any[] = [];
    let workoutsProcessed = 0;
    
    // Process each workout progress entry
    for (const [workoutKey, workoutProgress] of Object.entries(detailedProgress)) {
      const progress = workoutProgress as any;
      
      // Extract date from workoutKey (format: workoutTemplateId-YYYY-MM-DD)
      const dateMatch = workoutKey.match(/(\d{4}-\d{2}-\d{2})/);
      if (!dateMatch) {
        console.log(`⏭️ Skipping ${workoutKey} - no date found`);
        continue;
      }
      
      const date = dateMatch[1];
      
      // Skip if session already exists for this date
      if (existingSessionDates.has(date)) {
        console.log(`⏭️ Skipping ${date} - session already exists`);
        continue;
      }
      
      // Check if this workout has ANY logged sets
      const exercises = progress.exercises || {};
      const hasLoggedSets = Object.values(exercises).some((ex: any) => 
        ex.sets && ex.sets.some((set: any) => set.completed)
      );
      
      if (!hasLoggedSets) {
        console.log(`⏭️ Skipping ${date} - no logged sets`);
        continue;
      }
      
      workoutsProcessed++;
      console.log(`✅ Processing workout from ${date}...`);
      
      // Create session sets from logged data
      const sessionSets: any[] = [];
      let setIndex = 0;
      
      for (const [exerciseId, exerciseProgress] of Object.entries(exercises)) {
        const exProgress = exerciseProgress as any;
        
        // Skip if exercise was marked as skipped
        if (exProgress.skipped) {
          console.log(`  ⏭️ Skipped exercise: ${exerciseId}`);
          continue;
        }
        
        // Get logged sets
        const sets = exProgress.sets || [];
        const loggedSets = sets.filter((set: any) => set.completed);
        
        if (loggedSets.length === 0) {
          console.log(`  ⏭️ No logged sets for exercise: ${exerciseId}`);
          continue;
        }
        
        console.log(`  ✅ Found ${loggedSets.length} logged sets for exercise: ${exerciseId}`);
        
        // Convert each logged set to a session set
        for (const set of loggedSets) {
          sessionSets.push({
            id: `set-recovered-${date}-${setIndex}`,
            sessionId: `session-recovered-${date}`,
            exerciseId: exerciseId,
            setIndex: setIndex,
            weight: set.weight || 0,
            reps: set.reps || 0,
            rpe: set.rpe,
            isCompleted: true,
            completedAt: new Date(date).toISOString(),
          });
          setIndex++;
        }
      }
      
      // Only create session if we have sets
      if (sessionSets.length > 0) {
        const session = {
          id: `session-recovered-${date}`,
          date: date,
          startTime: new Date(date).toISOString(),
          endTime: new Date(date + 'T23:59:59').toISOString(),
          sets: sessionSets,
          notes: 'Recovered from partial workout progress',
        };
        
        newSessions.push(session);
        console.log(`  ✅ Created session with ${sessionSets.length} sets`);
      }
    }
    
    if (newSessions.length === 0) {
      console.log('ℹ️ No new sessions to create');
      return { success: true, sessionsCreated: 0, workoutsProcessed };
    }
    
    // Merge with existing sessions
    const allSessions = [...existingSessions, ...newSessions];
    
    // Sort by date (newest first)
    allSessions.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    
    // Save updated sessions
    await AsyncStorage.setItem('@workout_tracker_sessions', JSON.stringify(allSessions));
    
    console.log(`✅ Created ${newSessions.length} new sessions from partial workouts`);
    console.log(`📊 Total sessions now: ${allSessions.length}`);
    
    return {
      success: true,
      sessionsCreated: newSessions.length,
      workoutsProcessed,
    };
  } catch (error) {
    console.error('❌ Error converting partial workouts:', error);
    return {
      success: false,
      sessionsCreated: 0,
      workoutsProcessed: 0,
      error: String(error),
    };
  }
}
