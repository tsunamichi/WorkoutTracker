# Current product

## Reachability baseline

Launch runs `App.tsx` → `RootNavigator`. With the hard-coded Supabase configuration, an authenticated session enters the app; otherwise `LoginScreen` is shown. Login offers Apple Sign In, restore-after-login, and “continue as guest” (`RootNavigator.handleContinueAsGuest`). The persisted `@app/guestMode` value is written but never read: guest access lasts for that process and the welcome screen returns on a later launch.

The authenticated root is a native stack whose initial `Tabs` component is a custom shell. It initializes on Schedule. Although it defines Schedule and Progress states, the entire bottom navigation is wrapped in `{false && ...}` (`AppNavigator.TabNavigator`), so the user cannot switch to Progress through the shell. `ProgressHomeScreen` is also registered as `ProgressTab`, but no active source navigates there. Therefore Schedule is the only reachable top-level experience in the present code.

Status labels below mean: **reachable** has a source-code UI entry point; **implemented/unreachable** is registered or imported but has no reachable entry; **partial** has a reachable path with incomplete/broken integration; **legacy** is superseded architecture retained in code/data.

## Actual user-facing areas

| Area | Status | What exists now / evidence |
|---|---|---|
| Tabs | Partial | Custom Schedule/Progress state in `AppNavigator.TabNavigator`; bottom bar is hard-disabled. Schedule renders `TodayScreen`; Progress would render `ProgressHomeScreen`. |
| Schedule | Reachable | `TodayScreen` calendar/deck is the home. It selects dates, derives open/completed workout cards from `scheduledWorkouts`, pulls a future planned workout forward when started, exposes settings and Workout history, and opens add-workout and bonus drawers. `ScheduleWorkoutDeckV3` and Explore V2 execution presentation are current. |
| Workout creation | Reachable | Add Workout → blank opens `WorkoutBuilderScreen`; recent history opens `RecentWorkoutPickerScreen` then hydrates the builder; AI opens `AIWorkoutCreationScreen`. Builder supports multiple draft workouts, paste/import parsing, catalog matching/custom exercise creation, template save, and optional scheduling. |
| Workout scheduling | Reachable | Select an existing standalone template, create/schedule a blank workout, create/apply AI/manual cycles, repeat a finished cycle, or extract a plan day. Conflicts route to `CycleConflictsScreen`. Schedule permits multiple workouts per date in selectors, although conflict APIs still often enforce one target workout. |
| Workout execution | Reachable | `TodayScreen.navigateToWorkoutExecution` opens `ExerciseExecution` with `type: 'main'`. The UI is the Explore V2 consolidated carousel/root (`ExploreV2ExecutionRoot`) with current/completed/up-next implementation components still named separately. Workouts are marked in-progress; detailed set state and section state are persisted. |
| Exercise logging | Reachable | `ExerciseExecutionScreen` records per-set weight/reps/completion in `detailedWorkoutProgress`, `workoutProgress`, scheduled snapshot completion, sessions, and PRs. It provides inline per-exercise timers, history/settings drawers, progression suggestions, skip/edit behavior, and barbell mode. The 5,000+ line screen mixes current and legacy execution. |
| Workout completion | Reachable | Completing main execution calls store completion/session logic and can show `WorkoutCompletionCelebration` through navigation service. Completed scheduled workouts are locked; uncomplete/recovery actions remain in store. Warmup/accessory completion is tracked independently. |
| Workout history | Reachable | Schedule header “Workout history” pushes `HistoryScreen`. It has Last 4 Weeks and Weight progress tabs and reads scheduled snapshots plus detailed progress/sessions. `PlanHistoryDetailScreen` is registered but no current entry points were found. Old `LiftHistoryScreen` is only reachable from currently unreachable Progress Home. |
| Workout templates | Partially reachable | Existing templates appear in Add Workout. `WorkoutBuilder` creates/updates them. `WorkoutsScreen` and `WorkoutTemplateDetailScreen` are registered, but `WorkoutsScreen` itself has no active entry; therefore template library management/detail scheduling is currently unreachable. |
| Cycles/plans | Reachable, multiple generations | Manual `CreateCycleFlow` is reachable from Schedule empty state and creates current `WorkoutTemplate[]` + `CyclePlan`; AI creates the same. Apply/repeat/conflict controls are reachable through Schedule sheets. `CyclePlanDetailScreen` is only reachable via hidden Progress Home or unreachable Workouts. Old `Cycle`, onboarding `SavedCycle`, and associated screens remain legacy/unreachable. |
| Progress | Implemented/unreachable as a home | `ProgressHomeScreen` includes active plan, weekly weight, key lifts, photo check-ins, settings, lift history and photo viewer, but hidden tab navigation makes it unreachable. A narrower `ProgressScreen` (exercise weight charts) is reachable from execution. `HistoryScreen` weight progress is also reachable. Thus progress exists in fragmented forms. |
| Body weight | Implemented/unreachable | Store persistence and `ProgressHomeScreen` weekly card can add weight; `BodyWeightHistoryScreen` is registered but has no entry in the current reachable shell. |
| Progress photos | Implemented/unreachable | `ProgressHomeScreen` uses `expo-image-picker` and stores URI records; `PhotoViewerScreen` deletes/views them. No current reachable route reaches Progress Home. Files themselves are not copied into app-owned storage. |
| Timers | Reachable | HIIT templates/sessions are reachable from Schedule’s timer area and Bonus drawer. Exercise execution has rest/interval per-exercise timers using `SetTimerSheet`, `TimerValueSheet`, `DeviceEdgeTimer`, audio/haptics, keep-awake, and dynamically required notifications. Warmup/core/accessory time-based items depend on execution `type`. |
| Settings | Reachable | Schedule header opens `ProfileScreen` in general mode. Settings cover units, language/theme, default rest timer, progression rules, profile avatar URI and cloud sync. A celebration prototype is also exposed, which is development UI in a production-reachable settings screen. |
| Authentication | Reachable | Apple Sign In → Supabase token/session persisted through AsyncStorage (`authService.ts`, `supabase.ts`). Guest is available but not durable. No email/password flow. |
| Cloud backup/sync | Reachable/automatic | Profile can upload/restore Supabase `user_backups`; login can restore. `useStore.initialize` starts automatic Supabase upload every five minutes for authenticated users. A second iCloud FileSystem backup service initializes too, but its iCloud-directory capability is questionable without a tracked native entitlement/container setup. Both snapshot nearly all AsyncStorage. |
| Onboarding | Implemented/unreachable/legacy | `TemplateEditorScreen`, `CustomTemplateInputScreen`, `ReviewCreateCycleScreen`, and `useOnboardingStore` form an older cycle onboarding flow. Root auth never calls `hydrate` or branches on `hasCompletedOnboarding`, and there is no reachable entry to its first screen. |
| Warmup/core/accessories bonus | Reachable legacy product | Bonus drawer offers Timer, Warm Up, Core. Presets/logs, Core Program, and section-specific editor/execution paths are live. Main scheduled templates also retain warmup/accessory snapshots and independent completion. This directly conflicts with the intended single ordered exercise model. |

## Primary reachable flow tree

```text
Launch
├─ unauthenticated → Login → Apple sign-in [optional restore] OR guest
└─ authenticated/guest → Schedule (TodayScreen)
   ├─ Settings → Profile → Progression rules / celebration prototype / cloud sync
   ├─ Workout history → History (Last 4 Weeks | Weight progress)
   ├─ Add workout
   │  ├─ choose standalone template → schedule
   │  ├─ blank → WorkoutBuilder → save template + schedule
   │  ├─ recent workout → RecentWorkoutPicker → WorkoutBuilder → schedule
   │  ├─ AI → AIWorkoutCreation → apply plan/conflicts
   │  └─ repeat cycle → apply/conflicts
   ├─ empty plan state → CreateCycleFlow → day editors → create templates/plan
   ├─ planned card → ExerciseExecution(type='main') → log sets → complete/celebrate
   └─ bonus
      ├─ timer → HIIT list/form/execution
      ├─ warmup → preset picker/editor → ExerciseExecution(type='warmup')
      └─ core → preset/core program → ExerciseExecution(type='core')
```

## Questions requiring product decisions

- Should Progress be a top-level App Store v1 destination, and if so what should be canonical: `ProgressHomeScreen`, `HistoryScreen` weight progress, or `ProgressScreen`?
- Is guest mode intended to survive relaunch, or must release require Apple authentication?
- Are bonus warmup/core/HIIT experiences part of v1, or should all activity be exercises inside workouts?
- Should multiple workouts on one calendar date be supported as product behavior?
