# Workout Tracker

## Development

**Node.js:** Use **Node 20 LTS** (or any **18.18+**). Expo’s CLI depends on web APIs such as `ReadableStream`, which are not available on Node 16. If you use [Volta](https://volta.sh/), the repo pins Node in `package.json` so `npm run start:fresh` picks it up automatically after `cd` into the project. With **nvm** or **fnm**, run `nvm use` / `fnm use` (see `.nvmrc`). Otherwise install Node 20 from [nodejs.org](https://nodejs.org/) or Homebrew (`brew install node@20`) and ensure that `node` is first on your `PATH`.

### See the latest code (no stale cache)

If the app isn’t updating or you don’t see recent changes, run **one command** and keep the terminal open:

```bash
npm run dev
```

This clears all caches, then builds and launches the iOS app. Metro runs as part of this, so you get a fresh bundle every time. Use this when the simulator feels stuck on an old version.

### Normal development (server already running)

To avoid stale UI when the server is already running:

1. **Start with a clean cache**
   ```bash
   npm run start:fresh
   ```
   This clears Metro/Expo caches and starts the dev server on port 8081 with `--localhost`.

2. **Reload the app** after the server is up:
   - In the iOS simulator: **Cmd+R**, or
   - Force quit the app (swipe up in app switcher) and open it again from the home screen.

If you still don’t see updates, run `npm run dev` (cleans cache + launches app in one go).

### Scripts

- `npm run dev` — **Clear caches and run iOS app** (use when the app isn’t updating).
- `npm run start:fresh` — Clear caches and start dev server (recommended when you already have a terminal open).
- `npm run clean` — Clear caches only; run before `npm start` or `npm run start:clear` if needed.
- `npm run start:clear` — Start with Metro’s `--clear` (no pre-clean of disk caches).
- `npm run ios` — Run on iOS device/simulator (uses existing Metro if running).
