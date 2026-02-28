# Workout Tracker

## Development

To avoid stale UI (changes not showing in the simulator), use a fresh bundle every time you start:

1. **Start with a clean cache**
   ```bash
   npm run start:fresh
   ```
   This clears Metro/Expo caches and starts the dev server on port 8081 with `--localhost`.

2. **Reload the app** after the server is up:
   - In the iOS simulator: **Cmd+R**, or
   - Force quit the app (swipe up in app switcher) and open it again from the home screen.

If you still don’t see updates, run `npm run clean`, then `npm run start:fresh`, and reload the app again. Doing this after pulling or after big UI changes avoids wasting time on cached bundles.

### Scripts

- `npm run start:fresh` — Clear caches and start dev server (recommended for daily use).
- `npm run clean` — Clear caches only; run before `npm start` or `npm run start:clear` if needed.
- `npm run start:clear` — Start with Metro’s `--clear` (no pre-clean of disk caches).
- `npm run ios` — Run on iOS device/simulator.
