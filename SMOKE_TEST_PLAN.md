# Smoke Test Plan - WorkoutTracker

## Overview
This document covers the critical paths that must be verified before any release.
Each test case is tagged with priority (P0 = must-pass, P1 = high, P2 = medium).

---

## 1. Exercise Completion Flow

### TC-1.1 Complete exercises in order (P0)
1. Open a scheduled workout from the Schedule tab
2. Tap the first exercise card to expand it
3. Complete all sets (tap Start, wait for timer or skip)
4. Verify: card collapses with a checkmark, no exercise auto-expands
5. Tap the next exercise, complete all sets
6. Repeat until all exercises are done
7. Verify: "Workout Complete" alert appears
8. Verify: Schedule tab shows workout as "Completed"

### TC-1.2 Complete exercises out of order (P0)
1. Open a scheduled workout
2. Tap the LAST exercise in the list
3. Complete all sets for that exercise
4. Verify: no exercise auto-expands (user picks next)
5. Tap a MIDDLE exercise, complete it
6. Tap the FIRST exercise, complete it
7. Continue until all exercises are done
8. Verify: workout only marks as complete when ALL exercises are done

### TC-1.3 Complete second-to-last exercise first (P0)
1. Open a workout with 4+ exercises
2. Tap the second-to-last exercise, complete all sets
3. Verify: the last exercise does NOT auto-expand
4. Verify: user can freely pick any remaining exercise

### TC-1.4 Partial completion does not mark workout complete (P0)
1. Open a workout, complete only 1 of 4 exercises
2. Tap back to Schedule tab
3. Verify: workout is NOT marked as "Completed"
4. Verify: progress indicator shows partial progress

### TC-1.5 Set value propagation (P1)
1. Expand an exercise with 3+ sets
2. On set 1, adjust weight to 50 lb and reps to 12
3. Complete set 1
4. Verify: set 2 shows 50 lb / 12 reps (inherited values)
5. On set 2, adjust reps to 8
6. Complete set 2
7. Verify: set 3 shows 50 lb / 8 reps

---

## 2. Reset Behavior

### TC-2.1 Reset clears all progress (P0)
1. Open a workout, complete 2-3 exercises
2. Tap the overflow menu (three dots), tap "Reset"
3. Confirm the reset
4. Verify: all exercise cards show as incomplete (no checkmarks)
5. Verify: first exercise is not auto-expanded (user picks)
6. Verify: weight/reps values reset to template defaults

### TC-2.2 Reset reverts schedule status (P0)
1. Complete ALL exercises in a workout (workout marked as complete)
2. Reopen the workout, tap Reset
3. Go back to Schedule tab
4. Verify: workout is NO LONGER marked as "Completed"
5. Verify: workout shows as "Planned" or in-progress

### TC-2.3 Reset deletes current session logs (P1)
1. Complete a few exercises, then Reset
2. Open the Adjust Values drawer on any exercise
3. Verify: "Latest exercise log" section does NOT show the reset data
4. Verify: history from PREVIOUS days is still intact

---

## 3. Session Persistence (Navigate Away & Back)

### TC-3.1 Progress survives navigation (P0)
1. Open a workout, complete 2 exercises
2. Tap back arrow to Schedule tab
3. Reopen the same workout
4. Verify: the 2 completed exercises still show checkmarks
5. Verify: the screen expands the group where user left off (or lets user pick)
6. Verify: adjusted weight/reps values are preserved

### TC-3.2 Session ID continuity (P1)
1. Open a workout, complete 1 exercise
2. Navigate away, come back
3. Complete another exercise
4. Check history: verify only ONE session exists for this workout date
5. Verify: no duplicate log entries

### TC-3.3 Starting from last exercise and returning (P0)
1. Open a workout, select the LAST exercise
2. Complete 2 of 3 sets
3. Navigate away to Schedule tab
4. Reopen the workout
5. Verify: progress on the last exercise is preserved (2 sets completed)
6. Verify: the last exercise is expanded (where user left off)

---

## 4. History & Logs Accuracy

### TC-4.1 Correct set count in history (P0)
1. Complete a workout where each exercise has 3 sets
2. Open Adjust Values drawer for any completed exercise
3. Verify: "Latest exercise log" shows exactly 3 entries per exercise
4. Verify: no duplicate entries

### TC-4.2 Edited values persist in history (P0)
1. Complete an exercise with default values (e.g., 40 lb / 12 reps)
2. Tap the completed exercise card to open Adjust Values drawer
3. Change set 2 to 50 lb / 10 reps, dismiss drawer
4. Reopen the drawer
5. Verify: set 2 still shows 50 lb / 10 reps (not reset to defaults)
6. Verify: history log reflects the updated values

### TC-4.3 History page shows logged data (P0)
1. Complete a full workout
2. Go to History tab, find the plan/workout
3. Verify: each exercise shows weight/reps data (NOT "Not logged")
4. Verify: the set count matches what was actually completed

### TC-4.4 No history duplication across data sources (P1)
1. Complete a workout
2. Open Adjust Values drawer
3. Verify: history shows N entries (matching set count), not 2N or 3N

---

## 5. Rest Timer

### TC-5.1 Set indicator shows correct count (P0)
1. Start any exercise, complete set 1
2. Verify: rest timer shows "Set 2 of N" (not "Set NaN of N")

### TC-5.2 Last set shows next exercise (P1)
1. Complete the last set of an exercise (not the last exercise overall)
2. Verify: rest timer shows "Next exercise [Name]" instead of "Set N of N"
3. Verify: "Next exercise" is in gray, exercise name is in dark text

### TC-5.3 Timer after very last exercise (P1)
1. Complete the last set of the very last exercise
2. Verify: timer shows "Set N of N" (no next exercise to show)

---

## 6. Accessories / Warmup / Core

### TC-6.1 Multi-section completion (P0)
1. Open a workout that has warmup + main + core exercises
2. Complete ONLY the main exercises
3. Verify: workout is NOT marked as complete on Schedule tab
4. Complete the warmup exercises
5. Verify: workout is STILL not complete (core remaining)
6. Complete core exercises
7. Verify: NOW the workout is marked as complete

### TC-6.2 Accessories collapsed by default (P2)
1. Open a workout that has accessories
2. Verify: "Accessories" section is collapsed by default
3. Tap to expand, verify warmup and core cards appear

### TC-6.3 Remove warmup/core (P1)
1. Open warmup or core execution page
2. Tap overflow menu, select "Remove"
3. Verify: returns to workout execution page
4. Verify: "Add Warmup" or "Add Core" card is shown

---

## 7. Adjust Values Drawer

### TC-7.1 Completed card opens drawer (not inline expansion) (P0)
1. Complete all sets of an exercise
2. Tap the completed exercise card
3. Verify: the Adjust Values drawer opens
4. Verify: the card does NOT expand inline

### TC-7.2 Drawer shows correct values per set (P1)
1. Open drawer for a completed exercise
2. Verify: each set shows the actual logged weight/reps
3. Verify: collapsed set previews show "weight unit reps unit" format

### TC-7.3 Dismiss saves changes (P1)
1. Open drawer for completed exercise
2. Change weight on set 2
3. Dismiss the drawer
4. Reopen the drawer
5. Verify: set 2 still shows the changed weight

---

## 8. Edge Cases

### TC-8.1 Superset completion (P1)
1. Open a workout with a superset (2+ exercises grouped)
2. Complete exercise A in the superset
3. Verify: it advances to exercise B within the same group
4. Complete exercise B
5. Verify: round advances (or group completes)

### TC-8.2 Weight per side display (P2)
1. Open an exercise marked as barbell
2. Verify: active card shows "X lb per side" below the main weight
3. Verify: the per-side label uses meta font size

### TC-8.3 Active card border consistency (P2)
1. Expand an exercise card
2. Switch to a different exercise
3. Verify: no border clipping or visual artifacts during animation
4. Verify: border radius stays consistent between states

---

## Quick Smoke Test Checklist (Pre-Release)

Run these 5 tests minimum before any TestFlight build:

- [ ] **TC-1.2** Complete exercises out of order
- [ ] **TC-2.2** Reset reverts schedule status
- [ ] **TC-3.1** Progress survives navigation
- [ ] **TC-4.1** Correct set count in history
- [ ] **TC-6.1** Multi-section completion
