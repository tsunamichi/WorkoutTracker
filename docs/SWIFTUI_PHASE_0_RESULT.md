# Equilibrium SwiftUI Phase 0 result

Date: 2026-08-22

## Result

Phase 0 is implemented. The repository now contains a separate, compilable iOS 18 SwiftUI application named **Equilibrium** alongside the unchanged React Native application. No Schedule, Workout Execution, Builder, Plans, History, progression UI, timer, authentication, Supabase, cloud networking, or React Native cleanup was started.

## Project and structure

- `Equilibrium.xcodeproj` is generated from the checked-in `project.yml` with XcodeGen.
- Application product: `Equilibrium`; deployment target: iOS 18.0; SwiftUI lifecycle; SwiftData; Observation; `NavigationStack`.
- Local bundle identifier: `com.tsunamichi.equilibrium`.
- The app uses `Equilibrium/App`, `Domain`, `Data`, `DesignSystem`, `Features/Foundation`, and `Shared`. Empty folders and speculative service/feature files were not added.
- `EquilibriumTests` contains the Phase 0 XCTest unit and integration coverage.
- The Domain files import Foundation only. They do not import SwiftUI, SwiftData, Supabase, or AuthenticationServices.

Apple Developer and App Store Connect availability for `com.tsunamichi.equilibrium` cannot be established from repository configuration. The intended identifier is safely configured locally; external registration/availability verification remains required before distribution signing.

## Canonical domain

Implemented the approved strongly typed IDs, `LocalDay`, `Weight`, exercise metadata, repetition/duration prescriptions, reusable workout templates, scheduled workout snapshots/logs, CyclePlan lifecycle types, retained progression configuration, settings, and `EquilibriumBackupV1`.

The native schema has one ordered exercise list. It contains no warmup/main/core/accessory sections, persisted PR/current/up-next/completion maps, alternate plan reference, or excluded Progress/body-weight/photo/HIIT/Bonus models. Set execution semantics live in `SetTarget`; exercise catalog entries have no measurement mode.

Pure domain validation covers IDs and child uniqueness, set targets, completed repetition/duration values, optional nonnegative weight, workout status/timestamps, complete-workout required sets, logged-set-to-prescription references, CyclePlan duration/weekday/lifecycle coherence, and template availability at the boundary.

## LocalDay

`LocalDay` stores validated Gregorian year/month/day components and encodes as an exact `YYYY-MM-DD` string. Comparison is component-based and deterministic. It converts to/from `Date` only with an explicitly supplied `Calendar`; conversion uses noon by default to avoid midnight transition edge cases. Tests cover leap dates, invalid formats/dates, month/year ordering, New York DST boundaries, cross-time-zone interpretation, and Codable round trips.

## SwiftData approach and spike result

SwiftData records are separate from domain values and use a mapper:

```text
ScheduledWorkoutRecord
  → positioned ScheduledExerciseRecord
    → positioned PrescriptionRecord
    → positioned LoggedSetRecord
```

Stable string IDs and `localDay` are unique SwiftData attributes. Child arrays have explicit integer positions because persistence relationship array order is not treated as authoritative. Domain snapshots, IDs, order, prescriptions, optional weights, repetition/duration values, and completion timestamps survive save/reload.

The spike passed all critical tests:

- ordered mixed workout save/reload;
- maximum one workout per `LocalDay`, returning `RepositoryError.workoutDayConflict` before insert;
- atomic multi-workout materialization via full preflight followed by one context save; a conflict leaves no partial inserts;
- an in-progress logged set survives destruction/recreation of both repository and disk-backed container;
- an updated in-progress workout persists its new logged set;
- backup restore into a fresh in-memory container exports equivalent canonical values.

The persistence uniqueness strategy is dual-layered: the repository preflights and returns a domain conflict, while `@Attribute(.unique)` on the stored day is the final store-level guard. UI state is not involved.

The transaction strategy is validate/preflight every input, insert all records in one `ModelContext`, save once, and roll back on error. Phase 0 deliberately does not implement plan conflict resolution or replacement policy UI.

### Concrete SwiftData discovery

Unique child record attributes are global to an entity, not scoped to a parent relationship. Reusing a prescription or scheduled-exercise record ID in different workout snapshots causes SwiftData identity collisions. Canonical fixture/import/restore validation therefore requires globally unique scheduled-child IDs. This matches the stable entity-ID model and is not a blocker.

No critical SwiftData blocker was found, so the GRDB contingency is not recommended at this point.

Top-level exercise/template/plan/settings values used by the restore spike are retained as the versioned canonical backup payload in a singleton metadata record, while scheduled workout/log data uses explicit queryable records. This is a deliberate Phase 0 scope exception: future feature phases should add normalized top-level records when their repositories are implemented. Backup serialization remains independent of SwiftData internals.

## Backup codec and fixtures

`BackupCodec` accepts only schema version 1, uses sorted/pretty JSON keys and fixed milliseconds-since-1970 timestamp encoding, and contains canonical data only. It has no auth, network, UI/navigation/timer, PR/cache, or excluded legacy domain data. The checked-in golden fixture is `fixtures/equilibrium-backup-v1.golden.json`.

Canonical native fixtures cover empty, planned multi-set repetitions, mixed repetitions/duration, in-progress, completed, multi-week weekday plan, and occupied-day conflict cases. `fixtures/react-native-migration` contains anonymized frozen legacy input examples for exercises, templates, scheduled workouts, detailed progress, workout progress, sessions, PR validation input, CyclePlan, progression, and retained settings. Nothing imports these legacy fixtures into SwiftData.

## App shell, design, and transition

The dark-only shell initializes the production SwiftData container through an `@Observable` dependency environment. It displays an Equilibrium title and one fixture card using semantic canvas/surface/elevated/text/separator/accent/success/warning tokens plus spacing, continuous radii, and semantic Dynamic Type fonts.

The development-only card/detail spike uses a stable `ScheduledWorkoutID` with iOS 18 `.matchedTransitionSource` and `.navigationTransition(.zoom)`. It uses native `NavigationStack` push/pop behavior and removes the zoom transition under Reduce Motion. There is no custom shared-element infrastructure and the detail explicitly is not Workout Execution.

## Validation results

Validated with Xcode 26.6 / iOS Simulator SDK 26.5:

- Native simulator build: succeeded.
- XCTest suite on iPhone 16 Pro simulator: 15 tests, 0 failures.
- Disk-backed persistence recreation: passed.
- Unique-day conflict and atomic materialization: passed.
- Backup deterministic encode/decode, golden decode, and restore/re-export: passed.
- App simulator install/launch: succeeded on iPhone 16 Pro; `simctl launch` returned a live process identifier for `com.tsunamichi.equilibrium`.
- `git diff --check`: passed with no whitespace errors.

One iPhone 17 simulator instance crashed at the simulator service level during a rerun; the identical suite passed on the installed iPhone 16 Pro simulator. This was an Xcode simulator-service failure, not a test failure.

## Deviations and unresolved risks

- XcodeGen is used to keep the coexistence project definition reviewable; generated `Equilibrium.xcodeproj` is also checked in.
- No migration-plan text required clarification.
- Distribution bundle-ID availability and signing remain externally unverified.
- Schema migration behavior beyond the initial schema is not yet spiked. It should be tested before Phase 1 introduces production user data or before any post-v1 schema change.
- Backup restore in Phase 0 intentionally accepts a fresh store only. Confirmed destructive replacement/staging swap belongs to the later cloud-backup phase.
- Interactive-back and Reduce Motion use native navigation behavior and code-path verification; automated gesture UI testing was not added in Phase 0.

## React Native status

No existing React Native source, dependency, native wrapper, store, or backup implementation was modified. The only RN-related additions are separate anonymized fixture files under `fixtures/react-native-migration`.
