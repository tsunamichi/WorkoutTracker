# V1 cleanup candidates

This is an opportunity inventory and ordering guidance, not an implementation plan. No candidate was implemented.

## 1. Workout domain simplification

- **Current:** `training.WorkoutTemplate` owns `warmupItems`, `items`, `accessoryItems`; `ScheduledWorkout` freezes three snapshot arrays and four completion structures. Old and new exercise-instance shapes coexist (`types/training.ts`, editors, `exerciseMigration.ts`).
- **Likely desired:** one ordered workout-exercise definition and one scheduled snapshot list, with a stable catalog exercise ID and uniform set prescription.
- **Dependencies:** builders, AI/manual cycles, Schedule cards, execution, history/progress, bonus/core data and migrations.
- **Risk/order:** Highest migration risk. Define canonical schema and real-backup fixtures first; migrate persisted templates/scheduled logs before deleting compatibility. Recommended order 1 after data invariants are agreed.

## 2. Workout execution simplification

- **Current:** `ExerciseExecutionScreen.tsx` exceeds 5,000 lines, requires route `type`, supports three sections, old item casts, cycles/per-side timers, multiple completion stores, and Explore V2 current/completed/up-next subcomponents.
- **Likely desired:** one ordered exercise session state machine; presentation derives focus/completed state from one list without domain sections.
- **Dependencies:** section stores, timers, PR/session writers, progression suggestions, history and celebration.
- **Risk/order:** High runtime/data risk. Follow canonical domain/log decisions; preserve current behavior with focused tests. Recommended order 3.

## 3. Navigation cleanup

- **Current:** 40+ routes in one stack, hidden custom tab bar, duplicate Progress routes and many unreachable legacy/dev screens (`AppNavigator.tsx`).
- **Likely desired:** small release graph with explicit Schedule, optional Progress, Settings, builder/execution/history and only required plan/timer routes; dev routes excluded from production.
- **Dependencies:** product decisions about Progress/library/bonus; deep links and saved navigation state.
- **Risk/order:** Medium. First document/lock the release graph, then unregister UI only after data paths are preserved. Recommended order 2 for surface decisions, later for removal.

## 4. State/store cleanup

- **Current:** a 4,000+ line main store combines domain, migrations, schedule, progress, backup, timers and legacy cycles; two additional stores include an unreachable persisted onboarding generation and an unpersisted current cycle draft.
- **Likely desired:** bounded stores/services around catalog, workout definitions/logs, schedule, user progress/preferences and sync; pure selectors; migration outside runtime actions.
- **Dependencies:** nearly every screen and storage key.
- **Risk/order:** High. Split only after canonical data model and persistence adapter tests. Recommended order 5.

## 5. Persistence/data cleanup

- **Current:** more than 25 AsyncStorage collections, arbitrary-key cloud snapshots, two backup systems, duplicated workout logs/completions and three cycle generations.
- **Likely desired:** versioned schema, explicit backup allowlist, atomic migrations, canonical workout log, media strategy and secure auth/secrets.
- **Dependencies:** App Store privacy disclosures, Supabase schema, real user backups, all domain work.
- **Risk/order:** Critical. Inventory/fixture/export before code deletion; this is the prerequisite workstream (recommended order 1). Never silently discard old keys.

## 6. Timer simplification

- **Current:** standalone HIIT engine, execution timer, SetTimerSheet, timer value picker, edge/card visuals and unreachable accessory runner; notification dependency/config is broken.
- **Likely desired:** one small exercise/rest timer primitive, with HIIT retained only if explicitly in v1; live phase restoration policy defined.
- **Dependencies:** time-based/per-side/cycle exercise semantics, AV, keep-awake, notifications, haptics.
- **Risk/order:** Medium-high. Decide HIIT/notifications and exercise semantics after unified domain; recommended order 6.

## 7. Progress cleanup

- **Current:** reachable History, reachable per-exercise `ProgressScreen`, hidden `ProgressHomeScreen`, old Lift/BodyWeight/Plan history screens, multiple source reconciliation helpers.
- **Likely desired:** one Progress entry and shared log query layer; body weight/photos included only if release scope supports them.
- **Dependencies:** canonical completed log, navigation, image persistence and cycle decision.
- **Risk/order:** Medium data/read-model risk. Choose product surface early, consolidate after log migration. Recommended order 4/7.

## 8. Cycle cleanup

- **Current:** old embedded `Cycle`, onboarding `SavedCycle`, current `CyclePlan`, manual wizard draft and unused `PlanTemplate` coexist; compatibility includes assignment and program aliases.
- **Likely desired:** one optional plan/schedule recurrence model referencing workout definitions, or no cycle abstraction if outside v1.
- **Dependencies:** scheduled workout provenance, conflict handling, history grouping, repeat/pause/end behavior and legacy data.
- **Risk/order:** High. Product decision then convert all three persisted generations; recommended order 4.

## 9. Component cleanup

- **Current:** old section editors/executors, registered development screens, Explore V2 subcomponents named for obsolete grouping, custom icon barrel, duplicate design primitives and large screens.
- **Likely desired:** components aligned to the canonical exercise list and release routes, with dev galleries outside production registration.
- **Dependencies:** navigation/domain/execution decisions.
- **Risk/order:** Low-to-medium once import graph shrinks. Recommended order 8; do not start here because registered legacy UI currently keeps dependencies/assets apparently live.

## 10. Dependency cleanup

- **Current:** undeclared notifications/updates, apparently unused vector icons, optional web React DOM, deprecated-direction AV, unused patch-package payload, and broad native module footprint.
- **Likely desired:** declared and used dependencies only, permissions matching capabilities, current Expo-compatible media/notification approach.
- **Dependencies:** feature scope, Expo upgrade/re-prebuild, App Store privacy manifests.
- **Risk/order:** Medium native build risk. Resolve missing dependencies immediately as release correctness; uninstall only after feature/component cleanup. Recommended order 2 for correctness, 9 for pruning.

## 11. Naming cleanup

- **Current:** duplicate `Exercise` and `WorkoutTemplate` names across type modules; `CyclePlan` called program in fields; “bonus”, core/accessory/warmup terms; “ExploreV2”; comments marked NEW/DEPRECATED; completed/up-next component names despite consolidated Exercises UI.
- **Likely desired:** `ExerciseDefinition`, `WorkoutExerciseDefinition`, `WorkoutDefinition`, `ScheduledWorkout`/`WorkoutLog`, and consistent optional plan vocabulary.
- **Dependencies:** persistence serialization keys, route params, migrations and translations.
- **Risk/order:** Medium; rename only after schema boundaries, using migrations where serialized field names change. Recommended order 7.

## 12. App Store/release cleanup

- **Current:** TypeScript fails; Jest has one empty suite; no lint script; generated native build number disagrees with `app.json`; notification dependency missing; dev prototype reachable; hard-coded Supabase project/anon key; no crash SDK; arbitrary backup/privacy concerns; Live Activity flags without tracked implementation.
- **Likely desired:** reproducible clean typecheck/tests/archive, version/build source of truth, release-only navigation, verified entitlements/permissions/privacy manifest, secure data practices and tested restore/migration.
- **Dependencies:** all scope decisions plus Expo native regeneration and real-device/App Store validation.
- **Risk/order:** Blocking. Fix/reconcile release checks and privacy/capability configuration throughout, with final clean prebuild/archive after architecture cleanup. Recommended order 0 and final gate.

## Recommended dependency order summary

1. Preserve representative local/cloud data and define canonical workout/log invariants.
2. Decide the v1 route/feature surface (Progress, cycles, bonus/HIIT, templates, guest) and fix immediate build/dependency blockers.
3. Introduce/migrate the unified workout definition, scheduled snapshot and completed log semantics.
4. Collapse cycle/progress read models onto those semantics.
5. Separate store and versioned persistence responsibilities.
6. Simplify execution and timers.
7. Normalize names, routes and translations.
8. Remove verified legacy components/helpers/assets and then prune dependencies.
9. Regenerate native projects and pass release/archive/privacy/restore gates.

## Questions requiring product decisions

- Which features are in the App Store v1 surface: Progress hub, body weight/photos, plans/cycles, HIIT, bonus core/warmup, and template library?
- What historical data compatibility window is promised to TestFlight/released users?
- Is cloud sync mandatory, optional, or removable for v1, and which provider is authoritative?
- Is a workout allowed to contain multiple sessions on the same date and time-based/per-side exercises?
