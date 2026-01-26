export type ProgressLog = {
  id: string;
  createdAt: string; // ISO
  dateLabel: string; // e.g. "Jan 22"
  weekKey: string; // e.g. "2026-W04" (ISO week)
  weightLbs?: number; // stored in lbs (optional)
  photoUris: string[]; // array of local file URIs (up to 5 photos)
  // Legacy field for backwards compatibility:
  photoUri?: string; // deprecated: use photoUris
};

