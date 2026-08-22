# Equilibrium SwiftUI Phase 3B result

Date: 2026-08-22

## Result

Phase 3B replaces the disabled Add Workout “Import Plan” row with a native, deterministic, local text-import flow. The path is Schedule → Add Workout → Import Plan → paste/edit → parse → exercise match review → existing `WorkoutDraft` → existing Workout Builder. From Builder onward, template save, snapshot scheduling, conflicts, Schedule refresh, and Phase 2 execution are unchanged and reused.

No network, AI/LLM SDK, key, service, trainer concept, server dependency, CyclePlan lifecycle, Plans UI, full History, Progression, timer, authentication, Supabase, React Native migration, or other later-phase architecture was added. The React Native source is unchanged.

## Supported v1 grammar

Input is line-oriented and intentionally restricted. Blank lines and leading `-`, `•`, or `*` exercise bullets are accepted. A workout may use an explicit `Day N`, `Day N — Name`, `Day N - Name`, or `Day N: Name` heading. Common exact headings (`Push`, `Pull`, `Leg(s)`, `Upper`, `Lower`, `Full Body`, `Chest`, `Back`, `Shoulder(s)`, `Arm(s)`, and `Core`) are accepted. Any other concise workout name is accepted when it appears at the beginning of a section, is separated from the previous section by a blank line, and is followed by a valid exercise prescription. A missing workout name is retained as empty for review/Builder correction.

Supported exercise forms are:

- `Exercise Name 3x8`, `3 x 8`, or `3×8`
- `Exercise Name — 3 x 8`, `Exercise Name: 3x8`, and hyphen separators
- repetition ranges such as `3x8-12`, `3x8–12`, or `3x8..12`
- `Exercise Name 3 sets of 8`
- retained count-first RN forms: `3x8 Exercise Name` and `3x8-12 Exercise Name`
- duration: `Exercise Name 3x30 sec`, including second and minute unit spellings
- explicit weight suffix: `@ 100 lb`, `@ 100 lbs`, `@ 45 kg`, or `@ 45 kgs`
- explicit rest suffix: `rest 90 sec` (comma/semicolon before rest is optional)

Counts must be positive and bounded. Weight requires a unit; a bare number is never guessed. Kilograms convert through the existing shared `Weight` type and draft storage remains canonical pounds. Weight and rest remain `nil` when absent. Group semantics such as supersets, circuits, rounds, HIIT, warmup, accessories, and per-side are not modeled; their lines produce visible warnings. No default prescriptions are manufactured for an unparseable exercise line.

## Parser architecture and transient DTOs

`PlanTextParser` is a pure Foundation-oriented service with no SwiftUI, SwiftData writes, repository mutation, scheduling, template creation, or persistence behavior. Raw text becomes `PlanParseResult`, containing ordered `[ParsedWorkout]` plus `[ParseIssue]`. A parsed workout contains ordered `ParsedExercise` values and `ParsedSetPrescription` values. Set targets are only repetitions/ranges or duration, matching approved v1 execution semantics.

These types and `ResolvedParsedWorkout` are feature-local DTOs. They are not `Codable`, SwiftData models, backup data, or domain aggregates. Parser IDs are random transient UI identity only. The only final creation type is the existing Phase 3A `WorkoutDraft`.

## Errors and partial results

The parser returns partial structured workouts and line-numbered issues. Empty input, malformed prescriptions, unknown prose, missing exercise names, invalid counts, unsupported suffixes, and empty workout sections are never silently dropped. Blocking issues keep the user in the editable `TextEditor`, show the source line/content, and focus correction before parsing again. Unsupported domain semantics are warnings: valid individual prescriptions remain reviewable, but no unsupported concept is encoded.

Unknown exercise names are not parse errors when their prescription is valid; they proceed to matching review. This distinction lets the real picker resolve identity without weakening grammar.

## Exercise matching and ambiguity handling

Review loads the active catalog from the real `ExerciseRepository`. `PlanExerciseMatcher` applies deterministic precedence:

1. unique exact canonical name after the repository’s case/diacritic/punctuation/whitespace normalization;
2. unique exact explicit alias after the same normalization;
3. unique compact normalized canonical/alias identity (the same normalized characters with spaces removed, safely covering forms such as `pullup` / `pull-up`).

Multiple candidates at a precedence level are ambiguous. Substring/edit-distance/fuzzy matching is not used. Unmatched and ambiguous results are explicitly labeled “Needs review” with text and icons, not color alone, and block Continue. No uncertain exercise is silently created.

The review row can edit the parsed name and rerun matching or open the existing `ExercisePickerView`. That picker retains its native searchable catalog and existing `CustomExerciseView`; selecting or explicitly creating an exercise resolves the row to its canonical `ExerciseID`. Phase 3B adds no second picker or custom-exercise path.

## Review, WorkoutDraft conversion, and identity

Review deliberately focuses on parse confidence and identity. It displays workout naming, exercise order, prescriptions, matched/unmatched state, and warnings. Full name/order/set/prescription editing remains in the existing Builder. Continue is enabled only after every exercise in the selected workout has a canonical match.

`PlanImportDraftConverter` creates the existing `WorkoutDraft`. Each occurrence remains a separate ordered `DraftExercise`, even when multiple occurrences resolve to the same catalog exercise. Draft exercise and set UUIDs are newly generated on every conversion. Resolved exercises use canonical `ExerciseID`; canonical catalog names become draft snapshots. No template, scheduled, execution, completion, logged-set, or persistent identity is copied or derived from text. Template child IDs continue to be created only when Builder saves; scheduled child IDs continue to be created only when Builder snapshots.

## Multiple-workout behavior

Multiple named workouts are parsed into independent transient review values. Review lists every workout name plus matched/needs-review status and lets the user review/open one workout at a time in the existing Builder. Each may be saved as a reusable template or scheduled independently through normal Builder behavior. Phase 3B does not combine them, assign weekdays, schedule a week, create/apply a CyclePlan, or persist an imported-plan aggregate. CyclePlan application remains Phase 5.

## Add Workout integration

`CreationRoute` now includes Import input and review destinations. The former placeholder row is enabled and has a VoiceOver hint. Blank, Existing, and Recent behavior is unchanged. A reviewed import appends the same `.builder(WorkoutDraft)` route used by all other creation inputs; Builder has no import-specific branch.

## Fixtures and previews

`PlanImportFixtures` provides simple, mixed repetitions/duration/weight/rest, multiple-workout, unmatched, ambiguous, malformed, and long twelve-workout inputs. Import input previews cover normal and Accessibility Dynamic Type. Existing Builder previews cover the final mixed-target draft and large type.

## Design-system audit

Every Phase 3B SwiftUI file was inspected for literal colors, font sizes/weights, repeated spacing/radii/control sizes, card styling, and motion. The implementation reuses `EQColor` semantic states, `EQTypography`, `EQSpacing`, and `EQDimension.minimumTouch`, plus native Form/List/TextEditor/TextField/Button/Label treatments. No color, typography, spacing, radius, card, button, or motion token was added. The TextEditor’s single 220-point minimum is intentional component-specific geometry required to keep large pasted text editable; it is not repeated and therefore remains local.

Values consolidated to existing tokens include all row spacing (`xxs`/`xs`), body/caption/exercise typography, semantic warning/success/secondary text colors, and minimum touch heights. No new design token required justification.

## Accessibility and native interaction

The multiline editor uses native paste behavior, scrolls, supports text selection, dismisses the keyboard interactively, includes a keyboard Done action, and has a descriptive VoiceOver label/hint. Errors announce line number, explanation, and source content. Match states use explicit words plus symbols. Replacement and custom creation reuse accessible native sheets/search. Workout selection and review actions meet the shared minimum touch size. Forms/lists and semantic fonts support Dynamic Type; long plans remain scrollable. The Builder remains responsible for accessible order and detailed prescription correction.

## Tests, build, and launch

The complete native suite passes on iPhone 16 Pro (iOS 26.2): 52 tests, 0 failures (the retained 41 plus 11 Phase 3B tests). Coverage includes all required spacing and multiplication variants, bullets/blank lines, ranges, duration, pounds/kilograms, explicit rest, multiple independent workouts, empty/malformed/unknown/missing-name/invalid-count errors, unsupported semantics, exact/alias/diacritic/compact matching, ambiguity, unmatched/no fuzzy match, explicit custom resolution, draft conversion/order/targets/fresh IDs, unresolved blocking, Import route presence, template save, scheduling, and imported snapshot activation in Phase 2 execution.

The native simulator build succeeds. The automated integration path verifies parse → match → `WorkoutDraft` → Builder template save → scheduled snapshot → repository-backed Phase 2 activation. Simulator launch succeeds. The command environment does not provide full VoiceOver-driven UI automation, so final hands-on device QA should still traverse VoiceOver focus, keyboard avoidance, custom creation, long paste editing, and visual layout at the largest Accessibility sizes.

## RN comparison, deviations, discoveries, and Phase 4 risks

The frozen RN `parsePlanText` and `AIWorkoutCreationScreen` informed heading detection, count-first syntax, `x`/`×`, ranges, duration, and explicit units. Phase 3B intentionally does not port RN naming, API/trainer concepts, week normalization, automatic unknown-exercise creation, default `3x8-12`/90-second prescriptions, measurement mutation, warmup extraction, template source labels, cycle creation, direct persistence, date assignment, or Zustand behavior.

The native parser is stricter: bare exercise names and arbitrary prose are issues rather than silently defaulted exercises. This is a deliberate safety deviation. Multi-workout import stops at independent Builder inputs instead of creating a cycle. Warnings preserve valid individual lines but do not interpret unsupported structures.

Risks before Phase 4 are limited to catalog breadth and real-world formatting: the native seed catalog is intentionally small, so more imports will require explicit picker/custom resolution until product catalog content expands. V1 grammar should grow only through documented deterministic fixtures, not general natural-language heuristics. No material architecture assumption changed, so the main migration plan was not edited.
