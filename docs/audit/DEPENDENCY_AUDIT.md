# Dependency audit

Classification is based on source imports, Expo config, native impact, and static analysis. “Apparently unused” still requires a clean build after removal; nothing was uninstalled.

## Runtime dependencies

| Dependency | Classification | Evidence / role / native impact |
|---|---|---|
| `react`, `react-native` | Definitely used | Entire app runtime; iOS binary/frameworks. |
| `expo` | Definitely used | Expo runtime/config/build. `expo-updates` appears in `app.json`-resolved config but is not declared directly (Knip). |
| `@react-navigation/native`, `native-stack` | Definitely used | Root/stack navigation and all screens; native screens dependency. |
| `zustand` | Definitely used | Three stores. |
| `@react-native-async-storage/async-storage` | Definitely used | All app/auth persistence; native storage module. |
| `@supabase/supabase-js` | Definitely used | Apple-auth session and backup table; networking/storage SDK (JS, plus transitive crypto/polyfills). |
| `dayjs` | Definitely used | Schedule/cycles/history/progress/date formatting. |
| `react-native-gesture-handler`, `reanimated`, `safe-area-context`, `screens` | Definitely used | Current navigation, deck/calendar/execution animation and layout; all affect native binary. `screens` is primarily transitive/runtime setup despite no direct source import. |
| `react-native-svg` | Definitely used | Icon system, charts, confetti, timer visuals; native binary. |
| `@react-native-community/datetimepicker` | Definitely used | cycle/schedule/export date controls; native binary. |
| `expo-apple-authentication` | Definitely used | Login/Auth service and app plugin; Apple Sign In entitlement/native binary. |
| `expo-crypto` | Definitely used | Apple nonce hashing; native binary. |
| `expo-av` | Definitely used | timer sounds in HIIT and SetTimerSheet; microphone is not used. Native AV binary. Expo AV is deprecated in newer SDK direction, relevant to future upgrade. |
| `expo-clipboard` | Definitely used | Today/AI/share copy. Native binary. |
| `expo-file-system` | Definitely used | iCloud backup and web/native history sharing; native binary/container behavior. |
| `expo-font` | Definitely used | Outfit font load and plugin; native binary/resource. |
| `expo-haptics` | Definitely used | Broad UI/execution feedback; native binary. |
| `expo-image-picker` | Definitely used but transitively unreachable UI | Progress Home photo selection; requires camera/photo permissions and native binary. |
| `expo-keep-awake` | Definitely used | HIIT and set timers; native binary. |
| `expo-linear-gradient` | Definitely used | HIIT list/form. Native module. `DesignSystemScreen` references `LinearGradient` without import, a compile error. |
| `expo-sensors` | Definitely used | accelerometer-driven celebration confetti; motion permission and native binary. |
| `expo-sharing` | Definitely used | workout history JSON share; native share sheet. |
| `expo-status-bar` | Definitely used | App and animated screens. |
| `expo-system-ui` | Probably used | App config plugin/background system UI; no direct TS import. Native config impact. |
| `@expo/vector-icons` | Apparently unused directly | No source import; app uses custom SVG icon components. Knip ignores it, and Expo may bring it transitively. Likely older UI dependency. Verify bundle before removal. |
| `react-dom` | Probably used for Expo web only | No app source import; Expo web runtime. Keep only if web is supported. |

## Missing/unlisted runtime dependencies

- `expo-notifications` is dynamically required in `src/components/timer/SetTimerSheet.tsx` but absent from `package.json`; Knip flags it. Depending on installed transitive state is unsafe, and native notification configuration/permissions are absent. This can fail in production.
- `expo-updates` is referenced by generated Expo configuration (`app.json` according to Knip) but is not directly declared. Confirm whether EAS/Expo installs it transitively and whether OTA updates are intended.

## Development dependencies

| Dependency | Classification | Evidence |
|---|---|---|
| `typescript`, `@types/react` | Development-only, definitely used | strict typecheck; currently fails. |
| `jest`, `ts-jest`, `@types/jest` | Development-only, definitely used | four test files/config; direct Jest run works with watchman disabled. |
| `knip` | Development-only, definitely used | `npm run knip`; audit findings. |
| `babel-preset-expo` | Development/build-only | Babel config/Expo build. |
| `patch-package` | Development/install-only | postinstall, but no tracked `patches/` directory was found; apparently no current patch payload. |
| `@expo/ngrok` | Development-only/probably unused | no source/script reference; typically Expo tunnel support. |

`lsof` is listed in Knip ignoreDependencies but is a system binary used by `reload`; it is not an npm dependency. There is no lint dependency/configuration.

## Capability/security grouping

- **Native permissions:** Apple Sign In; Image Picker (camera/photos); Sensors (motion); dynamic notifications. `app.json` includes camera/photo/motion descriptions and Live Activities flags.
- **Binary-affecting packages:** nearly all `expo-*` native modules, AsyncStorage, datetime picker, navigation screens, gesture handler, reanimated, safe area, SVG.
- **Authentication/storage:** Supabase JS + Apple Authentication + Crypto + AsyncStorage. No SecureStore/keychain; auth tokens are AsyncStorage-backed.
- **Camera/photo:** `expo-image-picker`; no cloud Storage bucket or media upload SDK.
- **Notifications:** undeclared `expo-notifications` dynamically loaded; settings have notification flags, but no full permission/plugin flow was found. Live Activity flags have no tracked implementation.
- **Analytics/crash reporting:** none. No Sentry, Firebase Analytics/Crashlytics, Segment client usage, Amplitude or equivalent. `lastFatalJsError` is a local ad-hoc crash record.
- **AI:** no OpenAI SDK. AI creation appears local/parser-based despite stale `openaiApiKey` and trainer settings fields.

## Questions requiring product decisions

- Is Expo web a supported release target? This determines `react-dom` and some sharing/download branches.
- Are local notifications and OTA updates intended for v1? Their dependencies/configuration are currently inconsistent.
- Is an analytics/crash-reporting SDK required for App Store launch, or is privacy-minimal/no telemetry intentional?
