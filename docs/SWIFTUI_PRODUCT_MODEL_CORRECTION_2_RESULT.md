# SwiftUI Product Model Correction 2 — Result

Date: 2026-08-22

Scope: native Product Model Correction 2 only. Phase 4 History UI, charts, Plans, Progression, full Timer, Supabase/authentication, RN importer, and visual polish were not started. The React Native source remained unchanged.

## Result

### Add Workout navigation

The final Home carousel page remains the Add Workout page, but it is now the navigation hub itself. Its three buttons launch Create from scratch, Paste workout, and Use recent workout directly. The redundant modal menu containing the same three actions was removed.

### Lightweight Builder

The Builder now contains only the workout title, ordered exercise rows, Add exercise, delete/reorder behavior, and Create workout. The following normal-creation UI was removed:

- per-set cards and add/remove-set controls;
- repetition ranges, suggested weights, duration targets, and rest editors;
- Save reusable template and Existing Workout concepts.

`WorkoutTemplate` and its repository remain canonical internal capabilities for future plan construction and migration compatibility. Home-created workouts do not create or reference a template.

### Personal exercise vocabulary

`ExerciseDefinition` now means stable identity in the user's accumulated vocabulary. It is not a curated/system library. `AppEnvironment` no longer inserts fixture exercises when an empty production database starts, so a new account legitimately has zero definitions.

Exercise search matches personal normalized names and aliases only. Equipment/category are not searched or shown, and inline creation requires only a nonblank name. Repository normalization protects against duplicate names and aliases. Existing optional equipment/category fields remain for backup/RN migration compatibility.

Search rows request canonical latest performance and display the final completed working set with date, such as `160 lb × 8 · Aug 18`. A missing exact normalized result exposes `Create "<query>"` in the search list and returns the new definition directly to Builder.

### Canonical latest-history query

One reusable `ExerciseHistoryRepository.latestExerciseLog(exerciseID:)` query owns carry-forward selection. It reads only:

```text
ScheduledWorkout
→ ScheduledExercise
→ LoggedSet
```

Precedence is deterministic:

1. include only `WorkoutStatus.completed` workouts;
2. require at least one completed logged set for the requested `ExerciseID`;
3. if the same exercise occurs more than once in a workout, use its last ordered occurrence;
4. order occurrences by `completedAt`, falling back to `updatedAt` only for a legacy completed record;
5. break an equal timestamp tie by stable workout ID descending;
6. return completed logs in prescription order.

Planned/in-progress/abandoned partial work never seeds a future workout. No sessions, progress dictionaries, or PR records are queried.

### Inheritance and new exercises

When Builder commits, every known exercise is independently resolved against the newest canonical exercise log at that moment. Each completed historical working set becomes one fresh `SetPrescription`; actual reps/duration and actual weight are preserved per set. Differing sets remain differing sets. No averaging or progression is applied.

All new scheduled workout, exercise, prescription, and eventual log identities are fresh. Historical logged state, `LoggedSetID`, completion timestamps, scheduled IDs, and skipped state are never copied.

An exercise without completed history starts with an empty prescription list and empty logged-set list. The UI presents no previous values; it does not manufacture a completed `0 × 0` set.

### Execution-time set mutation and completion

The existing canonical structure was evolved without another persistent working-set store:

- inherited history is represented by fresh prescription slots;
- Log first set transactionally appends the first fresh prescription and logs it;
- Add set appends a fresh slot, carrying forward the preceding slot's target/suggested value as RN does;
- updating an existing logged set retains its `LoggedSetID`;
- an unlogged set can be removed; completed logs cannot be silently removed.

Completion is centralized in `WorkoutExecutionQuery` and `DomainValidator`. An unskipped exercise with zero prescriptions is explicitly incomplete. Inherited exercises complete when every prescribed slot has a valid completed log. A zero-history exercise becomes complete only after an actual first set exists and is logged. Progress counts an empty, unskipped exercise as one outstanding unit instead of reporting vacuous completion.

### Clipboard Paste

Tapping Paste workout reads `UIPasteboard` immediately and runs the deterministic parser. One valid parsed workout resolves known names automatically and opens the same lightweight Builder without a second paste tap or dedicated match/review ceremony.

Empty clipboard, unavailable text, invalid content, blocking parser issues, or multi-workout content opens the existing lightweight text editor as fallback with an explanation. Corrected valid text then goes directly to Builder.

Known names become canonical IDs. Unknown pasted names become transient draft rows with `exerciseID == nil`; they are normalized/resolved or created only when Create workout commits. Cancelling Paste/Builder therefore does not pollute the personal vocabulary.

### Recent workouts

Recent multi-select and tap ordering remain intact. Selected workout title, exercise identities, names, and order define each new workout structure. Every exercise is then seeded independently through `latestExerciseLog`, even if that latest performance belongs to a newer different workout. New workout/exercise/prescription IDs are generated, while logs and completion state remain empty.

### Migration plan

`SWIFTUI_V1_MIGRATION_PLAN.md` now locks the personal-vocabulary model, zero production catalog, title-plus-exercise Builder, canonical latest-history precedence, execution-owned set mutation, zero-history completion rule, direct clipboard flow/fallback, transient unknown paste strategy, recent latest-history seeding, and internal-only template role.

## Tests

Existing valid persistence, backup, scheduling, execution, import-parser, and template-boundary tests were retained. Rejected Builder assumptions were updated. `ProductModelCorrection2Tests` adds coverage for:

- zero production definitions;
- name-only exercise creation/search and normalized duplicate protection;
- newest completed occurrence selection while ignoring a newer in-progress occurrence;
- actual ordered set count/weight/reps context;
- known-history inheritance, empty new exercise state, no fake logs, and fresh child IDs;
- non-vacuous zero-history completion;
- first-set creation, add-set fresh identity, logged-set identity retention;
- transient Paste unknowns and automatic known resolution;
- Recent structure preservation with newer per-exercise performance seeding.

Clipboard screen routing is implemented in the SwiftUI adapter; parser and transient-draft behavior are covered at the deterministic boundary. Manual clipboard permission/availability behavior remains an on-device validation item.

## Design-system audit

This correction primarily removed UI. New UI uses existing `EQTypography`, `EQColor`, `EQSpacing`, `EQDimension`, and `EQRadius` tokens. No repeated hardcoded font, color, spacing, radius, dimension, or motion values were introduced. Date formatting and canonical unit conversion use Foundation and existing `WeightText` behavior.

## React Native files inspected

- `src/screens/TodayScreen.tsx`
- `src/screens/WorkoutBuilderScreen.tsx`
- `src/screens/ExerciseExecutionScreen.tsx`
- `src/components/workoutBuilder/ExerciseSearchPickModal.tsx`
- `src/components/exploreV2/ExploreV2CurrentCard.tsx`
- `src/components/exploreV2/ExploreV2CompletedExerciseEditor.tsx`
- `src/utils/workoutBuilderPaste.ts`
- `src/utils/getLatestExerciseLog.ts`
- `src/utils/lastExerciseRecord.ts`
- `src/utils/personalExerciseCatalog.ts`

RN observations retained: personal/history-oriented exercise context, clipboard-to-builder parsing, set-order carry-forward, Add set copying the prior round, revisiting a logged set, and Add/Remove controls in Explore V2. Legacy RN sessions/detailed progress are not copied into the native runtime query.

## Build and launch validation

- `xcodegen generate`: succeeded; new tests are included in the Xcode project.
- `xcodebuild ... build CODE_SIGNING_ALLOWED=NO`: succeeded for the iOS Simulator SDK.
- `xcodebuild test -project Equilibrium.xcodeproj -scheme Equilibrium -destination 'platform=iOS Simulator,name=iPhone 17 Pro' CODE_SIGNING_ALLOWED=NO`: succeeded; 63 tests, 0 failures.
- The built app installed and launched successfully on the booted iPhone 16 Pro simulator as PID 80252 (`com.tsunamichi.equilibrium`). Automated tests validate the canonical manual path; real clipboard interaction and the full gesture/keyboard path still require human device interaction.
- `git diff --check`: clean. `git status --short` contains only the native source/test/project/document changes listed by this correction.
- `git diff --name-only -- src`: empty; RN source unchanged.

## Remaining creation parity differences

- The native deterministic parser still accepts the structured Phase 3B grammar; RN's looser name-only paste heuristics accept more free-form lines. The native fallback editor exposes unsupported input safely instead of guessing.
- Multi-workout clipboard blobs fall back to the editor because the corrected lightweight Builder creates one workout at a time. Recent remains the multi-create path.
- The current native execution removal policy permits removing only unlogged slots. RN exposes broader completed-exercise editing; deleting completed canonical history was intentionally not inferred for this correction.
- Visual polish and pixel parity remain deferred. The requested functional manual path should still be exercised on a physical device for real clipboard behavior.

Phase 4 was not started.
