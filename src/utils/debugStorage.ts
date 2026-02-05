import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * Debug utility to check what's in AsyncStorage and help recover data
 */
export async function debugStorageContents() {
  try {
    console.log('🔍 Checking AsyncStorage contents...');
    
    const allKeys = await AsyncStorage.getAllKeys();
    console.log(`📦 Total keys in storage: ${allKeys.length}`);
    console.log('Keys:', allKeys);
    
    // Check workout-related keys
    const workoutKeys = allKeys.filter(key => key.includes('workout'));
    console.log(`\n💪 Workout-related keys (${workoutKeys.length}):`, workoutKeys);
    
    // Get sizes of each key
    for (const key of allKeys) {
      const value = await AsyncStorage.getItem(key);
      if (value) {
        const size = value.length;
        const sizeKB = (size / 1024).toFixed(2);
        console.log(`  ${key}: ${sizeKB} KB`);
        
        // Show preview of data
        try {
          const parsed = JSON.parse(value);
          if (Array.isArray(parsed)) {
            console.log(`    -> Array with ${parsed.length} items`);
          } else if (typeof parsed === 'object') {
            const objKeys = Object.keys(parsed);
            console.log(`    -> Object with ${objKeys.length} keys`);
          }
        } catch (e) {
          console.log(`    -> Raw string data`);
        }
      }
    }
    
    // Specifically check sessions (workout history)
    const sessionsData = await AsyncStorage.getItem('@workout_tracker_sessions');
    if (sessionsData) {
      const sessions = JSON.parse(sessionsData);
      console.log(`\n✅ SESSIONS FOUND: ${sessions.length} workout sessions in storage`);
      if (sessions.length > 0) {
        console.log('Latest session:', sessions[sessions.length - 1]);
      }
    } else {
      console.log('\n⚠️  NO SESSIONS DATA FOUND');
    }
    
    // Check detailed workout progress
    const progressData = await AsyncStorage.getItem('@workout_tracker_detailed_progress');
    if (progressData) {
      const progress = JSON.parse(progressData);
      const workoutIds = Object.keys(progress);
      console.log(`\n✅ PROGRESS FOUND: ${workoutIds.length} workouts have progress data`);
    } else {
      console.log('\n⚠️  NO PROGRESS DATA FOUND');
    }
    
    return {
      allKeys,
      workoutKeys,
      hasData: allKeys.length > 0,
    };
  } catch (error) {
    console.error('❌ Error checking storage:', error);
    return null;
  }
}

/**
 * Backup all AsyncStorage data to a JSON object
 */
export async function backupAllData() {
  try {
    console.log('💾 Creating backup of all AsyncStorage data...');
    const allKeys = await AsyncStorage.getAllKeys();
    const backup: Record<string, any> = {};
    
    for (const key of allKeys) {
      const value = await AsyncStorage.getItem(key);
      if (value) {
        try {
          backup[key] = JSON.parse(value);
        } catch (e) {
          backup[key] = value; // Store as raw string if not JSON
        }
      }
    }
    
    console.log('✅ Backup created successfully');
    console.log('Backup:', JSON.stringify(backup, null, 2));
    
    return backup;
  } catch (error) {
    console.error('❌ Error creating backup:', error);
    return null;
  }
}

/**
 * Restore data from a backup object
 */
export async function restoreFromBackup(backup: Record<string, any>) {
  try {
    console.log('📥 Restoring data from backup...');
    
    for (const [key, value] of Object.entries(backup)) {
      const stringValue = typeof value === 'string' ? value : JSON.stringify(value);
      await AsyncStorage.setItem(key, stringValue);
      console.log(`  ✅ Restored: ${key}`);
    }
    
    console.log('✅ Restore complete!');
    return true;
  } catch (error) {
    console.error('❌ Error restoring backup:', error);
    return false;
  }
}
