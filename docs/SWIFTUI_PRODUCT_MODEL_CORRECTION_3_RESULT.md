# SwiftUI Product Model Correction 3 — Result

Date: 2026-08-22

## Outcome

Native Equilibrium now models workouts as independent, undated records. Home is an active-workout queue containing every ready or in-progress workout. Completion removes a workout from Home immediately while retaining the same immutable record for History and Exercise Performance.

The uncommitted Phase 5 Plans implementation was isolated from the Phase 1–4 baseline and removed. No Plan UI, plan repository, plan SwiftData record, plan backup state, or plan test remains.

## Removed obsolete model

The correction removed:

- `CyclePlan`, `PlanDay`, `PlanID`, `PlanStatus`, plan scheduling/status helpers, repositories, mappers, SwiftData records, lifecycle commands, views, tests, backup fields, and Home navigation;
- `LocalDay` from workouts and all date-range/day repository queries;
- current-day providers, guards, and `workoutNotCurrentDay`;
- `WorkoutTemplate`, its identity/repository/records/mappers/backup state, and template provenance;
- `WorkoutSource`, manual/plan source state, and plan provenance;
- the version 1 native backup fixture and its obsolete schema;
- scheduling terminology in active production type, file, UI, accessibility, validation, and creation names.

No retained Phase 1–4 behavior required template persistence. Recent reuse copies canonical workout snapshots directly, paste import creates builder drafts, and creation uses personal `ExerciseDefinition` identities. Consequently, templates and the one-value source model were removed completely.

## Final canonical model

```swift
struct Workout: Identifiable, Codable, Hashable, Sendable {
    let id: WorkoutID
    var titleSnapshot: String
    var exercises: [WorkoutExercise]
    var status: WorkoutStatus
    var startedAt: Date?
    var completedAt: Date?
    var createdAt: Date
    var updatedAt: Date
}
```

The retained ownership graph is `Workout → WorkoutExercise → SetPrescription → LoggedSet`. Renames from the former scheduling model include `ScheduledWorkout` to `Workout`, `ScheduledWorkoutID` to `WorkoutID`, `ScheduledExercise` to `WorkoutExercise`, and the matching SwiftData record names. The former `.planned` state is `.ready`.

Validation enforces exactly three states:

- ready: neither lifecycle timestamp;
- in progress: `startedAt` only;
- completed: both timestamps, with completion not before start.

## Product behavior

`activeWorkouts()` returns every non-completed workout ordered by `createdAt` ascending and stable `WorkoutID` ascending. Starting, logging, resetting, or otherwise updating a workout does not reorder Home. Add Workout remains the final carousel page. Completion immediately removes the completed card while preserving the relative order of the remaining cards.

Scratch, paste, and recent creation no longer accept or infer a day. Each path creates fresh independent workout, exercise, and prescription identities with no logged sets or lifecycle state. Recent reuse retains the Phase 3 prescription precedence rules.

Execution read-only state is exactly completed status. All normal commands are available to incomplete workouts regardless of creation/start age. Incomplete deletion removes only the workout. Completed workouts remain immutable.

History formats and orders records from `completedAt`, with `updatedAt` only as a defensive fallback. Exercise Performance occurrences and trend points carry `occurredAt`; no duplicate day value remains. Existing snapshot, ExerciseID grouping, PR, trend, unit, and accessibility rules are unchanged.

## Persistence and backup

The SwiftData schema now contains only exercise definitions, workouts and their owned children, and backup/settings metadata. Configuration name `EquilibriumProductModelCorrection3` deliberately creates fresh pre-release development storage; no long-term migration layer was added.

Native backup schema version 2 contains exercises, workouts, settings, and retained progression configuration. It contains no templates, plans, sources, provenance, or scheduled dates. The frozen React Native data remains untouched and will be transformed only during the separate importer phase.

## Regression coverage

Tests were corrected or added for:

- active Home membership and stable created-at/ID ordering;
- immediate middle-card completion removal and canonical History retention;
- ready workout persistence and execution long after creation;
- in-progress persistence, logged-set restoration, later logging, and completion;
- independent creation, fresh IDs, recent reuse, and paste import;
- completed immutability and all retained execution commands;
- timestamp-based History and Exercise Performance;
- backup v2 deterministic round-trip and persistence recreation;
- atomic multi-workout creation and child identity validation.

The governing `SWIFTUI_V1_MIGRATION_PLAN.md` was replaced with a contradiction-free independent-workout roadmap. The former Plans phase is removed; Progression plus full Timer remains the next separate implementation phase and was not started here.

## Validation

- Full XCTest suite: 84 tests passed with zero failures.
- Focused Home queue suite: 6 tests passed with zero failures.
- iOS Simulator production build: passed.
- Simulator boot, install, and launch: passed on iPhone 16 Pro (iOS 26.2).
- Source terminology scan of production Swift: no obsolete plan/date/schedule/template/source architecture found.
- `git diff --check`: passed.
