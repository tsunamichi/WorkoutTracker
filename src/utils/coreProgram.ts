import type { CoreProgram, CoreSetTemplate } from '../types/training';

/** Current group for the program's current week: Week 1,3,5... = A; Week 2,4,6... = B */
export function getCurrentGroup(program: CoreProgram): 'A' | 'B' {
  return program.currentWeekIndex % 2 === 1 ? 'A' : 'B';
}

/** Get the session template that is "Up Next" for the program */
export function getUpNextSession(
  program: CoreProgram,
  sessions: CoreSetTemplate[]
): CoreSetTemplate | null {
  const group = getCurrentGroup(program);
  const idx = program.currentSessionIndexWithinGroup;
  const match = sessions.find(
    s => s.belongsToProgramId === program.id && s.groupKey === group && s.orderIndex === idx
  );
  return match ?? null;
}

/** All sessions in the program grouped by A and B, each ordered by orderIndex */
export function getSessionsByGroup(
  programId: string,
  sessions: CoreSetTemplate[]
): { A: CoreSetTemplate[]; B: CoreSetTemplate[] } {
  const inProgram = sessions.filter(s => s.belongsToProgramId === programId);
  const A = inProgram.filter(s => s.groupKey === 'A').sort((a, b) => (a.orderIndex ?? 0) - (b.orderIndex ?? 0));
  const B = inProgram.filter(s => s.groupKey === 'B').sort((a, b) => (a.orderIndex ?? 0) - (b.orderIndex ?? 0));
  return { A, B };
}

/** Advance the program pointer after completing or skipping the Up Next session */
export function advancePointer(program: CoreProgram): CoreProgram {
  const nextSessionIndex = program.currentSessionIndexWithinGroup + 1;
  if (nextSessionIndex < 3) {
    return {
      ...program,
      currentSessionIndexWithinGroup: nextSessionIndex,
      updatedAt: new Date().toISOString(),
    };
  }
  const nextWeek = program.currentWeekIndex + 1; // may exceed durationWeeks → program finished
  return {
    ...program,
    currentSessionIndexWithinGroup: 0,
    currentWeekIndex: nextWeek,
    updatedAt: new Date().toISOString(),
  };
}

/** Whether the program has finished (all weeks done) */
export function isProgramFinished(program: CoreProgram): boolean {
  return program.currentWeekIndex > program.durationWeeks;
}

/** Total expected sessions for progress display */
export function getTotalExpectedSessions(program: CoreProgram): number {
  return program.durationWeeks * program.sessionsPerWeekTarget;
}
