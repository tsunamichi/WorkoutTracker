# Repository snapshot

This audit describes the source tree at the start of the audit on 2026-08-22 (America/New_York). Source code, not the pre-existing Markdown files, was treated as authoritative.

## Git state

| Item | Value |
|---|---|
| Branch | `refactor/v1-cleanup` |
| Commit | `19c56a967e0768a23946dadf7feee3fad06e4750` |
| Commit subject | `Checkpoint current Equilibrium UI` |
| Commit time | `2026-08-22T11:57:01-04:00` |
| Initial working tree | Clean (`git status --short --branch` printed only the branch) |
| Audit changes | Only the seven files under `docs/audit/` |

## Versions and libraries

`package.json` and the installed lockfile resolve to:

| Item | Declared | Installed |
|---|---:|---:|
| App/package | 1.0.0 | 1.0.0 |
| Expo | `^53.0.27` | 53.0.27 |
| React Native | `^0.79.6` | 0.79.6 |
| React | `^19.0.0` | 19.x |
| TypeScript | `~5.8.3` | 5.8.3 |
| Node | `>=18.18.0`; Volta 20.19.6 | 20.19.6 during audit |

Major runtime libraries are React Navigation 7 (`@react-navigation/native`, `native-stack`), Zustand 4.5, AsyncStorage 2.1, Supabase JS 2.95, Day.js, React Native Reanimated/Gesture Handler/Screens/SVG, and Expo Apple Authentication, AV, FileSystem, ImagePicker, Sensors, Sharing, Haptics, Clipboard, Font, KeepAwake, LinearGradient, Crypto, StatusBar, and System UI. See `package.json` and `package-lock.json`.

## Application and iOS configuration

- Expo app name/slug: `WorkoutTracker`; owner `tsunamichi`; EAS project id `cc9457fe-c6f5-45ab-9110-40b941491c17` (`app.json`).
- Bundle identifier: `com.tsunamichi.workouttracker`; Expo iOS build number 96; supports iPad; portrait; dark UI (`app.json`).
- Production EAS iOS build uses Release (`eas.json`).
- App requests camera, photo-library read/add, and motion usage descriptions; Apple Sign In and Live Activities flags are enabled (`app.json`). No notification permission string/plugin is configured even though timer code dynamically requires `expo-notifications`.
- `ios/` and `android/` exist locally but are ignored/untracked generated trees (`git ls-files ios android` is empty). The local generated Xcode project says iOS 15.1, Swift 5, marketing 1.0, and build 1 (`ios/WorkoutTracker.xcodeproj/project.pbxproj`), which conflicts with Expo build number 96. Treat `app.json`/EAS as repository-controlled configuration and regenerate native projects before trusting local values.
- No tracked ActivityKit extension/native live-activity module exists. Only Info.plist flags are generated; documentation claiming a live activity implementation is not source evidence.

## Safe checks run

| Check | Result |
|---|---|
| `npx tsc --noEmit` | Failed with extensive errors across app, navigation, i18n, store, legacy exercise shapes, and screens. Representative failures: `App.tsx` React 19 `defaultProps`; missing `BottomSheet`; duplicate translation/style keys; missing `AccessoryItem_DEPRECATED`; warmup/accessory shape mismatches. |
| `npm test -- --runInBand` | Cannot run: no `test` script. |
| `npx jest --runInBand --watchman=false` | 3 suites passed, 1 failed because `warmupParser.test.ts` contains no tests; 40 tests passed. |
| `npm run knip` | Failed findings: undeclared `expo-notifications` and `expo-updates`, unlisted `lsof`, 51 unused exports, 47 unused exported types, and one duplicate export. It did not prove whole registered screens removable. |
| Lint | No lint script or ESLint configuration is present. |

The failing checks are findings, not changes made by this audit.
