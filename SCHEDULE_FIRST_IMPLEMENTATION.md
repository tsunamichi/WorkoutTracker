# Schedule-First Architecture Implementation

## ✅ What's Been Implemented (Backend Complete)

### 1. Core Data Model (`src/types/training.ts`)

#### New Types:
- `WarmupItem` - Warm-up exercises with duration/reps
- `WarmupCompletionState` - Track completed warm-up items
- `WorkoutCompletionState` - Track completed exercises/sets
- `ConflictResolutionMap` - Per-conflict decisions for atomic plan apply
- `PlanApplySummary` - Summary of plan application results

#### Updated Types:
```typescript
WorkoutTemplate {
  kind: 'workout'
  warmupItems: WarmupItem[]
  lastUsedAt: string | null    // Updates ONLY when applied to schedule
  usageCount: number            // Increments ONLY when applied to schedule
  source?: 'user' | 'ai' | 'import'
}

ScheduledWorkout {
  // Snapshots (immutable copies from template)
  titleSnapshot: string
  warmupSnapshot: WarmupItem[]
  exercisesSnapshot: WorkoutTemplateExercise[]
  
  // Completion tracking
  warmupCompletion: WarmupCompletionState
  workoutCompletion: WorkoutCompletionState
  
  // Status
  status: 'planned' | 'in_progress' | 'completed'
  isLocked: boolean             // Hard lock when completed
  
  // Program metadata
  programId: string | null
  programName: string | null
  weekIndex: number | null
  dayIndex: number | null
}

CyclePlan {
  lastUsedAt: string | null
  usageCount: number
}
```

---

### 2. Store Methods (`src/store/index.ts`)

#### Scheduling Workouts:
```typescript
// Schedule a workout (creates snapshots, updates usage tracking)
scheduleWorkout(
  date: string,           // YYYY-MM-DD
  templateId: string,
  source: 'manual' | 'cycle',
  cyclePlanId?: string,
  resolution?: 'replace' | 'cancel'
) → { success: boolean; conflict?: ScheduledWorkout }
```

**What it does:**
- ✅ Creates deep snapshots from template
- ✅ Initializes completion states
- ✅ Updates template.lastUsedAt to now
- ✅ Increments template.usageCount
- ✅ Enforces one workout per day (detects conflicts)
- ✅ Blocks replacement of locked (completed) workouts

#### Atomic Plan Application:
```typescript
// Apply a plan with atomic conflict resolution
applyCyclePlan(
  planId: string,
  resolutionMap?: ConflictResolutionMap  // date → 'keep' | 'replace'
) → PlanApplySummary | { success: false; conflicts: ConflictItem[] }
```

**Three-phase operation:**
1. **Detect**: Find all conflicts (in-memory, no writes)
2. **Propose**: Build proposed workouts based on resolutionMap
3. **Commit**: Single atomic write batch

**Returns:**
```typescript
{
  success: true,
  applied: 10,    // workouts successfully scheduled
  kept: 5,        // existing workouts kept
  replaced: 3,    // existing workouts replaced
  locked: 2       // completed workouts preserved (always kept)
}
```

#### Move/Duplicate:
```typescript
// Move workout to another date (blocked if locked)
moveScheduledWorkout(
  workoutId: string,
  toDate: string
) → { success: boolean; error?: string }

// Duplicate workout to another date (allowed even for locked)
duplicateScheduledWorkout(
  workoutId: string,
  toDate: string
) → { success: boolean; error?: string }
```

#### Warm-up Completion:
```typescript
// Update warm-up item completion (independent from workout)
updateWarmupCompletion(
  workoutId: string,
  warmupItemId: string,
  completed: boolean
) → void

// Get warm-up completion stats
getWarmupCompletion(
  workoutId: string
) → { completedItems: string[]; totalItems: number; percentage: number }
```

**Important:** Warm-up completion does NOT affect `getWorkoutCompletionPercentage()`

#### Completing Workouts:
```typescript
// Complete workout (sets isLocked = true)
completeWorkout(workoutId: string) → void

// Delete workout (blocked if locked)
unscheduleWorkout(workoutId: string) → void
```

---

### 3. Key Rules Enforced

#### Hard Lock:
- ✅ When `status` → 'completed', `isLocked` → `true`
- ✅ Locked workouts CANNOT be:
  - Deleted (`unscheduleWorkout`)
  - Replaced (`scheduleWorkout`, `applyCyclePlan`)
  - Moved (`moveScheduledWorkout`, `swapWorkoutAssignments`)
- ✅ Locked workouts CAN be:
  - Duplicated to another date (creates new unlocked instance)

#### One Workout Per Day:
- ✅ Enforced in all scheduling operations
- ✅ Conflict detection returns existing workout
- ✅ User must explicitly resolve conflicts
- ✅ No silent replacements

#### Template Usage Tracking:
- ✅ `lastUsedAt` updates ONLY when template applied to schedule
- ✅ `usageCount` increments ONLY when applied to schedule
- ✅ Viewing, editing, previewing does NOT update these fields
- ✅ Templates sorted by `lastUsedAt DESC` for "recently used"

#### Snapshots (Immutability):
- ✅ Snapshots created at scheduling time (deep copy)
- ✅ Editing scheduled instance does NOT mutate template
- ✅ Template edits do NOT affect existing scheduled instances

---

### 4. Data Migration

**Automatic migration on app start:**
- ✅ Adds new fields to existing `WorkoutTemplate` records
- ✅ Adds new fields to existing `CyclePlan` records
- ✅ Creates snapshots for existing `ScheduledWorkout` records
- ✅ Initializes completion states
- ✅ Sets `isLocked` based on status

---

## 🔍 Verification

**Check Metro/Xcode console on app reload:**

You should see:
```
🔍 SCHEDULE-FIRST ARCHITECTURE VERIFICATION:
================================================

📋 WORKOUT TEMPLATES (X total):
  Sample template: { ... }

📅 CYCLE PLANS (X total):
  Sample plan: { ... }

🗓️  SCHEDULED WORKOUTS (X total):
  Sample scheduled workout: { ... }
  🔒 Locked (completed) workouts: X

✅ NEW ARCHITECTURE STATUS:
  - Data structure: ✅ Loaded
  - Migrations: ✅ Applied/Not needed
  - Store methods: ✅ Available
  - Ready for UI: ✅ Yes
================================================
```

---

## 📋 What's NOT Implemented (UI Needs Update)

The **backend is complete**, but the UI still needs to be updated:

1. **Schedule Tab (TodayScreen)**:
   - ❌ Not using new `getScheduledWorkout(date)`
   - ❌ Not showing empty state correctly
   - ❌ Not calling new `scheduleWorkout()` method

2. **Workouts Tab (WorkoutsScreen)**:
   - ❌ Not displaying templates with lastUsedAt sorting
   - ❌ Not showing usage counts

3. **Add Workout Flow**:
   - ❌ No bottom sheet for "Workout vs Plan" choice
   - ❌ No template picker using new architecture

4. **Conflict Resolution Screen**:
   - ❌ Doesn't exist yet (needed for `applyCyclePlan`)

5. **Warm-up UI**:
   - ❌ No UI to track warm-up completion
   - ❌ Not showing warm-up items from snapshots

---

## 🚀 Next Steps for UI Implementation

### Minimal Changes to See It Work:

1. **Update TodayScreen** to use `getScheduledWorkout(date)`:
```typescript
const scheduledWorkout = useStore(state => state.getScheduledWorkout(selectedDate));

if (scheduledWorkout) {
  // Show: titleSnapshot, exercisesSnapshot
  // Check: isLocked to disable actions
  // Display: status ('planned' | 'in_progress' | 'completed')
}
```

2. **Add simple "Schedule Workout" button**:
```typescript
const { scheduleWorkout, workoutTemplates } = useStore();
const today = dayjs().format('YYYY-MM-DD');

// Pick any template and schedule it
const result = await scheduleWorkout(today, templates[0].id, 'manual');
if (!result.success && result.conflict) {
  // Show conflict resolution UI
}
```

3. **Display locked workouts differently**:
```typescript
{scheduledWorkout.isLocked && (
  <View style={styles.lockedBadge}>
    <Text>🔒 Completed</Text>
  </View>
)}
```

---

## 📞 Testing Commands

All these methods are available in the store:

```typescript
const store = useStore();

// Schedule a workout
await store.scheduleWorkout('2024-01-25', 'template-id', 'manual');

// Apply a plan (will return conflicts if any)
const result = await store.applyCyclePlan('plan-id');
if (!result.success) {
  console.log('Conflicts:', result.conflicts);
}

// Move a workout
await store.moveScheduledWorkout('workout-id', '2024-01-26');

// Update warm-up
await store.updateWarmupCompletion('workout-id', 'warmup-item-id', true);

// Check if day has workout
const workout = store.getScheduledWorkout('2024-01-25');
console.log('Locked?', workout?.isLocked);
```

---

## 🎯 Summary

**Backend Status:** ✅ 100% Complete
- All data structures implemented
- All business logic implemented  
- All rules enforced
- Migrations working
- Type-safe

**UI Status:** ⏳ Needs Update
- Screens still using old architecture
- Need to wire up new methods
- Need to build conflict resolution screen

The foundation is solid and ready for UI implementation!
