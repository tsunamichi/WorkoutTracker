# 🔄 Cycle System - Complete Implementation Guide

## Overview

The Workout Tracker now includes a comprehensive cycle creation and management system with progressive overload logic.

---

## ✅ What's Been Implemented

### 1. **Enhanced Data Model**

#### Cycle Structure
```typescript
{
  id: string;
  name: string;
  startDate: string;
  lengthInWeeks: number;        // NEW: Required field
  endDate: string;               // Auto-calculated
  workoutsPerWeek: number;       // NEW: Training days per week
  goal?: string;
  isActive: boolean;
  workoutTemplates: WorkoutTemplate[];
}
```

#### Workout Template Structure
```typescript
{
  id: string;
  cycleId: string;
  name: string;
  workoutType: WorkoutType;
  dayOfWeek?: number;            // NEW: 1 = Monday, 7 = Sunday
  orderIndex: number;
  exercises: WorkoutTemplateExercise[];
}
```

#### Exercise with Progression
```typescript
{
  id: string;
  exerciseId: string;
  orderIndex: number;
  targetSets: number;
  targetRepsMin: number;
  targetRepsMax?: number;
  targetWeight?: number;
  
  // Progression System
  progressionType: 'weight' | 'reps' | 'double' | 'none';
  progressionValue?: number;     // e.g., 2.5 for +2.5kg
  repRangeMin?: number;
  repRangeMax?: number;
}
```

---

## 🎯 Cycle Creation Flow

### Step 1: Basic Information
- **Cycle Name** (required)
- **Goal** (optional description)

### Step 2: Cycle Length
- Choose duration: 4, 6, 8, 12, or 16 weeks
- **End date** auto-calculated and displayed

### Step 3: Workouts Per Week
- Choose frequency: 3, 4, 5, or 6 days/week
- Sets expectation for workout template creation

### After Creation
- User is prompted to add workout templates
- (Next step: Workout Template Builder - TO BE IMPLEMENTED)

---

## 📈 Progressive Overload System

### Progression Types

#### 1. **Weight Progression**
```
Week 1: 3 × 8-10 reps @ 50kg
Week 2: 3 × 8-10 reps @ 52.5kg
Week 3: 3 × 8-10 reps @ 55kg
...
```
- Reps stay constant
- Weight increases by `progressionValue` each week

#### 2. **Reps Progression**
```
Week 1: 3 × 8 reps @ 50kg
Week 2: 3 × 9 reps @ 50kg
Week 3: 3 × 10 reps @ 50kg
...
```
- Weight stays constant
- Reps increase by `progressionValue` each week

#### 3. **Double Progression**
```
Week 1: 3 × 8 reps @ 50kg
Week 2: 3 × 9 reps @ 50kg
Week 3: 3 × 10 reps @ 50kg
Week 4: 3 × 8 reps @ 52.5kg  ← Weight up, reps reset
```
- Increase reps until reaching `repRangeMax`
- Then increase weight and reset reps to `repRangeMin`

#### 4. **No Progression**
- Maintenance mode
- Same weight and reps each week

---

## 🛠️ Utility Functions

### Calculate Weekly Targets
```typescript
// Get expected weight for this week
calculateWeeklyWeight(exercise, weekNumber, baseWeight)

// Get expected reps for this week
calculateWeeklyReps(exercise, weekNumber)

// Get formatted display text
getProgressionDisplay(exercise, weekNumber, baseWeight, settings)
```

### Cycle Helpers
```typescript
// Calculate end date from start + length
calculateCycleEndDate(startDate, lengthInWeeks)

// Get current week number of active cycle
getCurrentCycleWeek(startDate)
```

---

## 🎨 UI Components

### CyclesView
- **"+ New Cycle" button** at the top
- List of all cycles with:
  - Name and active badge
  - Current week indicator (e.g., "Week 3 of 8")
  - Goal description
  - Date range
  - Stats: length, workouts/week, total workouts

### CreateCycleModal
- **3-step wizard** with progress indicator
- Step 1: Name + Goal
- Step 2: Length (visual selection grid)
- Step 3: Workouts per week (visual selection grid)
- Validation and error handling
- Back/Next/Create navigation

---

## 📋 What's Next (TODO)

### Immediate Next Steps

1. **Workout Template Builder** ⏳
   - Add workout templates to a cycle
   - Select exercises from library
   - Set target sets, reps, weight
   - Choose progression type for each exercise
   - Assign day of week

2. **Day-of-Week Assignment** ⏳
   - Visual weekday grid (Mon-Sun)
   - Drag-and-drop or tap to assign
   - Prevent conflicts (1 workout per day)

3. **Workout Detail View**
   - View all exercises in a workout
   - Edit template
   - Reorder exercises
   - Delete exercises

4. **Active Cycle Management**
   - Mark cycle as active/inactive
   - Only one active cycle at a time
   - Active cycle appears on "Today" tab

### Integration with Trainer (AI)

The Trainer tab should be able to:
- "Create a 8-week push/pull/legs cycle"
- "Add 2.5kg to all bench press exercises"
- "Set double progression for squats with 8-12 rep range"
- "Show my progression for deadlifts"

**Status**: Architecture ready, needs NLP parsing logic

---

## 🔧 Technical Notes

### Storage
- All cycles saved to AsyncStorage
- Automatic persistence on any change
- Full TypeScript type safety

### Performance
- Progression calculations are lightweight
- Week number calculated on-demand
- No heavy computations

### Future Enhancements
- **Deload weeks**: Automatically reduce volume every N weeks
- **Auto-progression**: AI suggests weight increases based on RPE
- **Cycle templates**: Pre-built programs (5/3/1, PPL, etc.)
- **Analytics**: Track volume, tonnage, frequency over time

---

## ✅ Status

**Completed**:
- ✅ Enhanced data model with progression system
- ✅ Cycle creation flow (3-step wizard)
- ✅ Progressive overload utilities
- ✅ "New Cycle" button in CyclesView
- ✅ Current week tracking for active cycles

**In Progress**:
- ⏳ Workout template builder
- ⏳ Day-of-week assignment
- ⏳ Exercise progression configuration

**Planned**:
- 📅 Cycle activation/deactivation
- 📅 Template editing and deletion
- 📅 Trainer AI integration for cycle creation

---

**Ready to build the Workout Template Builder next!** 🚀

