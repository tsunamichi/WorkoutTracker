/**
 * LiveActivity.ts
 * 
 * TypeScript interface for iOS Live Activities
 * Manages Dynamic Island + Lock Screen timer display
 */

import { NativeModules, Platform } from 'react-native';

type Phase = 'EXERCISE' | 'REST' | 'ROUND' | 'COOLDOWN';

interface StartParams {
  id: string;
  exerciseName: string;
  phase: Phase;
  endTimestampMs: number; // Date.now() + duration
  relevanceScore?: number; // 0..1 optional
}

interface UpdateParams {
  id: string;
  exerciseName?: string;
  phase?: Phase;
  endTimestampMs?: number;
  isPaused?: boolean;
  pausedRemainingSeconds?: number;
}

interface EndParams {
  id: string;
}

interface LiveActivityModule {
  isSupported(): Promise<boolean>;
  start(params: StartParams): Promise<void>;
  update(params: UpdateParams): Promise<void>;
  end(params: EndParams): Promise<void>;
}

// No-op implementation for Android/unsupported platforms
const noOpModule: LiveActivityModule = {
  isSupported: async () => false,
  start: async () => {},
  update: async () => {},
  end: async () => {},
};

// Safely get the native module, fallback to no-op if not available
const getNativeModule = (): LiveActivityModule => {
  try {
    if (Platform.OS === 'ios' && NativeModules.LiveActivityModule) {
      return NativeModules.LiveActivityModule;
    }
  } catch (error) {
    console.log('LiveActivityModule not available:', error);
  }
  return noOpModule;
};

const LiveActivity: LiveActivityModule = getNativeModule();

export default LiveActivity;
export type { Phase, StartParams, UpdateParams, EndParams };

