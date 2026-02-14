import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import * as DocumentPicker from 'expo-document-picker';
import { Platform } from 'react-native';

const EXPORT_FILENAME = 'WorkoutTracker_Backup';

/**
 * Export all AsyncStorage data to a JSON file and open the system share sheet.
 * The user can "Save to Files", AirDrop, email, etc.
 */
export async function exportDataToFile(): Promise<{ success: boolean; error?: string }> {
  try {
    // 1. Collect all data from AsyncStorage
    const allKeys = await AsyncStorage.getAllKeys();
    if (allKeys.length === 0) {
      return { success: false, error: 'No data to export.' };
    }

    const pairs = await AsyncStorage.multiGet(allKeys);
    const backup: Record<string, any> = {
      _meta: {
        version: '2.0',
        exportedAt: new Date().toISOString(),
        platform: Platform.OS,
        keyCount: allKeys.length,
      },
    };

    for (const [key, value] of pairs) {
      if (value) {
        try {
          backup[key] = JSON.parse(value);
        } catch {
          backup[key] = value; // store raw string if not valid JSON
        }
      }
    }

    // 2. Write to a temporary file
    const date = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
    const filename = `${EXPORT_FILENAME}_${date}.json`;
    const filePath = `${FileSystem.cacheDirectory}${filename}`;

    await FileSystem.writeAsStringAsync(filePath, JSON.stringify(backup, null, 2), {
      encoding: FileSystem.EncodingType.UTF8,
    });

    // 3. Open share sheet
    const isAvailable = await Sharing.isAvailableAsync();
    if (!isAvailable) {
      return { success: false, error: 'Sharing is not available on this device.' };
    }

    await Sharing.shareAsync(filePath, {
      mimeType: 'application/json',
      dialogTitle: 'Export Workout Data',
      UTI: 'public.json',
    });

    return { success: true };
  } catch (error) {
    console.error('❌ Export error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown export error',
    };
  }
}

/**
 * Import data from a previously exported JSON file.
 * Opens the system document picker, parses the file, and writes all keys to AsyncStorage.
 * Returns the count of restored keys.
 */
export async function importDataFromFile(): Promise<{
  success: boolean;
  restoredKeys?: number;
  error?: string;
}> {
  try {
    // 1. Pick a file
    const result = await DocumentPicker.getDocumentAsync({
      type: 'application/json',
      copyToCacheDirectory: true,
    });

    if (result.canceled || !result.assets || result.assets.length === 0) {
      return { success: false, error: 'No file selected.' };
    }

    const fileUri = result.assets[0].uri;

    // 2. Read the file
    const content = await FileSystem.readAsStringAsync(fileUri, {
      encoding: FileSystem.EncodingType.UTF8,
    });

    const data = JSON.parse(content);

    // 3. Validate it looks like our backup
    if (typeof data !== 'object' || data === null) {
      return { success: false, error: 'Invalid backup file format.' };
    }

    // Check for meta or at least some workout tracker keys
    const keys = Object.keys(data);
    const hasWorkoutKeys = keys.some(k => k.startsWith('@workout_tracker'));
    const hasMeta = !!data._meta;

    if (!hasWorkoutKeys && !hasMeta) {
      return {
        success: false,
        error: 'This file does not appear to be a WorkoutTracker backup.',
      };
    }

    // 4. Write all keys to AsyncStorage (skip _meta)
    let restoredCount = 0;
    const pairs: [string, string][] = [];

    for (const [key, value] of Object.entries(data)) {
      if (key === '_meta') continue;

      const stringValue = typeof value === 'string' ? value : JSON.stringify(value);
      pairs.push([key, stringValue]);
      restoredCount++;
    }

    if (pairs.length > 0) {
      await AsyncStorage.multiSet(pairs);
    }

    return { success: true, restoredKeys: restoredCount };
  } catch (error) {
    console.error('❌ Import error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown import error',
    };
  }
}
