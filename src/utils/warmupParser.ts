import type { WarmupItem_DEPRECATED as WarmupItem } from '../types/training';

export type ParsedWarmup = {
  name: string;
  reps: number | null;
  seconds: number | null;
  weight: number | null;
  isTimeBased: boolean;
  raw: string;
};

export type ParsedWarmupGroup = {
  exercises: ParsedWarmup[];
  rounds: number;
  isCycle: boolean;
};

const normalize = (input: string) => {
  return input
    .replace(/[—–⸻]/g, "-")
    .replace(/×/g, "x")
    .replace(/\t/g, " ")
    .replace(/[•●]/g, "-")
    .replace(/\s+/g, " ")
    .trim();
};

/**
 * Parse a single warm-up exercise line
 * Examples:
 * - "90/90 Hip Rotations x 6 reps"
 * - "Half-Kneeling Hip Flexor 30 sec"
 * - "Wall Sit x 45sec"
 * - "Quadruped Thoracic Rotations x 6 reps"
 */
const parseWarmupLine = (lineRaw: string): ParsedWarmup | null => {
  const line = normalize(lineRaw);
  
  // Remove bullet prefix
  const body = line.replace(/^-+\s*/, "").trim();
  
  if (!body || body.toLowerCase().includes('repeat') || body.toLowerCase().includes('superset')) {
    return null;
  }
  
  let name = body;
  let reps: number | null = null;
  let seconds: number | null = null;
  let weight: number | null = null;
  let isTimeBased = false;
  
  // Pattern 1: "Exercise x Number reps" or "Exercise x Number"
  const repsMatch = body.match(/^(.*?)\s+x\s+(\d+)\s*(reps?)?$/i);
  if (repsMatch) {
    name = repsMatch[1].trim();
    reps = parseInt(repsMatch[2], 10);
    return { name, reps, seconds, weight, isTimeBased: false, raw: lineRaw };
  }
  
  // Pattern 2: "Exercise x Number sec/secs/second/seconds"
  const timeMatchX = body.match(/^(.*?)\s+x\s+(\d+)\s*(s|sec|secs|second|seconds)$/i);
  if (timeMatchX) {
    name = timeMatchX[1].trim();
    seconds = parseInt(timeMatchX[2], 10);
    return { name, reps, seconds, weight, isTimeBased: true, raw: lineRaw };
  }
  
  // Pattern 3: "Exercise Number sec/secs/second/seconds" (no 'x')
  const timeMatch = body.match(/^(.*?)\s+(\d+)\s*(s|sec|secs|second|seconds)$/i);
  if (timeMatch) {
    name = timeMatch[1].trim();
    seconds = parseInt(timeMatch[2], 10);
    return { name, reps, seconds, weight, isTimeBased: true, raw: lineRaw };
  }
  
  // Pattern 4: Just the exercise name (default to 1 rep)
  if (body && !body.match(/\d+/)) {
    return { name: body, reps: 1, seconds, weight, isTimeBased: false, raw: lineRaw };
  }
  
  return null;
};

/**
 * Parse warm-up text into grouped exercises with rounds
 * 
 * Example input:
 * ```
 * - 90/90 Hip Rotations x 6 reps
 * - World's Greatest Stretch x 5 reps
 * - Half-Kneeling Hip Flexor 30 sec
 * repeat this superset 2 times
 * 
 * - Knee-to-Wall Ankle Mobilization x 8
 * - Wall Sit x 45sec
 * repeat this superset 2 times
 * ```
 */
export const parseWarmupText = (text: string): ParsedWarmupGroup[] => {
  if (!text || !text.trim()) return [];
  
  const lines = text.split('\n');
  const groups: ParsedWarmupGroup[] = [];
  let currentGroup: ParsedWarmup[] = [];
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    
    if (!line) {
      // Empty line might indicate end of a group
      if (currentGroup.length > 0) {
        // Check if next non-empty line is "repeat"
        let foundRepeat = false;
        let rounds = 1;
        
        for (let j = i + 1; j < lines.length; j++) {
          const nextLine = lines[j].trim();
          if (!nextLine) continue;
          
          if (nextLine.toLowerCase().includes('repeat')) {
            foundRepeat = true;
            const roundsMatch = nextLine.match(/(\d+)\s*(times?|rounds?)/i);
            rounds = roundsMatch ? parseInt(roundsMatch[1], 10) : 2;
            i = j; // Skip to after the repeat line
            break;
          } else {
            break;
          }
        }
        
        groups.push({
          exercises: currentGroup,
          rounds: rounds,
          isCycle: currentGroup.length > 1,
        });
        currentGroup = [];
      }
      continue;
    }
    
    // Check if this is a "repeat" line
    if (line.toLowerCase().includes('repeat')) {
      if (currentGroup.length > 0) {
        const roundsMatch = line.match(/(\d+)\s*(times?|rounds?)/i);
        const rounds = roundsMatch ? parseInt(roundsMatch[1], 10) : 2;
        
        groups.push({
          exercises: currentGroup,
          rounds: rounds,
          isCycle: currentGroup.length > 1,
        });
        currentGroup = [];
      }
      continue;
    }
    
    // Try to parse as exercise line
    const exercise = parseWarmupLine(line);
    if (exercise) {
      currentGroup.push(exercise);
    }
  }
  
  // Add any remaining exercises
  if (currentGroup.length > 0) {
    groups.push({
      exercises: currentGroup,
      rounds: 1,
      isCycle: currentGroup.length > 1,
    });
  }
  
  return groups;
};

/**
 * Convert parsed warm-up groups into WarmupItem array with proper cycle IDs
 */
export const convertToWarmupItems = (groups: ParsedWarmupGroup[]): WarmupItem[] => {
  const warmupItems: WarmupItem[] = [];
  
  groups.forEach((group, groupIndex) => {
    if (group.isCycle) {
      // Generate a cycle ID for this group
      const cycleId = `cycle-${Date.now()}-${groupIndex}`;
      
      group.exercises.forEach((exercise, exerciseIndex) => {
        warmupItems.push({
          id: `warmup-${Date.now()}-${groupIndex}-${exerciseIndex}`,
          exerciseName: exercise.name,
          sets: group.rounds,
          reps: exercise.isTimeBased ? (exercise.seconds ?? 30) : (exercise.reps ?? 10),
          weight: exercise.weight ?? 0,
          isTimeBased: exercise.isTimeBased,
          cycleId: cycleId,
          cycleOrder: exerciseIndex,
        });
      });
    } else {
      // Single exercise, no cycle
      const exercise = group.exercises[0];
      warmupItems.push({
        id: `warmup-${Date.now()}-${groupIndex}`,
        exerciseName: exercise.name,
        sets: group.rounds,
        reps: exercise.isTimeBased ? (exercise.seconds ?? 30) : (exercise.reps ?? 10),
        weight: exercise.weight ?? 0,
        isTimeBased: exercise.isTimeBased,
      });
    }
  });
  
  return warmupItems;
};

/**
 * Example usage with the user's input
 */
export const parseUserWarmupExample = () => {
  const exampleInput = `- 90/90 Hip Rotations x 6 reps
- World's Greatest Stretch x 5 reps
- Half-Kneeling Hip Flexor 30 sec
repeat this superset 2 times

- Knee-to-Wall Ankle Mobilization x 8
- Wall Sit x 45sec
repeat this superset 2 times

- Quadruped Thoracic Rotations x 6 reps
- Scapular Push-Ups x 8 reps
repeat this superset 2 times`;

  return parseWarmupText(exampleInput);
};
