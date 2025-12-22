// Manual Cycle Creation Utilities

import dayjs from 'dayjs';
import { Weekday, DAY_ORDER, WEEKDAY_LABELS, WEEKDAY_FULL_LABELS } from '../types/manualCycle';

/**
 * Sort weekdays by Mon→Sun order
 */
export function sortWeekdays(days: Weekday[]): Weekday[] {
  return days.sort((a, b) => DAY_ORDER.indexOf(a) - DAY_ORDER.indexOf(b));
}

/**
 * Format weekday to short label (e.g., "Mon")
 */
export function formatWeekday(day: Weekday): string {
  return WEEKDAY_LABELS[day];
}

/**
 * Format weekday to full label (e.g., "Monday")
 */
export function formatWeekdayFull(day: Weekday): string {
  return WEEKDAY_FULL_LABELS[day];
}

/**
 * Add days to a date string (ISO format)
 */
export function addDays(dateISO: string, days: number): string {
  return dayjs(dateISO).add(days, 'day').format('YYYY-MM-DD');
}

/**
 * Calculate end date from start date and number of weeks
 */
export function calculateEndDate(startDate: string, weeks: number): string {
  const totalDays = weeks * 7 - 1;
  return addDays(startDate, totalDays);
}

/**
 * Format date range for display
 */
export function formatDateRange(startDate: string, endDate: string): string {
  const start = dayjs(startDate);
  const end = dayjs(endDate);
  return `${start.format('MMM D, YYYY')} — ${end.format('MMM D, YYYY')}`;
}

/**
 * Generate unique ID
 */
export function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Format exercise week plan for display (e.g., "3x8-10 @ 100lb")
 */
export function formatExerciseWeekPlan(
  sets?: number,
  reps?: string,
  weight?: number,
  unit?: 'lb' | 'kg'
): string {
  const parts: string[] = [];
  
  if (sets) parts.push(`${sets}x`);
  if (reps) parts.push(reps);
  if (weight && unit) parts.push(`@ ${weight}${unit}`);
  
  return parts.join(' ') || 'Not set';
}

/**
 * Get exercise summary across all weeks
 */
export function getExerciseSummary(weeks: any[]): string {
  if (weeks.length === 0) return 'Not set';
  
  const summaries = weeks
    .slice(0, 3) // Show first 3 weeks
    .map((week, i) => {
      const formatted = formatExerciseWeekPlan(
        week.sets,
        week.reps,
        week.weight,
        week.unit
      );
      return `W${i + 1} ${formatted}`;
    });
  
  if (weeks.length > 3) {
    summaries.push('...');
  }
  
  return summaries.join(', ');
}

