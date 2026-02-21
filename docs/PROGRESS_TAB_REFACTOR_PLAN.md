# Progress Tab Refactor + Expandable Cycle Drawer — Implementation Plan

**Status**: Approved  
**Date**: Feb 21, 2026

---

## Decisions (from planning discussion)

1. **Key Lifts selection**: Build pin/unpin "Edit Key Lifts" UI in v1
2. **Tap lift card**: New read-only Lift History screen in v1
3. **Sparkline data**: Top-set weight from last 8 sessions containing that exercise
4. **No previous cycle**: Show absolute volume number (don't hide the row)
5. **Check-in photo**: 1 thumbnail, prefer "Front" label if exists
6. **Weight source**: `bodyWeightEntries` only — remove `progressLogs` entirely
7. **Photos**: Wire up existing `ProgressPhoto` type (Front/Side/Back labels)

---

## Assumptions

1. **Framework**: React Native with Expo, TypeScript, Zustand store, react-native-reanimated, dayjs
2. **Existing expandable drawer**: "Current Cycle Module" in ProgressHomeScreen uses reanimated shared value (expansion 0→1) with pan gesture. Collapsed ~48px, expanded +100px
3. **Data availability**:
   - Lift history: `detailedWorkoutProgress` (per workout → exercises → sets with weight/reps), legacy `sessions` (WorkoutSet[]), PRs in `exercisePRs`
   - Cycle data: `cyclePlans`, `scheduledWorkouts` with `programId`. No cycle-vs-cycle comparison yet
   - Body weight: `bodyWeightEntries` (date + weight + unit) — sole weight source
   - Photos: `ProgressPhoto` type exists but not wired up
   - Completion: `useProgressMetrics` already computes `workoutsCompleted/workoutsPlanned`
4. **No chart/sparkline library** installed. Will use `react-native-svg` (already a dependency)
5. **No Lift History screen** exists. `ExerciseDetailScreen` is a set-logging screen, not a trends screen

---

## Metrics Definitions

| Metric | Definition | Fallback |
|--------|-----------|----------|
| **Lift primary stat** | Top set (weight × reps) from latest session | If no weight, show reps only (bodyweight exercises) |
| **Lift delta baseline** | vs 4 weeks ago (time-based), from `keyLifts.previousWeight` | If < 4 weeks of data, show "New" badge |
| **Sparkline data** | Top-set weight from last 8 sessions containing that exercise | If < 2 data points, hide sparkline |
| **Cycle completion** | `completedWorkouts / plannedWorkouts` (status=completed or isLocked). Ad-hoc workouts excluded | 0% if no workouts yet |
| **Volume** | Total tonnage: Σ(weight × reps) across completed sets in cycle workouts | If weights missing (bodyweight), count total reps; label "reps" not "load" |
| **Volume vs last cycle** | `(current - previous) / previous × 100` | No previous cycle → show absolute volume only |
| **Bodyweight change (drawer)** | Latest bodyWeightEntry in cycle range minus earliest in same range | No entries → hide row |
| **Bodyweight change (weekly card)** | Latest bodyWeightEntry this ISO week minus latest from previous ISO week | No previous week → show absolute weight only |
| **Week boundary** | ISO week (Mon-Sun) | — |

---

## Component Reuse Map

| Need | Existing | Action |
|------|----------|--------|
| Expandable drawer | `CurrentCycleModule` (ProgressHomeScreen) | **Reuse & extend** |
| Drag handle | `DragHandle` | **Reuse as-is** |
| Bottom drawer | `BottomDrawer` | **Reuse as-is** |
| Delta badge | `DeltaBadge` (inline in ProgressHomeScreen) | **Extract** to `src/components/common/DeltaBadge.tsx` |
| Diagonal line pattern | `DiagonalLinePattern` | **Reuse as-is** |
| Icons | `Icon*` components | **Reuse as-is** |
| Card styling | `CARDS.cardFlat` | **Reuse** |
| Action sheet | `ActionSheet` | **Reuse** for Edit Key Lifts |
| Sparkline | — | **Create**: `src/components/common/Sparkline.tsx` |
| KeyLiftCard | — | **Create**: `src/components/progress/KeyLiftCard.tsx` |
| WeeklyWeightCard | — | **Create**: `src/components/progress/WeeklyWeightCard.tsx` |
| PhotoCheckInCard | — | **Create**: `src/components/progress/PhotoCheckInCard.tsx` |
| LiftHistoryScreen | — | **Create**: `src/screens/LiftHistoryScreen.tsx` |

---

## Tasks

### Phase 0 — Audit & Prep

**Task 0.1: Remove progressLogs**
- Remove `progressLogs` from store, types, and storage
- Remove `addProgressLog`, `deleteProgressLog` store actions
- Delete `ProgressGalleryScreen` and `ProgressLogDetailScreen`
- Remove navigation routes for deleted screens
- Remove `progressLogs` from cloud backup
- DoD: No references to `progressLogs` or `ProgressLog` type remain; app compiles

**Task 0.2: Wire up ProgressPhoto model**
- Add `progressPhotos` array to store
- Add `addProgressPhoto`, `deleteProgressPhoto` store actions
- Add storage persistence (`saveProgressPhotos`, `loadProgressPhotos`)
- DoD: Can add/delete/persist ProgressPhoto entries

**Task 0.3: Create Sparkline component**
- `src/components/common/Sparkline.tsx` using `react-native-svg`
- Props: `data: number[]`, `width`, `height`, `color`, `strokeWidth`
- Simple polyline, no axes, no labels
- DoD: Renders correctly with sample data

**Task 0.4: Extract DeltaBadge as shared component**
- Move from inline in ProgressHomeScreen to `src/components/common/DeltaBadge.tsx`
- Props: `deltaPercent: number | null`, `suffix?: string`
- DoD: Standalone typed component, reusable

### Phase 1 — Refactor Progress Tab Content

**Task 1.1: Create KeyLiftCard component**
- `src/components/progress/KeyLiftCard.tsx`
- Fields: lift name, primary stat (weight × reps), delta badge, sparkline
- Tap handler prop for navigation
- Uses `CARDS.cardFlat`, `TYPOGRAPHY`, `SPACING` tokens
- DoD: Standalone component matching spec

**Task 1.2: Create Lifts section**
- Replace "All-Time Records" in ProgressHomeScreen
- Header: "Lifts" + subtext "Strength trends across time"
- 3-4 KeyLiftCards from `useProgressMetrics.keyLifts`
- Sparkline data: extend `useProgressMetrics` to return last 8 top-set weights per lift
- Link: "Edit Key Lifts" at bottom
- Empty state: "Complete your first workout to see lift trends"
- DoD: Lifts section renders with real data, sparklines visible, empty state works

**Task 1.3: Build "Edit Key Lifts" sheet**
- BottomDrawer with list of all exercises from history
- Toggle pin/unpin for each
- Persist pinned lifts in store (new `pinnedKeyLifts: string[]` in settings or store)
- Cap at 4 pinned lifts
- DoD: User can pin/unpin lifts; pinned lifts appear in Lifts section

**Task 1.4: Create LiftHistoryScreen**
- `src/screens/LiftHistoryScreen.tsx`
- Params: `exerciseId`, `exerciseName`
- Shows: larger sparkline/chart of top-set weight over time, list of past sessions with date + weight × reps, current PR badge
- Data from `detailedWorkoutProgress` + `sessions` + `exercisePRs`
- Register in navigation stack
- DoD: Screen renders with real data, navigable from KeyLiftCard tap

**Task 1.5: Create Body section**
- Replace old "Body Check-In" in ProgressHomeScreen
- Header: "Body" + subtext "Check-ins and physical changes"
- **Weight card**: latest bodyWeightEntry this week, delta vs last week, "Log weight" CTA if none
- **Photo card**: latest ProgressPhoto thumbnail (prefer Front), "Add photo" CTA if none
- **Recent photos**: horizontal FlatList of last 6 ProgressPhotos
- **Weight trend**: Sparkline from last 8 weeks of bodyWeightEntries (one point per week = latest entry that week)
- Empty state: "Log your first check-in to track changes"
- DoD: Body section renders with real data, empty states work, photo capture flow works

**Task 1.6: Build photo capture flow**
- "Add photo" opens camera/picker (reuse existing `expo-image-picker` usage)
- Label selection: Front / Side / Back
- Save as `ProgressPhoto` via store
- DoD: User can capture and save labeled photos

**Task 1.7: Remove old sections and dead code**
- Remove "All-time Records" rendering
- Remove old "Body Check-In" card
- Remove fake data fallbacks
- Remove unused imports
- DoD: No dead code, clean file

### Phase 2 — Drawer Upgrade (Cycle Intelligence)

**Task 2.1: Extend useProgressMetrics with cycle comparison data**
- Add to CycleSnapshot:
  - `completionPercent`: completed / planned × 100
  - `totalVolume`: Σ(weight × reps) for completed cycle workouts
  - `previousCycleTotalVolume`: same for most recent ended/archived cycle
  - `volumeVsPreviousCyclePercent`: delta % (null if no previous cycle)
  - `primaryLiftName`, `primaryLiftCurrent` (weight×reps), `primaryLiftPrevious`
  - `bodyweightStart`, `bodyweightCurrent` (from bodyWeightEntries in cycle range)
- Find previous cycle: most recent CyclePlan with `endedAt` or `!active` before active cycle's startDate
- DoD: New fields available, null when data missing

**Task 2.2: Redesign expanded drawer content**
- Replace current expanded content (Completed/Consistency/Top Lift)
- New rows (in order):
  1. **Completion**: percent + thin progress bar
  2. **Volume**: absolute number, or "+X% vs last cycle" if previous exists
  3. **Primary lift**: "Bench 165×6 → 175×6" (current vs previous cycle)
  4. **Bodyweight**: "180 → 178 lb" (start vs current in cycle)
- CTA: "View Cycle Summary" → navigates to CyclePlanDetail
- Each row hidden gracefully if data is null
- DoD: Expanded drawer shows all available insights

**Task 2.3: Adjust drawer dimensions**
- Increase `MODULE_EXPANDED_EXTRA` to ~180 (4 rows + CTA)
- Cap at 40% screen height
- Test on small (iPhone SE) and large (iPhone 17 Pro Max) screens
- DoD: Drawer fits content, doesn't overflow, smooth animation

### Phase 3 — Quality & Polish

**Task 3.1: Empty states**
- Lifts: icon + "Complete your first workout to see lift trends"
- Body: icon + "Log your first check-in to track changes"
- Drawer (no active cycle): "No active cycle" with link to create
- Weight trend (no data): subtle "No weight data" text
- DoD: Every section has intentional empty state

**Task 3.2: Performance**
- Memoize sparkline data computation
- FlatList for recent photos: `keyExtractor`, `getItemLayout`
- Ensure `useProgressMetrics` cycle comparison doesn't recompute on unrelated store changes
- DoD: No jank on scroll, verified on device

**Task 3.3: Typography & spacing audit**
- All text uses TYPOGRAPHY tokens
- All spacing uses SPACING tokens
- Section dividers consistent
- Breathing room matches "Swiss" aesthetic (generous padding)
- DoD: Visual consistency with Schedule tab

---

## Risks & Edge Cases

| Risk | Mitigation |
|------|-----------|
| No previous cycle | Show absolute volume, hide comparison text |
| Sparse exercise data (< 2 sessions) | Hide sparkline, show "New" badge |
| Mixed kg/lb units | Normalize via settings.useKg + existing weight utils |
| No bodyweight entries | Hide bodyweight row in drawer and weight trend |
| Large exercise catalog | "Edit Key Lifts" sheet scrollable, cap at 4 pins |
| Performance (volume computation) | Memoize with cycle ID + workout count as deps |
| Drawer on small screens | Cap expanded height at 40% screen height |
| No photos | Placeholder image area + CTA |
| Paused cycle completion % | Count only workouts up to today |
| Removing progressLogs | Migration: existing data is lost. Acceptable since feature is being redesigned |

---

## Milestones

**v1 — Core Refactor** (Phase 0 + Phase 1)
- progressLogs removed, ProgressPhoto wired up
- Sparkline component, DeltaBadge extracted
- Lifts section with KeyLiftCards, sparklines, Edit Key Lifts
- LiftHistoryScreen (new, read-only)
- Body section with weight card, photo card, gallery, weight trend
- Empty states for all sections
- Old code removed

**v1.1 — Drawer Intelligence** (Phase 2)
- useProgressMetrics extended with cycle comparison
- Expanded drawer: completion, volume, primary lift, bodyweight
- "View Cycle Summary" CTA

**v2 — Polish & Future** (Phase 3+)
- Performance audit
- Cross-cycle comparison timeline
- Photo comparison (side-by-side Front photos across weeks)
