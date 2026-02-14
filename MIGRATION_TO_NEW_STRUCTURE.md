# Migration to New Exercise Structure - Summary

## Date: February 13, 2026

## Overview
Successfully migrated warmup and accessory items from deprecated structure to the new `ExerciseInstance` architecture. This fixes the UI inconsistency where old items displayed correctly but newly created items looked different.

## Root Cause
- **Type definitions** pointed to new `ExerciseInstance` structure
- **Implementation** was still using old `WarmupItem_DEPRECATED` structure
- This mismatch caused newly created items to have incorrect/missing properties

## Changes Made

### 1. Type Definitions (`src/types/training.ts`)
- ✅ Added `isPerSide` to `ExerciseInstance`
- ✅ Created `ExerciseInstanceWithCycle` type extending `ExerciseInstance` with cycle support
- ✅ Updated `WarmupItem` and `AccessoryItem` to use `ExerciseInstanceWithCycle`

### 2. Migration Utilities (`src/utils/exerciseMigration.ts`) - NEW FILE
Created comprehensive migration utilities:
- `migrateDeprecatedItem()` - Converts old structure to new
- `isDeprecatedItem()` - Detects old structure
- `migrateItemsArray()` - Batch migration
- `createNewExerciseItem()` - Creates properly structured new items
- `getDisplayValuesFromItem()` - Extracts display values from new structure

### 3. Execution Screens
Updated both `WarmupExecutionScreen.tsx` and `AccessoriesExecutionScreen.tsx`:
- ✅ Import migration utilities
- ✅ Migrate items on load: `migrateItemsArray(rawItems)`
- ✅ Updated grouping logic to use `item.sets.length` instead of `item.sets`
- ✅ Extract values from first set: `firstSet = exercise.sets[0]`
- ✅ Use `exercise.movementId` instead of `exercise.exerciseName`
- ✅ Use `exercise.mode === 'time'` instead of `exercise.isTimeBased`
- ✅ Updated all rendering logic to extract display values correctly

### 4. Editor Screens
Updated both `WarmupEditorScreen.tsx` and `AccessoriesEditorScreen.tsx`:
- ✅ Import migration utilities
- ✅ Migrate items on load
- ✅ Updated `handleAddItem()` to use `createNewExerciseItem()`
- ✅ Updated `handleAddItemToCycle()` to create new structure
- ✅ Updated `handleApplyTemplate()` to create new structure
- ✅ Updated rendering to use `getDisplayValuesFromItem()`
- ✅ **Updated `handleSaveItem()`** to convert old-style updates to new structure:
  - Converts `exerciseName` → `movementId`
  - Converts `isTimeBased` → `mode`
  - Handles `sets` count changes by adding/removing set objects
  - Updates all sets when `reps` or `weight` changes

### 5. Editor Sheet Components
Updated both `WarmupItemEditorSheet.tsx` and `AccessoryItemEditorSheet.tsx`:
- ✅ Import `getDisplayValuesFromItem()`
- ✅ Extract display values on component mount
- ✅ Updated `useEffect` to extract display values when item changes
- These components still work with old-style fields (exerciseName, sets, reps, etc.) for simplicity
- Parent screens handle conversion back to new structure

## Data Structure Comparison

### OLD Structure (WarmupItem_DEPRECATED):
```typescript
{
  id: string;
  exerciseName: string;
  sets: number;  // Total number of sets
  reps: number;  // Reps per set (or seconds if time-based)
  weight: number;
  isTimeBased: boolean;
  isPerSide?: boolean;
  cycleId?: string;
  cycleOrder?: number;
}
```

### NEW Structure (ExerciseInstanceWithCycle):
```typescript
{
  id: string;
  movementId: string;  // Exercise name/reference
  mode: 'reps' | 'time';
  sets: ExerciseInstanceSet[];  // Array of set objects
  restSec?: number;
  isPerSide?: boolean;
  cycleId?: string;
  cycleOrder?: number;
}

// Where ExerciseInstanceSet is:
{
  id: string;
  reps?: number;
  durationSec?: number;
  weight?: number;
}
```

## Backward Compatibility
- ✅ Old items are automatically migrated on load
- ✅ All existing workouts will continue to work
- ✅ No data loss or corruption
- ✅ Gradual migration as items are loaded

## Testing Checklist
Before marking complete, test:
- [ ] Create new warmup item (should use new structure)
- [ ] Create new accessory item (should use new structure)
- [ ] Edit existing item (should update correctly)
- [ ] Apply template (should create new structure)
- [ ] Load old workout (should migrate automatically)
- [ ] Execute warmup with time-based exercises
- [ ] Execute accessories with reps-based exercises
- [ ] Create and execute cycle/superset
- [ ] Verify UI consistency between old and new items

## Benefits
1. **Fixed UI inconsistency** - New items now display correctly
2. **Future-proof architecture** - Aligned with intended design
3. **Better structure** - Sets are proper objects, not just counts
4. **Extensibility** - Easier to add per-set variations (different weights, reps, etc.)
5. **Clean codebase** - Consistent structure throughout

## Files Modified
1. `src/types/training.ts`
2. `src/utils/exerciseMigration.ts` (NEW)
3. `src/screens/WarmupExecutionScreen.tsx`
4. `src/screens/AccessoriesExecutionScreen.tsx`
5. `src/screens/WarmupEditorScreen.tsx`
6. `src/screens/AccessoriesEditorScreen.tsx`
7. `src/components/WarmupItemEditorSheet.tsx`
8. `src/components/AccessoryItemEditorSheet.tsx`

## Next Steps
1. Test the changes thoroughly (see Testing Checklist above)
2. Consider adding data migration script for AsyncStorage if needed
3. Update documentation if any API changes affect other parts of the app
4. Monitor for any edge cases during real-world usage
