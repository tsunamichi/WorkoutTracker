/**
 * useLiveActivity.ts
 * 
 * Custom hook to manage Live Activity lifecycle for workout timer
 * Handles start, update, pause, resume, and end operations
 */

import { useEffect, useRef, useCallback } from 'react';
import LiveActivity, { type Phase } from '../modules/LiveActivity';

// Optional: expo-notifications for local notifications
// Install with: npx expo install expo-notifications
let Notifications: any = null;
try {
  Notifications = require('expo-notifications');
} catch (e) {
  console.log('⚠️ expo-notifications not installed, local notifications disabled');
}

interface LiveActivityState {
  id: string;
  exerciseName: string;
  phase: Phase;
  isRunning: boolean;
  endTimestampMs?: number;
  pausedRemainingSeconds?: number;
}

export function useLiveActivity() {
  const isSupported = useRef<boolean | null>(null);
  const currentActivityId = useRef<string | null>(null);
  const notificationId = useRef<string | null>(null);
  
  // Check if Live Activities are supported
  useEffect(() => {
    LiveActivity.isSupported()
      .then(supported => {
        isSupported.current = supported;
        if (supported) {
          console.log('✅ Live Activities are supported');
        } else {
          console.log('⚠️ Live Activities not supported on this device');
        }
      })
      .catch(error => {
        console.log('⚠️ Live Activities module not available:', error.message);
        isSupported.current = false;
      });
  }, []);
  
  // Start Live Activity
  const startLiveActivity = useCallback(async (state: LiveActivityState) => {
    if (!isSupported.current || !state.endTimestampMs) {
      console.log('⏭️ Skipping Live Activity (not supported or missing endTimestampMs)');
      return;
    }
    
    try {
      // Start Live Activity
      await LiveActivity.start({
        id: state.id,
        exerciseName: state.exerciseName,
        phase: state.phase,
        endTimestampMs: state.endTimestampMs,
        relevanceScore: 0.8,
      });
      
      currentActivityId.current = state.id;
      
      // Schedule local notification for timer end
      await scheduleNotification(state.endTimestampMs, state.exerciseName);
      
      console.log('✅ Live Activity started:', state.id);
    } catch (error) {
      console.log('⚠️ Failed to start Live Activity (module may not be configured):', error instanceof Error ? error.message : error);
    }
  }, []);
  
  // Update Live Activity (e.g., phase change)
  const updateLiveActivity = useCallback(async (state: Partial<LiveActivityState> & { id: string }) => {
    if (!isSupported.current || !currentActivityId.current) {
      console.log('⏭️ Skipping Live Activity update (not active)');
      return;
    }
    
    try {
      const updateParams: any = { id: state.id };
      
      if (state.exerciseName) updateParams.exerciseName = state.exerciseName;
      if (state.phase) updateParams.phase = state.phase;
      if (state.endTimestampMs) updateParams.endTimestampMs = state.endTimestampMs;
      
      await LiveActivity.update(updateParams);
      
      // Reschedule notification if endTimestampMs changed
      if (state.endTimestampMs && state.exerciseName) {
        await cancelNotification();
        await scheduleNotification(state.endTimestampMs, state.exerciseName);
      }
      
      console.log('✅ Live Activity updated:', state.id);
    } catch (error) {
      console.log('⚠️ Failed to update Live Activity:', error instanceof Error ? error.message : error);
    }
  }, []);
  
  // Pause Live Activity
  const pauseLiveActivity = useCallback(async (id: string, remainingMs: number) => {
    if (!isSupported.current || !currentActivityId.current) return;
    
    try {
      const remainingSeconds = Math.max(0, Math.ceil(remainingMs / 1000));
      
      await LiveActivity.update({
        id,
        isPaused: true,
        pausedRemainingSeconds: remainingSeconds,
      });
      
      // Cancel notification when paused
      await cancelNotification();
      
      console.log('✅ Live Activity paused:', id, remainingSeconds);
    } catch (error) {
      console.log('⚠️ Failed to pause Live Activity:', error instanceof Error ? error.message : error);
    }
  }, []);
  
  // Resume Live Activity
  const resumeLiveActivity = useCallback(async (
    id: string,
    pausedRemainingMs: number,
    exerciseName: string
  ) => {
    if (!isSupported.current || !currentActivityId.current) return;
    
    try {
      const newEndTimestampMs = Date.now() + pausedRemainingMs;
      
      await LiveActivity.update({
        id,
        isPaused: false,
        endTimestampMs: newEndTimestampMs,
      });
      
      // Reschedule notification
      await scheduleNotification(newEndTimestampMs, exerciseName);
      
      console.log('✅ Live Activity resumed:', id);
    } catch (error) {
      console.log('⚠️ Failed to resume Live Activity:', error instanceof Error ? error.message : error);
    }
  }, []);
  
  // End Live Activity
  const endLiveActivity = useCallback(async (id: string) => {
    if (!isSupported.current || !currentActivityId.current) return;
    
    try {
      await LiveActivity.end({ id });
      await cancelNotification();
      
      currentActivityId.current = null;
      
      console.log('✅ Live Activity ended:', id);
    } catch (error) {
      console.log('⚠️ Failed to end Live Activity:', error instanceof Error ? error.message : error);
    }
  }, []);
  
  // Schedule local notification
  const scheduleNotification = async (endTimestampMs: number, exerciseName: string) => {
    if (!Notifications) {
      console.log('⏭️ Notifications not available, skipping schedule');
      return;
    }
    
    try {
      // Cancel existing notification
      if (notificationId.current) {
        await Notifications.cancelScheduledNotificationAsync(notificationId.current);
      }
      
      const trigger = new Date(endTimestampMs);
      
      const id = await Notifications.scheduleNotificationAsync({
        content: {
          title: 'Timer Complete',
          body: `${exerciseName} finished`,
          sound: true,
        },
        trigger,
      });
      
      notificationId.current = id;
      console.log('✅ Notification scheduled for:', trigger);
    } catch (error) {
      console.log('⚠️ Failed to schedule notification:', error instanceof Error ? error.message : error);
    }
  };
  
  // Cancel scheduled notification
  const cancelNotification = async () => {
    if (!Notifications || !notificationId.current) {
      return;
    }
    
    try {
      await Notifications.cancelScheduledNotificationAsync(notificationId.current);
      notificationId.current = null;
      console.log('✅ Notification cancelled');
    } catch (error) {
      console.log('⚠️ Failed to cancel notification:', error instanceof Error ? error.message : error);
    }
  };
  
  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (currentActivityId.current) {
        LiveActivity.end({ id: currentActivityId.current }).catch(error => {
          console.log('⚠️ Failed to end Live Activity on cleanup:', error instanceof Error ? error.message : error);
        });
      }
      cancelNotification().catch(() => {
        // Ignore notification cancellation errors on cleanup
      });
    };
  }, []);
  
  return {
    isSupported: isSupported.current,
    startLiveActivity,
    updateLiveActivity,
    pauseLiveActivity,
    resumeLiveActivity,
    endLiveActivity,
  };
}

