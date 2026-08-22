# Legacy and dead-code audit

## Classification method

Repository search covered imports, stack registration, route literals, store actions/state, storage restore, cloud snapshot behavior, tests, barrels, translation usage and generated native configuration. “Safe” is deliberately narrow: cloud backup includes arbitrary AsyncStorage keys, so persisted data/schema code is not safe merely because its UI is unreachable.

## Safe to remove

No material application file is proven safe to remove in this audit. The stack imports every screen, and many otherwise unused helpers are exported or involved in compatibility/data recovery. Static analysis alone cannot exclude external deep links, old cloud payloads or release scripts. The following individual exports are high-confidence safe candidates only after confirming no external/test consumption; removing their export modifier is different from deleting their implementation:

| Path / symbols | Evidence and references | Route/store/storage/cloud | Risk / confidence |
|---|---|---|---|
| `src/components/celebration/CelebrationAnimatedNumber.tsx`: four exported helpers/components | `knip` reports no consumers; actual celebration screen does not import them | No route/state/key directly; file itself may be a prototype asset | Low / High for unused exports, not necessarily whole file |
| `src/utils/assignCycleWorkouts.ts`: `generateWorkoutAssignments` | No imports; superseded by store `CyclePlan` scheduling | Concept touches old assignments; cloud can contain assignment data | Low code risk, data-semantic caution / High |
| `src/data/templates.ts`: `TEMPLATES` and `TemplateCard` | No consumer; current templates are persisted | None | Low / High |
| `src/storage/index.ts`: `clearAllData` | No caller; do not invoke because destructive | Removes all current storage keys | High if invoked; High that export is unused |

Knip’s remaining unused exports/types are recorded in the check output and include utility sub-functions, constants, props types and helper types. They are cleanup candidates, not proof that containing files are removable.

## Likely legacy — verify before removal

| Candidate (path / symbols) | Why obsolete; references/importers | Route / store / persisted keys / cloud | Removal risk | Confidence |
|---|---|---|---|---|
| Old cycle domain: `src/types/index.ts` `Cycle`, old `WorkoutTemplate`; `CycleDetailScreen`, `WorkoutEditScreen`, old cycle store actions | Superseded by `training.WorkoutTemplate` + `CyclePlan`; screens registered but no callers. Store initialization/actions and recovery still use it. | `CycleDetail`, `WorkoutEdit`; `cycles`, `workoutAssignments`; cycle/assignment keys included in cloud | Existing user data loss and recovery breakage; migration required | High legacy, Medium removable |
| Old onboarding cycle island: `types/workout.ts`, `useOnboardingStore.ts`, onboarding screens, `templateGenerator`, `parsePlanText` | Root never hydrates or routes into it; screens only navigate among themselves. | Three registered routes; separate Zustand; `@app/onboardingState`, `@app/cycles`; cloud includes them | Old user drafts/saved cycles could be lost; key collision is separate from current keys | High |
| `WarmupExecutionRedirectScreen` | Compatibility redirect to unified execution; no caller | registered route; no unique state/key | Deep links could still target route | High legacy / Medium safe |
| `AccessoriesExecutionScreen` | Separate old execution superseded by `ExerciseExecution`; no caller | registered; accessory completion map/snapshot APIs active elsewhere | Deep links and old navigation state; shared persisted data | High legacy / Medium removable |
| `ExerciseDetailScreen` | Separate old logger; no caller; current drawer logging is inside Explore V2 | registered route; reads/writes detailed progress and sessions-related values | Could contain unique edit/recovery behavior | Medium |
| `PlanHistoryDetailScreen`, `BodyWeightHistoryScreen` | Registered without caller; newer History/hub architectures exist | routes; read active retained data | UI-only if truly unreachable; no data deletion | High unreachable / Medium legacy |
| `WorkoutsScreen` + `WorkoutTemplateDetailScreen` | Full library exists but no entry into Workouts; detail only reachable from it | registered; active templates/plans and mutations | Could be intended v1 management UI | Medium |
| `ProgressHomeScreen` and child cards/hook | Intended top-level hub, but bottom nav is hard-disabled and `ProgressTab` has no caller | registered route and hidden tab; active weight/photo/settings data | Product decision, not dead-code inference | High unreachable / Low obsolete |
| `ProgressScreen` vs History weight progress vs LiftHistory | Three overlapping progress generations | `Progress` reachable; LiftHistory only via unreachable hub | Consolidation can affect user access, not data | High duplication / Medium choice |
| Development/prototype screens: `DesignSystemScreen`, deck preview/lab | Registered, no entry except celebration prototype exposed in Profile | routes only; no persisted state | Low, but check dev tooling/deep links | High |
| `WorkoutCreationOptionsScreen` | No caller; current AddWorkoutSheet owns options | registered, routes onward only | Low | High |
| Trainer conversations/settings fields | No current trainer screen reads them; settings still persists API key/goals/personality | store + conversations/settings keys; all uploaded | Privacy/data migration concern | High legacy / Medium removal |
| `PlanTemplate`, `ManualCycle` final types | Declared but active plan is `CyclePlan`; wizard never persists `ManualCycle` | none directly | Type-only | High |
| `dataMigration.ts` exported repair/recovery functions beyond startup mapping | Most are unused; startup uses only `migrateOldStorageKeys`; store has separate recovery actions | Reads/writes sessions/progress/templates/exercises | Removing could eliminate only recovery path for old installs | High legacy / Low removal safety |
| `cloudBackup.ts` iCloud service | Coexists with Supabase sync; generated entitlements show no tracked native source-of-truth capability | all AsyncStorage, iCloud `Documents/workout-tracker-backup.json` | Existing iCloud backup restoration risk | Medium |
| Root screenshots, logs and numerous historical Markdown plans | Not application runtime; repository clutter | none | Could be useful design/release evidence | High legacy / High removable after archival decision |

## Still active despite old-looking names

| Path / symbols | Active evidence | Associated state/data | Risk if removed | Confidence |
|---|---|---|---|---|
| `WarmupEditorScreen`, warmup sheets/parser/migration and warmup store APIs | Bonus drawer and execution editor navigate here; startup normalizes old shapes | template/scheduled warmup snapshots, preset and completion keys | High user-data and runtime breakage | High |
| `CoreProgramScreen`, core templates/utilities | Bonus picker opens program; execution logs/pointer advance | core presets/programs/logs/bonus logs | High | High |
| `AccessoriesEditorScreen` and accessory store APIs | Core program and execution edit path navigate here | accessory snapshots/completion keys | High | High |
| `ExerciseExecutionScreen` execution `type` and section branches | Main Schedule flow and bonus flows use it | all workout progress/session/PR/section state | Critical | High |
| Explore V2 “Completed” / “UpNext” components | Imported by `ExploreV2ExecutionRoot`, which current execution renders | derived current/completed/up-next UI state | Critical presentation breakage | High |
| HIIT list/form/execution | Schedule and bonus paths navigate to all three | HIIT template/session and bonus log keys | High | High |
| `HistoryScreen` and history components | Schedule header pushes it | scheduled, detailed progress, sessions | High | High |
| `dataMigration.migrateOldStorageKeys` and personal exercise migrations | Called on every `useStore.initialize` | multiple old/new keys and catalog marker | High for existing installs | High |
| `sessions`, `workoutProgress`, `exercisePRs` | Old-looking duplicate models still read/written by execution/history/recovery | three storage keys | High | High |

## Additional candidate classes

- **Translations:** `src/i18n/index.ts` has duplicate object keys and missing keys reported by TypeScript. Because calls use `t('literal')` and dynamic formatting, an automated unused-key conclusion is unsafe until compilation is fixed and key extraction is run. The duplicates are definitely correctness debt.
- **Icons/assets:** all icon modules are reachable through the `components/icons` barrel or registered screens; barrel reachability does not prove visible use. Root PNG screenshots are not runtime assets. Runtime assets are `assets/icon.png`, splash/adaptive/favicon, Outfit font, and timer sounds. Perform an asset-by-import pass after unregistering legacy routes.
- **Hooks/components/utilities/styles:** Knip finds unused exports, but no unused whole source files. The huge registered graph makes import-based analysis conservative. `getAppThemeFromStore` module-level styles and two theme generations (`v1`/`v2`) are active, not safely removable.
- **Feature flags:** the strongest hard-coded flags are `{false && bottom navigation}` in `AppNavigator` and fixed `executionExperience = 'explore-v2'` behavior in execution. Old comparison branches remain and TypeScript reports impossible `'explore'` comparisons.

## Questions requiring product decisions

- Is the template/workout library intentionally hidden or should it return as v1 UI?
- Is the current celebration prototype allowed in production Settings?
- Must historical cloud/iCloud backups from pre-v1 builds remain restorable?
