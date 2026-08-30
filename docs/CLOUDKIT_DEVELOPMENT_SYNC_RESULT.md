# CloudKit Development Sync Result

## Scope and configuration

Equilibrium is configured for managed SwiftData synchronization against the private database of development container `iCloud.com.tsunamichi.equilibrium`.

- The application entitlement declares CloudKit, the container identifier, APNs development, and `Development` as the CloudKit environment.
- The app Info.plist declares the `remote-notification` background mode used by CloudKit imports.
- The live model configuration uses `ModelConfiguration.CloudKitDatabase.private`.
- Unit-test and explicit in-memory containers remain `cloudKitDatabase: .none`; an unsigned XCTest host never contacts CloudKit.
- No Production schema deployment or promotion was performed.

The identifier is configured in the project. This machine has no valid Apple code-signing identity and the project has no development team, so it was not possible to register/verify the container in the Apple Developer account or create its Development schema from a signed device. That portal-side step remains required.

## Local-first startup

The live app first opens the existing named local store with managed CloudKit attached. If that initialization throws, it reopens the same named store locally with CloudKit disabled. It never deletes, replaces, migrates, or restores over the store as cloud recovery. A failure of both configurations still indicates a local persistence failure and remains fatal; cloud account/network/quota state by itself must not cause that outcome.

SwiftData/Core Data normally keeps the local SQLite store available while CloudKit is offline or the account is unavailable. The fallback specifically covers container initialization failures. Startup fallback is unit-tested with existing local data in the fallback container.

## Remote observation and UI refresh

`SwiftDataRepository` observes `NSPersistentStoreRemoteChange` and emits the small app-level `equilibriumRepositoryDidChange` notification. Current screens reload through their repositories:

- Home and canonical settings
- active workout execution
- History and completed-workout detail
- Exercise Performance, PRs, and trends
- units and rest settings
- progression assignments
- saved Timers

This is invalidation, not a claim of exact sync state. Settings displays only an explanatory iCloud section; it does not claim that a particular record is currently synced.

## Identity, duplicates, and conflicts

Logical IDs remain canonical. Managed-store uniqueness is not used. Reads choose the record with the greatest durable `updatedAt`; equal timestamps use persistent model identity as a stable local tie-breaker. Reads do not delete losing records or destructively repair partial graphs.

The automated suite covers duplicate Workout, WorkoutExercise, Prescription, LoggedSet, ExerciseDefinition, per-key settings, per-exercise progression assignment, and saved Timer records. Duplicate child records collapse to one domain-visible value, so duplicate physical records do not produce duplicate History or Performance entries.

Expected conflict behavior:

- Different active-workout sets are separate fine-grained records, so logging Set 1 and changing another prescription can both survive.
- Concurrent edits to the same completed LoggedSet are last-`updatedAt` wins. The visible History value is the deterministic winner; there is no merge UI.
- Weight unit and default rest duration use separate keyed mutations, so one no longer rewrites the other.
- Progression profile changes use one record per ExerciseID and do not save/delete an unrelated assignment collection.
- Timers reconcile duplicate IDs by `updatedAt`. Managed CloudKit deletion-vs-edit behavior still needs physical-device validation before adding any tombstone design.

## Deletion behavior

Local automated policy remains:

- Ready/in-progress workouts may be deleted.
- Completed History rejects deletion and is retained.
- Exercise removal is archival; the canonical ExerciseDefinition and historical references remain.
- Timer deletion removes every local record with that logical Timer ID.

Actual managed CloudKit deletion propagation, edit/delete races, and resurrection behavior could not be exercised without a signed development container. No tombstone infrastructure was added. If two-device testing demonstrates resurrection or history loss, that concrete behavior must be reviewed before designing tombstones.

## RN import and backup

The RN importer remains local-only: RN backup file → validated canonical SwiftData records → ordinary managed CloudKit export. It contains no CloudKit upload code. Existing receipt/source-ID idempotency tests verify one materialization across reopen; the second-device delivery portion requires signed two-device QA.

Backup v2 remains independent. Manual restore refuses a nonempty canonical store, which prevents automatically restoring over downloaded cloud data. A future merge/replace UX for restore into an already-synced store is a product decision; no destructive behavior was introduced.

## Two-device Development QA checklist

Use two physical Apple devices (preferred) or supported simulators, signed into the same development iCloud account, with a development-signed build. Record wall-clock delay for each step; CloudKit is eventual, not transactional.

1. Start with both devices online. Create a workout on A; verify it appears once on B.
2. Log Set 1 on A while changing a different unlogged set on B; verify both values converge.
3. Complete on A; verify it leaves Home and appears once in History on B.
4. Correct the same completed set on both devices at distinct times; verify the later `updatedAt` value wins on both.
5. Verify Performance, PR, trends, and Previous Performance from the received history.
6. Assign exercise A on device A and exercise B on device B; verify both progression assignments survive.
7. Change weight unit on A and default rest on B; verify both survive.
8. Create, edit, and delete saved Timers across devices. Specifically look for edit/delete resurrection.
9. Archive an exercise; verify historical History/Performance remains and the active picker excludes it.
10. Delete an incomplete workout; verify propagation. Confirm completed History has no deletion path.
11. Import an RN backup on A; verify workouts, exercises, timers, and one receipt arrive once on B. Relaunch both and verify no duplicate visible history.
12. Repeat representative writes while offline, then return online and record convergence delay.
13. Sign out, relaunch, create/use local workouts, sign back in, and verify local data survives and later converges.
14. Exercise restricted/unavailable account and account-change states. Preserve a separate manual backup before account-change testing and verify no local deletion at every transition.

No two-device observations or synchronization-delay measurements are claimed in this result because the required signed development account/container was unavailable on this machine.

## Remaining blockers before Production schema promotion

- Register/verify `iCloud.com.tsunamichi.equilibrium` under the intended Apple Developer team and obtain development provisioning.
- Launch a development-signed build to create and inspect the Development schema.
- Complete the two-device checklist, including offline/account-change and deletion/edit races.
- Verify RN-import convergence and receipt behavior on the second device.
- Inspect Development CloudKit Console record types/indexes and test realistic retained stores before freezing schema names.
- Decide manual backup merge/replace behavior for a nonempty synced store.
- Resolve any demonstrated Timer/workout deletion resurrection before considering tombstones.
- Only after those gates, explicitly deploy the tested schema to Production. This phase did not do so.
