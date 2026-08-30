# RN to Native Import Result

## Scope and source audit

The frozen React Native input was audited at commit `19c56a9`. The native SwiftUI domain remains authoritative. Import is local-only and CloudKit remains explicitly disabled.

The frozen app persisted independent JSON values in AsyncStorage. Two full-snapshot containers preserve those values:

- iOS backup file `workout_tracker_backup.json`, written below the RN app's iCloud application-support directory. Its root contains metadata plus parsed AsyncStorage keys.
- Supabase `user_backups.data`, version `2.0`, containing the same parsed AsyncStorage keys below `data` plus `_meta`. The native importer accepts an exported copy of that JSON but never contacts Supabase.

The frozen app also exposes a shareable `workout-history-<range>.json`, but that presentation export omits stable exercise IDs, complete set semantics, settings, progression, timers, and much history by default. It is intentionally not accepted as a canonical migration source.

### Retained AsyncStorage sources

| RN key | Frozen shape | Native destination |
|---|---|---|
| `@workout_tracker_exercises` | `Exercise[]` | `ExerciseDefinitionRecord` |
| `@workout_tracker_scheduled_workouts` | `ScheduledWorkout[]` with main snapshots/lifecycle | Canonical `Workout` graph |
| `@workout_tracker_detailed_progress` | workout-keyed exercise/set progress | Prescriptions and logged sets for scheduled workouts |
| `@workout_tracker_sessions` | older flat `WorkoutSession[]` and `WorkoutSet[]` | Completed workout fallback when not represented by a scheduled workout |
| `@workout_tracker_workout_templates` | reusable templates | Lookup only for missing session title/snapshot context; templates are not persisted natively |
| `@workout_tracker_settings` | `AppSettings` | Native weight unit and validated default rest duration |
| `@workout_tracker_progression_groups` | generic progression groups | Read only to map exact current profiles |
| `@workout_tracker_progression_rules` | generic per-exercise rules | Read only to map exact current profiles |
| `@workout_tracker_progression_defaults` | generic defaults | Conservative fallback during profile mapping only |
| `@workout_tracker_hiit_timers` | `HIITTimer[]` | Saved standalone timer records |

`workoutProgress` is a coarser completion index and is not used when detailed progress exists. The modern retained source is scheduled workout snapshot plus detailed progress. A scheduled lookup checks both the scheduled workout ID and the older `templateId-date` key form.

Weights in RN exercise progress, sessions, templates, and progression rules are already stored internally in pounds. `useKg` only controlled display conversion, so imported weights are not converted a second time.

## Source to destination mapping

```text
RN full AsyncStorage snapshot
  -> isolated RNLegacy DTOs
  -> RNLegacyTransformer
  -> native ExerciseDefinition / Workout graph / settings / profiles / timers
  -> one SwiftData transaction
  -> LegacyImportReceiptRecord
```

Legacy DTOs and decoding live exclusively under `Equilibrium/Migration/LegacyImport`. Production workout, history, progression, and timer features have no dependency on them.

The transformer produces canonical domain objects and validates every workout with `DomainValidator`. Imported history is consumed by the existing History, Exercise Performance, PR, trend, Previous Performance, and progression queries without migration-specific query paths.

## Exercise identity

RN catalog `Exercise.id` is the historical authority. The native logical ID is deterministically namespaced as `rn-exercise:<source-id>`. Every scheduled snapshot, detailed progress entry, and legacy session reference uses that mapping. Names are never used to merge history.

User-facing catalog names, canonical normalized names, aliases, category, equipment, custom status, and archive timestamp are retained where available. Workout occurrences preserve `nameSnapshot`, so a renamed catalog exercise keeps its historical name while all occurrences still share one native `ExerciseID`.

Duplicate source exercise IDs resolve deterministically by source creation timestamp, name, and canonical name. Missing referenced catalog entries produce one deterministic custom placeholder keyed by the stronger source exercise ID. Ambiguous names do not merge IDs.

## Completed history

Completed scheduled workouts become native `.completed` workouts using:

- `titleSnapshot` for title.
- `startedAt` and `completedAt` for actual lifecycle timestamps.
- `exercisesSnapshot.order` for exercise ordering.
- Template item ID plus source workout ID and positions for deterministic occurrence/set IDs.
- Detailed completed set values as authoritative logs.
- Snapshot target sets/reps only for prescription reconstruction.
- `isTimeBased`, `isPerSide`, and validated `restSeconds` for current occurrence semantics.

For duration exercises, RN `SetProgress.reps` represented seconds and becomes native duration. Nonpositive weight is treated as absent, not fabricated as zero. Completed workouts retain only completed progress as required prescriptions; skipped/no-log occurrences are marked skipped so the native completed graph remains valid.

Legacy sessions are imported only when their `workoutTemplateId + date` is not already represented by an imported scheduled workout. Their flat completed sets are grouped in first-seen exercise order. Session IDs and set IDs participate in deterministic native IDs. Legacy sessions do not contain duration/two-sided/rest snapshot fields, so those semantics cannot be reconstructed from that fallback format.

## Incomplete workouts

Only RN scheduled workouts explicitly persisted as `in_progress` are imported into native Home. Planned scheduling entries are discarded because a plan/calendar date is not a native ready-workout intent and importing a whole future schedule would recreate removed semantics.

An in-progress workout retains its usable snapshot, logged completed sets, uncompleted prescriptions, order, rest override, time/two-sided flags, and start timestamp. It remains `.inProgress`; it is never promoted to History. Cycle/program/date metadata is discarded.

## Progression and settings

Direct catalog `defaultProgressionType` maps as follows:

- `main_upper` -> Upper
- `main_lower` -> Lower
- `accessory` -> Accessories
- `none` -> None

Otherwise the resolved legacy rule/group/default maps only when its range and pound increment exactly match a native profile: 5–8/+2.5 to Upper, 5–8/+5 to Lower, or 10–20/+2.5 to Accessories. Anything else maps to None. Generic groups, modes, overrides, and defaults are not persisted.

`useKg` becomes the native display weight unit. `restTimerDefaultSeconds` is accepted only when it satisfies the native 15–300 second, whole, five-second increment validator; otherwise the native 90-second default is used. Removed notification, AI, appearance, schedule, and progress preferences are ignored.

## Timers

Only `HIITTimer.isTemplate != false` entries are imported. ID, name, work duration, between-exercise rest, exercises per round, rounds, round rest, and creation time map directly to the native saved timer configuration. Invalid timer ranges are skipped. Runtime timer state and `@workout_tracker_hiit_timer_sessions` are not migrated.

## Deliberately discarded data

The importer does not recreate cycles, cycle plans, workout assignments, reusable templates, scheduled dates, warmup/accessory/core sections, bonus logs, body-weight/progress-photo products, Progress tab ordering/state, coarse completion mirrors, separate PR records, trainer conversations, AI settings, session summaries, or timer run history.

Separate RN PR data is ignored because native PRs and trends derive from canonical logged sets. Scheduled dates are never copied into a native scheduling field.

## Idempotency and duplicate policy

The SHA-256 digest of the selected file is stored in `LegacyImportReceiptRecord` only after successful persistence. Selecting the exact file again returns `alreadyImported`; relaunch reads the persisted receipt and behaves identically.

Native IDs are deterministic and namespaced from source identifiers. If the same semantic export is reserialized and therefore has a different digest, existing exercise/workout/timer logical IDs are skipped rather than duplicated. Duplicate source workout/session/template IDs select the newest durable source timestamp and then stable content fields. Generated child IDs include source workout, occurrence position/item ID, and set position/source set ID.

Existing native data is supported. The importer inserts only missing namespaced logical IDs and does not replace unrelated native records.

## Atomicity, errors, and recovery

The flow is decode, transform, validate every native graph, insert all missing records and settings/profile/timer rows, insert receipt, then call one `ModelContext.save()`. A decode or validation failure occurs before insertion. A persistence failure rolls the context back. No failed attempt creates a receipt, so the same or corrected file can be retried.

Malformed elements in legacy arrays are omitted by lossy DTO-array decoding. A workout that cannot produce a trustworthy valid graph is skipped and counted. Corrupt top-level JSON or corrupt core keyed progress fails the import rather than guessing. The source file is read-only and never moved, edited, or deleted.

## Import UX and source limitation

Settings -> Migration -> Import React Native backup presents the system JSON file picker. The importer accepts:

1. A full `workout_tracker_backup.json` object.
2. An exported Supabase row/object with the AsyncStorage snapshot nested below `data`.

No Supabase credentials or backend calls exist. The frozen RN app did not expose its complete backup through its normal history-share screen; obtaining the full file may require copying the existing RN iCloud backup or exporting the user's Supabase data outside this app. The importer intentionally does not weaken identity/history correctness to accept the lossy history presentation export.

## Fixtures and performance

`fixtures/react-native-migration/retained-v2-backup.json` represents the exact frozen keys and includes completed and active workouts, repeated/renamed identities, weighted/unweighted/duration/two-sided sets, a custom archived exercise, kg settings, progression profiles, a saved timer, obsolete keys, and a malformed catalog element.

The Debug scale fixture is 667,899 bytes and imports 1,000 completed workouts with 3,000 logged sets in one transaction. On the iPhone 16 Pro / iOS 26.2 simulator repeated measured imports were approximately 0.83–0.86 seconds. This is adequate for likely personal-user histories without a second batching/checkpoint system or additional in-memory graph copies.

## Cloud boundary

CloudKit remains `cloudKitDatabase: .none`. No iCloud capability/container, entitlements, synchronization, Supabase client/call, authentication, or release-hardening work was added. A later cloud phase can synchronize the already-native canonical result.
