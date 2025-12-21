# Live Activity & Dynamic Island Setup Guide

## Overview
I've created all the necessary code files for Dynamic Island integration. Now we need to configure Xcode to build the Widget Extension.

## Files Created
✅ **Native iOS Files:**
- `ios/RestTimerWidget/Info.plist` - Widget Extension configuration
- `ios/RestTimerWidget/RestTimerAttributes.swift` - Live Activity data structure
- `ios/RestTimerWidget/RestTimerWidget.swift` - Widget UI (Dynamic Island layouts)
- `ios/RestTimerLiveActivity.swift` - Native module for React Native bridge
- `ios/RestTimerLiveActivity.m` - Objective-C bridge

✅ **React Native Integration:**
- `src/modules/RestTimerLiveActivity.ts` - TypeScript wrapper
- Updated `WorkoutExecutionScreen.tsx` with Live Activity calls
- Updated `app.json` with Live Activity support

## Xcode Setup Steps

### 1. Open Xcode Project
```bash
cd ios
open WorkoutTracker.xcworkspace
```

### 2. Add Widget Extension Target

1. In Xcode, select the project in the navigator (blue WorkoutTracker icon at top)
2. Click the "+" button at the bottom of the Targets list
3. Search for "Widget Extension"
4. Click "Next"
5. Configure the extension:
   - **Product Name:** `RestTimerWidget`
   - **Bundle Identifier:** `com.tsunamichi.workouttracker.RestTimerWidget`
   - **Include Live Activity:** Check this box ✅
   - **Organization Identifier:** `com.tsunamichi`
   - **Language:** Swift
6. Click "Finish"
7. When prompted "Activate 'RestTimerWidget' scheme?", click "Activate"

### 3. Add Widget Files to Target

1. In the Project Navigator, find the `RestTimerWidget` folder
2. Delete the automatically generated files:
   - `RestTimerWidgetLiveActivity.swift`
   - `RestTimerWidget.swift`
   - `RestTimerWidgetBundle.swift`
3. Right-click the `RestTimerWidget` folder
4. Select "Add Files to 'WorkoutTracker'..."
5. Navigate to your project's `ios/RestTimerWidget/` folder
6. Select all Swift files:
   - `RestTimerAttributes.swift`
   - `RestTimerWidget.swift`
7. Make sure **Target Membership** includes `RestTimerWidget` ✅
8. Click "Add"

### 4. Add Native Module Files

1. In the Project Navigator, right-click the `WorkoutTracker` folder (main app)
2. Select "Add Files to 'WorkoutTracker'..."
3. Navigate to your project's `ios/` folder
4. Select:
   - `RestTimerLiveActivity.swift`
   - `RestTimerLiveActivity.m`
5. Make sure **Target Membership** includes `WorkoutTracker` (main app) ✅
6. Click "Add"

### 5. Configure Build Settings

#### For RestTimerWidget Target:
1. Select `RestTimerWidget` target
2. Go to "Build Settings"
3. Search for "Swift Language Version"
4. Set to **Swift 5** or later
5. Search for "iOS Deployment Target"
6. Set to **16.1** or later (required for Dynamic Island)

#### For WorkoutTracker Main App:
1. Select `WorkoutTracker` target
2. Go to "Signing & Capabilities"
3. Click "+ Capability"
4. Add **"Push Notifications"** (required for Live Activities)
5. Ensure your provisioning profile supports Live Activities

### 6. Update Info.plist

The main app's `Info.plist` should already have these keys (added via app.json):
```xml
<key>NSSupportsLiveActivities</key>
<true/>
<key>NSSupportsLiveActivitiesFrequentUpdates</key>
<true/>
```

If not present, add them manually in Xcode.

### 7. Add ActivityKit Framework

1. Select the `WorkoutTracker` target (main app)
2. Go to "General" tab
3. Scroll to "Frameworks, Libraries, and Embedded Content"
4. Click the "+" button
5. Search for "ActivityKit"
6. Add `ActivityKit.framework`
7. Set to **"Do Not Embed"**

Repeat for the `RestTimerWidget` target.

### 8. Install Pods

```bash
cd ios
pod install
```

### 9. Build and Run

1. Select a **physical iOS device** (iOS 16.1+)
   - Dynamic Island requires iPhone 14 Pro or later
   - Live Activities require a physical device (not simulator)
2. Select the `WorkoutTracker` scheme
3. Build and run (⌘R)

### 10. Test Dynamic Island

1. Start a workout in the app
2. Tap "record" on a set to start the rest timer
3. You should see the timer appear in the Dynamic Island!
4. Minimize the app - the timer continues running
5. The Dynamic Island shows:
   - **Compact**: Clock icon + remaining time
   - **Expanded**: Exercise name, workout name, timer, progress bar
   - **Minimal**: Clock icon

## Troubleshooting

### Build Errors

**"No such module 'ActivityKit'"**
- Make sure iOS Deployment Target is 16.1+
- Clean build folder (⇧⌘K) and rebuild

**"Undefined symbols for architecture arm64"**
- Check that all files are added to correct targets
- Verify Swift bridging header is configured

**"Module 'RestTimerLiveActivity' not found"**
- Rebuild the app after adding native module files
- Make sure `.m` file is in Compile Sources

### Runtime Errors

**"Live Activities are not enabled"**
- Check Settings > Focus > Do Not Disturb
- Ensure Live Activities are enabled in iOS Settings

**Widget not appearing**
- Restart the device
- Check that provisioning profile includes App Groups capability
- Verify bundle identifier matches exactly

## Testing on Simulator

**Note:** Dynamic Island features require a physical device with Dynamic Island (iPhone 14 Pro or later). However, you can test Live Activities on simulator:

1. Use iPhone 14 Pro simulator (iOS 16.1+)
2. Live Activity will appear as banner notification
3. Dynamic Island features won't be visible

## Additional Resources

- [Apple ActivityKit Documentation](https://developer.apple.com/documentation/activitykit)
- [WidgetKit Documentation](https://developer.apple.com/documentation/widgetkit)
- [Live Activities Guide](https://developer.apple.com/documentation/activitykit/displaying-live-data-with-live-activities)

