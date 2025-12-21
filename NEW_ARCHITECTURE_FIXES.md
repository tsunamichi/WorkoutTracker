# New Architecture Compatibility Fixes

This document describes the fixes applied to make third-party React Native libraries compatible with React Native 0.81.5's New Architecture.

---

## Overview

The app uses `newArchEnabled: true` in `app.json`, which enables React Native's New Architecture (Fabric + TurboModules). Several third-party libraries had compatibility issues with the New Architecture APIs in React Native 0.81.5.

---

## Fixes Applied

### 1. react-native-safe-area-context (v4.14.0)

**File:** `common/cpp/react/renderer/components/safeareacontext/RNCSafeAreaViewShadowNode.cpp`

**Issue:** 
- Used `StyleLength.unit()` method which doesn't exist in RN 0.81.5's Yoga implementation
- Error: `No member named 'unit' in 'facebook::yoga::StyleLength'`

**Fix:**
Changed from checking unit type to checking if value is defined:

```cpp
// Before
if (edge.unit() != Unit::Undefined) {
  return edge;
}

// After  
if (edge.value().isDefined()) {
  return edge;
}
```

**Patch File:** `patches/react-native-safe-area-context+4.14.0.patch`

---

### 2. react-native-screens (v4.6.0)

**File:** `cpp/RNSScreenRemovalListener.cpp`

**Issue:**
- Used `mutation.parentShadowView` field which doesn't exist in RN 0.81.5's ShadowViewMutation structure
- Error: `No member named 'parentShadowView' in 'facebook::react::ShadowViewMutation'`

**Fix:**
Removed the parent component check since it's not necessary for the removal listener:

```cpp
// Before
if (mutation.type == ShadowViewMutation::Type::Remove &&
    mutation.oldChildShadowView.componentName != nullptr &&
    strcmp(mutation.parentShadowView.componentName, "RNSScreenStack") == 0) {
  listenerFunction_(mutation.oldChildShadowView.tag);
}

// After
if (mutation.type == ShadowViewMutation::Type::Remove &&
    mutation.oldChildShadowView.componentName != nullptr) {
  listenerFunction_(mutation.oldChildShadowView.tag);
}
```

The parent check was overly restrictive and not needed for the listener to function correctly.

**Patch File:** `patches/react-native-screens+4.6.0.patch`

---

## How Patches Work

### Automatic Application

Patches are automatically applied after `npm install` thanks to the `postinstall` script in `package.json`:

```json
{
  "scripts": {
    "postinstall": "patch-package"
  }
}
```

### Manual Application

If you need to manually apply patches:

```bash
npx patch-package
```

### Creating New Patches

If you need to modify a dependency:

1. Make changes directly in `node_modules/package-name/`
2. Run: `npx patch-package package-name`
3. Commit the generated patch file in `patches/`

---

## Why These Issues Only Appear in TestFlight/Release Builds

**Development builds:**
- Use Metro bundler with hot reloading
- JavaScript-only changes reload without recompiling native code
- May use cached compiled modules

**Release/Production builds:**
- Compile all native modules from scratch
- No caching from development
- Enable New Architecture optimizations
- Trigger C++ compilation that development builds may skip

This is why you didn't see these errors in local development but they appeared when building for Xcode/TestFlight.

---

## Commits

1. **bb725c6** - Fix Yoga compatibility issue with react-native-safe-area-context
2. **0b4e75a** - Fix New Architecture compatibility for react-native-screens

---

## Testing

To verify the fixes work:

```bash
# Clean build
cd ios
xcodebuild clean -workspace WorkoutTracker.xcworkspace -scheme WorkoutTracker

# Test build
xcodebuild -workspace WorkoutTracker.xcworkspace \
  -scheme WorkoutTracker \
  -configuration Release \
  -sdk iphoneos \
  -arch arm64
```

Or build directly in Xcode with ⌘+B.

---

## Future Considerations

These patches should be temporary. Monitor for updates:

- **react-native-safe-area-context**: Watch for v4.15.0+ which may have official New Architecture support
- **react-native-screens**: Watch for v4.7.0+ for official fixes

When updating these packages, test if patches are still needed:

```bash
# Update package
npm install react-native-safe-area-context@latest

# Try building without patch
npx patch-package --reverse

# If build fails, recreate patch
# If build succeeds, remove the patch file
```

---

## Related Issues

- React Native New Architecture: https://reactnative.dev/docs/the-new-architecture/landing-page
- Yoga Layout Engine: https://yogalayout.dev/
- react-native-safe-area-context repo: https://github.com/th3rdwave/react-native-safe-area-context
- react-native-screens repo: https://github.com/software-mansion/react-native-screens

