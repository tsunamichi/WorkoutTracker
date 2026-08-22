# Current architecture

## Navigation

Navigation is a single `createNativeStackNavigator` in `src/navigation/AppNavigator.tsx`; there is no real tab navigator. `RootNavigator.tsx` gates it behind auth/guest state. Programmatic celebration navigation uses `src/navigation/navigationService.ts`.

### Registered routes

All params are from `RootStackParamList`. “Reachable” means from the launch-reachable Schedule graph, not merely registered.

| Route → component | Params | Entry points / reachability |
|---|---|---|
| `Tabs` → `TabNavigator` | optional `initialTab` Schedule/Progress | Initial route; Schedule reachable. Progress state has no reachable switch because tab bar is disabled. |
| `Profile` → `ProfileScreen` | optional settings mode | Schedule header; reachable. |
| `BodyWeightHistory` → `BodyWeightHistoryScreen` | none | No current navigation reference; unreachable. |
| `History` → `HistoryScreen` | plan id, deck transition, initial history tab | Schedule history link; reachable. |
| `RecentWorkoutPicker` → same | selected date, deck transition | Schedule recent flow; reachable. |
| `PlanHistoryDetail` → same | program id/name | No navigation reference; unreachable. |
| `WorkoutBuilder` → same | date/scheduling/draft/deck flags | Add/recent Schedule flows; reachable. |
| `Workouts` → same | none | No navigation reference; unreachable library home. |
| `WorkoutTemplateDetail` → same | template id | Only from unreachable Workouts; transitively unreachable. |
| `WarmupEditor` → same | template id/workout key | Exercise execution edit and bonus creation; reachable. |
| `WarmupExecution` → redirect | workout key/template id | No caller; redirect itself immediately replaces with `ExerciseExecution(type='warmup')`; unreachable compatibility route. |
| `AccessoriesEditor` → same | template id/workout key | Exercise execution and Core Program paths; reachable. |
| `AccessoriesExecution` → same | workout key/template id | No current caller; unreachable older execution screen. |
| `ExerciseExecution` → same | workout/template keys; `type` warmup/main/core; optional bonus/transition data | Main from Schedule; warmup/core from bonus/core paths; reachable. |
| `DesignSystem` → same | none | No caller; unreachable development screen. |
| `WorkoutCompletionCelebrationPrototype` → same | none | Profile setting; reachable development prototype. |
| `WorkoutCompletionCelebration` → route wrapper | celebration data | Programmatic completion navigation; reachable. |
| `CycleDetail` → same | old cycle id | No caller; unreachable legacy Cycle screen. |
| `CyclePlanDetail` → same | plan id | Only hidden Progress/unreachable Workouts; unreachable. |
| `Progress` → `ProgressScreen` | optional exercise id/name | Exercise execution; reachable narrow progress chart. |
| `CycleConflicts` → same | plan/conflicts and pause metadata | Schedule/AI/manual plan paths; reachable. |
| `WorkoutEdit` → same | old cycle/template/date | No caller; unreachable mixed legacy editor. |
| `ExerciseDetail` → same | exercise id/workout key | No caller; unreachable old logger/detail. |
| `HIITTimerList` → same | bonus mode | Bonus drawer; reachable. |
| `HIITTimerForm` → same | create or edit/timer id | Schedule/list/execution; reachable. |
| `HIITTimerExecution` → same | timer id/optional bonus log | Schedule/list/bonus detail; reachable. |
| `TemplateEditor` / `CustomTemplateInput` / `ReviewCreateCycle` | template id or none | Only reference each other; no graph entry; unreachable legacy onboarding island. |
| `CreateCycleFlow` / `CreateCycleDayEditor` | date / weekday | Schedule empty state; reachable current manual cycle builder. |
| `AIWorkoutCreation` | single/plan mode | Add workout; reachable. |
| `WorkoutCreationOptions` | none | No caller; unreachable wrapper. |
| `LiftHistory`, `PhotoViewer`, `EditKeyLifts` | lift/photo params | Only Progress Home; transitively unreachable. |
| `BonusPresetPicker` | timer/warmup/core, add-to-program | Bonus drawer/Core Program; reachable. |
| `BonusDetail` | bonus log id | No current caller found; unreachable detail. |
| `CoreProgram` | none | Bonus picker; reachable. |
| `ProgressTab` → `ProgressHomeScreen` | none | No caller; unreachable duplicate route. |
| `Progression`, `ProgressionDefaults`, `ProgressionGroupDetail` | group id where needed | Profile → progression; reachable. |
| `ScheduleWorkoutDeckPreview`, `DeckMotionLab` | none | No caller; unreachable development routes. |

## State systems

### Main Zustand store

`src/store/index.ts` defines one very large `WorkoutStore`. It does not use Zustand persist middleware; every action explicitly calls `src/storage/index.ts`.

| Collection | Type / owner | Important readers and writers | Persistence / assessment |
|---|---|---|---|
| `exercises` | canonical-ish `types/index.Exercise[]` | builders, execution, progress, migrations; `ensureUserExercise`, add/update | `@workout_tracker_exercises`; active, but clashes with `types/training.Exercise`. |
| `workoutTemplates` | `training.WorkoutTemplate[]` | Schedule sheets, builders, execution, plans | template key; active; still sectioned (`warmupItems/items/accessoryItems`). |
| `scheduledWorkouts` | `ScheduledWorkout[]` | Today/deck, execution, history, cycle logic | scheduled key; active system of scheduled snapshots/status. |
| `detailedWorkoutProgress` | `Record<string, WorkoutProgress>` | execution, history, progress charts/recovery | detailed-progress key; active primary set log, but overlaps sessions and completion state. |
| `workoutProgress` | simpler completed arrays map | execution/recovery/store APIs | workout-progress key; active compatibility/duplicate tracking. |
| `sessions` | old `WorkoutSession[]`/sets | history, lift history, PR/recovery | sessions key; still active as completed-log/history compatibility. |
| `exercisePRs` | `ExercisePR[]` | execution, LiftHistory | PR key; active but derivable from logs. |
| `cycles` + `workoutAssignments` | old `Cycle[]`, assignment rows | old editors/recovery/onboarding conversion | cycle/assignment keys; legacy but store initialization and actions remain active. |
| `cyclePlans` | `CyclePlan[]` | Schedule, current manual/AI builders, conflict and plan controls | cycle-plan key; current plan generation. |
| body weight/photos/pinned lifts | respective index types | Progress Home/detail screens | separate keys; retained data, UI currently unreachable. |
| warmup/core presets, bonus logs, core programs/logs | training bonus types | bonus/core/editor/execution screens | five keys; active legacy product domain. |
| warmup/accessory completion maps | completion records | execution and fallback keys | two keys plus embedded scheduled completion; active duplicate/fallback. |
| HIIT timers/sessions, active id | timer types | Schedule/HIIT screens | templates/sessions persisted; active id memory-only. |
| progression groups/rules/defaults | progression types | settings and execution suggestions | three keys; active. |
| settings | `AppSettings` | theme, execution, profile, progress | settings key; active, includes stale trainer/API and notification fields. |
| trainer conversations | old AI trainer records | store only; no current screen reader | conversations key; likely legacy. |
| schedule deck focus/bypass | transient objects | Schedule/recent/builder transition | memory-only current UI coordination. |

### Other stores/state

- `useCreateCycleDraftStore.ts`: memory-only manual cycle wizard (`weeks`, weekdays, workout length, workout days, per-week exercise plans). Reachable and reset during `CreateCycleFlow`; current draft state is lost on process death.
- `useOnboardingStore.ts`: separately persisted old onboarding/cycle draft under `@app/onboardingState` and `@app/cycles`; not hydrated by the app root and unreachable.
- Component-local state is extensive in `ExerciseExecutionScreen` and `HIITTimerExecutionScreen`, including live countdown phases, active/current card, local weight/reps, rounds, sheets and animation state. Some live timer state is not persisted.
- `ScheduleDeckTransitionContext.tsx` and navigation module-level priming callbacks coordinate deck transitions; active presentation infrastructure, not domain state.

## Workout domain trace

### Current data path

```text
catalog Exercise
  → WorkoutTemplate.items (ordered WorkoutTemplateExercise[])
  → scheduleWorkout copies title/warmup/exercises/accessory snapshots
  → ScheduledWorkout
  → ExerciseExecution mutates detailed progress + scheduled completion/status
  → completion creates/updates WorkoutSession sets and ExercisePR
  → History/Progress combine scheduled snapshots, detailed progress, sessions
```

`WorkoutDraft` (`types/workoutDraft.ts`) is explicitly ephemeral builder state and becomes a `training.WorkoutTemplate`. `ScheduledWorkout` is the dated, frozen snapshot and is the closest thing to a workout log, but detailed set values live separately in `detailedWorkoutProgress`; completed `WorkoutSession` is a second historical representation. `buildWorkoutHistoryByDateFromSchedule.ts`, `getLatestExerciseLog.ts`, `buildExerciseWeightProgressRows.ts`, `lastExerciseRecord.ts`, and completion/recovery actions reconcile these sources.

### Remaining section concepts

| Concept | Types/storage | Functions | Components/routes |
|---|---|---|---|
| Warmup | `WarmupItem_DEPRECATED`, `ExerciseInstance`, alias `WarmupItem`, `WorkoutTemplate.warmupItems`, `ScheduledWorkout.warmupSnapshot/warmupCompletion`, fallback completion key | `ensureScheduledWorkoutWarmup`, profile inference/auto templates, `update/get/resetWarmupCompletion`, warmup parsers/migrations | `WarmupEditor`, redirect `WarmupExecution`, `ExerciseExecution(type='warmup')`, warmup bonus picker/editor; icon and item sheets. |
| Main | `WorkoutTemplate.items`, `exercisesSnapshot`, optional `mainCompletion`, `workoutCompletion`, detailed progress | `update/get/resetMainCompletion`, `markScheduledWorkoutStarted`, complete/recover | `TodayScreen` always launches `ExerciseExecution(type='main')`; Explore V2 root/cards. |
| Core | `CoreSetTemplate`, programs/logs, bonus core payload, scheduled core helper writes accessory snapshot | core program utilities, `ensureScheduledWorkoutCore`, pointer/log actions | `CoreProgram`, `BonusPresetPicker`, `ExerciseExecution(type='core')`, `IconCore`, `CoreProgramTimeline`. |
| Accessories | alias `AccessoryItem`, template/accessory snapshots and completion, fallback key | update/get/reset accessory completion | `AccessoriesEditor`, old `AccessoriesExecution`, execution editor branch, accessory sheets. |
| Execution `type` | Required route discriminant `'warmup'|'main'|'core'` | branches data source, completion APIs, labels, timer and finish behavior throughout `ExerciseExecutionScreen` | All execution calls and `BonusDetail`; central architectural coupling. |
| Completed / Up Next | not separate persisted models; derived from completed sets/current index/rounds | Explore V2 derivations inside execution | `ExploreV2CompleteCard`, `ExploreV2CompletedExerciseEditor`, `ExploreV2UpNextCard`, `ExploreV2CurrentCard/Root`. UI is consolidated, implementation remains grouped. |

Type drift is material: old warmup objects use `exerciseName/sets:number/reps/weight`; unified instances use `movementId` and `sets: ExerciseInstanceSet[]`; current code still constructs and reads both. TypeScript failures in editors, store, and execution demonstrate incomplete migration.

## Cycles

At least three generations coexist:

1. `types/index.Cycle` contains embedded old workout templates and pairs with `workoutAssignments`, `CycleDetailScreen`, `WorkoutEditScreen`, old store actions and `@workout_tracker_cycles`/assignments.
2. `types/workout.SavedCycle/CycleDraft` plus `useOnboardingStore`, template generator/parser and three onboarding screens persists to `@app/*`; unreachable.
3. `training.CyclePlan` maps weekdays to current training template IDs and generates `ScheduledWorkout` instances. `CreateCycleFlow`, AI creation, `CycleConflictsScreen`, Schedule sheets and store plan actions use this active architecture. `PlanTemplate` is declared as a proposed abstraction but unused.

`types/manualCycle.ManualCycle` describes wizard output, but the reachable wizard converts its draft directly to current templates/`CyclePlan` rather than persisting `ManualCycle`. Compatibility is spread across `convertOnboardingCycle.ts`, assignment logic, old recovery actions, `cyclePlanId` aliasing to `programId`, and migrations.

## Timer implementations

| Implementation | Purpose/invocation | State/data | Section dependency / reachability |
|---|---|---|---|
| HIIT screens | User-defined work/rest/set/round/round-rest timer from Schedule or bonus | persisted `HIITTimer[]` and completed `HIITTimerSession[]`; live phase/count/active id local; optional `BonusLog` completion | Independent of workout sections; reachable. Uses AV sounds, keep-awake, Reanimated, SVG. |
| Execution inline timer | Time-based exercise sets and rests in `ExerciseExecutionScreen`/Explore V2 | local elapsed/countdown/side/round state; set completion persisted in detailed progress | Branches heavily on `type`, time-based item shape, per-side and cycles; reachable for main/warmup/core. |
| `SetTimerSheet` | Full timer sheet used from execution | local phase/duration; dynamically loads `expo-notifications`, AV and keep-awake | Used by execution; reachable; dependency is undeclared. |
| `TimerValueSheet` | Choose/edit timer duration | local modal value | Used by execution/timer controls; reachable. |
| `DeviceEdgeTimer` / `ExploreV2TimerArea` | Visual progress at device edge/card | presentational props | Current execution presentation. |
| Accessory standalone timer | `AccessoriesExecutionScreen` time-based/cycle runner | local counters and accessory completion | Screen has no current caller; implemented/unreachable. |
| App/cloud intervals | five-minute Supabase sync and 30-minute iCloud backup | service timer fields | Automatic after store initialization; not user workout timers. |

## Progress architecture

- Reachable history: `HistoryScreen` with `LastFourWeeksHistoryTab` and `WeightProgressTab`; data is derived by `buildWorkoutHistoryByDateFromSchedule` and `buildExerciseWeightProgressRows`.
- Reachable per-exercise chart: `ProgressScreen`, opened from execution, reads scheduled workouts + detailed progress and groups exercise aliases.
- Unreachable intended hub: `ProgressHomeScreen` + `useProgressMetrics`, `WeeklyWeightCard`, `KeyLiftCard`, `PhotoCheckInCard`; hidden by disabled tabs.
- Older unreachable views: `LiftHistoryScreen`, `BodyWeightHistoryScreen`, `PlanHistoryDetailScreen`, and `PhotoViewerScreen` are only connected to unreachable hub routes (or not connected at all).
- `progressLogs` is not a current store collection. Searches show “progress” is represented by `workoutProgress`, `detailedWorkoutProgress`, sessions, body weight, photos and progression rules. Pre-existing docs mentioning `progressLogs` do not match source.

## Questions requiring product decisions

- Which single record should be canonical for completed workouts and sets: scheduled snapshot/log, detailed progress, or session?
- Are plan/cycle semantics required for v1, or is a reusable weekly schedule sufficient?
- Must time-based and per-side exercises remain first-class in the unified exercise model?
