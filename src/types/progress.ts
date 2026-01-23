export type ProgressLog = {
  id: string;
  createdAt: string; // ISO
  dateLabel: string; // e.g. "Jan 22"
  weekKey: string; // e.g. "2026-W04" (ISO week)
  weightLbs: number; // stored in lbs
  photoUri: string; // local file URI (Expo ImagePicker result)
};

