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
