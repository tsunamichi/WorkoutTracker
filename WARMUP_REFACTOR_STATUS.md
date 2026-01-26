# Warm Up Refactor - Implementation Status

## ✅ COMPLETED

### 1. Type System (src/types/training.ts)
- ✅ Added `ExerciseInstance` unified type for warmup + workout exercises
- ✅ Added `ExerciseInstanceSet` with reps/time/weight support
- ✅ Added `WarmUpSetTemplate` for reusable warmup routines
- ✅ Deprecated old `WarmupItem` (renamed to `WarmupItem_DEPRECATED`)
- ✅ Type aliased `WarmupItem` to `ExerciseInstance` for gradual migration

### 2. Migration Utilities (src/utils/warmupMigration.ts)
- ✅ `migrateWarmupItem()` - Converts old structure to new
- ✅ `migrateWarmupItems()` - Batch migration
- ✅ `needsMigration()` - Detection helper
- ✅ `validateExerciseInstance()` - Validation logic
- ✅ `createBlankExerciseInstance()` - Factory for new instances
- ✅ `cloneExerciseInstance()` - Deep clone with new IDs

### 3. Core Components

#### ExerciseInstanceEditor (src/components/ExerciseInstanceEditor.tsx)
- ✅ Unified editor for both warmup and workout exercises
- ✅ Mode toggle (reps/time)
- ✅ Multiple sets support with add/remove
- ✅ Stepper controls for reps/time/weight
- ✅ Context-aware defaults (warmup=time, workout=reps)
- ✅ Mode switching clears incompatible fields
- ✅ Rest time support (mainly for workouts)
- ✅ Validation before save
- ✅ NO notes field

#### MovementPicker (src/components/MovementPicker.tsx)
- ✅ Search exercises from library
- ✅ Filter by name, muscle, equipment
- ✅ Clean list UI
- ✅ Empty state handling

## 🚧 IN PROGRESS / TODO

### 4. Warm Up Set Management (NEXT)
- [ ] Create `WarmUpSetChooser.tsx`
  - List all warm up set templates
  - Search by name
  - Show recent/popular
  - "Create new" action
  - Select → copy items to workout
- [ ] Create `WarmUpSetEditor.tsx`
  - Name input (required)
  - Add warmup exercises (via MovementPicker → ExerciseInstanceEditor)
  - Edit existing items
  - Remove items
  - Reorder items (optional)
  - Save template

### 5. WorkoutBuilderScreen Updates
- [ ] Replace old `WarmupItemEditor` with new system
- [ ] Add "Add warm up exercise" button → MovementPicker → ExerciseInstanceEditor
- [ ] Add "Add warm up set" button → WarmUpSetChooser
- [ ] Display warmup items using shared list component
- [ ] "Save as warm up set" action (optional)

### 6. Store Updates (src/store/index.ts)
- [ ] Add `warmUpSetTemplates: WarmUpSetTemplate[]` to state
- [ ] Add `addWarmUpSetTemplate(template)`
- [ ] Add `updateWarmUpSetTemplate(id, updates)`
- [ ] Add `deleteWarmUpSetTemplate(id)`
- [ ] Add `getWarmUpSetTemplate(id)`
- [ ] Persist to AsyncStorage
- [ ] Run migration on hydration for old warmup data

### 7. Translation Keys (src/i18n/index.ts)
Need to add:
- `selectExercise` / `searchExercises`
- `time` / `reps`
- `addSet` / `cannotRemoveSet` / `atLeastOneSetRequired`
- `invalidSets` / `allSetsMustHaveReps` / `allSetsMustHaveTime`
- `restBetweenSets`
- `addWarmUpSet` / `addWarmUpExercise`
- `warmUpSets` / `selectWarmUpSet` / `createWarmUpSet`
- `noWarmUpSets` / `warmUpSetName`
- `saveAsWarmUpSet`

### 8. Testing & Validation
- [ ] Create warmup with time mode
- [ ] Create warmup with reps mode
- [ ] Toggle mode (verify field clearing)
- [ ] Create warm up set template
- [ ] Insert warm up set into workout
- [ ] Verify unique IDs on insertion
- [ ] Test migration with old data
- [ ] Verify notes are gone everywhere

### 9. Documentation
- [ ] Update WARMUP_IMPLEMENTATION.md with new architecture
- [ ] Add migration guide for users
- [ ] Update component documentation

## Key Design Decisions Made

1. **Unified Type System**: `ExerciseInstance` works for both contexts, just changes default mode
2. **Context-Aware Defaults**: Warmup defaults to time, workout defaults to reps
3. **No Notes**: Removed entirely per spec
4. **Deep Cloning**: Warm up sets copy items with new IDs to prevent template mutation
5. **Validation**: Enforces reps for reps-mode, durationSec for time-mode
6. **Migration**: Gracefully handles old data, creates dummy movements if needed

## Implementation Complexity

**Estimated Remaining Work**: ~2-3 hours

**Critical Path**:
1. Warm Up Set Chooser → Editor (1 hour)
2. WorkoutBuilder integration (1 hour)
3. Store updates + migration (30 min)
4. Translation keys (15 min)
5. Testing (30 min)

## Next Steps

1. Create WarmUpSetChooser.tsx
2. Create WarmUpSetEditor.tsx
3. Update WorkoutBuilderScreen.tsx
4. Update store/index.ts with warm up set management
5. Add all translation keys
6. Test end-to-end flows
7. Document changes
