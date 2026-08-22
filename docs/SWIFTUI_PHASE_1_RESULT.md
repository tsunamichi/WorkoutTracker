# Equilibrium SwiftUI Phase 1 result

Date: 2026-08-22

## Result

Phase 1 implements the native Schedule shell only. Equilibrium now launches directly into a dark, iPhone-first SwiftUI Schedule inside a `NavigationStack`. Workout Execution, mutation, builders, plan flows, full History, account services, and all later-phase features remain unimplemented.

## Schedule structure and navigation

- `ScheduleView` is the production root and replaces the Phase 0 demonstration screen.
- The header contains Schedule, the selected full date, Settings, Workout History, and a Today affordance when another day is selected.
- Settings and Workout History are native push destinations. Settings exposes only Units, Timer, Progression, and Account / Cloud Backup shells. History can show completed canonical rows visible to the Schedule query.
- Add Workout is a native detented sheet with the Phase 3 contract: Existing Workout, Recent Workout, Blank Workout, and Import Plan. It performs no creation yet.
- No tab bar, authentication gate, appearance setting, Progress, body-weight, photo, AI, HIIT, Bonus, warm-up/core, notification, or development route is exposed.

## Date and calendar approach

`ScheduleCalendar` wraps an explicit Gregorian `Calendar`, uses the device's autoupdating locale/time zone, and defines Monday as the first weekday. Week generation and movement convert `LocalDay` to noon calendar dates only at the calculation boundary. Schedule state remains keyed by `LocalDay`; no midnight `Date` is stored.

The seven-day strip supports previous/next controls, horizontal swipe navigation, selected day, today, planned/in-progress markers, and a distinct completed marker. Moving a week retains the corresponding selected weekday. Returning to Today changes both selection and visible week.

Automated coverage includes month and year boundaries, leap day, New York DST dates, multiple time zones, week movement, and today calculation from an injected instant.

## Repository and query additions

The production flow is:

```text
SwiftData ScheduledWorkoutRecord
→ ScheduledWorkoutRepository
→ ScheduleModel
→ ScheduleView
```

`ScheduledWorkoutRepository` now provides an inclusive visible-date range query. `SwiftDataRepository` performs that query directly against the lexically sortable canonical `YYYY-MM-DD` field and returns ordered domain values. Schedule loads only the visible week and does not own all workout history in memory.

The Phase 0 single-day query previously used `fetchLimit = 1`, which could conceal invalid multiplicity. It now fetches all matching rows and surfaces `workoutDayConflict` after a developer assertion if more than one exists. The range query performs the same invariant check. This is the only Phase 0 architecture correction; the schema and canonical domain remain unchanged.

## Workout and rest states

The workout card maps canonical status to immutable presentation behavior:

- planned: Planned / Start workout;
- in progress: In progress / Resume workout;
- completed: Completed / View workout, never start or resume.

Cards use `ScheduledWorkoutID.rawValue` for both `.matchedTransitionSource` and the Phase 1 route. The placeholder destination includes the workout title and identity and explicitly states that Workout Execution arrives in Phase 2. Push/pop uses the native iOS 18 zoom transition; Reduce Motion removes the zoom.

A missing workout is presented as a valid Rest day with recovery framing and the production Add workout entry, not as an error.

## Design and accessibility

The Schedule expands the Phase 0 semantic typography only where needed and retains the semantic dark canvas/surface/text/accent/status tokens. It uses continuous rounded cards, generous spacing, restrained status color, SF Symbols, native controls, Dynamic Type, and native scrolling.

Each date cell exposes the full localized date plus today, selected, rest, planned, in-progress, or completed state as applicable. Selected state is also conveyed through accessibility traits, workout status is provided in text and symbols rather than color alone, icon buttons have explicit labels, and controls meet a minimum 44-point target. Selection uses native sensory feedback. Native transitions and value-driven state respect Reduce Motion.

Debug previews use canonical models persisted into an in-memory SwiftData container and cover planned, in-progress, completed, rest, future, past-completed, long-title, and accessibility Dynamic Type cases. Month/year-spanning behavior is covered deterministically by calendar tests.

## Tests and validation

- Simulator build: succeeded with Xcode 26.6 / iOS Simulator SDK 26.5.
- Full XCTest suite on iPhone 16 Pro (iOS 26.2): 24 tests, 0 failures (15 Phase 0 and 9 Phase 1).
- Repository range query, one-workout-per-day repository behavior, status/action mapping, completed immutability presentation, selected/rest state, Add Workout presentation state, stable card identity, and route generation pass.
- The built app installed and launched on iPhone 16 Pro; `simctl launch` returned a live process.
- Visual simulator inspection verified the Schedule header, current week, selected/today treatment, rest card, and Add Workout affordance at the reference phone size.
- Planned, in-progress, completed, long-title, rest, and large Dynamic Type layouts are represented by deterministic SwiftData-backed previews. Native zoom and Reduce Motion are implemented on the same proven Phase 0 APIs; no custom animation infrastructure was introduced.
- `git diff --check` and React Native integrity checks are recorded at final handoff.

## Deviations and architecture discoveries

- The frozen RN baseline still says “Workout of the day” and conditionally exposes history around plan state. Native uses the approved migration product root title “Schedule” and keeps History consistently reachable, matching the Phase 1 navigation contract.
- The RN multi-card deck was not reproduced because native v1 has the locked zero-or-one workout-per-day invariant.
- Units persistence was optional and was not implemented; all four approved settings entries remain intentionally shaped placeholders.
- No plan context is shown because it is not necessary to understand the Schedule shell and normalized plan querying belongs to Phase 5.
- No migration-plan architectural assumption changed materially, so the main migration plan was not edited.

## Risks before Phase 2

- Phase 2 must preserve `ScheduledWorkoutID` through its navigation destination and replace only the placeholder content.
- Workout mutations will need explicit refresh/invalidation so returning Schedule state reflects execution changes.
- Full History will require its own bounded completed-workout query rather than reusing the Schedule visible-week cache.
- VoiceOver traversal and interactive zoom should receive hands-on device testing in addition to the implemented labels/traits and simulator validation before release.
