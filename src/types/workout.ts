export type UserPrefs = {
  daysPerWeek: number;        // 1..7
  sessionMinutes: number;     // 20..120
};

export type CycleTemplateId =
  | 'full_body'
  | 'upper_lower'
  | 'ppl'
  | 'bro_split'
  | 'strength_531'
  | 'powerbuilding'
  | 'hybrid'
  | 'custom';

export type MovementPattern =
  | 'squat' | 'hinge' | 'push' | 'pull' | 'carry' | 'core' | 'cardio' | 'other';

export type Equipment =
  | 'barbell' | 'dumbbell' | 'machine' | 'cable' | 'bodyweight' | 'kettlebell' | 'other';

export type Exercise = {
  id: string;
  name: string;
  pattern?: MovementPattern;
  equipment?: Equipment;
  sets?: number;
  reps?: string;       // "5" or "8-12" or "AMRAP"
  restSec?: number;
  notes?: string;
};

export type DayPlan = {
  dayIndex: number;    // 1..daysPerWeek
  title: string;       // "Push", "Upper A", etc
  exercises: Exercise[];
};

export type CycleDraft = {
  prefs: UserPrefs;
  templateId: CycleTemplateId;
  templateName: string;
  days: DayPlan[];
  source: 'template' | 'custom_text';
  rawText?: string;
};

export type SavedCycle = {
  id: string;
  createdAt: string;   // ISO
  prefs: UserPrefs;
  templateId: CycleTemplateId;
  templateName: string;
  days: DayPlan[];
  source: 'template' | 'custom_text';
  rawText?: string;
  cycleLengthWeeks: number; // 4/6/8, default 6
};

