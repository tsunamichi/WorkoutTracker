import { Platform } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import type { WorkoutHistoryExportPayload } from './exportWorkoutHistory';

export function workoutHistoryExportJsonString(payload: WorkoutHistoryExportPayload): string {
  return JSON.stringify(payload, null, 2);
}

export async function copyWorkoutHistoryJson(payload: WorkoutHistoryExportPayload): Promise<void> {
  await Clipboard.setStringAsync(workoutHistoryExportJsonString(payload));
}

function historyExportFilename(payload: WorkoutHistoryExportPayload): string {
  return `workout-history-${payload.startDate}_${payload.endDate}.json`;
}

async function shareJsonOnNative(fileUri: string, filename: string): Promise<void> {
  const canShare = await Sharing.isAvailableAsync();
  if (!canShare) {
    throw new Error('Sharing is not available on this device');
  }

  await Sharing.shareAsync(fileUri, {
    mimeType: 'application/json',
    dialogTitle: filename,
    UTI: 'public.json',
  });
}

function downloadJsonOnWeb(json: string, filename: string): void {
  if (typeof document === 'undefined') {
    throw new Error('Download is not available in this environment');
  }
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

export function isShareExportCancelled(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return /cancel/i.test(message) || /dismiss/i.test(message);
}

export async function shareWorkoutHistoryJson(payload: WorkoutHistoryExportPayload): Promise<void> {
  const json = workoutHistoryExportJsonString(payload);
  const filename = historyExportFilename(payload);

  if (Platform.OS === 'web') {
    downloadJsonOnWeb(json, filename);
    return;
  }

  const fileUri = `${FileSystem.cacheDirectory}${filename}`;
  await FileSystem.writeAsStringAsync(fileUri, json, {
    encoding: FileSystem.EncodingType.UTF8,
  });
  await shareJsonOnNative(fileUri, filename);
}
