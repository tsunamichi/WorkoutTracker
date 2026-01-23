# Development Process & Component Standards

## Problem
We've been wasting time and creating inconsistencies by:
1. Not reusing existing component patterns
2. Implementing the same UI elements differently across screens
3. Not checking existing implementations before building new features

## Solution: Pre-Implementation Checklist

### Before implementing ANY feature:

#### 1. **Read the Constants First** (`src/constants/index.ts`)
Always check what's already defined:
- ✅ **Colors** → `COLORS.*`
- ✅ **Spacing** → `SPACING.*`
- ✅ **Typography** → `TYPOGRAPHY.*`
- ✅ **Border Radius** → `BORDER_RADIUS.*`
- ✅ **Cards** → `CARDS.*`
- ✅ **Buttons** → `BUTTONS.*`
- ✅ **Shadows** → `SHADOW.*`

**Example:**
```typescript
// ❌ DON'T create new button styles
const newButton = {
  height: 56,
  backgroundColor: '#1B1B1B',
  borderRadius: 16,
  // ...
};

// ✅ DO use existing patterns
const button = {
  ...BUTTONS.primaryButtonLabeled,
  // Add only what's unique
};
```

#### 2. **Search for Similar UI Patterns**
Before building a new component, search for similar ones:

```bash
# Search for similar patterns
grep -r "statValue" src/screens/
grep -r "primaryButton" src/screens/
grep -r "cardDeep" src/screens/
```

**Common Patterns:**

| UI Element | Standard Pattern | File Example |
|------------|------------------|--------------|
| **Stats (no background)** | `statBlock`, `statValue`, `statLabel` | `ProfileScreen.tsx` |
| **Primary black button** | `BUTTONS.primaryButtonLabeled` | `constants/index.ts` |
| **Card with shadow** | `CARDS.cardDeep.outer/inner` | `constants/index.ts` |
| **Metadata text** | `TYPOGRAPHY.meta + COLORS.textMeta` | Multiple screens |
| **Dashed border button** | `borderStyle: 'dashed'` + `borderColor: COLORS.textMeta` | `CreateCycleDayEditor.tsx` |

#### 3. **Read Similar Screens**
If building a detail screen, read other detail screens first:
- `CycleDetailScreen.tsx` → Layout, header pattern
- `ProfileScreen.tsx` → Stats pattern, cards pattern
- `WorkoutExecutionScreen.tsx` → Bottom CTA pattern

#### 4. **Use Codebase Search for Context**
```typescript
// Before implementing "stats", search:
codebase_search("How do we display stats in this app?", []);

// Before implementing buttons:
codebase_search("How do we style primary action buttons?", []);
```

---

## Component Registry

### **Stats (No Background)**
**Pattern:** `statBlock` container, no background, centered layout
```typescript
<View style={styles.statsRow}>
  <View style={styles.statBlock}>
    <Text style={styles.statValue}>25</Text>
    <Text style={styles.statLabel}>Total Workouts</Text>
  </View>
</View>

const styles = StyleSheet.create({
  statsRow: {
    flexDirection: 'row',
    gap: SPACING.xxxl,
  },
  statBlock: {
    flex: 1,
    alignItems: 'center',
  },
  statValue: {
    ...TYPOGRAPHY.h1,
    color: COLORS.text,
    marginBottom: SPACING.xs,
  },
  statLabel: {
    ...TYPOGRAPHY.meta,
    color: COLORS.textMeta,
  },
});
```
**Used in:** `ProfileScreen.tsx`, `WorkoutTemplateDetailScreen.tsx`

---

### **Primary Action Button**
**Pattern:** Use `BUTTONS.primaryButtonLabeled`, black background, white text, **metaBold** typography
```typescript
<TouchableOpacity style={styles.primaryButton} onPress={handleAction}>
  <Text style={styles.primaryButtonText}>Action Label</Text>
</TouchableOpacity>

const styles = StyleSheet.create({
  primaryButton: {
    ...BUTTONS.primaryButtonLabeled,
    // Add only unique properties (e.g., flex, gap for icons)
  },
  primaryButtonText: {
    ...TYPOGRAPHY.metaBold,  // NOT TYPOGRAPHY.button
    color: COLORS.backgroundCanvas,
  },
});
```
**Used in:** `WorkoutTemplateDetailScreen.tsx`, `CreateCycleBasics.tsx`

**Important:** Button labels use `metaBold`, not `button` typography.

---

### **Dashed Border Card**
**Pattern:** Used for "Add" actions with **metaBold** typography
```typescript
<TouchableOpacity style={styles.addButton}>
  <IconAdd size={20} color={COLORS.text} />
  <Text style={styles.addButtonText}>Add Exercise</Text>
</TouchableOpacity>

const styles = StyleSheet.create({
  addButton: {
    width: '100%',
    height: 56,
    borderRadius: BORDER_RADIUS.lg,
    borderWidth: 1,
    borderColor: COLORS.textMeta,
    borderStyle: 'dashed',
    backgroundColor: 'transparent',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.sm,
  },
  addButtonText: {
    ...TYPOGRAPHY.metaBold,  // NOT body
    color: COLORS.text,
  },
});
```
**Used in:** `CreateCycleDayEditor.tsx`, `WorkoutTemplateDetailScreen.tsx`

**Important:** Dashed "Add" buttons use `metaBold`, not `body` typography.

---

### **Bottom CTA (No Background)**
**Pattern:** Fixed bottom action button without container background or shadow
```typescript
<View style={[styles.bottomCTA, { paddingBottom: insets.bottom || 16 }]}>
  <TouchableOpacity style={styles.actionButton} onPress={handleAction}>
    <Text style={styles.actionButtonText}>Action Label</Text>
  </TouchableOpacity>
</View>

const styles = StyleSheet.create({
  bottomCTA: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: SPACING.xxl,
    paddingTop: SPACING.lg,
    // NO backgroundColor, NO shadow
  },
  actionButton: {
    ...BUTTONS.primaryButtonLabeled,
  },
  actionButtonText: {
    ...TYPOGRAPHY.metaBold,
    color: COLORS.backgroundCanvas,
  },
});
```
**Used in:** `WorkoutTemplateDetailScreen.tsx`

**Important:** Bottom CTAs should NOT have background color or shadows. The button floats cleanly over the content.

---

### **Card with Inner Shadow**
**Pattern:** Use `CARDS.cardDeep.outer/inner` for two-layer shadow effect
```typescript
<View style={styles.cardOuter}>
  <View style={styles.cardInner}>
    {/* Content */}
  </View>
</View>

const styles = StyleSheet.create({
  cardOuter: {
    ...CARDS.cardDeep.outer,
  },
  cardInner: {
    ...CARDS.cardDeep.inner,
    padding: SPACING.lg,
  },
});
```
**Used in:** Multiple screens

---

### **Leaf Page Header**
**Pattern:** Stacked layout with back/action buttons on top, title below
```typescript
<View style={[styles.header, { paddingTop: insets.top }]}>
  <View style={styles.topBar}>
    <TouchableOpacity onPress={handleBack} style={styles.backButton}>
      <IconArrowLeft size={24} color={COLORS.text} />
    </TouchableOpacity>
    <TouchableOpacity onPress={handleAction} style={styles.headerAction}>
      <IconTrash size={24} color={COLORS.error} />
    </TouchableOpacity>
  </View>
  <View style={styles.pageTitleContainer}>
    <Text style={styles.pageTitle}>Page Title</Text>
  </View>
</View>

const styles = StyleSheet.create({
  header: {
    backgroundColor: COLORS.backgroundCanvas,
  },
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    minHeight: 48,
    paddingHorizontal: SPACING.xxl,
  },
  backButton: {
    width: 48,
    height: 48,
    justifyContent: 'center',
    alignItems: 'flex-start',
    marginLeft: -12,
  },
  pageTitleContainer: {
    paddingHorizontal: SPACING.xxl,
    paddingTop: SPACING.md,
  },
  pageTitle: {
    ...TYPOGRAPHY.h2,
    color: COLORS.text,
  },
});
```
**Used in:** `CycleDetailScreen.tsx`, `WorkoutTemplateDetailScreen.tsx`

---

## Implementation Workflow

### Step 1: Research (5-10 min)
1. Read `src/constants/index.ts` for available tokens
2. Search codebase for similar UI patterns: `grep -r "pattern" src/`
3. Read 2-3 similar screens to understand layout conventions

### Step 2: Plan (2 min)
- List which existing patterns apply
- Identify only the truly unique parts
- Confirm spacing/colors/typography from constants

### Step 3: Implement (Build)
- Import from constants: `import { BUTTONS, TYPOGRAPHY, ... } from '../constants'`
- Use spread operator for base styles: `...BUTTONS.primaryButtonLabeled`
- Add only unique properties

### Step 4: Self-Review (2 min)
- Check that you didn't redefine constants
- Verify consistency with similar screens
- Run linter: `read_lints(['path/to/file'])`

---

## Anti-Patterns to Avoid

### ❌ **Don't Hardcode Values**
```typescript
// BAD
const button = {
  height: 56,
  backgroundColor: '#1B1B1B',
  borderRadius: 16,
  fontSize: 17,
};

// GOOD
const button = {
  ...BUTTONS.primaryButtonLabeled,
};
```

### ❌ **Don't Create New Patterns for Existing UI**
```typescript
// BAD - Creating new stat card with background
const statCard = {
  backgroundColor: COLORS.activeCard,
  padding: SPACING.lg,
};

// GOOD - Use existing statBlock (no background)
const statBlock = {
  alignItems: 'center',
};
```

### ❌ **Don't Guess Typography**
```typescript
// BAD
const label = {
  fontSize: 14,
  fontWeight: '400',
};

// GOOD
const label = {
  ...TYPOGRAPHY.meta,
  color: COLORS.textMeta,
};
```

---

## Quick Reference: Common Tasks

| Task | Read First | Pattern to Use |
|------|------------|----------------|
| Add a button | `constants/index.ts` → `BUTTONS` | `BUTTONS.primaryButtonLabeled` |
| Show stats | `ProfileScreen.tsx` | `statBlock`, `statValue`, `statLabel` |
| Create a card | `constants/index.ts` → `CARDS` | `CARDS.cardDeep.outer/inner` |
| Add spacing | `constants/index.ts` → `SPACING` | `marginBottom: SPACING.xxxl` |
| Style text | `constants/index.ts` → `TYPOGRAPHY` | `...TYPOGRAPHY.h3` |
| Add colors | `constants/index.ts` → `COLORS` | `color: COLORS.textMeta` |
| Build a leaf page | `CycleDetailScreen.tsx` | Stacked header + scrollable content |
| Add "Add" button | `CreateCycleDayEditor.tsx` | Dashed border + icon + text |

---

## Commit Message Template
When making changes, always reference the pattern used:

```
feat: Add workout template detail screen

- Uses statBlock pattern from ProfileScreen (no background)
- Uses BUTTONS.primaryButtonLabeled for schedule CTA
- Uses leaf page header pattern from CycleDetailScreen
- Follows dashed border pattern for "Add Exercise" button
```

---

## Benefits
✅ **Consistency** → All stats look the same  
✅ **Speed** → No reinventing the wheel  
✅ **Maintainability** → Changes to constants propagate everywhere  
✅ **Quality** → Reusing tested patterns reduces bugs

---

## 📝 Maintaining This Living Document

### When to Update This Document

**Add a new pattern when:**
1. You create a reusable component used in 2+ places
2. You establish a new design convention (e.g., a new card style)
3. You add new constants to `src/constants/index.ts`
4. You discover an inconsistency that needs to be documented

**Update a pattern when:**
1. Design requirements change (e.g., spacing, colors)
2. A better implementation is found
3. A pattern is deprecated or replaced

### How to Document a New Pattern

Use this template:

````markdown
### **[Component/Pattern Name]**
**Pattern:** [One-line description]
```typescript
// Example implementation
<Component style={styles.example}>
  {/* Content */}
</Component>

const styles = StyleSheet.create({
  example: {
    ...EXISTING_PATTERN,
    // Only unique properties
  },
});
```
**Used in:** `Screen1.tsx`, `Screen2.tsx`
````

### Quick Update Checklist

Before implementing a feature:
- [ ] Check if pattern exists in this document
- [ ] Check if pattern exists in `constants/index.ts`
- [ ] Search codebase for similar implementation

After implementing a feature:
- [ ] If you created a reusable pattern, document it here
- [ ] If you used an undocumented pattern, add it to the registry
- [ ] Update "Used in" references for existing patterns

### Document Sections

1. **Component Registry** → Catalog of reusable UI patterns
2. **Quick Reference** → Task-based lookup table
3. **Anti-Patterns** → Common mistakes to avoid
4. **Constants Reference** → What's available in `constants/index.ts`

### Version History

| Date | Change | Author |
|------|--------|--------|
| 2026-01-22 | Initial document created | AI Assistant |
| 2026-01-22 | Added stats pattern, primary button pattern | AI Assistant |
| 2026-01-22 | Updated button typography to `metaBold`, added bottom CTA pattern (no background) | AI Assistant |
## Reusable Components

### **DraggableExerciseList**
**Location:** `src/components/exercises/DraggableExerciseList.tsx`

**Purpose:** Handles drag-to-reorder exercise lists with animated tap-to-reveal actions

**Usage:**
```typescript
import { DraggableExerciseList, type DraggableExerciseItem } from '../components/exercises';

const exercises: DraggableExerciseItem[] = items.map((item, idx) => ({
  id: item.exerciseId,
  exerciseId: item.exerciseId,
  name: item.name,
  order: idx,
}));

<DraggableExerciseList
  exercises={exercises}
  onReorder={handleReorder}
  onEdit={handleEdit}         // Optional
  onSwap={handleSwap}          // Optional
  onDelete={handleDelete}
  selectedExerciseId={selectedId}
  onSelectExercise={setSelectedId}
  actionButtons={['edit', 'delete']}
  scrollEnabled={scrollEnabled}
  onScrollEnabledChange={setScrollEnabled}
/>
```

**Features:**
- Drag-to-reorder with PanResponder
- Animated card shrinking (75%) when tapped
- Action icons slide in from right
- Orange drop indicator
- Configurable buttons: swap, edit, delete
- Auto-disables parent scroll while dragging

**Used in:** `WorkoutTemplateDetailScreen.tsx`, `WorkoutEditScreen.tsx`

**⚠️ CRITICAL:** Never reimplement drag-drop manually. Always use this component.


## Data Model Migration Notes

### **WorkoutTemplate vs Cycle-based Workouts**

The app is transitioning from cycle-based workouts to standalone `WorkoutTemplate` objects. Some screens need to support **both** structures during the migration.

**Pattern: Backward-Compatible Workout Loading**

```typescript
// Try cycle first (old structure)
const cycle = cycles.find(c => c.id === cycleId);
let workout = cycle?.workoutTemplates.find(w => w.id === workoutTemplateId);

// Fall back to standalone template (new structure)
const isStandaloneTemplate = !workout && workoutTemplateId;
if (isStandaloneTemplate) {
  const template = getWorkoutTemplate(workoutTemplateId);
  if (template) {
    // Convert WorkoutTemplate to old format for backward compatibility
    workout = {
      id: template.id,
      name: template.name,
      exercises: template.items.map(item => ({
        id: item.exerciseId,
        exerciseId: item.exerciseId,
        orderIndex: item.order,
        targetSets: item.sets,
        targetRepsMin: item.reps,
        targetRepsMax: item.reps,
        targetWeight: item.weight,
        // ... other fields
      })),
    };
  }
}
```

**Pattern: Backward-Compatible Workout Saving**

```typescript
const handleSave = async () => {
  if (isStandaloneTemplate && updateWorkoutTemplate) {
    // Save to new structure
    await updateWorkoutTemplate(templateId, {
      name: workoutName,
      items: exercises.map((ex, idx) => ({ ... })),
    });
  } else if (cycle) {
    // Save to old structure
    await updateCycle(cycleId, {
      workoutTemplates: updatedTemplates,
    });
  }
};
```

**Applied in:**
- `WorkoutExecutionScreen.tsx` (view/execute workout)
- `WorkoutEditScreen.tsx` (edit workout)

**Important:** Any screen that navigates with `workoutTemplateId` must support both structures until the full migration is complete.


---

### **DraggableExerciseList: Handling Duplicate Exercises**

**Problem:** If a workout has the same exercise twice (e.g., two sets of squats), using `exerciseId` as the unique `id` causes:
1. React reconciliation errors (duplicate keys)
2. Drag-drop breaks (can't distinguish between items)
3. Delete/edit affects wrong item (always finds first occurrence)

**Solution:** Use composite ID combining exerciseId + position

```typescript
// When creating the list:
const sortedItems = [...template.items].sort((a, b) => a.order - b.order);
const exerciseDetails = sortedItems.map((item, index) => ({
  id: `${item.exerciseId}-${index}`, // ✅ Unique composite ID
  exerciseId: item.exerciseId,
  name: item.name,
  order: index,
}));

// When reordering:
const handleReorder = async (reorderedExercises) => {
  const sortedItems = [...template.items].sort((a, b) => a.order - b.order);
  const updatedItems = reorderedExercises.map((item, newIndex) => {
    const originalIndex = parseInt(item.id.split('-').pop() || '0', 10);
    return {
      ...sortedItems[originalIndex],
      order: newIndex,
    };
  });
  await updateWorkoutTemplate(templateId, { items: updatedItems });
};

// When deleting:
const handleDelete = async (compositeId) => {
  const originalIndex = parseInt(compositeId.split('-').pop() || '0', 10);
  const sortedItems = [...template.items].sort((a, b) => a.order - b.order);
  const updatedItems = sortedItems
    .filter((_, idx) => idx !== originalIndex)
    .map((item, newIndex) => ({ ...item, order: newIndex }));
  await updateWorkoutTemplate(templateId, { items: updatedItems });
};
```

**Key Points:**
- ✅ Always sort items first to get stable indices
- ✅ Use `exerciseId-index` format for composite ID
- ✅ Extract index from ID when mapping back: `item.id.split('-').pop()`
- ✅ Re-index items after deletion

**Applied in:** `WorkoutTemplateDetailScreen.tsx`


---

### **Cycle Conflict Resolution**

**Problem:** When creating a CyclePlan, existing ScheduledWorkouts (manual or from previous cycles) may overlap with the new plan's schedule, causing conflicts.

**Solution:** Detect conflicts before applying the plan and let the user choose how to resolve.

**Flow:**

```typescript
// 1. User completes cycle creation (CreateCycleReview)
const result = await addCyclePlan(newPlan); // No resolution parameter

// 2. Store detects conflicts
if (!result.success && result.conflicts && result.conflicts.length > 0) {
  // Navigate to conflicts screen
  navigation.navigate('CycleConflicts', {
    plan: newPlan,
    conflicts: result.conflicts,
  });
}

// 3. User selects resolution on CycleConflictsScreen
const resolution = 'replace' | 'keep' | 'cancel';

// 4. Apply with resolution
await addCyclePlan(plan, resolution);
```

**Resolution Options:**

| Option | Behavior |
|--------|----------|
| **Replace** | Remove all conflicting scheduled workouts, apply cycle schedule |
| **Keep** | Keep existing scheduled workouts, cycle fills empty days (manual overrides) |
| **Cancel** | Don't activate the cycle, return to editor |

**Implementation:**

```typescript
// Store functions (src/store/index.ts)
getCycleEndDate: (startDate: string, weeks: number) => string;
listDatesInRange: (start: string, endExclusive: string) => string[];
detectCycleConflicts: (plan: CyclePlan) => ConflictItem[];
addCyclePlan: (plan: CyclePlan, resolution?: CycleConflictResolution) => 
  Promise<{ success: boolean; conflicts?: ConflictItem[] }>;
```

**Screen:** `CycleConflictsScreen.tsx`
- Displays list of conflicting dates/workouts
- Radio button selection for resolution
- Applies plan with chosen resolution
- Navigates to Schedule tab on success

**Applied in:**
- `CreateCycleReview.tsx` (manual cycle creation)
- Any future cycle creation flow (AI, templates, etc.)

**Important:**
- `detectCycleConflicts` only checks within the plan's date range (startDate → endDate)
- Manual workouts (`source='manual'`) always count as conflicts
- Cycle workouts from other plans also count as conflicts
- When `resolution='keep'`, `generateScheduledWorkoutsFromCycle` respects existing workouts


---

## Exercise Editing Components

### **ExerciseSettingsSheet**
**Location:** `src/components/exercises/ExerciseSettingsSheet.tsx`

**Purpose:** Simple bottom drawer for editing exercise settings (sets, reps, weight, time-based toggle)

**Design Source:** Based on `ExerciseEditorBottomSheet.tsx` from cycle creation flow (same styling, minus week tabs)

**Usage:**
```typescript
import { ExerciseSettingsSheet } from '../components/exercises';

const [editingExerciseId, setEditingExerciseId] = useState<string | null>(null);

// When user taps edit icon:
const handleEdit = (exerciseId: string) => {
  setEditingExerciseId(exerciseId);
};

// In render:
{editingExerciseId && (() => {
  const exercise = getExerciseById(editingExerciseId);
  return (
    <ExerciseSettingsSheet
      exercise={{
        ...exerciseData,
        name: exercise.name,
      }}
      visible={true}
      onClose={() => setEditingExerciseId(null)}
      onSave={(updates) => handleSaveExercise(editingExerciseId, updates)}
    />
  );
})()}
```

**Features:**
- Time-based toggle (for duration vs reps)
- Weight, reps/duration, sets controls with +/- steppers (exact order from cycle flow)
- Respects user's kg/lb preference
- Pinned save button at bottom (accentPrimaryDimmed background)
- Clean, consistent styling with activeCard background
- Matches `ExerciseEditorBottomSheet` design exactly

**Used in:** `WorkoutTemplateDetailScreen.tsx`

**⚠️ vs ExerciseEditorBottomSheet:** 
- `ExerciseEditorBottomSheet` is for **cycle creation** (week tabs, draft store)
- `ExerciseSettingsSheet` is for **standalone templates** (simpler, no weeks)

