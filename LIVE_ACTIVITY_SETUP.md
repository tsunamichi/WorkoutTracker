# iOS Live Activity Setup Guide

This guide explains how to set up and test the Live Activity feature for the Workout Timer.

## Overview

The Live Activity implementation provides:
- **Dynamic Island** support showing exercise name and countdown timer
- **Lock Screen** widget with timer progress
- **Background timer** that continues counting when app is minimized
- **Pause/Resume** functionality with frozen timer display
- **Automatic cleanup** when timer completes

## Architecture

### Components

1. **Native Module** (`LiveActivityModule.swift`)
   - Manages Live Activity lifecycle
   - Bridges between React Native and ActivityKit

2. **Activity Attributes** (`WorkoutTimerAttributes.swift`)
   - Defines the data model for the Live Activity
   - Fixed: `id`
   - Dynamic: `exerciseName`, `phase`, `endDate`, `isPaused`, `pausedRemainingSeconds`

3. **Widget Extension** (`WorkoutTimerWidget/`)
   - SwiftUI views for Dynamic Island and Lock Screen
   - Minimal, glanceable design
   - System-managed countdown using `Text(endDate, style: .timer)`

4. **React Native Hook** (`useLiveActivity.ts`)
   - Custom hook managing Live Activity lifecycle
   - Handles local notifications
   - Provides clean API for timer integration

## Xcode Setup (Required)

### Step 1: Add Widget Extension Target

1. Open `WorkoutTracker.xcworkspace` in Xcode
2. **File → New → Target**
3. Select **Widget Extension**
4. Configure:
   - Product Name: `WorkoutTimerWidget`
   - Team: Your development team
   - Language: Swift
   - Include Configuration Intent: **No**
5. Click **Finish**
6. When prompted "Activate WorkoutTimerWidget scheme?", click **Activate**

### Step 2: Add Files to Widget Target

Add these files to the Widget Extension target:

1. `WorkoutTimerWidgetBundle.swift` → WorkoutTimerWidget target
2. `WorkoutTimerLiveActivity.swift` → WorkoutTimerWidget target
3. `WorkoutTimerAttributes.swift` → **Both** WorkoutTracker AND WorkoutTimerWidget targets
   - Important: This file must be in both targets

### Step 3: Configure Widget Target

1. Select **WorkoutTimerWidget** target in project settings
2. **General** tab:
   - Deployment Target: iOS 16.1 or later
   - Bundle Identifier: `com.tsunamichi.workouttracker.WorkoutTimerWidget`

3. **Info** tab:
   - Verify `NSExtension` → `NSExtensionPointIdentifier` = `com.apple.widgetkit-extension`

4. **Signing & Capabilities**:
   - Enable automatic signing
   - Add capability: **App Groups** (if needed for data sharing)

### Step 4: Update Main App Target

1. Select **WorkoutTracker** target
2. **Signing & Capabilities**:
   - Verify **Live Activities** capability exists
   - If not, click **+ Capability** → **Push Notifications** → **Live Activities**

3. **Build Phases**:
   - Ensure Widget Extension is embedded

### Step 5: Add Native Module to Build

1. In Xcode project navigator, create folder: `WorkoutTracker/LiveActivity`
2. Add files to this folder:
   - `LiveActivityModule.swift`
   - `LiveActivityModule.m`
   - `WorkoutTimerAttributes.swift`
3. Ensure they're added to **WorkoutTracker** target (check target membership)
4. For `WorkoutTimerAttributes.swift`, also add to **WorkoutTimerWidget** target

### Step 6: Update Bridging Header

If you don't have a bridging header:
1. Xcode will prompt to create one when you add Swift files
2. Accept the prompt

Add to bridging header (`WorkoutTracker-Bridging-Header.h`):
```objc
#import <React/RCTBridgeModule.h>
```

### Step 7: Build Settings

Ensure these settings for WorkoutTracker target:
- **Swift Objc Bridging Header**: `$(SRCROOT)/WorkoutTracker-Bridging-Header.h`
- **Swift Language Version**: Swift 5.x
- **Deployment Target**: iOS 16.1+

## Testing

### Prerequisites

- **Physical device** running iOS 16.1+ (Live Activities don't work on simulator)
- Device must have **Live Activities enabled** in Settings
- iPhone 14 Pro or later recommended for Dynamic Island (works on other devices on Lock Screen)

### Test Scenarios

#### 1. Start Timer
```
Expected behavior:
✅ Dynamic Island shows exercise name + countdown
✅ Lock Screen shows timer widget
✅ Timer continues counting in background
```

#### 2. Minimize App
```
Expected behavior:
✅ Dynamic Island stays visible
✅ Countdown continues accurately
✅ Lock Screen widget updates
```

#### 3. Pause Timer
```
Expected behavior:
✅ Dynamic Island shows "Paused · MM:SS" with frozen time
✅ Timer stops counting
✅ Notification cancelled
```

#### 4. Resume Timer
```
Expected behavior:
✅ Dynamic Island shows live countdown again
✅ Timer resumes from paused time
✅ Notification rescheduled
```

#### 5. Phase Change (Exercise → Rest)
```
Expected behavior:
✅ Live Activity updates with new phase label
✅ Exercise name updates
✅ Countdown resets for rest period
```

#### 6. Complete Timer
```
Expected behavior:
✅ Live Activity dismisses immediately
✅ Notification fires (if app backgrounded)
✅ No lingering Live Activity
```

#### 7. Exit During Timer
```
Expected behavior:
✅ Alert shows confirmation
✅ "Resume" restarts Live Activity
✅ "Exit" ends Live Activity
```

### Debug Tips

1. **Check Console Logs**:
   ```
   ✅ Live Activity started: timer-{id}
   ✅ Live Activity updated
   ✅ Live Activity paused: {id} {seconds}
   ✅ Live Activity ended: {id}
   ```

2. **Verify Live Activity Support**:
   ```typescript
   // In app, check:
   const { isSupported } = useLiveActivity();
   console.log('Live Activities supported:', isSupported);
   ```

3. **Check Device Settings**:
   - Settings → Face ID & Passcode → Allow access when locked: Live Activities (ON)

4. **Widget Debugging**:
   - In Xcode, select WorkoutTimerWidget scheme
   - Run on device
   - Choose "Live Activity" as widget type
   - Use Preview canvas to test UI

## Troubleshooting

### Issue: Live Activity not appearing

**Check:**
- [ ] Device is iOS 16.1+
- [ ] Live Activities enabled in Settings
- [ ] Running on physical device (not simulator)
- [ ] Widget Extension properly added to project
- [ ] `WorkoutTimerAttributes.swift` in both targets
- [ ] No build errors in Xcode

### Issue: "Module not found: LiveActivityModule"

**Fix:**
- Ensure `LiveActivityModule.swift` is added to WorkoutTracker target
- Check bridging header is configured
- Clean build folder (Cmd+Shift+K) and rebuild

### Issue: Live Activity shows but doesn't update

**Check:**
- Console logs for update calls
- Ensure `endTimestampMs` is being calculated correctly
- Verify `updateLiveActivity` is being called with correct parameters

### Issue: Timer continues after app closed

**This is expected behavior!** Live Activities are designed to continue independently.
- The local notification will fire at timer end
- User can dismiss from Lock Screen if needed

## API Reference

### TypeScript API

```typescript
const {
  isSupported,
  startLiveActivity,
  updateLiveActivity,
  pauseLiveActivity,
  resumeLiveActivity,
  endLiveActivity,
} = useLiveActivity();

// Start
await startLiveActivity({
  id: 'timer-123',
  exerciseName: 'Bench Press - Set 1/3',
  phase: 'EXERCISE',
  isRunning: true,
  endTimestampMs: Date.now() + 30000, // 30 seconds
});

// Update (phase change)
await updateLiveActivity({
  id: 'timer-123',
  exerciseName: 'Rest',
  phase: 'REST',
  endTimestampMs: Date.now() + 10000,
});

// Pause
await pauseLiveActivity('timer-123', remainingMs);

// Resume
await resumeLiveActivity('timer-123', remainingMs, exerciseName);

// End
await endLiveActivity('timer-123');
```

### Phases

- `EXERCISE`: Active work phase (blue in Dynamic Island)
- `REST`: Rest between sets/rounds (displays "Rest")
- `ROUND`: Round rest (displays "Round Rest")
- `COOLDOWN`: Cool down phase

## Best Practices

1. **Single Activity**: Only one Live Activity active at a time
   - New timer automatically ends previous Live Activity

2. **Always End**: End Live Activity when:
   - Timer completes
   - User exits timer screen
   - User deletes timer

3. **Update on Phase Change**: Update Live Activity when:
   - Exercise → Rest transition
   - Set/round change
   - Exercise name changes

4. **Pause State**: Use `isPaused` + `pausedRemainingSeconds` for frozen display
   - Better UX than stopping countdown

5. **Error Handling**: Gracefully degrade on unsupported devices
   - Check `isSupported` before operations
   - Timer works normally without Live Activity

## Production Checklist

Before releasing:
- [ ] Tested on iOS 16.1 device
- [ ] Tested Dynamic Island (iPhone 14 Pro+)
- [ ] Tested Lock Screen widget (all devices)
- [ ] Verified pause/resume cycle
- [ ] Confirmed timer completion cleanup
- [ ] Tested with another app's Live Activity active
- [ ] Verified all console logs removed for production
- [ ] Widget Extension properly signed for distribution
- [ ] App Group configured if needed
- [ ] Privacy manifest updated if required

## Resources

- [Apple ActivityKit Documentation](https://developer.apple.com/documentation/activitykit)
- [Live Activities Design Guidelines](https://developer.apple.com/design/human-interface-guidelines/live-activities)
- [Dynamic Island Guidelines](https://developer.apple.com/design/human-interface-guidelines/components/system-experiences/live-activities#dynamic-island)

