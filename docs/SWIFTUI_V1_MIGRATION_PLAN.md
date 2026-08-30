# Equilibrium v1 — governing SwiftUI migration plan

Status: active governing plan. This document incorporates Product Model Correction 3, Progression/Timer QA, and the retained-flow closure decisions. It supersedes contradictory scheduling, template, progression, completion, and completed-immutability language in older result documents and in the frozen React Native application.

## Locked product model

Workouts are independent, undated canonical records. Home displays every `ready` and `inProgress` workout, ordered by `createdAt` ascending and stable `WorkoutID` ascending. A workout remains there indefinitely until completed or deleted. Persisting the final required valid set automatically completes the workout, removes it from Home immediately, and retains the same canonical record in History.

There is no scheduling, date picker, `LocalDay`, day rollover, template, Plan, or Cycle in native v1. Lifecycle timestamps describe execution and History only. The frozen React Native application is a behavioral reference only where compatible with this model.

```text
Home: all ready and in-progress workouts
├── Add Workout
│   ├── Create from scratch
│   ├── Paste one or more workouts
│   └── Use recent workout
├── Workout Execution
├── Workout History
│   └── Completed Workout Detail
│       └── Exercise Performance
├── Saved standalone Timers
└── Settings
```

Authentication launch gates, scheduling, templates, Plans, Cycles, AI creation, and a Progress tab are absent.

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

The ordered ownership graph is `Workout → WorkoutExercise → SetPrescription → LoggedSet`. `ExerciseDefinition` supplies stable personal-exercise identity; names in workouts are historical snapshots. There is no session, scheduling provenance, source, template identity, plan identity, or parallel history store.

Lifecycle states are `ready`, `inProgress`, and `completed`. Completed workouts never return to Home. From History, the user may correct canonical logged-set weight, repetitions, or duration. That correction retains workout status, workout `completedAt`, logged-set identity, and logged-set `completedAt`; History, PRs, and Exercise Performance derive again from the corrected logs. Other structural completed-workout mutations remain restricted unless separately approved.

## Home and creation

Home contains all incomplete workouts followed by Add Workout. Empty Home contains only Add Workout. A failed refresh keeps already-visible cards, presents a compact error with Retry, and clears the error after a successful load.

The lightweight scratch Builder owns workout title plus an ordered exercise list. It does not require detailed prescription editing. Known exercises inherit the latest canonical completed working-set structure and values; an exercise without history begins without manufactured sets. Execution owns first-set creation and subsequent set mutation.

Clipboard Paste uses the deterministic local parser. Every successfully parsed workout is materialized as a fresh independent workout in parsed order through the atomic workout batch boundary. Each receives fresh workout, workout-exercise, and prescription identities, with no logs or lifecycle state. Known and unknown exercises follow the same personal-vocabulary and latest-history rules as scratch creation. Paste creates no dates, schedules, templates, or intermediate multi-workout review aggregate.

Recent reuse creates fresh independent workouts in selection order. It copies selected workout structure while resolving each exercise through current canonical creation inheritance. No logs, lifecycle timestamps, or historical identities are copied.

## Execution and completion

Ready workouts start; in-progress workouts resume with persisted logs. All incomplete workouts remain mutable regardless of age. Retained execution includes exercise focus, ordered sets, logging and editing, first-set creation, Add Set and value propagation, removal of unlogged sets, rest-duration editing, rest timer and Skip Rest, Previous Performance, exercise settings/swap/removal, reset, delete, share, and overflow actions.

When the final required valid set is successfully persisted, completion occurs automatically exactly once. There is no Mark Complete button, completion confirmation page, or Return Home page. Completed workouts open read-only in execution; the narrow History metric-correction command is the explicit exception described above.

Time-based exercises use one ordered flow: work timer → canonical set log → rest timer when another required set remains. Work-timer expiration never creates a parallel history record. The canonical `LoggedSet.duration` remains authoritative.

## Progression

Progression is enabled globally and assigned per stable `ExerciseID` using exactly four fixed profiles:

- None: no progression prefill.
- Upper: 5–8 repetitions, +2.5 lb.
- Lower: 5–8 repetitions, +5 lb.
- Accessories: 10–20 repetitions, +2.5 lb.

The newest completed canonical occurrence drives the calculation. Progression directly prefills the appropriate editable weight or repetition value and displays `↑` beside the dimension that changed. It never manufactures zero weight. Generic defaults, ordered groups, arbitrary overrides, and an informational Suggested card are not product concepts.

## Timers

The shared deadline-based countdown engine reconciles elapsed time after suspension or foreground return. In-workout work/rest state is transient and is not backed up or restored after process termination.

Standalone Timers are saved, reusable interval configurations containing a name, movement duration, exercise rest, exercises per round, rounds, and round rest. Users can create, edit, delete, run, pause/resume, skip, reset, and restart them. They create no Workout or History record.

Notification permission, local notifications, Live Activities, Dynamic Island, forced silent-mode audio, and terminated-process timer continuation are not required for native v1.

## History, persistence, and backup

History reads completed canonical workouts ordered by `completedAt` descending and stable `WorkoutID`. Exercise Performance groups by stable `ExerciseID`; occurrences, metric-family selection, PRs, trends, units, previous performance, and accessibility text derive from canonical completed logs.

SwiftData stores personal exercise definitions, canonical workouts and owned children, settings, and fixed-profile progression assignments. Native backup schema version 2 contains the same durable product state. It contains no schedule dates, templates, Plans, Cycles, sources, sessions, duplicate history, or transient timer runtime. Saved standalone timer configurations remain local reusable preferences.

## Migration roadmap

Completed and retained:

1. Native foundation and active-workout Home queue.
2. Workout Execution and automatic completion.
3. Lightweight scratch, multi-workout Paste, and recent creation.
4. History, completed metric correction, and Exercise Performance.
5. Independent-workout product correction with scheduling/templates/Plans removed.
6. Fixed-profile automatic progression plus work, rest, and saved standalone Timers.
7. Retained-flow closure, governing-model reconciliation, and functional accessibility hardening.

Next separate changes:

8. Authentication and versioned Supabase backup.
9. Explicit React Native migration/import.
10. Release hardening and retained-product regression.

No phase may reintroduce scheduling, templates, Plans, Cycles, generic progression rule architecture, or date-based workout eligibility without a new explicit product decision.

## Validation gates

- ready and in-progress workouts survive relaunch indefinitely;
- Home ordering is deterministic, Add Workout stays final, and failed refreshes do not erase visible data;
- completing the final required set removes only that workout immediately;
- incomplete deletion removes only its target;
- scratch, every parsed Paste workout, and recent reuse receive fresh canonical identities;
- multi-workout Paste is all-or-nothing at the workout persistence boundary;
- old incomplete workouts support every normal execution mutation;
- completed structural mutations are rejected while History metric correction preserves completion timestamps;
- History, Performance, and PRs recompute from canonical corrected logs;
- progression profiles and `↑` prefills follow the locked fixed rules;
- time-based work logs canonically before rest and standalone Timers create no history;
- persistence and backup recreate equivalent canonical state;
- full XCTest, simulator build/install/launch, source terminology scan, and `git diff --check` pass.

Authentication, Supabase, RN import, and general visual polish remain outside this closure pass.
