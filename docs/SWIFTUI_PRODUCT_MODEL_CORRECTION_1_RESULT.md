# SwiftUI Product Model Correction 1 — Result

## Outcome

The incorrect `LocalDay → 0...1 ScheduledWorkout` assumption is removed. The native root is now Home / Workout of the day: a bounded lens over every canonical workout assigned to the current local day, followed by Add Workout. The canonical `ScheduledWorkout → ScheduledExercise[] → SetPrescription[] → LoggedSet[]` logging architecture is unchanged. Phase 4 was not started and the React Native source was not modified.

## Domain, persistence, and repository

- `ScheduledWorkoutRecord.localDay` is no longer unique.
- The day query is `workouts(on:) -> [ScheduledWorkout]`; Home does not load all history.
- Scheduling, atomic batch materialization, update, restore, and range queries accept multiple distinct workouts on one day. Day-conflict and replacement APIs/errors were removed.
- Identity and child/referential validation remain. Completed-record immutability remains.
- Carousel order is deterministic by `createdAt`, then `ScheduledWorkoutID` as a total-order tie breaker. Normal single additions naturally append by creation time. Recent batches receive monotonically increasing subsecond creation timestamps in RN-confirmed tap order. Status changes do not affect either key, so cards do not move on start/completion.
- Backup restore accepts same-day multiplicity and preserves all IDs. Fresh restore returns the same canonical deterministic order, including an ID tie breaker for imported records whose timestamps are identical.

This is a pre-release native schema correction. `PersistenceController` uses the new `EquilibriumProductModelCorrection1` configuration name, intentionally recreating native development data rather than adding long-term migration machinery for the invalid development schema. Frozen RN data and RN backup files are untouched.

## Current-day execution and rollover

`CurrentDayProviding` is a small injectable time boundary. `SwiftDataRepository` checks it in start, log-set, and complete commands, so stale routes and deep links cannot mutate past or future workouts. Workout Execution also derives read-only presentation from the same abstraction; completed workouts remain read-only independently of day.

`HomeModel` recalculates `LocalDay` and reruns only `workouts(on: today)` on load and whenever the app becomes active. A local-day rollover therefore removes yesterday’s cards without deleting their canonical records and reveals the new day’s workouts. No background midnight scheduler was added.

## Home and creation

- Production `ScheduleView`, `ScheduleModel`, card presentation, and routes became `HomeView`, `HomeModel`, `HomeCardPresentation`, and `HomeRoute`. The remaining `Features/Schedule` directory and `ScheduleCalendar` filename retain localized calendar-formatting history only; production concepts and state no longer model date selection.
- The header is Workout of the day, informational current date, Workout history, and Settings. Previous/next day, week strip, selected date, and Today controls are absent.
- Home uses a native horizontal view-aligned carousel with stable `ScheduledWorkoutID` identity, planned/in-progress/completed cards, presentation-derived sequence numbers, native card-to-execution zoom, and the separate Timer affordance.
- Add Workout is always the final page and is the sole primary carousel content on an empty day. There is no Rest Day or recovery empty state.
- Add Workout exposes exactly Create from scratch, Paste workout, and Use recent workout. Existing Workout/template selection is removed from production Home navigation; reusable template persistence remains.
- Create from scratch uses the existing `WorkoutDraft`/Builder/canonical scheduling path, assigns today, and adds without replacement.
- Import Plan user-facing copy and route are now Paste workout. The deterministic local parser and review-to-Builder path are reused, with Home’s current day supplied and no date picker/network/AI behavior.
- Use recent workout is now multi-select. RN inspection confirmed selection order means tap order. Each selected completed historical workout creates a fresh current-day scheduled ID, exercise IDs, prescription IDs, planned state, and empty logs; structure, exercise order, useful prescriptions, weights, and rest values are copied without progression or historical mutation.

## Migration plan

`SWIFTUI_V1_MIGRATION_PLAN.md` now locks Home/current-day scope, zero-or-more same-day workouts, no Home date navigation/Rest Day state, the three creation paths, recent multi-select, current-day execution, Paste workout terminology, same-day backup support, and RN import preservation. The importer design no longer groups by day for selection/move/exclusion; only genuine duplicate evidence is reconciled.

## Tests and validation

Coverage was updated/added for same-day multiplicity, several-card deterministic ordering, batch insertion/duplicate atomicity, completed/planned coexistence, today-only Home queries, rollover without deletion, stable identity/order through status change, fresh recent identity, backup same-day restore ordering, and injected current/past/future execution eligibility. Parser and canonical Workout Execution suites remain in place.

RN files inspected read-only:

- `src/screens/TodayScreen.tsx`
- `src/components/schedule/ScheduleWorkoutDeckV3.tsx`
- `src/screens/RecentWorkoutPickerScreen.tsx`
- `src/screens/WorkoutCreationOptionsScreen.tsx`
- relevant navigation/store ordering references

Design-system audit: carousel and creation UI reuse `EQTypography`, `EQColor`, `EQSpacing`, `EQRadius`, and `EQDimension`. Only carousel behavior/layout composition is local; no repeated visual constants or new visual-polish system was introduced.

Validation results:

- XcodeGen project generation: succeeded.
- Native simulator build, Debug, iOS Simulator SDK 26.5: succeeded.
- Native XCTest suite on iPhone 16 Pro, iOS 26.2: succeeded (57 tests after correction coverage was added; final rerun recorded at handoff).
- The app installed and launched on iPhone 16 Pro with a same-day planned/in-progress/completed carousel fixture; Home header, first card, neighboring horizontal content behavior, and Timer affordance were visually inspected. Creation and rollover mechanics are additionally covered deterministically in tests; hands-on final creation-parity QA remains listed below.
- `git diff --check`: recorded at handoff.
- RN source: unchanged.

## Remaining creation-parity QA ambiguity

The RN source is explicit that recent batch ordering is tap order and that the first selected workout is the post-create focus. The correction preserves tap order; exact post-dismiss carousel focus and final visual geometry remain creation-parity/manual visual QA work, not this architectural pass. Full Timer, History, Plans, progression, authentication, cloud, analytics, StoreKit, light mode, and RN importer implementation remain deferred.
