# Equilibrium v1 — SwiftUI migration plan

Status: planning only. This document does not authorize React Native cleanup, Swift implementation, Xcode project creation, configuration changes, dependency changes, or data migration.

Reference points:

- Behavioral and visual baseline: `19c56a9 — Checkpoint current Equilibrium UI`
- Migration branch: `refactor/v1-cleanup`
- Repository audit: `docs/audit/*.md`
- Current implementation references cited throughout are under `src/`.

## 1. Executive migration strategy

Equilibrium v1 should be a new native iOS product built in SwiftUI, not a translation of the React Native component tree, Zustand store, React Navigation graph, or AsyncStorage schema. The React Native app remains runnable and frozen as the behavioral/visual oracle while native vertical slices are built beside it.

The migration preserves the product’s useful center:

- Home / Workout of the day as the only root experience, scoped to the current `LocalDay`.
- Create-from-scratch, Paste workout, multi-select recent-workout reuse, plan creation/application, and the deterministic clipboard parser. No AI or OpenAI integration is part of v1.
- One ordered exercise list per workout.
- Set logging, resume, completion, workout history, exercise history, PR derivation, progression suggestions, and a simple rest/duration timer.
- Settings needed by those features.
- Apple Sign In, Supabase authentication, and one explicit versioned Supabase backup contract.

It intentionally abandons development-era product domains: workout sections, Bonus Warm Up/Core, Core Program, HIIT, Progress Home/tab, body weight, photos, pinned lifts, old cycle generations, trainer conversations/API-key settings, duplicate performance stores, arbitrary AsyncStorage backup, and separate iCloud backup.

The RN app is a reference rather than the migration target because its architecture encodes obsolete product distinctions. For example, `src/types/training.ts` and `src/screens/ExerciseExecutionScreen.tsx` spread one workout across section arrays, route `type`, multiple completion stores, sessions, PR records, and bonus systems. Reproducing that would preserve the very coupling the native rebuild is intended to remove.

The governing sequence is:

```text
Freeze RN baseline and capture fixtures
→ define native v1 invariants
→ build testable SwiftUI vertical slices
→ stabilize canonical local schema
→ add native auth and versioned Supabase backup
→ import only selected development data
→ validate retained behavior against RN
→ harden and ship the native target
→ archive RN after rollback window
```

No phase depends on first cleaning RN internals. Later RN changes should be limited to a migration export bridge or a critical defect that prevents reference testing. The native product is **Equilibrium**, targets **iOS 18 and newer**, and is intentionally iOS-only. The planned final bundle identifier is `com.tsunamichi.equilibrium`, subject to Apple Developer and App Store Connect availability verification before implementation.

## 2. Final SwiftUI product graph

There is one root destination, Home / Workout of the day. Authentication is optional and lives under Settings; it is neither a launch gate nor a tab. SwiftData persists the complete local workout product before sign-in. Modern SwiftUI `NavigationStack` handles pushes; native sheets handle creation/pickers/settings where their interaction is modal.

```text
EQUILIBRIUM
└── Home / Workout of the day
    ├── Current-day workout carousel (zero or more workouts)
    ├── Add Workout (final carousel page)
    │   ├── Create from scratch
    │   │   ├── Exercise picker/search
    │   │   └── Exercise/set prescription editor
    │   ├── Paste workout
    │   │   ├── Paste formatted text
    │   │   ├── Parse and match exercises
    │   │   └── Review → create current-day workout
    │   └── Use recent workout (multi-select completed history)
    ├── Plans
    │   ├── Create
    │   ├── Apply
    │   └── Plan Detail / lifecycle
    ├── Workout
    │   └── Exercises
    │       ├── Sets
    │       ├── Weight / repetitions
    │       ├── Duration where prescribed
    │       ├── Previous performance
    │       ├── Progression
    │       ├── Simple timer
    │       └── Completion
    ├── History
    │   ├── Completed workouts / detail
    │   └── Exercise performance
    └── Settings
        ├── Units
        ├── Timer
        ├── Progression
        │   ├── Defaults
        │   └── Groups / exercise overrides
        └── Account / Cloud Backup
            ├── Sign in with Apple (optional)
            ├── Last Backup / Back Up Now
            ├── Restore Backup
            └── Sign Out
```

### Screen inventory and presentation

| Screen | Presentation | Primary responsibility |
|---|---|---|
| Account / Cloud Backup | Settings destination | Optional Apple identity, Supabase session, backup/restore and logout. Local use never depends on it. |
| Home | Root `NavigationStack` | Current local day, ordered workout carousel, history/settings/add entry points and Timer affordance. No date navigation or Rest Day state. |
| Add Workout | Final carousel page/sheet | Exactly Create from scratch, Paste workout, and Use recent workout. |
| Workout Builder | Push or full-screen sheet | Edit one reusable workout definition and optionally schedule a snapshot. |
| Exercise Picker | Searchable sheet | Select/create canonical catalog exercises. |
| Use recent workout | Sheet/push | Multi-select completed canonical logs and create fresh current-day snapshots in tap order without linking history. |
| Paste workout | Sheet/push | Paste, parse, match, review and create a current-day workout. It is explicitly local and not AI-backed. |
| Plan Builder/Review | Push flow | Create one `CyclePlan`, map weekdays to reusable templates, apply atomically. |
| Workout Execution | Push with optional native zoom | Mutate one `ScheduledWorkout`; derive current/upcoming/completed presentation. |
| Exercise Performance | Push/sheet from execution/history | Previous working sets, trend, derived PR, progression rationale. |
| Workout Completion | Native overlay/presentation | Confirm canonical completion, show restrained celebration, return to Home. |
| Workout History | Push | Completed workouts grouped by date; no Progress tab. |
| Completed Workout Detail | Push | Read-only snapshot and logged sets. |
| Plan Detail | Push/sheet | Current plan status and retained lifecycle actions. |
| Settings | Sheet or push | Small v1 settings/account/backup/progression surface. |

No route exists for an authentication gate, tab bar, Progress Home, body weight, photos, HIIT, bonus/core, warmup/accessory execution, appearance selection, design labs, or legacy cycle editors.

## 3. Proposed Swift domain model

### Identifier and calendar strategy

Use strongly typed IDs in domain APIs while encoding them as strings. New IDs are lowercase UUID strings. Import preserves an RN ID through an import map and produces a stable native ID once; it does not repeatedly hash names. This supports existing non-UUID IDs such as `wt-*`, prevents accidental cross-entity ID use, and keeps backup JSON readable.

Workout dates are calendar days, not instants. Introduce a validated `LocalDay` (`yyyy-MM-dd`, Gregorian calendar) for scheduling and retain `Date` only for timestamps. This avoids workouts moving dates across time zones.

Planning-level definitions follow. Persistence records may be separate SwiftData models; these are domain and backup shapes.

```swift
import Foundation

protocol DomainID: RawRepresentable, Hashable, Codable, Sendable
where RawValue == String {}

struct ExerciseID: DomainID, Identifiable {
    let rawValue: String
    var id: String { rawValue }
}
struct WorkoutTemplateID: DomainID, Identifiable {
    let rawValue: String
    var id: String { rawValue }
}
struct WorkoutExerciseID: DomainID, Identifiable {
    let rawValue: String
    var id: String { rawValue }
}
struct ScheduledWorkoutID: DomainID, Identifiable {
    let rawValue: String
    var id: String { rawValue }
}
struct ScheduledExerciseID: DomainID, Identifiable {
    let rawValue: String
    var id: String { rawValue }
}
struct SetID: DomainID, Identifiable {
    let rawValue: String
    var id: String { rawValue }
}
struct PlanID: DomainID, Identifiable {
    let rawValue: String
    var id: String { rawValue }
}

struct LocalDay: Hashable, Codable, Sendable {
    let iso8601: String       // validated YYYY-MM-DD
}
```

### Exercises and prescriptions

```swift
struct ExerciseDefinition: Identifiable, Codable, Hashable, Sendable {
    let id: ExerciseID
    var name: String
    var normalizedName: String
    var aliases: [String]
    var equipment: String?
    var category: String?
    var isCustom: Bool
    var archivedAt: Date?
}

struct WorkoutExerciseDefinition: Identifiable, Codable, Hashable, Sendable {
    let id: WorkoutExerciseID
    let exerciseID: ExerciseID
    var exerciseNameSnapshot: String
    var prescriptions: [SetPrescription]
    var restDuration: TimeInterval?
    var progressionRuleID: ProgressionRuleID?
}

struct SetPrescription: Identifiable, Codable, Hashable, Sendable {
    let id: SetID
    var target: SetTarget
    var suggestedWeight: Weight?
}

enum SetTarget: Codable, Hashable, Sendable {
    case repetitions(range: ClosedRange<Int>)
    case duration(seconds: TimeInterval)
}

struct Weight: Codable, Hashable, Sendable {
    var pounds: Double       // canonical storage unit
}
```

Decisions encoded here:

- The catalog describes movement identity and lightweight discovery metadata, not execution semantics. The same exercise may be prescribed for repetitions in one workout and duration in another.
- Equipment, category, aliases, and custom/system status are retained where available because they are inexpensive, portable, and useful for workout creation/search. They remain lightweight strings rather than an over-modeled taxonomy.
- Rep ranges and durations are the only first-class set targets because reachable RN builder/import/execution behavior uses both (`WorkoutBuilderScreen`, current `AIWorkoutCreationScreen`, and `ExerciseExecutionScreen`).
- Weight is optional; bodyweight is `nil`, never zero-by-convention.
- Per-side execution state, cycles, rounds, supersets, and HIIT phases are not v1 concepts. “Per side” may appear in user-facing exercise/set notes or naming without creating a second execution state machine.
- Array order is authoritative. Do not persist a second `order` field unless the persistence adapter requires it; if it does, enforce contiguous unique positions.

### Templates and canonical logs

```swift
struct WorkoutTemplate: Identifiable, Codable, Hashable, Sendable {
    let id: WorkoutTemplateID
    var name: String
    var exercises: [WorkoutExerciseDefinition]
    var createdAt: Date
    var updatedAt: Date
    var archivedAt: Date?
}

struct LoggedSet: Identifiable, Codable, Hashable, Sendable {
    let id: SetID
    let prescriptionID: SetID?
    var weight: Weight?
    var repetitions: Int?
    var duration: TimeInterval?
    var completedAt: Date?
}

struct ScheduledExercise: Identifiable, Codable, Hashable, Sendable {
    let id: ScheduledExerciseID
    let exerciseID: ExerciseID
    var nameSnapshot: String
    var prescriptions: [SetPrescription]
    var loggedSets: [LoggedSet]
    var restDuration: TimeInterval?
    var skippedAt: Date?
}

enum WorkoutSource: String, Codable, Sendable {
    case manual
    case plan
}

enum WorkoutStatus: String, Codable, Sendable {
    case planned
    case inProgress
    case completed
}

struct ScheduledWorkout: Identifiable, Codable, Hashable, Sendable {
    let id: ScheduledWorkoutID
    var day: LocalDay
    var titleSnapshot: String
    var templateID: WorkoutTemplateID?
    var planID: PlanID?
    var source: WorkoutSource
    var exercises: [ScheduledExercise]
    var status: WorkoutStatus
    var startedAt: Date?
    var completedAt: Date?
    var createdAt: Date
    var updatedAt: Date
}
```

`ScheduledWorkout` is both plan and log. It owns frozen exercise names/prescriptions and actual logged sets. Editing/deleting a catalog exercise or template never changes historical meaning. A planned workout is created by snapshotting a template; a recent-workout reuse creates a new template draft or scheduled snapshot with new entity IDs.

### Derivation invariants

- A logged set is complete only when `completedAt != nil` and its values satisfy the associated prescription target: repetitions for a repetition target, duration for a duration target. Zero weight is allowed only as an actual load; absence is `nil`.
- `planned` requires `startedAt == nil && completedAt == nil`; `inProgress` requires `startedAt != nil && completedAt == nil`; `completed` requires both timestamps. Repository validation repairs invalid combinations.
- A completed workout is immutable through normal UI. An explicit “reopen” command, if retained, records the transition and clears `completedAt`; history never silently edits it.
- Completion percentage is derived from completed required logged sets plus skipped exercises according to one documented policy. No completion map is stored.
- Scheduling is keyed by `LocalDay` with zero or more distinct `ScheduledWorkout` instances. Same-day workouts are valid, retain stable deterministic carousel order, and never trigger day-occupancy replacement. Completed-record immutability applies to that record, not its day.
- Start, log, edit, and complete commands require `workout.day == CurrentDayProviding.currentDay()` through the injectable `CurrentDayProviding` boundary. Historical and future workouts are read-only.
- Presentation `ExerciseState` is transient:

```swift
enum ExerciseState: Sendable { case upcoming, current, completed }
```

It derives from array order, completed/skipped sets, and execution focus. It is never backed up or persisted.

- History queries completed `ScheduledWorkout` values. Exercise history flattens `ScheduledExercise.loggedSets`. PRs are the maximum valid completed set under a defined comparison (v1: highest weight, then repetitions; duration exercises use longest duration separately). A performance index may cache queries but must be rebuildable from logs.

### Plan model

Use only `planID`; no `programID` or `cyclePlanID` enters native domain code.

```swift
enum Weekday: Int, Codable, CaseIterable, Sendable {
    case sunday = 1, monday, tuesday, wednesday, thursday, friday, saturday
}

struct PlanDay: Identifiable, Codable, Hashable, Sendable {
    var id: Weekday { weekday }
    let weekday: Weekday
    let workoutTemplateID: WorkoutTemplateID
}

enum PlanStatus: String, Codable, Sendable {
    case draft
    case active
    case paused
    case ended
    case completed
}

struct CyclePlan: Identifiable, Codable, Hashable, Sendable {
    let id: PlanID
    var name: String
    var startDay: LocalDay
    var numberOfWeeks: Int
    var days: [PlanDay]
    var status: PlanStatus
    var pausedUntil: LocalDay?
    var endedOn: LocalDay?
    var createdAt: Date
    var updatedAt: Date
}
```

Plan application is a transaction that materializes distinct `ScheduledWorkout` snapshots. A plan does not dynamically render templates into history, and existing same-day workouts are not conflicts solely because they share a `LocalDay`. The apply command is atomic after genuine identity/referential validation. Pause/shift, end, repeat, and natural completion should be retained only to the extent verified in `src/store/index.ts` (`pauseShiftCyclePlan`, `endCyclePlan`, `repeatCyclePlan`, `getCyclePlanStatus`).

### Progression model

The current useful behavior is double progression plus weight-only/reps-only modes, global defaults, groups, and exercise overrides (`src/types/progression.ts`, `src/utils/progressionSuggestions.ts`, `src/screens/Progression*.tsx`). Remove old semantic buckets named `main_upper`, `main_lower`, and `accessory`; section vocabulary must not survive in native domain.

```swift
struct ProgressionRuleID: DomainID, Identifiable {
    let rawValue: String
    var id: String { rawValue }
}

enum ProgressionMode: String, Codable, Sendable {
    case doubleProgression
    case weightOnly
    case repetitionsOnly
    case disabled
}

struct ProgressionParameters: Codable, Hashable, Sendable {
    var repetitionRange: ClosedRange<Int>
    var weightIncrement: Weight
    var mode: ProgressionMode
}

struct ProgressionGroup: Identifiable, Codable, Hashable, Sendable {
    let id: ProgressionRuleID
    var name: String
    var parameters: ProgressionParameters
    var exerciseIDs: Set<ExerciseID>
}

struct ExerciseProgressionOverride: Identifiable, Codable, Hashable, Sendable {
    var id: ExerciseID { exerciseID }
    let exerciseID: ExerciseID
    var parameters: ProgressionParameters
}

struct ProgressionConfiguration: Codable, Hashable, Sendable {
    var isEnabled: Bool
    var defaults: ProgressionParameters
    var groups: [ProgressionGroup]
    var overrides: [ExerciseProgressionOverride]
}

struct ProgressionSuggestion: Equatable, Sendable {
    let exerciseID: ExerciseID
    let suggestedWeight: Weight?
    let targetRepetitions: ClosedRange<Int>?
    let rationale: Rationale
    enum Rationale: Sendable { case increaseWeight, addRepetitions, repeatLast }
}
```

Suggestion precedence is override → first validated group membership → defaults. It reads the most recent completed canonical working sets. The current algorithm is a useful reference: all sets reaching the rep maximum increases weight and resets to range minimum; otherwise it keeps weight and raises the weakest set target. Suggestions remain derived.

### Settings and backup schema

```swift
enum WeightUnit: String, Codable, Sendable { case pounds, kilograms }

struct AppSettings: Codable, Hashable, Sendable {
    var weightUnit: WeightUnit
    var defaultRestDuration: TimeInterval
}

struct EquilibriumBackupV1: Codable, Sendable {
    let schemaVersion: Int       // exactly 1
    let exportedAt: Date
    let sourceDeviceID: String   // installation identifier, not advertising ID
    let exercises: [ExerciseDefinition]
    let workoutTemplates: [WorkoutTemplate]
    let scheduledWorkouts: [ScheduledWorkout]
    let cyclePlans: [CyclePlan]
    let settings: AppSettings
    let progression: ProgressionConfiguration
}
```

The backup owns canonical user data only. Progression remains its own configuration, while account/session/cloud state belongs to authentication and backup services rather than `AppSettings`. The backup never contains auth tokens, derived PRs/caches, UI/navigation/timer state, deleted v1-excluded domains, or raw SwiftData files. Encoding is stable JSON with fixtures and explicit version decoders. Equilibrium v1 is dark-only, so no appearance preference is persisted.

## 4. Native architecture

Use one iOS application target with folders/groups reflecting dependency direction. Do not create separate framework targets until build time or team scale justifies them; logical modules and protocols are enough for v1.

```text
Equilibrium/
├── App/
│   ├── EquilibriumApp
│   ├── AppEnvironment
│   ├── AppCoordinator
│   └── AppRoute
├── Domain/
│   ├── Models/
│   ├── Commands/
│   ├── Queries/
│   ├── Progression/
│   └── Validation/
├── Data/
│   ├── Persistence/          # SwiftData records, container, mappers
│   ├── Repositories/         # protocol implementations
│   ├── Backup/               # V1 codecs/import transactions
│   └── Migration/            # development-only RN importer
├── Services/
│   ├── Authentication/
│   ├── Supabase/
│   ├── Timer/
│   ├── Haptics/
│   ├── Audio/
│   └── PasteWorkout/
├── Features/
│   ├── Authentication/
│   ├── Home/
│   ├── WorkoutExecution/
│   ├── WorkoutBuilder/
│   ├── History/
│   ├── ExercisePerformance/
│   ├── Plans/
│   ├── Progression/
│   └── Settings/
├── DesignSystem/
│   ├── Color
│   ├── Typography
│   ├── Spacing
│   ├── Components
│   └── Motion
└── Shared/
    ├── Extensions
    ├── Formatting
    └── TestSupport
```

Dependency direction is Features → Domain protocols/models; Data and Services implement Domain-facing protocols; App composes them. Domain must not import SwiftUI, SwiftData, Supabase, AuthenticationServices, or notification frameworks.

Recommended repository protocols:

```swift
protocol ExerciseRepository { /* query/upsert/archive catalog */ }
protocol WorkoutTemplateRepository { /* CRUD reusable definitions */ }
protocol ScheduledWorkoutRepository { /* bounded ordered LocalDay queries + identity-safe transactional mutation */ }
protocol CyclePlanRepository { /* plan lifecycle + materialization commands */ }
protocol SettingsRepository { /* small preferences */ }
protocol BackupRepository { /* export/restore EquilibriumBackup versions */ }
protocol AuthenticationService { /* session stream, sign-in, sign-out */ }
```

Commands such as `AddScheduledWorkout`, `LogSet`, `CompleteWorkout`, `ApplyPlan`, and `RestoreBackup` own multi-record transaction rules. Views never write persistence records directly.

### Native design system

Translate intent, not RN constants:

- `EQSpacing`: 4/8/12/16/24/32 points, using native list/content margins where appropriate.
- `EQRadius`: compact/control/card/hero, with continuous corners.
- Semantic colors in the asset catalog: canvas, surface, elevated surface, primary text, secondary text, separator, accent, success, warning. The v1 palette is dark-only while remaining semantic enough that a future light palette would not require rewriting views. No appearance selector is exposed.
- Typography uses semantic text styles (`.body`, `.headline`, `.title2`) with restrained custom font mapping only if Outfit remains essential. Never disable Dynamic Type.
- `WorkoutCardStyle`, `ExerciseCardStyle`, native `ButtonStyle`s, form row styles, and sheet chrome replace copied style objects.
- Motion tokens define only durations/springs shared by product meaning; native transitions remain the default.
- Haptics are semantic service calls (`selection`, `setCompleted`, `workoutCompleted`), disabled/reduced appropriately for accessibility/system settings.

## 5. State architecture

Use Observation (`@Observable`) for small feature models and environment injection for long-lived capabilities. Do not mirror the database in one global observable array store.

| State kind | Owner | Examples |
|---|---|---|
| Persistent domain | Repositories/SwiftData transactions | exercises, templates, scheduled workouts/logs, plans, settings, progression. |
| Query/read state | Feature model using repository async query/observation | current-day ordered workouts, history page, exercise performance series. Home derives its day from `CurrentDayProviding`. |
| Transient view state | SwiftUI `@State` | sheet visibility, carousel position, search query, focus field, expanded card. |
| Feature workflow state | `@Observable` feature model | unsaved builder draft, plan review, restore progress/errors. |
| Execution session | `@Observable WorkoutExecutionModel` | focused exercise ID, editor focus, timer state, pending input. Completed set mutations are committed immediately to `ScheduledWorkout`; unsaved keystrokes remain transient. |
| Navigation | `NavigationPath`/typed `AppRoute` in a small coordinator | Home routes and modal destinations; no persisted navigation graph. |
| Account/cloud | `@Observable AccountModel` backed by `AuthenticationService`/`BackupService` | optional signed-in user, backup status/revision/time, restore state and errors. It never gates local Home use. |
| Timer | actor/service plus feature projection | monotonic deadline, remaining time, pause/resume; not a domain database. |

`AppEnvironment` should inject protocol-typed repositories/services. Production, preview, fixture, and test environments use different implementations. Feature models receive only what they need.

Persistence writes belong on actors or `@ModelActor`-backed repositories. UI changes occur on `@MainActor`. Use structured concurrency and cancellable tasks; avoid global singletons and notification buses for routine state flow.

## 6. Local persistence recommendation

### Options considered

| Option | Strengths | Costs/risks for Equilibrium |
|---|---|---|
| SwiftData | Native Swift model graph, predicates/sorting, observation, migrations, transactions through model contexts, previews/tests; no third-party runtime. | Available well within the locked iOS 18 baseline; schema evolution and Codable-value modeling need discipline; CloudKit integration must remain off because Supabase Backup/Restore is authoritative. |
| Core Data directly | Mature, granular migrations, broad OS support. | More mapping/boilerplate and less idiomatic for a new SwiftUI-only v1; useful only if iOS 16 support is required or SwiftData limitations emerge in a spike. |
| SQLite/GRDB | Excellent explicit schema, deterministic migrations and query performance. | Adds a dependency and substantial persistence code before scale warrants it. Strong fallback if SwiftData transaction/migration prototypes fail. |
| JSON/UserDefaults | Simple at first. | Unsafe concurrency/atomicity, expensive whole-document writes, weak queries/migrations; recreates AsyncStorage problems. Not suitable. |

### Recommendation

Use SwiftData for the iOS 18 native app, with separate persistence records and domain mapping where that prevents framework leakage. Phase 0 still runs a focused technical spike and may reject SwiftData only if it demonstrates a concrete blocker in the hardest relationships: ordered nested exercise/set snapshots, deterministic same-day workout ordering, transactional plan materialization, backup restore into an empty container, or schema migration fixtures.

Store normalized top-level records for catalog definitions, templates, scheduled workouts and plans. Child template exercises, prescriptions, scheduled exercises and logged sets should be explicit related records with stable IDs and positions, not opaque blobs, so history/performance queries remain efficient. Small value types such as `LocalDay` and `Weight` can use transformable/Codable storage only after query requirements are known.

Keep backup serialization independent of SwiftData internals. Repositories map persistence records ↔ domain values; Supabase encodes domain backup DTOs. Use an in-memory SwiftData container for unit/integration tests.

GRDB remains a contingency only if that spike proves a concrete SwiftData blocker. There is no iOS 16/17 fallback architecture.

## 7. Supabase architecture

### Local-first account model and authentication

Authentication does not gate launch. `EquilibriumApp` opens the persistent local SwiftData store and Home / Workout of the day immediately. An anonymous/local user has the full core workout product, and that data survives relaunch exactly like authenticated data. Settings → Account / Cloud Backup offers optional sign-in; signing in enables Supabase Backup/Restore.

- Use `AuthenticationServices.SignInWithAppleButton`/`ASAuthorizationAppleIDProvider` with a cryptographically random nonce and SHA-256 hash.
- Exchange Apple’s identity token through the Supabase Swift client’s native `signInWithIdToken` Apple provider flow. Supabase documents native ID-token sign-in for Swift and an auth-state async stream.
- Capture Apple full name only on first authorization and update user metadata deliberately; Apple may not return it later.
- Subscribe once to Supabase auth state changes for initial session, signed in/out and token refresh. Expose account state through `AccountModel`.
- Configure the Supabase Swift client with secure custom session storage backed by Keychain if the SDK’s selected version does not already meet the project’s Keychain requirement. Access/refresh tokens never enter SwiftData, backups, logs, analytics, or UserDefaults.
- When a local user signs in, offer to back up the current local canonical dataset to that account or inspect/restore an existing cloud backup. Implementation must prevent an accidental overwrite when both sides contain data; the exact association/replace UX may be refined during implementation.
- On logout: revoke/sign out through Supabase, delete Keychain session material, and cancel backup tasks. Keep the local SwiftData history intact unless the user separately chooses an explicit destructive reset. Logout never silently destroys workouts.

### Backup contract and table

Keep a per-user backup row but stop dumping local storage. A proposed table contract is:

```text
equilibrium_backups
- user_id uuid primary key references auth.users on delete cascade
- schema_version integer not null
- revision bigint not null
- payload jsonb not null
- payload_sha256 text not null
- client_updated_at timestamptz not null
- updated_at timestamptz not null default now()
```

RLS permits only `auth.uid() = user_id`. The existing `user_backups` table remains read-only legacy input during cutover; native v1 writes a distinct table or explicitly versioned row so it cannot overwrite the RN backup before validation.

### Backup flow

1. Repository creates a consistent read snapshot and validates domain invariants.
2. Encode `EquilibriumBackupV1` using a fixed ISO-8601/date and key strategy.
3. Hash the encoded payload.
4. Upsert with backup-level revision/checksum checking to detect a newer cloud backup or accidental overwrite. Do not implement entity-level merge, tombstones, distributed conflict resolution, or multi-device reconciliation.
5. Record last successful revision/time locally; surface failures without blocking offline workouts.

For v1 this is strictly **Cloud Backup / Restore**, not real-time or multi-device synchronization. SwiftData is authoritative during ordinary use. Trigger backup after meaningful mutations with debounce, on background opportunity where allowed, and manually through **Back Up Now**. Settings uses **Cloud Backup**, **Last Backup**, **Back Up Now**, and **Restore Backup**. Never depend on an app-background callback as the only durability path.

### Restore flow

1. Authenticate and fetch metadata before payload.
2. Decode by `schemaVersion`; reject future unsupported versions without changing local data.
3. Validate IDs, referential integrity, array and same-day carousel ordering, status/timestamps, limits, and other domain invariants. Multiple `ScheduledWorkout` values sharing a `LocalDay` are valid and must be preserved.
4. Restore into a temporary/in-memory or staging SwiftData container.
5. Run domain validation and counts/checksum.
6. Ask for confirmation if replacement is destructive.
7. Atomically swap/replace user-domain data; retain a local pre-restore export until successful relaunch validation.
8. Rebuild derived indexes/PRs and show a restore summary.

Do not merge arbitrary backups in Phase 7. Use explicit restore-new-install or confirmed replace-local behavior. Entity revision/tombstone semantics and multi-device merge are outside v1.

### Versioning and security

- Every backup version has a frozen DTO, decoder tests and migration to current domain.
- Backup revision and schema version are independent.
- Supabase project URL and publishable/anon key may be app configuration; service-role keys never ship.
- Apply payload size limits, decode limits and server RLS tests.
- Do not reproduce iCloud FileSystem backup. Before retiring it, prove RN Supabase backup availability and native legacy conversion against captured fixtures.

Official references for implementation-time verification: [Apple SwiftUI zoom navigation transition](https://developer.apple.com/documentation/swiftui/zoomnavigationtransition), [Apple matched transition source](https://developer.apple.com/documentation/swiftui/view/matchedtransitionsource%28id%3Ain%3A%29), [Supabase Swift native ID-token sign-in](https://supabase.com/docs/reference/swift/v1/auth-signinwithidtoken), and [Supabase Swift auth state changes](https://supabase.com/docs/reference/swift/auth-onauthstatechange).

## 8. React Native → Swift data mapping

The importer reads a frozen export/Supabase legacy payload; it never mutates RN storage. “Keep” means eligible after validation, not automatically imported.

| React Native source | Swift canonical destination | Migration rule | Keep/import? |
|---|---|---|---|
| `@workout_tracker_exercises` / `types/index.Exercise` | `ExerciseDefinition` | Preserve normalized identity, name, aliases, equipment, category, custom/system status and archive state. Do not import catalog `measurementType`; execution target comes from each prescription. Create a stable ID mapping and resolve duplicates by normalized identity with an explicit alias map. | Yes |
| `training.WorkoutTemplate.items` | `WorkoutTemplate.exercises` | Map in `order`; map sets/reps/weight/time/rest and exercise ID/name snapshot. Create individual set prescriptions. | Yes |
| `WorkoutTemplate.warmupItems` | none by default | Sections are removed. Do not append automatically: that changes workout meaning. An optional migration review tool may let the developer explicitly promote selected items to ordinary exercises. | No automatic import |
| `WorkoutTemplate.accessoryItems` | none by default | Same rule as warmups; no section data in native schema. | No automatic import |
| `scheduledWorkouts` | `ScheduledWorkout` | Map day/title/template/source/status/timestamps/main `exercisesSnapshot`; map `programId ?? cyclePlanId` to `planID`; ignore section snapshots/completion. Reconcile logs using Section 9. | Yes |
| `detailedWorkoutProgress` | `ScheduledExercise.loggedSets` | Preferred actual set values when linked unambiguously to a scheduled main exercise. Map set number/weight/reps/completed; infer completion time from workout/session when absent and mark provenance in import report. | Yes, reconciled |
| `workoutProgress` | no separate model | Use only as completion evidence/fallback set-index evidence when detailed logs are absent. Never persist it independently. | Conditional evidence |
| `sessions` / `WorkoutSession.sets` | canonical scheduled workout logged sets or synthesized historical `ScheduledWorkout` | Merge by scheduled ID/template/date/exercise/set identity. Synthesize a completed manual workout only when no scheduled candidate exists and session has valid completed sets. | Yes, reconciled |
| `exercisePRs` | none | Compare to PRs derived after import; report discrepancies. Never override canonical logged sets or persist as authority. | Validation only |
| current `cyclePlans` | `CyclePlan` | Preserve name/start/weeks/weekday mapping/status lifecycle; translate template IDs; canonicalize all scheduled references to `planID`. Drop share source unless Paste workout review needs it. | Yes |
| old `Cycle` | none | Historical generation excluded. | No |
| `workoutAssignments` | none | Excluded old scheduling generation. Use only in diagnostic report if a selected scheduled/history record cannot otherwise be found; do not import automatically. | No |
| `SavedCycle`, old `CycleDraft`, onboarding state, `ManualCycle` | none | Excluded generations/drafts. | No |
| progression groups/rules/defaults | `ProgressionConfiguration` | Map modes/ranges/increments and translated exercise IDs. Convert `main_upper/main_lower/accessory` named defaults to neutral named groups only if membership is explicit; otherwise use v1 defaults and report skipped assumptions. | Yes |
| settings: `useKg`, rest timer, progression enabled | `AppSettings` + progression enabled | Map units and timer default; map progression enabled into `ProgressionConfiguration`. Ignore RN theme because v1 is dark-only. | Yes |
| settings: trainer/API/avatar/notification/catalog marker/history order | none | Obsolete or unsupported. Never import secrets/API keys. | No |
| body weight | none | Explicitly excluded. Preserve only in untouched RN backup/archive. | No |
| progress photos / avatar URI | none | Explicitly excluded; local URIs are nonportable. | No |
| pinned key lifts | none | Explicitly excluded. | No |
| HIIT timers/sessions | none | Explicitly excluded. | No |
| warmup/core presets, bonus logs, core programs/logs | none | Explicitly excluded. | No |
| fallback warmup/accessory completion | none | Section completion excluded. | No |
| trainer conversations | none | Explicitly excluded; do not upload to v1 backup. | No |
| `@app/guestMode`, auth `sb-*`, fatal error | none | Never import tokens, diagnostics, or the broken guest marker. Native local data persists through SwiftData without an account flag. | No |

## 9. Duplicate workout history reconciliation

Implement the importer as a pure, deterministic transformation with an `ImportReport`. It must produce identical output for identical input, never infer by unordered iteration, and never overwrite the RN source.

### Source authority

Authority is field-specific:

1. **Workout identity, date, title, planned exercise snapshot, template/plan provenance and explicit status:** `ScheduledWorkout` wins.
2. **Actual per-set values/completion:** linked `detailedWorkoutProgress` wins because it is written during execution at set granularity.
3. **Completed-set fallback and missing workout synthesis:** `sessions` wins only where detailed progress is absent or cannot provide a value.
4. **Completion-only evidence:** `workoutProgress` can mark a known set/exercise complete but cannot invent weight/reps.
5. **PR records:** never win; they validate derived output only.

### Deterministic algorithm

1. **Normalize inputs.** Parse all dates/timestamps strictly; convert kg to canonical pounds only when the source explicitly identifies kg; reject NaN/negative reps/durations and unreasonable values into the report. Sort every source by stable keys.
2. **Build the exercise identity map.** Prefer exact source ID. Merge duplicate catalog definitions only through normalized-name/alias rules already exercised by `exerciseIdentity.ts` and `personalExerciseCatalog.ts`. Every merge is reported.
3. **Seed canonical workouts from scheduled records.** One provisional native record per RN scheduled ID. Include only `exercisesSnapshot` (main list), in order. Snapshot names resolve: item `nameSnapshot` → mapped catalog name → deterministic “Unknown Exercise” placeholder plus report issue.
4. **Resolve detailed-progress keys.** Match in this order: exact scheduled workout ID/key; exact scheduled ID after known `sw-` prefix normalization; exact template ID + local day legacy key; unique template/day candidate. Ambiguous matches are not guessed.
5. **Match exercises.** Prefer template item ID, then catalog exercise ID within the candidate workout, then unique normalized name. Never match only by array index when IDs disagree.
6. **Match sets.** Prefer explicit set number/index; otherwise stable source order. Convert completed detailed sets into `LoggedSet` values. Preserve incomplete entered values if useful for in-progress workouts, but `completedAt` remains nil.
7. **Merge sessions.** Candidate match order: explicit session/scheduled ID linkage if present; exact template ID + local day; unique local day plus overlapping exercise IDs. For each set field, detailed non-null value wins; session fills null weight/reps/duration/completion only. A disagreement is recorded with both values and chosen source.
8. **Synthesize orphan session history.** If no candidate exists and a session contains at least one valid completed set, create one completed manual `ScheduledWorkout` titled from its template snapshot/catalog fallback, day from session, exercises grouped in first-set occurrence order, and completion time from `endTime` or deterministic fallback. Mark it `synthesized` in the import report, not in domain schema.
9. **Apply `workoutProgress` evidence.** For a matched workout/exercise/set lacking detailed/session completion, mark completion only when the record explicitly names that set. Do not create numeric performance values. Do not mark an entire workout completed from a percentage alone.
10. **Reconcile status.** Explicit scheduled `completedAt/status=completed` wins if structurally plausible. Otherwise a workout becomes completed only if a session has `endTime` or every non-skipped prescribed set is complete. `startedAt` uses scheduled value, else session `startTime`, else earliest logged-set time. `completedAt` uses scheduled value, else session `endTime`, else latest logged-set time. Never use import time.
11. **Deduplicate synthesized/canonical workouts.** Do not collapse separate scheduled IDs merely because their content matches. For orphan sessions only, identify likely duplicate evidence when template ID, local day, exercise/set fingerprints and timestamps agree; report it for converter policy/review.
12. **Preserve same-day multiplicity.** Import every distinct scheduled ID on its source `LocalDay`; retain deterministically available source order. Do not merge workouts because they share a day or template. Only genuine duplicate evidence enters duplicate reconciliation.
13. **Validate and derive.** Enforce identity, relationship, snapshot, and execution invariants, rebuild performance index and PRs from canonical logs, compare derived PRs with RN `exercisePRs`, and report missing/excess values without altering logs.
14. **Commit atomically.** Import into staging; present counts, genuine duplicate warnings, other warnings, abandoned domains and checksum; commit after validation. Store import manifest (`sourceBackupHash`, importer version, timestamp, entity ID map) outside the user-domain backup so reruns are detected.

### Reconciliation examples

- Detailed progress says 100 lb × 8; session says 95 lb × 8: import 100 × 8 and report disagreement.
- Detailed set exists but is incomplete; session has a completed value: session fills and completes that set.
- Scheduled workout says completed but has no logs anywhere: retain completed workout shell for history only if it was explicitly completed; report zero performance sets.
- PR says 225 lb but no canonical log supports it: do not synthesize a set; report that the legacy PR was not imported.
- Two RN scheduled workouts share a day: import both as distinct canonical instances, preserving IDs and deterministic source order; no warning exists solely for same-day cardinality.

## 10. Vertical migration phases

Each phase is independently demonstrable and retains the RN app unchanged as reference.

### Phase 0 — Define native foundation

- **Objective:** Prepare an implementation-ready native foundation with the locked iOS 18/product decisions, domain/backup schemas, persistence feasibility, dependency policy, design foundations and migration fixtures. The only external identity task is verifying `com.tsunamichi.equilibrium` availability/configuration.
- **User-visible result:** None; runnable preview/test harness with fixture cards is acceptable, not a product feature.
- **Likely Swift files/modules:** `Domain/Models`, `Domain/Validation`, repository protocols, `PersistenceController`, SwiftData record spike, `AppEnvironment`, design tokens, fixture factories, `EquilibriumBackupV1` codec.
- **RN references:** all audit docs; `src/types/index.ts`, `training.ts`, `progression.ts`; Home workout-deck/execution screenshots and baseline commit.
- **Data required:** anonymized empty, planned, in-progress, completed, duplicate-history and current-plan fixtures captured without mutating RN.
- **Automated tests:** Codable golden files; ID/local-day tests; same-day multiplicity and deterministic-order tests; reps/duration prescription invariants; SwiftData relationship/transaction prototype; backup round trip; fixture decoding.
- **Manual regression:** compare typography/colors/card geometry against known-good RN on representative iPhone sizes and Dynamic Type sizes.
- **Dependencies/frameworks:** iOS 18 SwiftUI, Observation, Foundation and SwiftData; XCTest/Swift Testing choice. No Supabase runtime yet.
- **Risks:** premature schema abstraction; a concrete SwiftData relationship/transaction blocker; Apple Developer/App Store Connect bundle-ID availability.
- **Exit criteria:** iOS 18 deployment target locked; Equilibrium name selected; `com.tsunamichi.equilibrium` availability marked verified or assigned a verified equivalent; dark-only/local-first/no-tabs scope locked; SwiftData spike passes or documents a concrete blocker and approved contingency; canonical types locked; same-day multiplicity, reps+duration-only execution scope, Supabase Backup/Restore scope, RN fixture/import strategy and Paste workout naming locked; schema-v1 fixture passes; no product-scope question remains before creating the SwiftUI project.

### Phase 1 — Home shell

- **Objective:** Establish the current-day Home lens, navigation and local-day semantics with fixtures.
- **User-visible result:** Home launches into an ordered current-day workout carousel whose final/only empty page is Add Workout, and opens placeholder Settings/history plus Timer.
- **Likely files/modules:** `HomeView`, `HomeModel`, `WorkoutCard`, `AddWorkoutCard`, typed routes/coordinator, Settings shell, design components.
- **RN references:** `TodayScreen.tsx`, `ScheduleWorkoutDeckV3.tsx`, theme/tokens and baseline screenshots. Calendar components are historical negative references only; Home has no date-navigation UI.
- **Data required:** fixture repository only; no migration.
- **Automated tests:** injected current-local-day calculations across DST/year boundaries; bounded ordered current-day query/state tests; rollover tests; Home route tests; zero/one/many/completed/Add Workout snapshots where stable.
- **Manual regression:** horizontal carousel gestures and card peeking, Add Workout final/only-page behavior, safe areas, iPad behavior, VoiceOver order, Dynamic Type, reduced motion, dark appearance, and absence of date navigation or a Rest Day state.
- **Dependencies/frameworks:** SwiftUI navigation/scrolling; native haptics abstraction.
- **Risks:** over-copying deck animation; local-day/time-zone rollover bugs; unstable same-day ordering.
- **Exit criteria:** fixture Home is production-quality, accessible, and navigable with a current-day ordered carousel, final Add Workout page, Timer/History/Settings routes, and no custom navigation framework.

### Phase 2 — First vertical slice

- **Objective:** Prove the canonical log model end to end.
- **User-visible result:** Home → workout card → ordered Exercises → log sets → complete → Home/history state updates; the completed card remains in today's carousel, and relaunch resumes persisted in-progress work.
- **Likely files/modules:** scheduled-workout repository, `WorkoutExecutionView/Model`, exercise/set cards, log/complete commands, completion presentation, performance query seed, transition source.
- **RN references:** `ExerciseExecutionScreen.tsx`, Explore V2 components/tokens, `completeWorkout`, celebration data builder, current Home workout-card transition.
- **Data required:** one fixture/template materialized into SwiftData.
- **Automated tests:** log/update set transactions; status invariants; completion percentage/state derivation; relaunch recovery; completed immutability; history query; transition route identity.
- **Manual regression:** set entry/keyboard, current/upcoming/completed animations, interruption/relaunch, back/dismiss behavior, completion and card return, reduced motion.
- **Dependencies/frameworks:** SwiftData; SwiftUI Observation/`NavigationStack`; native iOS 18 matched source + zoom navigation transition.
- **Risks:** keeping too much execution state transient; transition tied to data mutation; false parity with section behavior.
- **Exit criteria:** a persisted workout can be completed and reconstructed solely from `ScheduledWorkout`; no sessions/progress/PR store exists.

### Phase 3 — Workout creation

- **Objective:** Create and add current-day canonical workouts through the three Home entry paths.
- **User-visible result:** Create from scratch, exercise selection/custom exercise, reusable internal save, multi-select **Use recent workout**, and **Paste workout** for formatted workout text; every Home creation path targets today.
- **Likely files/modules:** `WorkoutBuilderView/Model`, `ExercisePicker`, prescription editor, template repository, current-day add command, recent multi-select picker, `PasteWorkoutView/Model`, `PlanTextParser` and review UI.
- **RN references:** `WorkoutBuilderScreen`, `RecentWorkoutPickerScreen`, builder utilities, `AIWorkoutCreationScreen`, personal catalog utilities.
- **Data required:** catalog/template/log fixtures.
- **Automated tests:** builder validation; catalog dedupe; ordered prescriptions; template snapshot isolation; recent multi-select clones with new IDs in tap order; parser golden cases/invalid input; multiple same-day creation.
- **Manual regression:** Paste workout, search/create exercise, reorder/delete, unsaved-change dismissal, keyboard/focus, Create from scratch result, and one/many Use recent workout results appended to today's Home carousel.
- **Dependencies/frameworks:** native searchable/navigation/forms/clipboard. No AI/OpenAI SDK or client API key.
- **Risks:** ambiguous exercise matching; accidental mutation of history/template; parser error review.
- **Exit criteria:** all retained creation paths write only canonical models and survive relaunch.

### Phase 4 — History and performance

- **Objective:** Derive all retained progress behavior from canonical logs.
- **User-visible result:** workout history/detail, exercise previous sets/trend, derived PR and execution-accessible performance context.
- **Likely files/modules:** history/performance queries, `WorkoutHistoryView`, `WorkoutDetailView`, `ExercisePerformanceView`, chart/PR derivation.
- **RN references:** `HistoryScreen`, history components/utilities, `ProgressScreen`, execution history drawer, `buildExerciseWeightProgressRows`, `getLatestExerciseLog`.
- **Data required:** varied canonical completed logs, missing-weight and duration fixtures.
- **Automated tests:** grouping/order; per-exercise identity; unit conversion; PR rules; chart points; deleted/renamed catalog snapshot behavior; cache rebuild equivalence.
- **Manual regression:** history navigation, empty states, large histories, performance from execution, accessibility of charts/data tables.
- **Dependencies/frameworks:** Swift Charts if deployment supports it; otherwise native list first. No Progress tab.
- **Risks:** chart scope creep; performance queries; invalid imported records.
- **Exit criteria:** deleting every derived cache still yields identical history/performance/PR results.

### Phase 5 — Plans

- **Objective:** Implement only current useful `CyclePlan` behavior against canonical templates/snapshots.
- **User-visible result:** create/review/apply plan, current plan status and approved lifecycle actions. Plan-generated workouts coexist with any other workouts already assigned to the same day.
- **Likely files/modules:** plan repository/commands, `PlanBuilder`, day editor, review/detail, materialization/status calculator.
- **RN references:** `CreateCycleFlow`, day editor, `CyclePlanDetailScreen`, plan actions in `src/store/index.ts`, and Home plan entry points. `CycleConflictsScreen` is a negative reference for obsolete day-occupancy behavior.
- **Data required:** templates; active/paused/ended/repeated plans; days containing zero, one, and several existing workouts, including completed workouts.
- **Automated tests:** weekday generation across DST; atomic apply with same-day coexistence; completed-record lock; pause/shift; end/repeat; planID provenance; natural completion.
- **Manual regression:** create/apply onto empty and already-populated days, plan visibility from Home, pause/end/repeat if retained, genuine validation-error recovery, and unchanged existing/completed same-day workouts.
- **Dependencies/frameworks:** Foundation Calendar, SwiftData transactions, native date picker/sheets.
- **Risks:** copying legacy lifecycle quirks; date ambiguity; losing deterministic order during atomic same-day materialization; treating ordinary day occupancy as an error.
- **Exit criteria:** plan workflows create only canonical scheduled snapshots with `planID`; no compatibility aliases/generations.

### Phase 6 — Progression and timer

- **Objective:** Add execution assistance without new performance stores or timer product domains.
- **User-visible result:** progression defaults/groups/overrides, next-session suggestions, simple rest/duration timer with pause/resume/reset and haptic/audio completion.
- **Likely files/modules:** progression engine/config views, `SimpleTimer` actor/state, timer UI, haptic/audio clients, lifecycle adapter.
- **RN references:** progression screens/types/utilities, execution suggestion use, `SetTimerSheet`, `TimerValueSheet`, `DeviceEdgeTimer`; HIIT code only as negative reference.
- **Data required:** canonical logs/config fixtures; timer lifecycle clocks.
- **Automated tests:** progression precedence and modes; last-log selection; injected-clock timer transitions; background/foreground elapsed time; cancellation/reset; duration-set integration.
- **Manual regression:** rest start, interruption/background/lock, pause/resume, sound/haptics, silent mode expectations, reduced motion/accessibility.
- **Dependencies/frameworks:** ContinuousClock/Swift concurrency, scene phase, AVFoundation/AudioServices and UserNotifications only if background notification behavior is explicitly required.
- **Risks:** timer correctness when suspended; notification permission scope creep; old section-named progression groups.
- **Exit criteria:** one timer state machine handles retained uses; no HIIT/round/bonus data or UI.

### Phase 7 — Optional account and Supabase Cloud Backup

- **Objective:** Add optional secure native identity and authoritative versioned Cloud Backup/Restore without changing local-first behavior.
- **User-visible result:** the app still launches directly to Home / Workout of the day; Settings offers Apple Sign In, durable account session, Last Backup, Back Up Now, Restore Backup and logout while local history remains intact.
- **Likely files/modules:** auth service/AccountModel, Keychain storage, Supabase client, backup DTO/service, Settings account/backup UI, RLS/schema migration outside app code.
- **RN references:** `LoginScreen`, `authService.ts`, `supabase.ts`, `cloudSync.ts`, `ProfileScreen`; `cloudBackup.ts` only to verify retirement.
- **Data required:** test Supabase project/users, backup fixtures v1, corrupt/future/conflict payloads.
- **Automated tests:** auth state reducer; custom session storage; encode/hash/revision; RLS integration; offline/retry; staging restore; future schema rejection; token exclusion.
- **Manual regression:** first/repeat Apple login, relay email/name, token refresh, airplane mode, logout/relaunch, new install restore, wrong/corrupt backup, two-device conflict message.
- **Dependencies/frameworks:** AuthenticationServices, Security/Keychain, Supabase Swift pinned version, CryptoKit.
- **Risks:** identity mismatch with existing RN users; token storage; local-data/cloud-backup association; accidental overwrite or destructive restore.
- **Exit criteria:** test user restores an identical validated v1 dataset on a fresh device; no auth token appears in backup or logs; iCloud is absent.

### Phase 8 — Real-data migration

- **Objective:** Run the required one-time developer/TestFlight import of selected RN development data after the native schema is stable.
- **User-visible result:** selected catalog/templates/dated workouts/history/plan/progression appear natively with an import summary; excluded domains remain in RN archive only.
- **Likely files/modules:** development-only legacy DTOs, versioned JSON exporter contract, optional frozen Supabase legacy reader, deterministic reconciliation engine, ID mapper, import report/review, staging transaction.
- **RN references:** storage/types, history builders, migration utilities, cloud schema and baseline data.
- **Data required:** checkpointed real/anonymized RN exports covering all known shapes and disagreements.
- **Automated tests:** every Section 9 precedence rule; idempotence; golden converted backup; malformed/ambiguous data; excluded-key assertions; rollback.
- **Manual regression:** compare counts and representative workouts/sets/PRs/plans side-by-side with RN; inspect warnings; relaunch and backup restored import.
- **Dependencies/frameworks:** Foundation Codable/CryptoKit; existing native repositories. No RN runtime in shipped target.
- **Risks:** ambiguous identifiers; genuine duplicate evidence; accidental section import; development importer leaking into the production target.
- **Exit criteria:** exercise catalog, reusable templates, all distinct scheduled/completed workout history including same-day multiplicity, current CyclePlans, progression and relevant settings import deterministically with zero invariant violations; converted `EquilibriumBackupV1` restores correctly; legacy importer is excluded from the production App Store target unless actual users later require it.

### Phase 9 — Feature parity and RN retirement

- **Objective:** Close retained-workflow gaps and declare the native app behaviorally ready.
- **User-visible result:** all chosen v1 workflows match or intentionally improve on baseline; RN becomes reference-only.
- **Likely files/modules:** targeted fixes/tests only; parity matrix and release fixtures.
- **RN references:** known-good commit run on reference device/simulator; no RN refactor.
- **Data required:** parity scenarios across empty/new/existing/plan/history accounts.
- **Automated tests:** complete retained-flow suite; migration and backup regression; performance baselines.
- **Manual regression:** side-by-side Home workout carousel, builder, execution, completion, history, performance, plans, progression, timer, settings/auth.
- **Dependencies/frameworks:** existing only; dependency freeze begins.
- **Risks:** visual pixel-copying over native behavior; hidden RN edge cases mistaken for scope; premature archive.
- **Exit criteria:** signed parity matrix; no critical/high defects; native iOS build used for ongoing TestFlight; frozen RN retained only for reference/migration/rollback, not Android/web maintenance; rollback artifact retained.

### Phase 10 — App Store hardening

- **Objective:** Make the native target releasable, supportable and privacy-correct.
- **User-visible result:** stable TestFlight/App Store candidate.
- **Likely files/modules:** privacy manifest, release configuration, accessibility/localization polish, diagnostics policy, store metadata support—not feature prototypes.
- **RN references:** only visual regression and migration rollback.
- **Data required:** clean-install, upgrade/import and restore fixtures.
- **Automated tests:** clean compiler warnings policy, full test suite, Release build, migration/backup/RLS integration, UI smoke tests, performance/memory checks.
- **Manual regression:** all final gates in Section 15 on supported devices/OS versions.
- **Dependencies/frameworks:** final audited set only.
- **Risks:** capability/permission leftovers, signing/bundle conflict, release-only failures, inadequate accessibility/privacy disclosures.
- **Exit criteria:** archived signed build passes TestFlight and App Store validation; release checklist signed; rollback/cutover runbook rehearsed.

## 11. Features intentionally NOT ported

The following are out of SwiftUI v1 scope and must not appear as domain models, persistence records, backup fields, routes, dependencies, permissions, or “temporary compatibility” except inside a one-time importer decoder:

- Warmup/main/core/accessories as workout sections.
- `warmupItems`, `accessoryItems`, all section snapshots/completion maps/APIs, execution `type`, and section-specific editors/executors.
- Bonus Warm Up, Bonus Core, warmup/core presets, bonus logs, Core Program and core logs.
- HIIT templates, history, list, form, execution and phase engine.
- Progress tab/home/dashboard, Progress-home hooks/cards/metrics/navigation.
- Body weight models, UI, charts, settings, persistence and backup.
- Progress photos/check-in/gallery/viewer/image picker, photo persistence/backup, and their camera/photo permissions.
- Pinned key lifts and dashboard-only lift trends/settings.
- Old `Cycle`, `WorkoutAssignment`, `SavedCycle`, onboarding `CycleDraft`/store/screens, `ManualCycle` as a persisted domain, unused `PlanTemplate`, legacy cycle screens/compatibility.
- `programID` and `cyclePlanID` in native domain (legacy importer may decode them to `planID`).
- Separate `sessions`, `detailedWorkoutProgress`, `workoutProgress`, stored `exercisePRs`, or section completion databases.
- Completed/current/up-next as persisted collections.
- Separate iCloud backup and arbitrary local-store/cloud dumps.
- Trainer conversations/personality/goals, client-side OpenAI API key, and stale AI trainer settings.
- Old notification flags/migrations, Live Activity capability, and timer notifications unless the simple timer requirement explicitly needs them.
- Design-system/prototype/motion-lab screens in production.
- React Native/Expo runtime or dependencies in the shipped native target.

Removed data remains preserved in the frozen RN backup/archive during the agreed retention window; exclusion from v1 is not authorization to destroy it immediately.

## 12. Native transition opportunities

### Home workout card → execution

On the iOS 18 baseline, mark each Home workout card with `.matchedTransitionSource(id:in:)` and apply `.navigationTransition(.zoom(sourceID:in:))` to Workout Execution where the card and destination have a clear one-to-one relationship. This is the native source-to-detail continuity the current deck transition custom infrastructure approximates. Keep the `ScheduledWorkoutID` stable through the transition; status changes must not reorder or remove today's source card. Do not build an iOS 17 fallback transition architecture.

### Exercise states

- Animate a card’s derived state changes using value-driven SwiftUI transitions/content transitions and spring animation.
- Preserve identity with `ScheduledExerciseID`; avoid separate completed/up-next arrays that destroy/recreate identity.
- Respect Reduce Motion by removing scale/geometry travel and retaining opacity/state clarity.

### Completion

Use a native overlay/full-screen cover with a short phase animation, haptic and optional lightweight particles. Dismiss/return through standard navigation so the card settles into its completed Home appearance and remains in today's carousel until rollover. Do not port accelerometer-dependent confetti unless explicitly justified; motion permission should disappear.

### Sheets and drawers

Replace `BottomDrawer`/custom editor sheets with native `.sheet`, presentation detents, drag indicator, compact adaptation, confirmation dialogs, menus, popovers and searchable navigation as appropriate. Use interactive dismissal normally; disable it only while a destructive/unsaved decision is unresolved and explain why.

### Plan/workout detail

Use native navigation pushes for information hierarchy and sheets for selection/creation. Apply matched/zoom source only where a visible source card maps one-to-one to the destination. Avoid animation across validation resolution or destructive state changes where clarity matters more than flourish.

### OS availability baseline

- Equilibrium v1 supports iOS 18 and newer.
- SwiftData, Observation/`@Observable`, `NavigationStack`, modern sheet APIs, `.matchedTransitionSource`, and `.navigationTransition(.zoom(...))` may be used directly.
- Reduce Motion, VoiceOver, Dynamic Type and other accessibility settings still govern how these APIs are presented; an iOS-version fallback is unnecessary, but an accessibility-safe reduced-motion presentation is required.

## 13. Migration/data cutover strategy

### Recommended path

Use **B: one-time versioned JSON export/import** as the primary development/TestFlight path, with **C: frozen legacy Supabase payload input** available when useful. Existing development workout history is intentionally preserved. A clean reset remains an explicit emergency/developer choice, not the default migration strategy.

Do not make the native app read AsyncStorage directly or embed a React Native runtime. A versioned JSON export is inspectable, reproducible and testable. For remote transition, upload that same frozen legacy export to a separate Supabase legacy location, convert server-side or in the native importer once, then write only `EquilibriumBackupV1` to the new backup table.

### Cutover runbook

1. Freeze and tag the RN reference commit/build; retain install artifact and screenshots.
2. Before any native import, create three checkpoints: raw local JSON export, existing RN Supabase backup copy, and checksum/import metadata. Leave iCloud untouched/readable during validation.
3. Define the exact legacy export allowlist; include sources needed for reconciliation and excluded-domain metadata/counts, but never auth tokens or client API keys.
4. Run the pure importer offline against copies. Produce canonical JSON and `ImportReport`; do not write Supabase yet.
5. Compare representative workouts, totals and derived PRs against RN. Approve warnings.
6. Import into a staging local native container. Relaunch, execute queries, and create a native v1 backup under the new table/schema.
7. Test fresh-install restore from v1 backup on a second simulator/device.
8. Only then mark that user/developer data as converted. Keep RN backup read-only through the rollback window.
9. Never have RN and SwiftUI write the same backup row. During dual-running, RN writes legacy `user_backups`; SwiftUI writes `equilibrium_backups`.
10. If native validation fails, discard the staging/native dataset and return to the untouched RN build/backup. Never reverse-convert native data into RN.

### Local development data choices

- The standard development cutover imports catalog, reusable templates, scheduled/completed workout history, current CyclePlans, progression and relevant v1 settings.
- A reduced catalog/templates-only profile may exist for diagnostic use, but it is not the approved primary cutover.
- A deliberate clean reset starts with seed catalog/default settings and no history only when explicitly selected after preserving the frozen export.
- Because migration precedes public App Store release, the importer is a developer/TestFlight tool and is excluded from the production binary after validated cutover unless actual users later require it.

### Supabase/iCloud retirement validation

- Inventory RN Supabase backups and prove they contain the expected legacy keys.
- Convert at least empty, typical, large, corrupt, and genuinely ambiguous backups, including valid same-day multiplicity fixtures.
- Prove native backup/restore checksum and counts across fresh install.
- Retain raw RN Supabase/iCloud snapshots for the agreed rollback period.
- Stop relying on iCloud only after every data owner has either validated native restore, exported, or chosen clean reset. Do not port iCloud code into Swift.

## 14. React Native retirement plan

| State | Trigger | Allowed changes / retention |
|---|---|---|
| Runnable/frozen reference | Immediately after Phase 0 fixtures/baseline are captured | No architecture cleanup or Android/web maintenance. Only export bridge or critical comparison-blocking fix. Keep baseline commit/build reproducible. |
| Reference-only | Phase 9 parity matrix passes and native becomes primary TestFlight | No product or platform development. Preserve source tag, install artifact, screenshots, sample backups and migration fixtures. Future Android/web support would be a separate product decision, not a reason to maintain RN. |
| Archived | Native App Store candidate passes Phase 10 and rollback window starts | Move documentation/status to archival ownership; disable CI/deploy writes as appropriate, but retain repository history and legacy backup reader. |
| Safe to delete from active tree | Native release is stable through the agreed retention window, all required imports/restores are complete, legal/data retention is resolved, and no shipped build depends on RN assets/services | Delete only in a separately reviewed cleanup. Git tag/archive and raw migration fixtures remain recoverable. |

Do not delete RN at feature-code completion alone. Data rollback, visual reference and operational backup access are separate retirement gates.

## 15. App Store release plan

### Build and code quality

- Swift compiler clean under the agreed warnings policy.
- All unit, persistence, importer, backup/RLS integration and UI smoke tests pass.
- Clean Release archive from a fresh checkout with pinned dependency versions.
- No RN/Expo/JavaScript bundle, Metro config or obsolete native modules in the shipped target.
- Product name is Equilibrium; `com.tsunamichi.equilibrium` (or a verified equivalent if unavailable) is configured in Apple Developer/App Store Connect. Signing and version/build numbering are verified. RN and SwiftUI may coexist independently during development.

### Core workflow gates

- Fresh install and relaunch persistence.
- Home current-day carousel with zero, one, and many same-day workout states.
- Completed cards remain in today's carousel; local-day rollover removes yesterday from Home without deleting canonical history.
- Add Workout is the final carousel page and the only primary page when today has no workouts; no Rest Day state exists.
- Create from scratch, Paste workout, and Use recent workout multi-select are the only Home creation entries.
- Create/add/start/resume/log/complete current-day workouts; past and future workouts remain read-only.
- Completed workout history/detail and exercise performance/derived PRs.
- Plan create/apply/status/lifecycle workflows, including atomic same-day coexistence with existing workouts and rejection only for genuine identity/referential/domain errors.
- Progression configuration and suggestion correctness.
- Simple timer foreground/background/interruption behavior.

### Identity and cloud gates

- First and returning Sign in with Apple, logout, token refresh and revoked-session behavior.
- Local-first data persists across relaunch without authentication; optional sign-in associates current local data with Cloud Backup without silent loss.
- Supabase RLS tests and no service secret in app.
- Backup, offline retry, revision conflict, corrupt/future-schema rejection and fresh-install restore.
- No auth token, excluded domain, derived cache or diagnostic data in backup.
- RN legacy backup retained/read-only for rollback; iCloud capability absent from native target.

### Platform quality

- VoiceOver labels/order/actions for the Home carousel, Add Workout page, workout/exercise cards, set controls, charts and timer.
- Dynamic Type without globally disabled scaling; keyboard/focus and hardware keyboard behavior.
- Reduce Motion/Increase Contrast, haptic/sound accessibility, and sufficiently large targets.
- Dark-only appearance matches the Equilibrium reference; there is no light/system appearance setting, while semantic colors and accessibility contrast remain correct.
- Native sheet/popover behavior across supported iPhone/iPad sizes and orientations selected for v1.
- Time-zone/DST/date boundary, background/foreground, memory, launch time and large-history performance tests.

### Privacy and submission

- Privacy manifest and Required Reason API review for app and Supabase dependency.
- App Privacy answers match account identifiers, workout data and diagnostics actually collected.
- Permissions audit shows no camera/photo/motion/HIIT/obsolete notification/Live Activity capability. Request notification permission only if approved timer behavior requires it.
- Account deletion/support/privacy policy obligations reviewed for Supabase accounts.
- No development/prototype/import-debug screens in production.
- TestFlight internal then external validation, crash/log review, StoreKit/App Store Connect metadata, export compliance and final archive validation.

Release requires a signed checklist and an exercised rollback plan, not merely a successful archive.

## 16. Questions requiring decisions

No product-scope decision remains before Phase 0 or creation of the SwiftUI project.

One external technical verification remains: confirm that `com.tsunamichi.equilibrium` is available and can be configured with the required Apple Developer team, Sign in with Apple capability, App Store Connect record and Supabase Apple provider. If unavailable, select a verified Equilibrium-specific identifier without reopening the product identity or migration architecture.

## Locked v1 decisions

| Decision | v1 choice |
|---|---|
| Framework | Native SwiftUI |
| Minimum iOS | iOS 18 |
| Platform | iOS only |
| Product identity | Equilibrium; planned bundle ID `com.tsunamichi.equilibrium`, pending external availability verification |
| Navigation | No tab bar |
| Workout structure | One ordered exercise list |
| Exercise targets | Repetitions + duration; prescription-owned semantics |
| Catalog metadata | Preserve aliases, equipment, category, and custom/system status |
| Home | Workout of the day |
| Home scope | Current local day only |
| Home workouts | Zero or more, in stable deterministic carousel order |
| Date navigation | None on Home |
| Completed workout | Remains in today's carousel; canonical history thereafter |
| Empty day | Add Workout; no Rest Day state |
| Add Workout | Create from scratch / Paste workout / Use recent workout |
| Use recent workout | Multi-select previous completed workouts in tap order |
| Execution eligibility | Current local day only |
| Timer | Simple rest/duration timer |
| Warmup/Core/Accessories | Removed as domains |
| HIIT | Removed |
| Progress tab | Removed |
| Body weight | Removed |
| Progress photos | Removed |
| Appearance | Dark only |
| Authentication | Optional; available in Settings |
| Local guest data | Persistent in SwiftData across relaunch |
| Local authority | SwiftData database |
| Cloud | Supabase Cloud Backup/Restore, not multi-device synchronization |
| iCloud backup | Removed |
| Plans | Current `CyclePlan` behavior only; canonical `planID` |
| AI | No AI in v1; current deterministic local parser is Paste workout |
| RN history | One-time development/TestFlight JSON migration with deterministic reconciliation |
| Legacy importer | Excluded from production App Store target after validated cutover unless actual users require it |
| RN app | Frozen behavioral/migration/rollback reference, then archived; no Android/web maintenance |
