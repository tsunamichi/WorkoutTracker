# SwiftData CloudKit Readiness Result

## Scope

This phase refactors canonical local persistence for eventual managed SwiftData/private CloudKit synchronization. CloudKit remains disabled with `cloudKitDatabase: .none`. No capability, entitlement, container, authentication, Supabase integration, or RN import was added.

## Final persisted models

- `ExerciseDefinitionRecord`: stable logical `id`, definition fields, archive state, and `updatedAt`.
- `WorkoutRecord`: stable logical `id`, lifecycle/snapshot timestamps, and an optional explicitly-inversed exercise relationship.
- `WorkoutExerciseRecord`: stable logical `id`, definition reference/snapshot, explicit position, execution flags, `updatedAt`, optional parent, prescriptions, and logged sets.
- `PrescriptionRecord`: stable logical `id`, explicit position, target fields, suggestion, `updatedAt`, and optional parent.
- `LoggedSetRecord`: stable logical `id`, optional logical prescription reference, explicit position, logged values, completion, `updatedAt`, and optional parent.
- `SettingValueRecord`: independently versioned canonical setting key/value.
- `ProgressionAssignmentRecord`: independently versioned ExerciseID-to-profile assignment.
- `StandaloneTimerConfigurationRecord`: stable timer ID, durable configuration, creation/update timestamps.
- `BackupCollectionRecord`: stable metadata key, backup payload, and update timestamp.
- `AppConfigurationRecord`: retained only as a pre-release read compatibility bridge. New writes do not use its opaque blobs.

No persisted model uses a SwiftData unique constraint.

## Logical identity and duplicate resolution

Domain IDs remain canonical string identity and are never replaced during reconciliation. Reads group records by logical ID/key and select the record with the newest durable `updatedAt`. Equal timestamps use the persistent model identifier as a stable deterministic tie-breaker. Reads do not delete losing duplicates or merge exercise history by name.

Create/restore commands still reject locally known duplicate identities. Duplicate records that may eventually arrive asynchronously remain readable and non-destructive. Exercise normalized-name uniqueness is a soft creation invariant; `ExerciseID`, not name, owns history.

## Relationship strategy

All model relationships are optional. To-many ownership relationships declare explicit inverses and retain cascade behavior for deliberate local parent deletion. Ordering remains scalar `position` ordering rather than relationship-array ordering.

Domain mapping accepts a parent with missing children, an unresolved child parent, missing prescriptions, and logged sets whose logical prescription has not arrived. Invalid/incomplete prescription rows are temporarily omitted from presentation. Reads never perform destructive repair.

## In-place workout mutation

Workout commands no longer delete and recreate the whole child graph.

- Start/complete update only lifecycle fields.
- Logging/editing updates one existing logged-set row or inserts one new row.
- Carry-forward updates only affected prescription rows.
- Add Set inserts one prescription.
- Remove Set deletes only the eligible prescription and its incomplete matching log, then repositions siblings.
- Rest duration updates one workout-exercise row.
- Reset deletes only logged-set progress and clears skip state.
- Generic occurrence changes reconcile stable WorkoutExercise, Prescription, and LoggedSet IDs in place. Swap deliberately reconciles the changed occurrence while preserving its stable occurrence identity.

## Configuration persistence

Weight unit, default rest duration, and progression-enabled state are separate keyed records. Progression assignments are separate per-ExerciseID records. A change in one category cannot rewrite a stale blob from another category.

Only the locked simple progression model is persisted: enabled state and None/Upper/Lower/Accessories assignments. Obsolete generic defaults, groups, and overrides are not written. The old opaque configuration entity remains temporarily readable for pre-release local conversion.

`@AppStorage` is no longer a competing weight-unit persistence source. Canonical settings are loaded through `SettingsRepository` and passed to presentation features.

## Saved timer migration

Saved standalone timers now use SwiftData. Create, edit, delete, ordering, stable identity, and navigation behavior are unchanged. Runtime phase/countdown state remains transient.

`SwiftDataStandaloneTimerStore` performs a one-time pre-release conversion from the previous `UserDefaults` array and marks that conversion complete. It does not repeatedly re-import later legacy values.

## Backup changes

Backup schema version 2 remains decode-compatible and now has an optional-on-decode `timers` collection. Old v2 documents decode with an empty timer list.

Export uses an unfiltered canonical exercise-definition query, so archived definitions needed by historical workout references are included. UI exercise queries continue to exclude archived definitions. Restore includes timers and the granular settings/progression model.

## Validation coverage

CloudKit-readiness tests simulate duplicate logical workout/exercise/settings records, partial parent graphs, unresolved child parents, logs awaiting prescriptions, fine-grained set edits, sibling-preserving removal, archived-definition backup restoration, timer backup restoration, and one-time timer conversion. Existing product suites cover queue, creation/import, execution, progression, history/performance, units, timers, and backup behavior.

## Remaining blockers before enabling CloudKit

- Add the iCloud/CloudKit and remote-notification capabilities only in a later authorized phase.
- Create and select a private CloudKit container only after schema review.
- Exercise true multi-device import/conflict behavior in a development CloudKit environment.
- Decide whether completed-history deletion needs soft tombstones before remote deletion is possible.
- Add observation of remote persistent-history changes so visible settings and screens refresh while open.
- Validate iCloud signed-out, restricted, quota, account-switch, offline, and production-environment behavior.
- Review and freeze record/field names before any schema promotion; production CloudKit evolution is additive.
