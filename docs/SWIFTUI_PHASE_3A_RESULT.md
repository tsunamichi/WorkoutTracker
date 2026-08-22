# Equilibrium SwiftUI Phase 3A result

Date: 2026-08-22

## Result

Phase 3A implements the native workout-creation foundation only. Schedule now opens real Blank, Existing, and Recent Workout flows; each leads to a transient SwiftUI Builder and creates a canonical frozen `ScheduledWorkout` that opens through the Phase 2 execution route. Import Plan remains visible and disabled for Phase 3B. No Plans, full History, Progression, timer, authentication, Supabase, network, AI, or RN migration work was added, and the frozen RN source is unchanged.

## Persistence architecture

`SwiftDataRepository` now conforms to `ExerciseRepository` using queryable `ExerciseDefinitionRecord` rows. It supports active listing, normalized name/alias/equipment/category search, ID fetch, create/update, and archive. Normalization folds case and diacritics, removes punctuation boundaries, and collapses whitespace. Custom creation rejects a normalized name colliding with another canonical name or alias and retains stable `ExerciseID`. Records retain name, normalized name, aliases, equipment, category, custom/system state, and archive timestamp; they contain no measurement or execution semantics. A fresh production container seeds the small canonical system fixture catalog when empty, allowing native-only first use without a large catalog service.

Queryable `WorkoutTemplateRecord`, `TemplateExerciseRecord`, and `TemplatePrescriptionRecord` models replace template metadata persistence. Explicit positions restore exercise and set ordering. Cascades stay inside the template aggregate. Save/update and archive commands are repository-owned; template child and prescription IDs are checked for uniqueness. Scheduled records use separate SwiftData models, so no relationship can propagate template edits or deletion into history.

The Phase 0 `BackupCollectionRecord` shortcut now retains only not-yet-normalized CyclePlan, settings, and progression values. Exercises and workout templates are exported from and restored into their real repositories. Scheduled workouts continue using their existing real records.

## Builder and picker

`WorkoutBuilderModel` owns a feature-only `WorkoutDraft` containing a name and ordered `DraftExercise`/`DraftSet` values. It is never inserted into SwiftData, encoded into backup, or saved per keystroke. Cancellation confirms meaningful unsaved changes. Validation requires a nonblank name, at least one exercise, and an actual prescription per exercise.

The Builder supports native list deletion/reordering plus accessible Move Up/Move Down actions, set addition/removal, rep ranges, duration seconds, optional suggested weight, and optional exercise rest seconds. The prescription array is authoritative. Weight uses the existing shared `Weight` conversion and the single Phase 2 `AppStorage` unit source; canonical storage remains pounds. The `AppStorage` to `SettingsRepository` migration remains pending.

Exercise Picker uses native `searchable`, stable canonical selection, metadata labels, and a custom-exercise sheet. Existing Workout queries active templates and opens a reviewable Builder draft. Recent Workout queries canonical completed scheduled workouts newest-first and creates a clean draft. Recent reuse copies frozen prescribed values—not logged values or progression-adjusted values—because Phase 6 owns progression. Logged identity, completion state, scheduled identity, and historical linkage are not copied.

## Save and scheduling semantics

Save creates or updates a reusable `WorkoutTemplate`; Schedule creates a `ScheduledWorkout`. Each conversion generates globally fresh template exercise/set or scheduled exercise/set IDs. A scheduled snapshot owns its title, exercise identity/name snapshots, prescriptions, and rest values. The test sequence Template A → schedule → edit Template A verifies the scheduled instance remains unchanged.

One workout per `LocalDay` remains repository-enforced. A conflict presents explicit replacement confirmation. Replacement is a repository command; planned/in-progress workouts may be replaced, while completed workouts return `immutableCompletedWorkout`. Successful creation publishes the repository result into `ScheduleModel`, dismisses creation, and retains the scheduled ID used by Phase 2 execution. There is no second durable Schedule cache.

## Backup and persistence

`EquilibriumBackupV1` assembly now queries exercises, templates, and scheduled workouts from production records. Restore into an empty container inserts real exercise/template aggregates and scheduled snapshots, retaining Phase 0 metadata only for CyclePlan/settings/progression. Drafts are excluded. Tests cover fresh restore, repository queries, mixed target persistence, ordering, metadata, relaunch, and historical isolation.

## Design system and accessibility audit

Builder and picker code use semantic Equilibrium colors, typography, spacing, radii, and minimum touch dimensions. Touched Schedule literals for 44-point touch height were consolidated to `EQDimension.minimumTouch`; six-point week-stack spacing was consolidated to `EQSpacing.xs`; and Today uses `EQTypography.cardTitle`. No visual tokens were introduced. The pre-existing seven-point calendar marker and fixed week/card geometry remain local component geometry.

Controls use Dynamic Type fonts and scrolling forms/lists, interactive keyboard dismissal, native numeric keyboards, minimum touch heights, descriptive labels, set-number context, non-color errors, searchable metadata, accessible remove labels, and non-drag move actions. Previews cover empty/mixed Builder, rep/duration, large Dynamic Type, Exercise Picker, Existing Workout, and Recent Workout. Custom-exercise and conflict states are reached through their parent previews.

## Tests, build, and launch

The complete suite passes on iPhone 16 Pro (iOS 26.2): 41 tests, 0 failures (the original 36 plus 5 Phase 3A integration tests). Simulator build succeeds for arm64 and x86_64 with Xcode 26.6 / iOS Simulator SDK 26.5.

Automated coverage verifies repository normalization/search/archive/metadata, template update/order/mixed prescriptions/archive, builder validation/mutations/set operations, fresh identities, selected day, conflicts, completed protection, Existing/Recent conversion, snapshot isolation, relaunch, and backup queries. The creation destination publishes scheduled values through the same Schedule model path tested by Phase 2.

The command environment validated compiled creation/execution integration and canonical operations but did not provide reliable interactive VoiceOver/tap automation for the entire hands-on sequence. Final device QA should still exercise keyboard avoidance, VoiceOver traversal, drag behavior, replacement dialogs, and complete visual Blank/Existing/Recent paths at Accessibility sizes.

## Deviations, discoveries, and risks before Phase 3B

- Recent Workout deliberately reuses prescribed targets, not historical logs or progression suggestions.
- Existing Workout routes through Builder for review before scheduling.
- The catalog seed is intentionally tiny; expanding system content is a product-content task.
- Minimal units remain the single Phase 2 `AppStorage` source.
- SwiftData aggregate updates replace child rows while retaining domain IDs; persistence and snapshot tests pass, but future schema migration remains a broader v1 concern.
- Phase 3B can build Import Plan against `WorkoutDraft`, `ExerciseRepository`, and existing scheduling commands without persisting parser drafts or changing history.

No material architecture change required an update to the main migration plan.
