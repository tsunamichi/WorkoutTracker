# SwiftUI Progression + Full Timer — Result

Date: 2026-08-23

## Outcome

Native Equilibrium now provides two separate assistance systems against the corrected independent `Workout` model. Progression persists configuration only and derives recommendations from canonical completed history. Timer runtime is transient and uses one reusable deadline-based state machine for post-set rest, duration prescriptions, and the retained Home Timer.

No date, schedule, Plan, Cycle, template, session-summary, duplicate performance, HIIT, round, bonus, or timer-history model was introduced.

## Progression

`ProgressionConfiguration` contains the global enabled flag, defaults, ordered groups, and stable-`ExerciseID` overrides. `SwiftDataRepository` implements `ProgressionRepository`; validation rejects invalid bounds/increments, blank identities/names, duplicate group identities, and duplicate override exercise identities. Weight increments are canonical pounds and settings editors round-trip through the selected display unit.

Resolution is deterministic: globally disabled returns no rule; an exercise override wins; otherwise the first valid matching group in stored order wins; otherwise defaults apply. Any selected rule whose mode is disabled returns no suggestion. Names are presentation only.

Suggestions read the newest completed `Workout` occurrence through the Phase 4 completed-history ordering and stable exercise identity. Ready/in-progress workouts, incomplete values, current input, charts, and PR derivations are not inputs. No completed occurrence returns no suggestion. Duration-only prescriptions return no suggestion. Missing weight stays absent and never becomes zero.

The frozen RN `19c56a9` utility established these algorithms:

- Double progression: when every valid working set reaches the upper repetition bound, add exactly the configured increment to the first working-set load and reset the target range to the configured bounds. Otherwise retain that load and set the lower target to one above the weakest set, capped at the upper bound.
- Weight only: add exactly the configured increment to the first working-set load and retain the configured repetition range.
- Repetitions only: retain load and set the lower target to one above the weakest set, capped at the upper bound.
- Disabled: no recommendation.

Native intentionally corrects two conflicting RN details: RN emitted a fabricated zero-load no-history suggestion and silently fed suggestions into execution values. Native returns no suggestion without completed history and presents a concise Suggested block with rationale without changing prescriptions, fields, logs, or history. Previous Performance remains separate and available.

Settings now supports enabling progression, global mode/range/increment, ordered group creation/editing/deletion and exercise assignment, plus adding/editing/removing overrides. It explains precedence explicitly and creates no section-named groups.

## Timer

`CountdownTimer` owns configured, remaining, and elapsed duration plus idle/running/paused/completed state. Start creates a monotonic deadline; refresh derives remaining time from that deadline; pause captures remaining time; resume builds a new deadline; reset restores the configured duration and leaves the timer paused; cancel clears runtime state. Completion transitions and counts once. UI refresh tasks are display drivers only and do not subtract seconds.

Monotonic deadline calculation makes suspension, lock, slow refresh, and foreground reconciliation temporally correct. Workout Execution refreshes on active scene transition. If a deadline expired while suspended, the first refresh completes immediately and feedback fires at most once. Process-relaunch survival is intentionally absent.

Rest starts only after successful canonical set persistence, does not restart when editing a completed set, is suppressed when the workout can complete, and uses exercise override then global default. Skip Rest cancels it. Changing either setting does not alter an already-created deadline. Rest remains in the existing active-exercise card; moving it into the wider execution canvas remains visual polish.

Duration prescriptions expose Start/Pause/Resume/Reset/Cancel using their target duration. Expiration gives feedback but never logs a set. The user still confirms through the canonical repository command, and `LoggedSet.duration` remains authoritative.

Home’s retained Timer affordance now presents a simple configurable countdown with Start/Pause/Resume/Reset/Cancel/Done. It creates no history or product record.

Timer feedback is routed through small haptic/audio clients for rest and the shared feature presentation. Haptics use semantic success feedback. Audio uses a system sound and does not configure an audio session to override the silent switch. No notification permission, entitlement, local notification, Live Activity, or Dynamic Island behavior was added. The frozen RN contained optional notification prompting and forced silent-mode playback, but those conflict with the explicit native phase guardrails and are not required for deadline correctness.

## Persistence and backup

An `AppConfigurationRecord` stores encoded `AppSettings` and `ProgressionConfiguration` through SwiftData. `AppSettings.defaultRestDuration` accepts 15–300 seconds in five-second steps. Backup v2 already had both fields; export now reads the live configuration record and restore validates and recreates it. Timer state is never encoded or backed up.

The pre-release SwiftData configuration is named `EquilibriumProgressionTimer`, deliberately replacing the prior development configuration without a migration layer.

## Validation

Focused tests cover rule precedence, disabled rules, deterministic group order, weakest-set and all-at-ceiling double progression, weight-only, repetitions-only, missing load, completed-only stable-identity history selection, rename continuity, duration exclusion, validation, settings/progression backup round-trip, and monotonic timer state/large-jump correctness. Retained Phase 2 execution tests cover persistence-before-rest, edit suppression, Skip Rest, override/default behavior, active-duration stability, and no final rest.

Final build/test/install/launch and terminology-scan results are recorded in the implementation handoff. No later migration phase was started.
