# SwiftUI Experience Parity Pass 1 Result

## Scope and divergence

This pass changes Schedule and Workout Execution only. The previous native production path made a week strip the dominant Schedule control and represented workout execution as a generic progress header followed by every exercise and every editable set row. Those structures met the data requirements but did not preserve Equilibrium's workout-first, one-set-at-a-time interaction model.

No Phase 4 feature was started. Workout Builder, pickers, import, History, Plans, and Settings were not redesigned.

## Schedule restored

Schedule now opens with the lightweight `Workout of the day` header, selected local date, Workout history, and Settings. There is no generic Schedule navigation title and the week strip was removed from the production path. Compact previous/next day controls and Today provide date navigation without making the calendar the primary object.

Date changes remain `LocalDay` operations through `ScheduleCalendar`. A selected day loads its containing repository range and maps at most one canonical workout. Tests cover day navigation through a DST boundary and retain the repository's one-workout-per-`LocalDay` conflict.

The workout card remains keyed by stable `ScheduledWorkoutID`, is the largest Schedule object, communicates planned/in-progress/completed state, exercise count, and its appropriate action, and remains the `.matchedTransitionSource` for the native iOS 18 zoom transition. Completed cards enter the immutable read-only destination. Rest/unplanned days use a shorter, subordinate empty state with Add Workout.

The Schedule-level Timer row is restored below the day content. It opens a clear deferred native sheet; standalone timer execution is intentionally not implemented in this pass.

## Execution card stack

The generic `Train` title, percentage/progress-bar hierarchy, per-exercise cards, and all-set form were removed from the production path. Native navigation now reads as Schedule back navigation, workout name, and Options.

Execution uses one transient `ExecutionPanel` selection across three always-visible stack layers: Completed, Up Next, and Current. Current is expanded by default for active workouts. Panel selection, focused exercise, and selected set are `@Observable` presentation state only and are not encoded or persisted.

### Current and set position

Current derives its exercise from the ordered canonical workout plus optional transient focus. It presents one prescription at a time with large semantic metric typography. Repetition targets show weight and reps; duration targets show duration only. Confirmed values immediately call the existing `logSet` repository command and update the same canonical `LoggedSet` when revisited.

A horizontally accessible numbered selector changes the transient set position. After logging, selection advances to the first incomplete prescription. A completed exercise naturally stops being the derived current exercise, and the first incomplete exercise becomes Current. Add/remove set controls were intentionally omitted: the canonical repository has no safe execution-time prescription mutation command, and they are not required for the core logging flow.

### Up Next and Completed

Up Next expands into the remaining incomplete exercises with prescription and set-count context. Selecting an item changes transient focus, expands Current, and does not reorder or rewrite the workout.

Completed expands into already-performed exercises. During an in-progress workout, a completed exercise can be focused to review/update its canonical logs. Fully completed workouts open with Completed expanded and remain read-only.

### Rest state

Logging a set starts in-workout rest when the exercise has a positive rest duration and the workout is not fully log-complete. Rest replaces the Current metric emphasis with a prominent countdown while retaining the exercise name. Skip Rest is accessible.

The rest abstraction stores only a transient deadline, total duration, and display remainder. The deadline is recalculated when the app becomes active, so foreground/lifecycle elapsed time is correct. It deliberately does not persist rest state, schedule notifications, or introduce background/Live Activity architecture. Canonical logging completes before rest begins and is independent of timer state.

## Options scope

Options remains present for active workouts. `Mark as complete` appears only when canonical validation says the workout can complete. Share, reset, delete, and next-rest editing were omitted because the native repository does not yet expose safe domain semantics for them. Completed-workout reopen is not present.

## Canonical architecture preserved

The durable graph remains:

`ScheduledWorkout → ScheduledExercise[] → SetPrescription[] → LoggedSet[]`

The pass continues to use `ScheduledWorkoutRepository`, `ScheduledWorkoutID`, globally unique child IDs, SwiftData, repository commands, derived progress/exercise completion, immediate confirmed-set persistence, Schedule mutation callbacks/reload, atomic completion validation, and completed-workout immutability. No progress, session, PR, panel, focus, current-exercise, or rest database was added.

Intentional native-v1 differences remain: one workout per day; no workout sections, HIIT, Bonus, tabs, Progress Home, body weight, photos, cycles UI restoration, RN state architecture, or custom RN transition infrastructure.

## Design-system audit

Touched native feature files were reviewed for repeated visual values. Existing `EQSpacing`, `EQRadius`, `EQDimension.minimumTouch`, semantic typography, card surfaces, and motion tokens are used throughout.

Added centrally:

- `EQTypography.metric`: reusable Dynamic-Type-aware emphasis for focused working values and countdowns.
- `EQColor.rest`: intentional semantic treatment shared by the rest label, countdown progress, and Skip Rest action.
- `EQMotion.standard`: shared panel/set/rest presentation timing.
- `EQDimension.workoutCardHeight` and `restCardHeight`: semantic Schedule hierarchy dimensions; the rest state is intentionally shorter than the workout card.

No legacy RN pixel values were copied. Component-specific set selector geometry remains local and is based on the existing minimum touch target.

## Accessibility and motion

Panel controls expose named expanded/collapsed values. Up Next and Completed exercises are individually selectable with contextual hints. The Current exercise/set, set-selector completion/selection, repetition weight/reps, duration seconds, rest time, and Skip Rest have contextual labels. Controls retain 44-point minimum targets and semantic fonts for Dynamic Type.

Schedule card entry retains native zoom. Stack and rest transitions use local SwiftUI animation; Reduce Motion disables spatial stack/rest animation and the Schedule zoom modifier already falls back to a direct state change. The countdown uses numeric content transitions without repeated announcement triggers.

## Tests

The suite now additionally covers:

- LocalDay day navigation including DST, workout/rest selection, Timer presentation contract, stable route/card identity, state mapping, and the single-day invariant.
- Current as the default panel; Up Next/Completed expansion; upcoming and completed transient focus; canonical ordering unchanged; presentation state absent after model recreation.
- Current-set derivation, advancement, revisiting/updating one canonical log, and repetition versus duration targets.
- Rest start, deadline countdown, skip, elapsed completion, return to Current, and log persistence independent of timer state.
- Existing relaunch persistence, Schedule propagation, atomic completion, completed immutability, and absence of alternate persistence remain covered by the complete native suite.

Validation result: 60 native tests passed with zero failures.

## Build and launch result

The final Equilibrium Debug target built successfully for the booted iPhone 16 Pro simulator (iOS 26.2), installed, and launched as `com.tsunamichi.equilibrium`. Simulator inspection confirmed the workout-first Schedule hierarchy, dominant in-progress card, and Timer placement. Canonical execution transitions are covered by the model/repository tests above; the remaining physical-device interaction checklist is recorded below.

## Frozen RN reference inspected

Baseline `19c56a9` files inspected:

- `src/screens/TodayScreen.tsx`
- `src/components/schedule/ScheduleWorkoutDeckV3.tsx`
- `src/components/exploreV2/ExploreV2ExecutionRoot.tsx`
- `src/components/exploreV2/ExploreV2CurrentCard.tsx`
- `src/components/exploreV2/ExploreV2UpNextCard.tsx`
- `src/components/exploreV2/ExploreV2CompleteCard.tsx`

The RN source was not modified.

## Remaining experience differences and device QA

- Standalone Timer is a deferred placeholder by design.
- Execution-time add/remove set is omitted pending explicit canonical mutation semantics.
- Options omits unsupported share/reset/delete/next-rest actions.
- Rest handles foreground/lifecycle elapsed time only; notifications, robust terminated-process continuation, Live Activities, and complex background behavior remain later timer work.
- Exact color, typography, spacing, shadow, and card/deck geometry parity remains a later visual pass.

Device QA should continue to exercise long localized workout/exercise names, keyboard dismissal with numeric pads, VoiceOver panel order, maximum accessibility sizes, Reduce Motion transitions, a full real-time rest countdown, scene background/foreground during rest, and completion-to-Schedule zoom/refresh on physical device.
