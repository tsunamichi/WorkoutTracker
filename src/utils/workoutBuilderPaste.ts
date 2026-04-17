/** Clipboard → builder exercise list (shared with WorkoutBuilder + Home paste flow). */

function normalizePasteLine(s: string) {
  return s.replace(/\t/g, ' ').trim();
}

function stripLeadingBullet(s: string) {
  return s.replace(/^[•\u2022\-*]\s*/, '').replace(/^\d+\.\s*/, '').trim();
}

/** Keep exercise name only; strip trailing sets/reps/weight from pasted plan lines. */
function stripExerciseMetadata(namePart: string): string {
  const s = namePart.replace(/[—–]/g, '-').replace(/×/g, 'x').trim();
  const mSplit = s.match(/^(.*?)(?:\s+-\s+|\s+)(\d+\s*x\s*\d+.*)$/i);
  if (mSplit) return mSplit[1].trim().replace(/[-–—]\s*$/, '').trim();
  const idx = s.search(/\b\d+\s*x\s*\d+/i);
  if (idx > 0) return s.slice(0, idx).trim().replace(/[-–—]\s*$/, '').trim();
  const atIdx = s.indexOf('@');
  if (atIdx > 0) return s.slice(0, atIdx).trim();
  return s.trim();
}

function lineLooksLikeExercise(line: string): boolean {
  const trimmed = line.trim();
  const t = stripLeadingBullet(line);
  if (!t) return false;
  if (/^warm\s*up/i.test(t)) return false;
  if (/^(?:WEEK\s+\d+\s+)?DAY\s+\d+/i.test(trimmed)) return false;
  if (/^day\s+\d+\s*[—\-:]/i.test(trimmed)) return false;
  if (trimmed.startsWith('-') || trimmed.startsWith('•') || trimmed.startsWith('*')) return true;
  if (/^\d+\.\s/.test(trimmed)) return true;
  if (/\b\d+\s*x\s*\d+/i.test(t)) return true;
  if (/@\s*[\d.]/i.test(t)) return true;
  return false;
}

/** Parse clipboard text into an optional workout title and exercise names (builder-friendly). */
export function parseBuilderPaste(text: string): { workoutName?: string; exercises: string[] } {
  const lines = text.split(/\r?\n/).map(normalizePasteLine).filter(l => l.length > 0);
  const exercises: string[] = [];
  let workoutName: string | undefined;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const dayMatch = line.match(/^(?:WEEK\s+\d+\s+)?DAY\s+\d+\s*[—\-:]\s*(.+)$/i);
    if (dayMatch) {
      workoutName = dayMatch[1].trim();
      continue;
    }
    if (/^warm\s*up/i.test(line)) continue;

    if (lineLooksLikeExercise(line)) {
      exercises.push(stripExerciseMetadata(stripLeadingBullet(line)));
      continue;
    }

    const secondIsExercise = lines.length > 1 && lineLooksLikeExercise(lines[1]);
    if (i === 0 && !workoutName && lines.length > 1 && secondIsExercise) {
      workoutName = line;
      continue;
    }

    const stripped = stripExerciseMetadata(stripLeadingBullet(line));
    if (stripped.length > 0) exercises.push(stripped);
  }

  const seen = new Set<string>();
  const deduped: string[] = [];
  for (const e of exercises) {
    const key = e.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    deduped.push(e);
  }
  return { workoutName, exercises: deduped };
}

function splitByDayHeaders(text: string): string[] {
  const lines = text.split(/\r?\n/);
  const chunks: string[] = [];
  let buf: string[] = [];
  const dayRe = /^(?:WEEK\s+\d+\s+)?DAY\s+\d+\s*[—\-:]/i;
  for (const line of lines) {
    const trimmedStart = line.trimStart();
    if (dayRe.test(trimmedStart) && buf.length > 0) {
      chunks.push(buf.join('\n'));
      buf = [line];
    } else {
      buf.push(line);
    }
  }
  if (buf.length > 0) chunks.push(buf.join('\n'));
  return chunks;
}

/** Split pasted blob into sections (multiple DAY blocks, or paragraphs separated by blank lines). */
export function splitRawIntoSections(text: string): string[] {
  const normalized = text.replace(/\r\n/g, '\n').trim();
  if (!normalized) return [];
  const dayChunks = splitByDayHeaders(normalized);
  if (dayChunks.length >= 2) return dayChunks;
  const byBlank = normalized
    .split(/\n(?:\s*\n)+/)
    .map(s => s.trim())
    .filter(s => s.length > 0);
  if (byBlank.length >= 2) return byBlank;
  return [normalized];
}

export type ParsedWorkoutSection = { workoutName: string; exercises: string[] };

/** One or more workouts from clipboard (blank line or DAY headers separate workouts). */
export function parseBuilderPasteAll(text: string): ParsedWorkoutSection[] {
  const sections = splitRawIntoSections(text);
  const parsed: ParsedWorkoutSection[] = [];
  for (const section of sections) {
    const p = parseBuilderPaste(section);
    if (p.exercises.length === 0) continue;
    parsed.push({
      workoutName: (p.workoutName || '').trim(),
      exercises: p.exercises,
    });
  }
  if (parsed.length === 0) {
    const single = parseBuilderPaste(text);
    if (single.exercises.length === 0) return [];
    return [
      {
        workoutName: (single.workoutName || '').trim(),
        exercises: single.exercises,
      },
    ];
  }
  return parsed;
}

export function newDraftId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}
