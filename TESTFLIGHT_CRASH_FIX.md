# TestFlight Crash Fix - EXC_BAD_ACCESS in Expo Component Registration

## Crash Details

**Date:** 2025-12-11 10:46:16  
**Version:** 1.0.0 (Build 3)  
**Platform:** iPhone OS 26.2 (TestFlight)  
**Error:** `EXC_BAD_ACCESS (SIGBUS)` - Memory access violation  

**Location:**
```
facebook::react::Props::Props()
  └─ facebook::react::YogaStylableProps::YogaStylableProps()
    └─ facebook::react::BaseViewProps::BaseViewProps()
      └─ expo::ExpoViewComponentDescriptor (construction)
```

## Root Cause

The crash occurs during Expo module initialization with the New Architecture. The native component descriptors are trying to access memory structures that don't match between the JavaScript bundle and the compiled native code.

**Why this happened:**
1. `expo-linear-gradient` was updated to v15.0.8 in package.json
2. Pods were installed, updating the native module
3. **BUT** the workspace might not have been fully cleaned before building for TestFlight
4. Stale build artifacts mixed v14.x and v15.x code

## Solution Steps

### 1. Complete Clean Build

```bash
cd /Users/fcasanov/Projects/WorkoutTracker

# Clean everything
rm -rf ios/build
rm -rf ios/Pods
rm -rf ios/Podfile.lock
rm -rf node_modules
rm -rf ~/Library/Developer/Xcode/DerivedData/*

# Reinstall
npm install --legacy-peer-deps
cd ios
pod install
cd ..
```

### 2. Verify Expo Modules

Check that all Expo modules are on compatible versions:

```bash
npx expo-doctor
```

### 3. Build for TestFlight (Clean)

**Option A: Use EAS Build (Recommended)**
```bash
# EAS builds in a clean environment every time
npx eas build --platform ios --profile production --clear-cache
```

**Option B: Local Archive**
```bash
# Open Xcode
open ios/WorkoutTracker.xcworkspace

# In Xcode:
# 1. Product → Clean Build Folder (⌘+Shift+K)
# 2. Hold Option key → Product → Clean Build Folder (deep clean)
# 3. Product → Archive
# 4. Distribute → TestFlight
```

### 4. Alternative: Temporarily Disable New Architecture

If the issue persists, you can temporarily disable New Architecture to get the app working:

**In `app.json`:**
```json
{
  "expo": {
    "newArchEnabled": false  // Change from true to false
  }
}
```

Then rebuild everything from scratch. However, this removes the New Architecture benefits and means you'll need to fix it eventually.

## Prevention

### For Future Builds

1. **Always use EAS Build for TestFlight** - it builds in a clean Docker environment
2. **Never mix local and CI builds** - stick to one method
3. **Version bump** - Increment build number for each TestFlight upload
4. **Test New Architecture locally first**:
   ```bash
   npx expo run:ios --configuration Release
   ```

### Pre-Flight Checklist

Before submitting to TestFlight:

- [ ] Run `npm install --legacy-peer-deps` 
- [ ] Clean pods: `cd ios && rm -rf Pods Podfile.lock && pod install`
- [ ] Clean Xcode: Remove DerivedData
- [ ] Test Release build locally on a real device
- [ ] Check crash logs if app crashes during testing
- [ ] Verify all patches are applied: `ls patches/`
- [ ] Confirm build number incremented

## Debugging Tips

### Check if it's a specific module

To identify which Expo module is causing the crash, you can:

1. **Check the crash log** for the specific component descriptor
2. **Temporarily remove modules** from `app.json` one by one
3. **Use Xcode Instruments** to profile memory access during launch

### Verify Native Module Versions

```bash
# Check what's actually in Podfile.lock
grep -A 2 "ExpoLinearGradient" ios/Podfile.lock
grep -A 2 "ExpoBlur" ios/Podfile.lock
grep -A 2 "Expo " ios/Podfile.lock
```

Should show:
```
  - ExpoLinearGradient (15.0.8):
  - ExpoBlur (14.0.1):
  - Expo (54.0.25):
```

## Related Issues

- New Architecture compatibility fixes (3 patches applied)
- `expo-linear-gradient` version mismatch between package.json and Podfile.lock
- Build artifacts not properly cleaned between builds

## Next Steps

1. Perform complete clean build (see Solution Steps above)
2. Test locally with Release configuration on a real device
3. Upload new build to TestFlight
4. Monitor for crashes in TestFlight console

If the crash persists after a clean build, we may need to:
- Create patches for specific Expo modules
- Report the issue to Expo team
- Consider downgrading to a stable Expo SDK version

