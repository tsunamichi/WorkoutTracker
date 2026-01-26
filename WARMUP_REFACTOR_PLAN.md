# Warm Up Refactor - Implementation Plan

## Overview
Unifying Warm Up and Exercise data models + UI to create a consistent experience and add reusable "Warm Up Sets"

## Current State Analysis
- **WarmupItem**: Simple (id, exerciseName, duration?, reps?, notes?)
- **WorkoutTemplateExercise**: Structured (id, exerciseId, order, sets, reps, weight?, restSeconds?)
- **Exercise Settings UI**: Already has time-based toggle + stepper controls

## Implementation Steps

### 1. Type System Updates (`src/types/training.ts`)
- ✅ Create `ExerciseInstance` type (unified for warmup + workout)
- ✅ Add `WarmUpSetTemplate` type
- ✅ Update `WorkoutTemplate.warmupItems` to use new structure
- ✅ Add migration types

### 2. Shared Components
- ✅ Create `ExerciseInstanceEditor` (unified editor for both contexts)
- ✅ Create `MovementPicker` (search/select from Exercise library)
- ✅ Create `WarmUpSetChooser` (select/insert warm up set)
- ✅ Create `WarmUpSetEditor` (create/edit warm up set template)

### 3. Update Workout Builder
- ✅ Replace `WarmupItemEditor` with new unified system
- ✅ Add "Add warm up set" and "Add warm up exercise" buttons
- ✅ Wire up new flows

### 4. Storage & Migration
- ✅ Add `warmUpSetTemplates` to store
- ✅ Write migration function for old warmup data
- ✅ Update persistence layer

### 5. Translation Keys
- ✅ Add necessary i18n keys

## Data Model

### ExerciseInstance
```typescript
{
  id: string;
  movementId: string; // reference to Exercise in library
  mode: "reps" | "time";
  sets: Array<{
    id: string;
    reps?: number;        // required when mode === "reps"
    durationSec?: number; // required when mode === "time"
    weight?: number;
  }>;
  restSec?: number;
  context: "workout" | "warmup";
}
```

### WarmUpSetTemplate
```typescript
{
  id: string;
  name: string;
  items: ExerciseInstance[];
  createdAt: number;
  updatedAt: number;
  lastUsedAt?: number;
}
```

## Migration Strategy
- Old `WarmupItem` → `ExerciseInstance`
  - Create dummy movement in library if exerciseName doesn't match
  - Map duration → time mode
  - Map reps → reps mode
  - Drop notes field
- Run migration on app load before store hydration

## Validation Rules
- Name required for Warm Up Set (non-empty string)
- At least 1 set required per ExerciseInstance
- Reps required when mode === "reps"
- DurationSec required when mode === "time"
- Switching mode clears incompatible fields

## UI Flow

### Add Warm Up Exercise
1. Tap "Add warm up exercise"
2. MovementPicker opens → search/select
3. ExerciseInstanceEditor opens (context="warmup", default mode="time")
4. Configure sets/reps/time
5. Save → appends to workout.warmupItems

### Add Warm Up Set
1. Tap "Add warm up set"
2. WarmUpSetChooser opens
3. Shows: Recent sets, All sets, Search, "Create new"
4. Tap set → copies items with new IDs into workout.warmupItems

### Create Warm Up Set
1. From WarmUpSetChooser → "Create new"
2. WarmUpSetEditor opens
3. Enter name (required)
4. Add items via "Add warm up exercise" (same flow)
5. Save → persists template

## Files to Create/Modify

### New Files
- `src/types/exerciseInstance.ts` - New unified types
- `src/components/ExerciseInstanceEditor.tsx` - Shared editor
- `src/components/MovementPicker.tsx` - Exercise library picker
- `src/components/WarmUpSetChooser.tsx` - Template chooser
- `src/components/WarmUpSetEditor.tsx` - Template editor
- `src/utils/warmupMigration.ts` - Migration logic

### Modified Files
- `src/types/training.ts` - Add new types
- `src/screens/WorkoutBuilderScreen.tsx` - New warmup UI
- `src/store/index.ts` - Add warm up set templates storage
- `src/i18n/index.ts` - Add translation keys

## Testing Checklist
- [ ] Create warmup with time mode
- [ ] Create warmup with reps mode
- [ ] Switch mode (clears fields correctly)
- [ ] Create warm up set with multiple items
- [ ] Insert warm up set into workout
- [ ] Inserted items have unique IDs
- [ ] Old workouts still load (migration works)
- [ ] Notes no longer visible anywhere

## Timeline
Estimated: 3-4 hours of focused implementation
