# Equilibrium SwiftUI Phase 2 result

Date: 2026-08-22

## Result

Phase 2 implements the Workout Execution vertical slice only. Schedule now opens a real native execution destination by `ScheduledWorkoutID`; planned workouts start, in-progress workouts resume, repetition and duration sets persist into the canonical workout, completed/current/upcoming presentation is derived, validated workouts complete, and completed workouts reopen read-only. No builder, recent/import/plan flow, full History, progression, timer, authentication, Supabase, or RN migration work was started.

## Execution architecture

The production flow is:

```text
ScheduleRoute.workout(ScheduledWorkoutID)
→ ScheduledWorkoutRepository
→ WorkoutExecutionModel
→ WorkoutExecutionView
```

`WorkoutExecutionModel` receives only the stable ID. It loads and publishes one canonical `ScheduledWorkout`; it owns only transient destination state (activation, error/completion presentation, and a temporary focused exercise). `WorkoutExecutionView`, `ExerciseExecutionCard`, and `SetEntryRow` render the canonical ordered exercise list. There are no sections or separate completed/current/up-next collections.

New files are `Domain/Models/WorkoutExecution.swift`, `Features/WorkoutExecution/WorkoutExecutionModel.swift`, `Features/WorkoutExecution/WorkoutExecutionView.swift`, and `EquilibriumTests/WorkoutExecutionPhase2Tests.swift`. Schedule, fixtures, repository protocols/implementation, design tokens, Settings Units, and the generated Xcode project were updated.

## Repository commands and persistence

`ScheduledWorkoutRepository` now exposes `startWorkout`, `logSet`, and `completeWorkout`. Views never mutate SwiftData records. `SwiftDataRepository` loads the canonical value, applies and validates the command, then saves through the existing one-context transaction. A logged set is keyed to its scheduled prescription and uses its own generated globally unique `logged-<UUID>` identity. Editing a set retains that logged-set identity.

Confirmed repetition and duration rows persist immediately. Keystrokes remain local until the row confirmation action. Repetition logging stores optional weight (`nil` means no external load) plus positive repetitions; duration logging stores positive seconds. Target/input mismatches are rejected. The disk-backed command test destroys and recreates both container and repository and recovers the exact in-progress status and logged values.

## Start, resume, and navigation semantics

The Schedule source card and route retain the same `ScheduledWorkoutID` before and after mutation. Destination activation loads first; a planned workout starts only from `WorkoutExecutionModel.activate()`, after `Task.yield()` preserves the source through native destination activation. It receives `startedAt`, `updatedAt`, and `.inProgress` together. Activating an in-progress workout is idempotent and preserves `startedAt`. Activating a completed workout performs no mutation and exposes read-only rows.

The existing `.matchedTransitionSource` and `.navigationTransition(.zoom)` remain unchanged. Reduce Motion still removes zoom and changes the completion overlay to opacity-only. Native back is unrestricted; confirmed progress is already on disk.

## Derived exercise state and progress

`WorkoutExecutionQuery` is the single derivation point. An exercise is complete when all prescribed IDs have a completed canonical logged set or when the existing `skippedAt` is present. The first incomplete exercise is current and later incomplete exercises are upcoming. A transient focus can display any selected exercise as current, including reopening a completed exercise for canonical editing while the workout remains in progress. Focus is not persisted and no three-array representation exists.

Workout progress is completed required prescription IDs divided by required prescriptions across non-skipped exercises. Skipped exercises are excluded from numerator and denominator and do not block completion. Phase 2 deliberately adds no skip UI because frozen Explore V2 exposes timer/rest skipping, not whole-exercise skipping as a core retained action; the pre-existing domain policy remains deterministic and tested.

## Completion semantics

Completion requires `.inProgress`, at least one exercise, and every exercise to validate complete under the set/skip policy. One repository update preserves `startedAt`, sets `.completed`, `completedAt`, and `updatedAt`, and saves the full canonical record. Incomplete completion fails without mutation. Repository updates and set commands reject completed workouts; reactivation is read-only. No session, progress, PR, percentage, exercise-state, section, or completion-map record exists.

The completion presentation uses the semantic success color, success sensory feedback, design-system typography/spacing/button radius, and a restrained scale/fade (fade only under Reduce Motion). The explicit Return to Schedule action uses native dismissal.

## Schedule refresh

Each successful repository command publishes the returned canonical value through `didPersist`; `ScheduleModel.applyPersistedWorkout` replaces the matching item in its existing bounded week cache immediately. Destination disappearance also reloads the visible range from the repository. This gives immediate Start/Resume/Completed card behavior while keeping SwiftData/repository data authoritative and avoiding a second durable state store.

## Units and input

Canonical `Weight` remains pounds. Shared `WeightText` conversion/parsing handles pounds and kilograms, optional blank load, decimal display, and round trips. The previously placeholder Units destination now contains the minimum pounds/kilograms picker backed by `AppStorage`; Schedule supplies that preference to execution. No broader Settings work was added.

Set rows use decimal-pad weight and integer-pad repetition/duration fields, native `FocusState`, interactive scroll keyboard dismissal, local draft text, contextual field labels, and minimum semantic touch/input dimensions. Values commit only from the row completion/update action.

## Design system and accessibility

Execution uses only semantic colors, spacing, typography, radii, dimensions, motion, and the reusable `eqCard` container. New primitives are `EQTypography.exerciseTitle`, `EQDimension.minimumTouch`, `EQDimension.inputHeight`, `EQMotion.completion`, and `EQCardModifier`. The typography is a reusable exercise hierarchy, dimensions encode accessibility/control semantics, motion encodes the reusable completion transition, and the card modifier removes repeated surface/radius/stroke treatment. `EQPreferenceKey` centralizes the units key; it is not a visual token.

The touched-code audit found no feature-level literal RGB/hex colors, repeated raw corner radii, or repeated animation durations. The Phase 1 seven-point calendar marker and fixed card/week geometry remain local component geometry; no numeric-name token was introduced. Existing design-system RGB definitions remain centralized in `DesignTokens.swift`.

Exercise cards announce name, state, and progress independently of color. Completed/current/upcoming states also use text and symbols. Set fields include set number and metric context, completion is textual and symbolic, controls use minimum touch targets, content uses semantic Dynamic Type fonts, scrolling protects large content/keyboard layouts, and motion respects Reduce Motion.

## Fixtures and tests

Canonical fixtures now include a mid-workout with a completed prior exercise, partially logged current exercise, multiple upcoming exercises, duration work, a long exercise name, and globally distinct scheduled child IDs. Previews cover fresh planned, mid-workout, completed/read-only, duration/mixed, long names, and Accessibility XXL; the mid-workout preview covers completed/current/multiple-upcoming states.

The full XCTest suite passes: 36 tests, 0 failures (24 existing plus 12 Phase 2). Phase 2 coverage includes start timestamp/idempotent resume; repetition/duration logging; optional weight; target validation; state/progress/skip derivation; incomplete and successful completion; completion timestamps; immutability; unique scheduled/logged child IDs; disk relaunch; destination-only start; in-progress resume; completed read-only activation; back-equivalent persistence; Schedule propagation; and unit conversion/text round trips.

## Build, launch, and RN comparison

The simulator build succeeds with Xcode 26.6 / iOS Simulator SDK 26.5. The full test suite succeeds on iPhone 16 Pro (iOS 26.2). The built app installed and launched with planned and in-progress same-day fixtures; simulator inspection verified the Schedule planned card. Accessibility XXL launched successfully through the simulator content-size override and its fixture preview. Reduce Motion is implemented through environment branches for both navigation and completion; this `simctl` runtime does not expose a Reduce Motion setting toggle, so that branch still needs hands-on Settings verification.

The requested end-to-end manual tap/typing checklist could not be fully driven from the non-interactive command environment. Its canonical behaviors are covered by repository/model integration tests, including actual disk recreation, partial exit/resume state, completion, Schedule propagation, and read-only activation. A hands-on zoom gesture, VoiceOver traversal, and keyboard occlusion pass remains advisable on device before release.

Frozen RN `ExerciseExecutionScreen` and Explore V2 components were inspected. Native retains the focused current card, visible up-next queue, understandable completed items, completed-item editing during an active workout, compact set entry, and restrained completion direction. It intentionally does not carry over RN sections, stores, sessions, PR writes, progression, timers, custom deck transitions, or workout-wide skip behavior. `git diff` confirms RN source and package files are unchanged.

## Deviations, discoveries, and risks before Phase 3

- Whole-exercise skip remains supported by the canonical derivation/validation policy but has no Phase 2 UI because it is not a core reachable Explore V2 action.
- Units use minimal local preference persistence because normalized settings persistence was explicitly deferred in Phase 1. A future Settings repository should migrate this preference without changing canonical pound storage.
- The existing mapper replaces child records during a workout update. Repeated command and relaunch tests pass, including retained IDs, but schema migration behavior beyond v1 remains a general pre-existing risk.
- Hands-on interactive zoom, VoiceOver, hardware-keyboard/locale decimal entry, and extreme keyboard occlusion should receive device QA.
- No material migration-plan architecture issue was discovered, so `SWIFTUI_V1_MIGRATION_PLAN.md` was not changed.
