import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system';
import { Platform } from 'react-native';

const BACKUP_FILENAME = 'workout_tracker_backup.json';
const BACKUP_INTERVAL = 5 * 60 * 1000; // 5 minutes

// iCloud directory (iOS only)
const iCloudDirectory = Platform.OS === 'ios' 
  ? FileSystem.documentDirectory + '../Library/Application Support/iCloud/'
  : null;

class CloudBackupService {
  private backupTimer: NodeJS.Timeout | null = null;
  private isBackupInProgress = false;
  private lastBackupTime: number = 0;

  /**
   * Initialize cloud backup service
   * - Checks for existing backups
   * - Starts automatic backup timer
   */
  async initialize() {
    try {
      console.log('☁️ Initializing cloud backup service...');
      
      if (Platform.OS !== 'ios') {
        console.log('⚠️ Cloud backup only supported on iOS');
        return;
      }

      // Check if we have a cloud backup
      const hasCloudBackup = await this.hasCloudBackup();
      console.log('Cloud backup exists:', hasCloudBackup);

      // Check if local storage is empty or has minimal data
      const allKeys = await AsyncStorage.getAllKeys();
      const hasLocalData = allKeys.length > 5; // More than just settings

      if (hasCloudBackup && !hasLocalData) {
        console.log('📥 Local data is empty but cloud backup exists. Restoring...');
        await this.restoreFromCloud();
      }

      // Start automatic backup timer
      this.startAutomaticBackup();
      
      console.log('✅ Cloud backup service initialized');
    } catch (error) {
      console.error('❌ Error initializing cloud backup:', error);
    }
  }

  /**
   * Check if a cloud backup exists
   */
  async hasCloudBackup(): Promise<boolean> {
    try {
      if (!iCloudDirectory) return false;
      
      const backupPath = iCloudDirectory + BACKUP_FILENAME;
      const fileInfo = await FileSystem.getInfoAsync(backupPath);
      return fileInfo.exists;
    } catch (error) {
      console.error('Error checking cloud backup:', error);
      return false;
    }
  }

  /**
   * Create a backup of all AsyncStorage data to iCloud
   */
  async backupToCloud(): Promise<{ success: boolean; error?: string }> {
    if (this.isBackupInProgress) {
      console.log('⏳ Backup already in progress, skipping...');
      return { success: false, error: 'Backup in progress' };
    }

    if (Platform.OS !== 'ios' || !iCloudDirectory) {
      return { success: false, error: 'Cloud backup only supported on iOS' };
    }

    try {
      this.isBackupInProgress = true;
      console.log('☁️ Starting cloud backup...');

      // Get all data from AsyncStorage
      const allKeys = await AsyncStorage.getAllKeys();
      const backup: Record<string, any> = {
        version: '1.0',
        timestamp: new Date().toISOString(),
        platform: Platform.OS,
      };

      // Read all values
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

      // Ensure iCloud directory exists
      const dirInfo = await FileSystem.getInfoAsync(iCloudDirectory);
      if (!dirInfo.exists) {
        await FileSystem.makeDirectoryAsync(iCloudDirectory, { intermediates: true });
      }

      // Write to iCloud
      const backupPath = iCloudDirectory + BACKUP_FILENAME;
      await FileSystem.writeAsStringAsync(
        backupPath,
        JSON.stringify(backup, null, 2),
        { encoding: FileSystem.EncodingType.UTF8 }
      );

      this.lastBackupTime = Date.now();
      console.log(`✅ Cloud backup complete (${allKeys.length} keys backed up)`);
      
      return { success: true };
    } catch (error) {
      console.error('❌ Error backing up to cloud:', error);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      };
    } finally {
      this.isBackupInProgress = false;
    }
  }

  /**
   * Restore data from cloud backup
   */
  async restoreFromCloud(): Promise<{ success: boolean; error?: string; restoredKeys?: number }> {
    if (Platform.OS !== 'ios' || !iCloudDirectory) {
      return { success: false, error: 'Cloud backup only supported on iOS' };
    }

    try {
      console.log('📥 Restoring from cloud backup...');

      const backupPath = iCloudDirectory + BACKUP_FILENAME;
      const fileInfo = await FileSystem.getInfoAsync(backupPath);
      
      if (!fileInfo.exists) {
        return { success: false, error: 'No cloud backup found' };
      }

      // Read backup file
      const backupData = await FileSystem.readAsStringAsync(backupPath, {
        encoding: FileSystem.EncodingType.UTF8,
      });

      const backup = JSON.parse(backupData);
      console.log(`Found backup from: ${backup.timestamp}`);

      // Restore each key (except metadata)
      let restoredCount = 0;
      for (const [key, value] of Object.entries(backup)) {
        if (key === 'version' || key === 'timestamp' || key === 'platform') {
          continue; // Skip metadata
        }

        const stringValue = typeof value === 'string' ? value : JSON.stringify(value);
        await AsyncStorage.setItem(key, stringValue);
        restoredCount++;
      }

      console.log(`✅ Restored ${restoredCount} keys from cloud backup`);
      
      return { success: true, restoredKeys: restoredCount };
    } catch (error) {
      console.error('❌ Error restoring from cloud:', error);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      };
    }
  }

  /**
   * Get backup info (last backup time, size, etc.)
   */
  async getBackupInfo(): Promise<{
    exists: boolean;
    timestamp?: string;
    sizeKB?: number;
    lastBackupTime?: number;
  }> {
    try {
      if (Platform.OS !== 'ios' || !iCloudDirectory) {
        return { exists: false };
      }

      const backupPath = iCloudDirectory + BACKUP_FILENAME;
      const fileInfo = await FileSystem.getInfoAsync(backupPath);
      
      if (!fileInfo.exists) {
        return { exists: false };
      }

      const backupData = await FileSystem.readAsStringAsync(backupPath, {
        encoding: FileSystem.EncodingType.UTF8,
      });
      const backup = JSON.parse(backupData);

      return {
        exists: true,
        timestamp: backup.timestamp,
        sizeKB: fileInfo.size ? fileInfo.size / 1024 : undefined,
        lastBackupTime: this.lastBackupTime,
      };
    } catch (error) {
      console.error('Error getting backup info:', error);
      return { exists: false };
    }
  }

  /**
   * Start automatic backup timer
   */
  startAutomaticBackup() {
    if (this.backupTimer) {
      clearInterval(this.backupTimer);
    }

    console.log(`⏰ Starting automatic backup (every ${BACKUP_INTERVAL / 60000} minutes)`);
    
    this.backupTimer = setInterval(async () => {
      console.log('⏰ Automatic backup triggered');
      await this.backupToCloud();
    }, BACKUP_INTERVAL);

    // Do an immediate backup
    setTimeout(() => this.backupToCloud(), 5000); // Wait 5 seconds after app launch
  }

  /**
   * Stop automatic backup timer
   */
  stopAutomaticBackup() {
    if (this.backupTimer) {
      clearInterval(this.backupTimer);
      this.backupTimer = null;
      console.log('⏹️ Automatic backup stopped');
    }
  }

  /**
   * Manually trigger a backup
   */
  async manualBackup(): Promise<{ success: boolean; error?: string }> {
    console.log('🔄 Manual backup triggered');
    return await this.backupToCloud();
  }
}

export const cloudBackupService = new CloudBackupService();
