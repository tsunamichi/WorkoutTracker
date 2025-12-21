import { NativeModules, Platform } from 'react-native';

interface RestTimerLiveActivityModule {
  startActivity(
    workoutName: string,
    exerciseName: string,
    timeRemaining: number,
    endTimeTimestamp: number,
    currentSet: number,
    totalSets: number
  ): Promise<string>;
  
  updateActivity(
    timeRemaining: number,
    endTimeTimestamp: number
  ): Promise<boolean>;
  
  markAsCompleted(): Promise<boolean>;
  
  endActivity(): Promise<boolean>;
}

const LINKING_ERROR =
  `The package 'RestTimerLiveActivity' doesn't seem to be linked. Make sure: \n\n` +
  Platform.select({ ios: "- You have run 'pod install'\n", default: '' }) +
  '- You rebuilt the app after installing the package\n' +
  '- You are not using Expo Go\n';

const RestTimerLiveActivity: RestTimerLiveActivityModule =
  NativeModules.RestTimerLiveActivity
    ? NativeModules.RestTimerLiveActivity
    : new Proxy(
        {},
        {
          get() {
            throw new Error(LINKING_ERROR);
          },
        }
      );

export default RestTimerLiveActivity;

// Helper functions
export async function startRestTimer(
  workoutName: string,
  exerciseName: string,
  durationSeconds: number,
  currentSet: number = 1,
  totalSets: number = 1
): Promise<string | null> {
  if (Platform.OS !== 'ios') {
    console.log('Live Activities are only supported on iOS');
    return null;
  }

  try {
    const endTime = Date.now() + durationSeconds * 1000;
    const activityId = await RestTimerLiveActivity.startActivity(
      workoutName,
      exerciseName,
      durationSeconds,
      endTime,
      currentSet,
      totalSets
    );
    console.log('✅ Live Activity started:', activityId);
    return activityId;
  } catch (error) {
    console.error('❌ Failed to start Live Activity:', error);
    return null;
  }
}

export async function updateRestTimer(
  timeRemaining: number,
  endTime: number
): Promise<boolean> {
  if (Platform.OS !== 'ios') {
    return false;
  }

  try {
    await RestTimerLiveActivity.updateActivity(timeRemaining, endTime);
    return true;
  } catch (error) {
    console.error('❌ Failed to update Live Activity:', error);
    return false;
  }
}

export async function markRestTimerCompleted(): Promise<boolean> {
  if (Platform.OS !== 'ios') {
    return false;
  }

  try {
    console.log('🔴 DEBUG: Calling markAsCompleted() on native module');
    await RestTimerLiveActivity.markAsCompleted();
    console.log('✅ Live Activity marked as completed');
    return true;
  } catch (error) {
    console.error('❌ Failed to mark Live Activity as completed:', error);
    return false;
  }
}

export async function endRestTimer(): Promise<boolean> {
  if (Platform.OS !== 'ios') {
    return false;
  }

  try {
    await RestTimerLiveActivity.endActivity();
    console.log('✅ Live Activity ended');
    return true;
  } catch (error) {
    console.error('❌ Failed to end Live Activity:', error);
    return false;
  }
}

