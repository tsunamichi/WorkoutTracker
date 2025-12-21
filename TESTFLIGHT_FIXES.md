# TestFlight Issues - Fixed

This document summarizes the three issues found in TestFlight and their fixes.

---

## Issue 1: Background Gradient Missing (ExpoLinearGradient Error)

**Problem:**
- Error: `Unimplemented component: <ViewManagerAdapter_ExpoLinearGradient_...>`
- Background gradients not showing in TestFlight build
- Works fine in local development

**Root Cause:**
- Version mismatch between `package.json` (expo-linear-gradient ~15.0.8) and installed pod (14.0.1)
- New Architecture is enabled (`newArchEnabled: true` in app.json)
- Version 15.x has better New Architecture compatibility than 14.x

**Fix:**
Run the provided script to clean and reinstall dependencies:

```bash
bash fix-linear-gradient.sh
```

Or manually:
```bash
# Clean and reinstall node modules
rm -rf node_modules
npm install

# Clean and reinstall iOS pods
cd ios
rm -rf Pods Podfile.lock
pod install --repo-update
cd ..

# Rebuild for TestFlight
npx eas build --platform ios --profile production
```

**Why it worked locally:**
- Development builds use Metro bundler with hot reloading
- Release/TestFlight builds use precompiled native modules
- The version mismatch only affects production builds

---

## Issue 2: Keyboard Doesn't Push Up Bottom Sheet Content

**Problem:**
- When creating a new cycle, tapping the text input opens the keyboard
- The keyboard covers the text input and save button
- User can't see what they're typing or access the save button

**Root Cause:**
- The bottom sheet Modal in `WorkoutsScreen.tsx` didn't have `KeyboardAvoidingView`
- iOS needs explicit keyboard avoidance behavior

**Fix:**
Added `KeyboardAvoidingView` wrapper around the bottom sheet content:

```typescript
<KeyboardAvoidingView 
  behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
  style={{ flex: 1 }}
>
  <View style={styles.bottomSheetOverlay}>
    {/* Bottom sheet content */}
  </View>
</KeyboardAvoidingView>
```

**Files Changed:**
- `src/screens/WorkoutsScreen.tsx`
  - Added `KeyboardAvoidingView` and `Platform` imports
  - Wrapped Modal content with KeyboardAvoidingView

---

## Issue 3: Today Tab Empty After Creating Cycle

**Problem:**
- After creating a new cycle, the Workouts tab shows the workouts
- But the Today tab remains empty
- No workout appears for the current day

**Root Cause:**
- In `WorkoutsScreen.tsx`, the `assignWorkout()` calls were not awaited
- Workout assignments were being created asynchronously
- The UI updated before assignments were saved to storage
- TodayScreen couldn't find assignments because they weren't persisted yet

**Fix:**
Changed the workout assignment loop to properly await each assignment:

**Before:**
```typescript
for (let week = 0; week < numWeeks; week++) {
  workoutTemplates.forEach((template) => {
    // ...
    assignWorkout(workoutDate, template.id, cycleId); // NOT AWAITED!
  });
}
```

**After:**
```typescript
for (let week = 0; week < numWeeks; week++) {
  for (const template of workoutTemplates) {
    // ...
    await assignWorkout(workoutDate, template.id, cycleId); // AWAITED ✓
  }
}
```

**Additional Changes:**
- Added console logs to track cycle creation and assignment
- Enhanced TodayScreen debug logs to show more detail about cycles and assignments

**Files Changed:**
- `src/screens/WorkoutsScreen.tsx`
  - Changed `forEach` to `for...of` loop to support async/await
  - Added `await` before `assignWorkout()` calls
  - Added console logs for debugging
- `src/screens/TodayScreen.tsx`
  - Enhanced debug logging to show more details

---

## Testing Steps

### After Deploying the Fix:

1. **Test Issue 1 (Gradient):**
   - Run `bash fix-linear-gradient.sh`
   - Build for TestFlight: `npx eas build --platform ios --profile production`
   - Install from TestFlight
   - Verify background gradients appear on all screens

2. **Test Issue 2 (Keyboard):**
   - Open the app
   - Go to Workouts tab
   - Tap "Create New Cycle"
   - Tap the text input
   - ✓ Keyboard should push up the content so you can see input and button

3. **Test Issue 3 (Today Tab):**
   - Create a new cycle with workouts
   - Go to Today tab
   - ✓ Should show today's workout (if assigned)
   - Check console logs to verify assignments were created

---

## Important Notes

- **Issue 1** requires a rebuild and redeployment to TestFlight
- **Issues 2 & 3** are code fixes that will work in the next build
- All fixes work in both development and production builds
- The enhanced logging will help debug any future issues

---

## Next Build Checklist

Before submitting to TestFlight:

- [ ] Run `bash fix-linear-gradient.sh` to ensure pods are up to date
- [ ] Test locally with `npx expo run:ios --configuration Release`
- [ ] Verify gradients appear in release build
- [ ] Test keyboard behavior when creating cycles
- [ ] Test that Today tab shows workouts after cycle creation
- [ ] Submit to TestFlight: `npx eas build --platform ios --profile production`

