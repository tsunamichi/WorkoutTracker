# Equilibrium v1 — governing SwiftUI migration plan

Status: active governing plan. Product Model Correction 3 is locked and supersedes all scheduling, dated-workout, template, plan, and cycle language in older result documents and in the frozen React Native application.

## Product invariant

Workouts are independent, undated canonical records.

Home displays all incomplete workouts. A ready or in-progress workout remains in Home indefinitely until completed or deleted. Completing a workout removes it from Home immediately and retains the same canonical record in History.

There is no scheduling, date picker, day rollover, plan, or cycle in native v1. Timestamps describe lifecycle and history, not scheduling.

The frozen React Native baseline remains a behavioral reference only where it does not conflict with this model. Legacy data will be transformed at a future import boundary; it must not shape the native domain.

## Native product graph

Home is the only root experience and presents an active-workout carousel followed by Add Workout. It has no calendar lens or tab bar.

```text
Home: all ready and in-progress workouts
├── Add Workout
│   ├── Create from scratch
│   ├── Paste workout
│   └── Use recent workout
├── Workout Execution
├── Workout History
│   └── Completed Workout Detail
│       └── Exercise Performance
└── Settings
```

Plans, cycles, schedule navigation, template management, AI creation, Progress tabs, and authentication launch gates are absent.

## Canonical durable model

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

The ordered ownership graph is:

```text
Workout
→ ordered WorkoutExercise
→ ordered SetPrescription
→ LoggedSet
```

`ExerciseDefinition` supplies stable personal-exercise identity. Workout and exercise names are snapshots. There is no session object, `LocalDay`, scheduling provenance, template identity, source enum, plan identity, or parallel history store.

Valid lifecycle states are:

- `ready`: no start or completion timestamp.
- `inProgress`: a start timestamp and no completion timestamp.
- `completed`: both timestamps.

Completed workouts are immutable through normal product commands. Every incomplete workout remains editable regardless of age.

## Repository contracts

The canonical Home query is `activeWorkouts()`. It returns ready and in-progress workouts ordered by `createdAt` ascending, then stable `WorkoutID` ascending. Status changes and `updatedAt` changes never reorder the queue.

Workout commands operate by stable workout and child IDs. They validate status and domain values, persist through repository transaction boundaries, and never check the device calendar. Completing a workout changes the canonical record to completed; Home then excludes it while History includes it.

History queries completed records ordered by `completedAt` descending and then stable `WorkoutID`. Valid completed records always have `completedAt`; `updatedAt` may only be a defensive read fallback for malformed development data.

Exercise Performance groups completed historical occurrences by stable `ExerciseID`. Occurrence and trend chronology use `occurredAt`, derived from completion timestamps. Historical snapshots, valid completed sets, metric-family rules, PR derivation, unit conversion, previous occurrence, and accessibility text remain Phase 4 behavior.

## Home and creation

Home contains every incomplete workout plus Add Workout as the final page. Empty Home contains only Add Workout. There is no Rest Day state.

All creation paths directly materialize a fresh independent workout using `createdAt` for stable queue order:

- Create from scratch uses the personal exercise vocabulary and an ordered exercise list.
- Paste workout parses one or more workout definitions and opens each independently in Workout Builder.
- Use recent workout copies the retained Phase 3 structure and prescription precedence behavior.

Fresh workouts receive fresh workout, exercise, and prescription IDs, with no logged sets, start timestamp, or completion state. Creation has no date parameter or picker. Home does not expose template management.

## Execution

Execution read-only state is exactly `workout.status == .completed`. Ready workouts start; in-progress workouts resume with persisted logged sets. There is no current-day or age eligibility rule.

Retained behavior includes exercise focus, ordered sets, logging and editing, add/remove set, rest timer, Skip Rest, Previous Performance, reset, delete while incomplete, rest-duration editing, share, overflow actions, completion gating, and completion. Completed records remain read-only.

## Persistence and backup

SwiftData stores only retained product records. This pre-release correction uses a new schema configuration and recreates development storage rather than maintaining compatibility with the invalid development schema.

Native backup schema version 2 contains:

- personal `ExerciseDefinition` values;
- canonical `Workout` values;
- retained settings;
- retained progression configuration for the later Progression phase.

It contains no dates used for scheduling, templates, plans, cycles, sources, or duplicate workout stores. React Native import and cloud backup remain separate future work.

## Migration phases

Completed and retained:

1. Native foundation and Home vertical slice, corrected to the active-workout queue.
2. Workout Execution.
3. Workout creation, paste import, and recent reuse.
4. History and Exercise Performance, including correction passes.
5. Product Model Correction 3: independent workouts, no dates, no plans.

The former “Phase 5 — Plans” is removed and is not part of the roadmap.

Next, in a separate change set:

6. Progression plus full Timer behavior.
7. Authentication and versioned Supabase backup.
8. Explicit React Native migration/import.
9. Release hardening and retained-product regression.

No phase may reintroduce scheduling, templates, plans, cycles, or date-based workout eligibility without a new explicit product decision.

## Validation gates

Every retained phase must keep these invariants covered:

- ready and in-progress workouts survive relaunch indefinitely;
- Home ordering is deterministic and Add Workout stays final;
- completion removes only the completed card immediately;
- incomplete workout deletion removes only that workout;
- all three creation paths produce fresh independent records;
- old incomplete workouts support every normal execution mutation;
- completed workouts remain immutable and appear in History;
- History and Performance chronology comes from timestamps;
- persistence and backup recreate equivalent canonical state;
- the full XCTest suite, simulator build/install/launch, source terminology scan, and `git diff --check` pass.

Progression/full Timer, authentication, Supabase, importer work, and visual polish remain outside this correction.
