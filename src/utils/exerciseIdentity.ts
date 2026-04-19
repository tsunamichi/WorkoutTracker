import type { Exercise } from '../types';
import type { WorkoutDraftLine } from '../types/workoutDraft';

/** Canonical identity for typing / search — matches ExerciseDefinition fields on `Exercise`. */
export type ExerciseDefinitionFields = Pick<Exercise, 'id' | 'name' | 'canonicalName' | 'aliases' | 'category' | 'equipment' | 'isCustom'>;

/**
 * Normalize free text for comparison: lowercase, trim, collapse internal whitespace,
 * strip common punctuation that does not change meaning for exercise names.
 */
export function normalizeExerciseLabel(raw: string): string {
  return raw
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ')
    .replace(/[\u2019'`]/g, '')
    .replace(/[^a-z0-9\u00C0-\u024F\s+-]/gi, '')
    .trim();
}

function levenshtein(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;
  const dp: number[][] = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
  for (let i = 0; i <= m; i++) dp[i]![0] = i;
  for (let j = 0; j <= n; j++) dp[0]![j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      dp[i]![j] = Math.min(dp[i - 1]![j]! + 1, dp[i]![j - 1]! + 1, dp[i - 1]![j - 1]! + cost);
    }
  }
  return dp[m]![n]!;
}

function similarityScore(queryNorm: string, labelNorm: string): number {
  if (!queryNorm || !labelNorm) return 0;
  if (queryNorm === labelNorm) return 1;
  if (labelNorm.includes(queryNorm) || queryNorm.includes(labelNorm)) return 0.88;
  const d = levenshtein(queryNorm, labelNorm);
  const maxLen = Math.max(queryNorm.length, labelNorm.length) || 1;
  return Math.max(0, 1 - d / maxLen);
}

/** All searchable surface forms for an exercise (display name, canonical, aliases). */
export function labelsForExercise(ex: Exercise): string[] {
  const out = new Set<string>();
  out.add(normalizeExerciseLabel(ex.name));
  if (ex.canonicalName) out.add(normalizeExerciseLabel(ex.canonicalName));
  for (const a of ex.aliases ?? []) {
    const n = normalizeExerciseLabel(a);
    if (n) out.add(n);
  }
  return [...out].filter(Boolean);
}

export function bestScoreForExercise(queryNorm: string, ex: Exercise): number {
  if (!queryNorm) return 0;
  return Math.max(...labelsForExercise(ex).map(l => similarityScore(queryNorm, l)));
}

/** Whitespace-separated tokens after normalization (AND search). */
function tokenizeSearchQuery(normalizedQuery: string): string[] {
  return normalizedQuery.split(/\s+/).filter(w => w.length > 0);
}

const TOKEN_FUZZY_THRESHOLD = 0.55;

/**
 * Whether `token` matches inside a single normalized label: substring, or fuzzy against
 * a whitespace-split word (handles light typos like "bnech" → "bench").
 */
function tokenMatchesInLabel(token: string, label: string): boolean {
  if (!token || !label) return false;
  if (label.includes(token)) return true;
  if (token.length < 2) return false;
  for (const w of label.split(/\s+/).filter(Boolean)) {
    if (similarityScore(token, w) >= TOKEN_FUZZY_THRESHOLD) return true;
  }
  return false;
}

/**
 * True if at least one of the exercise's labels (name / canonical / alias) contains **every**
 * search token — so "bench press" matches "Barbell Bench Press" but not "Bench Dips" or "Leg Press".
 */
export function exerciseMatchesAllSearchTokens(ex: Exercise, tokens: string[]): boolean {
  if (tokens.length === 0) return false;
  const labels = labelsForExercise(ex);
  return labels.some(label => tokens.every(tok => tokenMatchesInLabel(tok, label)));
}

export type RankedExercise = { exercise: Exercise; score: number };

/**
 * Rank catalog exercises for a search query.
 * Multi-word queries use **AND** semantics: each word must match the same label (substring or fuzzy word match).
 * Results are ordered by overall fuzzy score on the full query string.
 */
export function rankExercisesForQuery(exercises: Exercise[], rawQuery: string, limit = 40): RankedExercise[] {
  const q = normalizeExerciseLabel(rawQuery);
  if (!q) return [];
  const tokens = tokenizeSearchQuery(q);
  if (tokens.length === 0) return [];

  return exercises
    .filter(ex => exerciseMatchesAllSearchTokens(ex, tokens))
    .map(ex => ({ exercise: ex, score: bestScoreForExercise(q, ex) }))
    .filter(r => r.score > 0.38)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}

export type ImportResolution =
  | { kind: 'strong'; exercise: Exercise }
  | { kind: 'ambiguous'; candidates: Exercise[] }
  | { kind: 'none' };

const STRONG_THRESHOLD = 0.88;
const AMBIGUOUS_DELTA = 0.04;

/**
 * Resolve pasted/imported text to a library exercise when confidence is high.
 * Does not auto-create custom exercises — caller handles `none` / `ambiguous`.
 */
export function resolveImportedExerciseLabel(raw: string, exercises: Exercise[]): ImportResolution {
  const ranked = rankExercisesForQuery(exercises, raw, 12);
  if (ranked.length === 0) return { kind: 'none' };
  const top = ranked[0]!;
  const second = ranked[1];
  if (top.score >= STRONG_THRESHOLD) {
    if (
      second &&
      second.score >= STRONG_THRESHOLD - AMBIGUOUS_DELTA &&
      Math.abs(top.score - second.score) <= AMBIGUOUS_DELTA
    ) {
      const close = ranked.filter(r => r.score >= top.score - AMBIGUOUS_DELTA).map(r => r.exercise);
      return { kind: 'ambiguous', candidates: close.slice(0, 5) };
    }
    return { kind: 'strong', exercise: top.exercise };
  }
  if (top.score >= 0.72 && second && Math.abs(top.score - second.score) <= 0.03) {
    return {
      kind: 'ambiguous',
      candidates: [top.exercise, second.exercise],
    };
  }
  return { kind: 'none' };
}

/**
 * Ensure legacy rows get `canonicalName` / `aliases` for stable matching.
 */
export function migrateLoadedExerciseCatalog(exercises: Exercise[]): { next: Exercise[]; changed: boolean } {
  let changed = false;
  const next = exercises.map(ex => {
    const canonicalName = ex.canonicalName ?? normalizeExerciseLabel(ex.name);
    const aliases = ex.aliases ?? [];
    if (ex.canonicalName !== canonicalName || ex.aliases !== aliases) {
      changed = true;
      return { ...ex, canonicalName, aliases };
    }
    return ex;
  });
  return { next, changed };
}

/** One imported/pasted line → draft row with auto-resolve when confidence is high. */
export function draftLineFromImportedName(
  rawName: string,
  lineId: string,
  exercises: Exercise[],
): WorkoutDraftLine {
  const trimmed = rawName.trim();
  const res = resolveImportedExerciseLabel(trimmed, exercises);
  if (res.kind === 'strong') {
    return {
      id: lineId,
      name: res.exercise.name,
      exerciseId: res.exercise.id,
    };
  }
  if (res.kind === 'ambiguous') {
    return {
      id: lineId,
      name: trimmed,
      resolutionStatus: 'needs_pick',
      matchCandidateIds: res.candidates.map(c => c.id),
    };
  }
  return {
    id: lineId,
    name: trimmed,
    resolutionStatus: 'needs_pick',
  };
}

/** Build a new custom catalog entry with a stable id and identity fields. */
export function buildCustomExerciseDefinition(displayName: string, index: number): Exercise {
  const trimmed = displayName.trim();
  const id = `ex-user-${Date.now()}-${index}`;
  const norm = normalizeExerciseLabel(trimmed);
  return {
    id,
    name: trimmed,
    canonicalName: norm,
    aliases: [],
    category: 'Other',
    isCustom: true,
  };
}
