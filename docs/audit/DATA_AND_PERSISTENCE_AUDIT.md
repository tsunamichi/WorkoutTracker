# Data and persistence audit

## Persistence mechanisms

The main store explicitly loads/saves AsyncStorage through `src/storage/index.ts`. `useStore.initialize` first runs old-key migration and conditional iCloud restore, loads every collection, performs catalog/data repairs, then initializes both iCloud backup and Supabase sync. Supabase auth also stores its session in AsyncStorage. There is no SecureStore/keychain use.

Supabase `cloudSync.ts` uploads every AsyncStorage key except keys beginning `sb-` into one `user_backups.data JSONB` blob. Restore writes keys without clearing absent local keys. `cloudBackup.ts` separately snapshots every AsyncStorage key (including, unlike Supabase filter, potentially auth keys) into iCloud `Documents/workout-tracker-backup.json`. Consequently even “unused” local keys can remain user data in backups.

## Main AsyncStorage inventory

| Key / shape | Current writer and reader | Needed / legacy | Data-loss and migration assessment |
|---|---|---|---|
| `@workout_tracker_exercises`: `Exercise[]` | store catalog actions/migrations; builders/execution/progress | Current canonical catalog, with compatibility normalization | Deletion loses custom exercises and identity links; migration required for any schema change. |
| `@workout_tracker_workout_templates`: `training.WorkoutTemplate[]` | builder, AI/manual cycle, editors; Schedule/execution | Current, but sectioned and mixed historical item shapes | Deletion loses reusable workouts/plans’ targets. Unification requires mapping `warmupItems/items/accessoryItems` in order. |
| `@workout_tracker_scheduled_workouts`: `ScheduledWorkout[]` | scheduling/cycle/execution/completion; Today/history | Current central schedule/log snapshot | High-value user history. Migrate warmup/accessory snapshots, section completions, `mainCompletion`, deprecated `cyclePlanId`, and `programId`. |
| `@workout_tracker_detailed_progress`: `Record<workoutKey, WorkoutProgress>` | execution; history/progress/recovery | Current detailed set logs, though duplicate | Deletion loses logged weights/reps and incomplete workouts. Must merge into chosen canonical logs. |
| `@workout_tracker_workout_progress`: completed arrays/map | execution/store recovery | Compatibility/duplicate but still written | May be only completion evidence for older workouts; migrate/reconcile before removal. |
| `@workout_tracker_sessions`: `WorkoutSession[]` | completion/recovery; history/PR/lift progress | Old log representation still active | High-value completed-set history; dedupe against detailed/scheduled data before migration. |
| `@workout_tracker_exercise_prs`: `ExercisePR[]` | execution PR updater; LiftHistory | Active but derivable | Deletion may remove displayed PRs, especially if source logs incomplete. Recompute migration required. |
| `@workout_tracker_cycles`: old `Cycle[]` | old store actions/init/screens | Legacy generation | Could contain user-authored programs; convert before removal. |
| `@workout_tracker_assignments`: `WorkoutAssignment[]` | old assignment/recovery/swap logic | Legacy but active code | Could encode historical/current scheduling absent elsewhere. Compare/convert to ScheduledWorkout. |
| `@workout_tracker_cycle_plans`: `CyclePlan[]` | current plan builders/control | Current | Deletion loses plans. Schema cleanup must preserve mappings, lifecycle and share source. |
| `@workout_tracker_body_weight`: entries | Progress Home/history store actions | Retained current user data; UI unreachable | Deletion loses check-ins. Preserve regardless of current reachability. |
| `@workout_tracker_progress_photos`: `{imageUri,...}[]` | Progress Home/PhotoViewer | Retained; UI unreachable | Deleting records loses index, but image files may remain. URI validity across restore/device is not guaranteed. |
| `@workout_tracker_pinned_key_lifts`: ids | Progress Home/EditKeyLifts | Retained; UI unreachable | Low-volume preference; IDs need exercise migration. |
| `@workout_tracker_settings`: `AppSettings` | main store/Profile/theme/execution | Current plus legacy fields | Includes API key, goals/personality, avatar URI, notification flags, progression and catalog migration markers. Field migrations/default merge required; API key in AsyncStorage/cloud is a security concern. |
| `@workout_tracker_conversations`: trainer conversations | store actions only | Likely legacy | User conversation text; explicitly migrate/export or obtain deletion consent. |
| `@workout_tracker_hiit_timers`, `...hiit_timer_sessions` | HIIT screens/store | Current reachable | Deletion loses templates/history. Product decision and export/migration required. |
| `@workout_tracker_warmup_presets`, `...core_presets` | bonus/edit/core paths | Active old domain | User-authored exercise routines; unify/convert rather than discard if feature removed. |
| `@workout_tracker_bonus_logs` | bonus/HIIT/execution | Active | Historical bonus completion; migrate if bonus becomes workout exercise data. |
| `@workout_tracker_core_programs`, `...core_logs` | Core Program/store | Active | Program history/pointer; high semantic migration risk. |
| `@workout_tracker_warmup_completion_by_key`, `...accessory_completion_by_key` | fallback execution APIs | Active fallback/compatibility | May be sole completion state for bonus/standalone keys. Fold only after key-to-log mapping. |
| `@workout_tracker_progression_groups`, `...rules`, `...defaults` | Profile progression screens/execution suggestions | Current | Preserve user rules; exercise IDs need referential validation. |

## Other AsyncStorage keys

| Key | Behavior / assessment |
|---|---|
| `@app/onboardingState` | Old onboarding auth/prefs/draft/completion. Written by unreachable `useOnboardingStore`; never hydrated by root. Legacy user draft data. |
| `@app/cycles` | Old `SavedCycle[]` + active ID for onboarding generation. Distinct from `@workout_tracker_cycles`; legacy user plans. |
| `@app/guestMode` | Written by `RootNavigator` guest continuation, never read. Safe schema candidate after confirming no released version reads it; no meaningful user content. |
| `lastFatalJsError` | `App.tsx` writes message/stack/time on fatal JS errors; UI only tells user it was saved, with no reader/exporter. Diagnostic data uploaded by both backup systems. Consider privacy/retention. |
| Supabase `sb-*` auth keys | Written/read by Supabase client adapter. Excluded from Supabase backups, but iCloud service currently enumerates all keys. Authentication session is sensitive. |
| old unprefixed keys | `dataMigration.OLD_KEY_MAPPINGS` recognizes sessions/templates/plans/scheduled/exercises/progress variants and copies them if new data is empty. It does not delete originals; backup continues to upload them. |

No SecureStore, Keychain, SQLite, Realm or MMKV usage was found.

## Section and old-format structures requiring migration

- Template: `warmupItems`, `items`, `accessoryItems` (`training.WorkoutTemplate`).
- Scheduled snapshot: `warmupSnapshot`, `exercisesSnapshot`, `accessorySnapshot`; embedded `warmupCompletion`, optional `mainCompletion`, `workoutCompletion`, `accessoryCompletion`.
- Fallback section completion maps by workout key.
- Bonus exercise payloads use unified-ish `ExerciseInstanceWithCycle[]` plus `completedItems`; core has separate program/session identities.
- Old warmup objects (`exerciseName`, numeric sets/reps/weight/time flags) coexist with `movementId` + set-array instances. `exerciseMigration.ts`, startup store normalization and execution casts exist solely/partly for this compatibility.
- Old scheduled keys can be `sw-{id}` or `{templateId}-{YYYY-MM-DD}`. Recovery parsing in `dataMigration.ts` explicitly handles legacy keys and skips some scheduled IDs.
- Old cycle generations exist in three local keys/domains; `cyclePlanId` is deprecated in favor of `programId` on scheduled workouts.
- Timers persist only templates and completed sessions. Live execution phase/remaining time/current side are local component state and are lost on kill; `activeHIITTimerId` is memory-only.
- There is no `progressLogs` key. Progress history is fragmented across scheduled workouts, detailed progress, simple progress, sessions, PRs, body weight, photos, progression records and HIIT/core logs.

## Supabase and files

- Tracked schema `supabase-migration.sql` defines only `user_backups(id,user_id,data,version,timestamps)` with RLS ownership policies. Auth uses Supabase Auth/Apple. No normalized workout tables or Storage buckets are referenced.
- `cloudSync.uploadBackup/downloadBackup/getCloudBackupInfo` are reachable. Automatic sync uploads every five minutes only when authenticated.
- Progress photos store picker-returned URIs, not bytes in Supabase or an app bucket. Cloud restore to another device can restore dead local URIs.
- Profile avatar is likewise only `settings.profileAvatarUri`; no current image copy/upload path is evident.
- `cloudBackup.ts` uses FileSystem’s iCloud container path and `workout-tracker-backup.json`; because native directories are ignored and no tracked container entitlement is visible, production capability must be verified on an actual archive.

## Compatibility-only code

`migrateOldStorageKeys`, startup catalog normalization and personal catalog migration, `legacyMigrationExerciseLookup.ts`, `exerciseMigration.ts`, `convertOnboardingCycle.ts`, session recovery/repair functions in `dataMigration.ts` and store, workout-key resolution helpers, `cyclePlanId` alias support, deprecated warmup types, `WarmupExecutionRedirectScreen`, and history builders combining multiple stores all exist wholly or partly to bridge earlier shapes. None should be removed before fixtures from real released backups are tested.

## Questions requiring product decisions

- What is the oldest released/TestFlight data version that v1 must migrate successfully?
- May legacy trainer conversations and API keys be deleted, or must they be exported/migrated?
- Should progress photos sync across devices? If yes, URI-only backup is insufficient and requires file/blob storage policy.
- Is iCloud backup intended to coexist with Supabase, and may it contain auth tokens?
