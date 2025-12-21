import { Cycle } from '../types';
import dayjs from 'dayjs';

interface WorkoutAssignmentData {
  date: string;
  workoutTemplateId: string;
  cycleId: string;
}

/**
 * Automatically assigns workouts from a cycle to days of the week
 * Distributes workouts evenly across the week starting from today
 */
export function generateWorkoutAssignments(cycle: Cycle): WorkoutAssignmentData[] {
  const assignments: WorkoutAssignmentData[] = [];
  const { workoutTemplates, startDate, lengthInWeeks, workoutsPerWeek } = cycle;
  
  if (!workoutTemplates || workoutTemplates.length === 0) {
    return assignments;
  }

  // Calculate total days in the cycle
  const totalWeeks = lengthInWeeks;
  const cycleStartDate = dayjs(startDate);
  
  // Determine which days of the week to use based on workoutsPerWeek
  // E.g., 3 days/week = Monday, Wednesday, Friday
  // 4 days/week = Monday, Tuesday, Thursday, Friday
  // 5 days/week = Monday-Friday
  // 6 days/week = Monday-Saturday
  const dayOfWeekSchedule = generateDayOfWeekSchedule(workoutsPerWeek);
  
  // Assign workouts to specific dates across all weeks
  for (let week = 0; week < totalWeeks; week++) {
    const weekStartDate = cycleStartDate.add(week, 'week');
    
    // For each workout day in this week
    dayOfWeekSchedule.forEach((dayOfWeek, index) => {
      // Calculate the date for this workout
      const workoutDate = weekStartDate.day(dayOfWeek);
      
      // Round-robin through the workout templates
      const templateIndex = index % workoutTemplates.length;
      const template = workoutTemplates[templateIndex];
      
      assignments.push({
        date: workoutDate.format('YYYY-MM-DD'),
        workoutTemplateId: template.id,
        cycleId: cycle.id,
      });
    });
  }
  
  return assignments;
}

/**
 * Generates an array of day-of-week numbers (1=Monday, 7=Sunday) based on workouts per week
 */
function generateDayOfWeekSchedule(workoutsPerWeek: number): number[] {
  // Map of workouts per week to day-of-week schedule
  // Using 1=Monday through 7=Sunday
  const schedules: Record<number, number[]> = {
    1: [1],              // Monday only
    2: [1, 4],           // Monday, Thursday
    3: [1, 3, 5],        // Monday, Wednesday, Friday
    4: [1, 2, 4, 5],     // Monday, Tuesday, Thursday, Friday
    5: [1, 2, 3, 4, 5],  // Monday-Friday
    6: [1, 2, 3, 4, 5, 6], // Monday-Saturday
    7: [1, 2, 3, 4, 5, 6, 7], // Every day
  };
  
  return schedules[workoutsPerWeek] || schedules[3]; // Default to 3x/week
}

/**
 * Alternative: Randomly distribute workouts across the week
 * This provides more variety in scheduling
 */
export function generateRandomWorkoutAssignments(cycle: Cycle): WorkoutAssignmentData[] {
  const assignments: WorkoutAssignmentData[] = [];
  const { workoutTemplates, startDate, lengthInWeeks, workoutsPerWeek } = cycle;
  
  if (!workoutTemplates || workoutTemplates.length === 0) {
    return assignments;
  }

  const cycleStartDate = dayjs(startDate);
  const availableDays = [1, 2, 3, 4, 5, 6, 7]; // Monday-Sunday
  
  // For each week in the cycle
  for (let week = 0; week < lengthInWeeks; week++) {
    const weekStartDate = cycleStartDate.add(week, 'week');
    
    // Randomly select days for this week
    const shuffledDays = [...availableDays].sort(() => Math.random() - 0.5);
    const selectedDays = shuffledDays.slice(0, workoutsPerWeek);
    
    // Sort selected days to maintain chronological order
    selectedDays.sort((a, b) => a - b);
    
    // Assign workouts to selected days
    selectedDays.forEach((dayOfWeek, index) => {
      const workoutDate = weekStartDate.day(dayOfWeek);
      
      // Round-robin through the workout templates
      const templateIndex = index % workoutTemplates.length;
      const template = workoutTemplates[templateIndex];
      
      assignments.push({
        date: workoutDate.format('YYYY-MM-DD'),
        workoutTemplateId: template.id,
        cycleId: cycle.id,
      });
    });
  }
  
  return assignments;
}

