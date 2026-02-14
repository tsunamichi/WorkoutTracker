import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase, isSupabaseConfigured } from './supabase';
import { getCurrentUser } from './authService';
import { Platform } from 'react-native';

/**
 * Upload all AsyncStorage data to Supabase as a single JSON blob.
 * Uses upsert so repeated calls just update the existing row.
 */
export async function uploadBackup(): Promise<{ success: boolean; error?: string }> {
  try {
    if (!isSupabaseConfigured()) {
      return { success: false, error: 'Supabase is not configured.' };
    }

    const user = await getCurrentUser();
    if (!user) {
      return { success: false, error: 'Not signed in.' };
    }

    // Collect all AsyncStorage data
    const allKeys = await AsyncStorage.getAllKeys();
    // Exclude Supabase session keys from the backup
    const workoutKeys = allKeys.filter(k => !k.startsWith('sb-'));
    const pairs = await AsyncStorage.multiGet(workoutKeys);

    const data: Record<string, any> = {
      _meta: {
        version: '2.0',
        syncedAt: new Date().toISOString(),
        platform: Platform.OS,
        keyCount: workoutKeys.length,
      },
    };

    for (const [key, value] of pairs) {
      if (value) {
        try {
          data[key] = JSON.parse(value);
        } catch {
          data[key] = value;
        }
      }
    }

    // Upsert to Supabase
    const { error } = await supabase
      .from('user_backups')
      .upsert(
        {
          user_id: user.id,
          data,
          version: '2.0',
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'user_id' }
      );

    if (error) {
      console.error('❌ Cloud upload error:', error);
      return { success: false, error: error.message };
    }

    console.log(`☁️ Cloud backup uploaded (${workoutKeys.length} keys)`);
    return { success: true };
  } catch (error) {
    console.error('❌ Cloud upload error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown upload error',
    };
  }
}

/**
 * Download the user's backup from Supabase and restore it to AsyncStorage.
 */
export async function downloadBackup(): Promise<{
  success: boolean;
  restoredKeys?: number;
  syncedAt?: string;
  error?: string;
}> {
  try {
    if (!isSupabaseConfigured()) {
      return { success: false, error: 'Supabase is not configured.' };
    }

    const user = await getCurrentUser();
    if (!user) {
      return { success: false, error: 'Not signed in.' };
    }

    // Fetch from Supabase
    const { data: row, error } = await supabase
      .from('user_backups')
      .select('data, updated_at')
      .eq('user_id', user.id)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        // No rows found
        return { success: false, error: 'No cloud backup found for this account.' };
      }
      return { success: false, error: error.message };
    }

    if (!row?.data || typeof row.data !== 'object') {
      return { success: false, error: 'Cloud backup data is empty or corrupt.' };
    }

    // Write all keys to AsyncStorage (skip _meta)
    const pairs: [string, string][] = [];
    let restoredCount = 0;

    for (const [key, value] of Object.entries(row.data)) {
      if (key === '_meta') continue;

      const stringValue = typeof value === 'string' ? value : JSON.stringify(value);
      pairs.push([key, stringValue]);
      restoredCount++;
    }

    if (pairs.length > 0) {
      await AsyncStorage.multiSet(pairs);
    }

    console.log(`☁️ Cloud backup restored (${restoredCount} keys)`);
    return {
      success: true,
      restoredKeys: restoredCount,
      syncedAt: row.updated_at,
    };
  } catch (error) {
    console.error('❌ Cloud download error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown download error',
    };
  }
}

/**
 * Check if a cloud backup exists for the current user.
 */
export async function getCloudBackupInfo(): Promise<{
  exists: boolean;
  syncedAt?: string;
  keyCount?: number;
}> {
  try {
    if (!isSupabaseConfigured()) return { exists: false };

    const user = await getCurrentUser();
    if (!user) return { exists: false };

    const { data: row, error } = await supabase
      .from('user_backups')
      .select('updated_at, data')
      .eq('user_id', user.id)
      .single();

    if (error || !row) return { exists: false };

    const keyCount = row.data?._meta?.keyCount ?? Object.keys(row.data).length - 1;

    return {
      exists: true,
      syncedAt: row.updated_at,
      keyCount,
    };
  } catch {
    return { exists: false };
  }
}
