# Onboarding Flow Implementation Guide

## Overview

A complete 6-screen onboarding + workout creation flow has been implemented for the Workout Tracker app. Users can now:
- Sign in with Apple or continue as guest
- Set their training schedule preferences
- Choose from 7 pre-built templates or create a custom plan
- Edit exercises with drag-to-reorder functionality
- Parse custom workout plans from text
- Review and finalize their training cycle

## 📦 Required Dependencies

Before running the app, install these packages:

```bash
# Core dependencies (if not already installed)
npm install zustand @react-native-async-storage/async-storage

# Bottom sheets and gestures
npm install @gorhom/bottom-sheet react-native-reanimated react-native-gesture-handler

# Draggable list
npm install react-native-draggable-flatlist
```

### Additional Setup

1. **react-native-reanimated**: Add to `babel.config.js`:
```javascript
module.exports = {
  presets: ['babel-preset-expo'],
  plugins: ['react-native-reanimated/plugin'], // Add this line
};
```

2. **react-native-gesture-handler**: Wrap your app (already done in `App.tsx`)

## 📁 File Structure

### Types
- `src/types/workout.ts` - All TypeScript types for the onboarding flow

### Data & Utilities
- `src/data/templates.ts` - 8 template definitions with metadata
- `src/data/exercises.json` - 67 common exercises library
- `src/utils/templateGenerator.ts` - Template-to-workout mapping logic
- `src/utils/exerciseLibrary.ts` - Exercise search and filtering
- `src/utils/parsePlanText.ts` - Raw text parser for custom plans

### State Management
- `src/store/useOnboardingStore.ts` - Zustand store with AsyncStorage persistence

### Components
- `src/components/common/ProgressHeader.tsx` - Step indicator header
- `src/components/common/StickyFooter.tsx` - Bottom CTA button
- `src/components/templates/TemplateCard.tsx` - Selectable template card
- `src/components/exercises/ExerciseRow.tsx` - Individual exercise display
- `src/components/exercises/AddExerciseBottomSheet.tsx` - Add exercise with search
- `src/components/exercises/EditExerciseBottomSheet.tsx` - Edit exercise details

### Screens
- `src/screens/onboarding/WelcomeScreen.tsx` - Auth entry point
- `src/screens/onboarding/ScheduleSetupScreen.tsx` - Days/week and session length
- `src/screens/onboarding/TemplatePickerScreen.tsx` - Template selection
- `src/screens/onboarding/TemplateEditorScreen.tsx` - Edit exercises with drag-to-reorder
- `src/screens/onboarding/CustomTemplateInputScreen.tsx` - Paste custom plan
- `src/screens/onboarding/ReviewCreateCycleScreen.tsx` - Final review and create

### Navigation
- `src/navigation/OnboardingStack.tsx` - Onboarding flow navigator
- `src/navigation/RootNavigator.tsx` - Root gating logic
- `src/navigation/AppNavigator.tsx` - Modified to work without NavigationContainer

## 🎯 User Flow

### Path 1: Template-Based (Recommended)
1. **Welcome** → Continue with Apple or as Guest
2. **Schedule Setup** → Select days/week (1-7) and session length (30-90 min)
3. **Template Picker** → Choose from 7 templates:
   - Full Body
   - Upper/Lower Split
   - Push/Pull/Legs
   - Bro Split
   - Strength Focus (5/3/1)
   - Powerbuilding
   - Hybrid Athlete
4. **Template Editor** → 
   - View days generated based on template + preferences
   - Drag to reorder exercises
   - Tap to edit (sets, reps, rest)
   - Add new exercises from library (search + filter)
5. **Review** → Select cycle length (4/6/8 weeks) and create

### Path 2: Custom Text Input
1-2. Same as Path 1
3. **Template Picker** → Select "Create Your Own"
4. **Custom Input** → 
   - Paste workout plan text
   - Parser detects days and exercises
   - Supports formats like "3x8", "4 sets of 10", etc.
5. **Review** → Same as Path 1

## 🧩 Template Logic

Templates automatically adapt to the user's `daysPerWeek`:

### Full Body
- 1-2 days: A/B split
- 3 days: A/B/C split
- 4+ days: A/B/C/D (repeating if needed)

### Upper/Lower
- 3 days: Upper A / Lower A / Upper B
- 4 days: Upper A / Lower A / Upper B / Lower B
- 5+ days: Adds "Arms + Core" and "Conditioning"

### Push/Pull/Legs (PPL)
- 3 days: Push / Pull / Legs
- 4 days: Push / Pull / Legs / Push
- 5-6 days: Full PPL twice per week

### Bro Split
- 3 days: Upper / Lower / Arms+Shoulders
- 4 days: Chest+Tris / Back+Biceps / Legs / Shoulders+Arms
- 5 days: Chest / Back / Legs / Shoulders / Arms

### Strength (5/3/1-inspired)
- 3 days: Squat / Bench / Deadlift
- 4+ days: Adds Overhead Press

### Powerbuilding
- 3 days: Upper Strength / Lower Strength / Full Body Hypertrophy
- 4+ days: Upper Strength / Lower Strength / Upper Hypertrophy / Lower Hypertrophy

### Hybrid
- 3 days: Strength A / Conditioning / Strength B
- 4+ days: Adds more conditioning and full-body work

Each day is pre-populated with 4-6 exercises tailored to the day's focus.

## 💾 Data Persistence

### Storage Keys
- `@app/onboardingState` - Auth status, prefs, draft, completion flag
- `@app/cycles` - Saved cycles and active cycle ID

### Store Actions
- `hydrate()` - Load from AsyncStorage on app start
- `setAuthStatus()` - Update auth state
- `setPrefs()` - Update schedule preferences
- `startDraftFromTemplate()` - Initialize draft from template
- `startDraftFromCustomText()` - Initialize empty draft
- `addExerciseToDay()` - Add exercise to specific day
- `removeExerciseFromDay()` - Remove exercise
- `reorderExercisesInDay()` - Update exercise order
- `updateExercise()` - Modify exercise properties
- `setRawText()` - Store custom plan text
- `parseRawTextIntoDraft()` - Parse text into structured days
- `finalizeCycle()` - Create SavedCycle and complete onboarding

## 🎨 Styling

Consistent design system with:
- Primary color: `#FD6B00` (orange)
- Text colors: `#000000` (primary), `#817B77` (secondary), `#3C3C43` (tertiary)
- Backgrounds: `#FFFFFF` (cards), `#F8F8F8` (canvas), `#E3E6E0` (chips)
- Typography: SF Pro (system default)
- Spacing: 8px grid system

## 🔄 Gating Logic (RootNavigator)

```
App Start
  ↓
Hydrate Stores
  ↓
Check: authStatus === 'unknown' OR !hasCompletedOnboarding OR !activeCycleId
  ├─ YES → Show OnboardingStack
  └─ NO → Show AppTabs (main app)
```

## 🧪 Testing Checklist

- [ ] Fresh install shows Welcome screen
- [ ] Apple sign-in updates authStatus
- [ ] Guest sign-in works
- [ ] Schedule prefs persist across restarts
- [ ] All 7 templates generate correct day titles
- [ ] Template exercises match day focus
- [ ] Drag-to-reorder works smoothly
- [ ] Add exercise search and filters work
- [ ] Edit exercise saves changes
- [ ] Delete exercise removes from day
- [ ] Custom text parser handles various formats
- [ ] Review screen shows accurate summary
- [ ] Create cycle navigates to main app
- [ ] Returning users skip onboarding

## 📝 Notes

1. **Exercise defaults**: All template exercises start with sensible defaults (e.g., 3 sets, 8-12 reps, 90s rest)
2. **Validation**: Cannot proceed to Review if any day has 0 exercises
3. **Parse flexibility**: Custom text parser is forgiving - always returns something even on parse failures
4. **ID generation**: Uses timestamp + random string for uniqueness
5. **No AI trainer**: Template selection and defaults are rule-based, not AI-powered

## 🚀 Next Steps

1. Install dependencies (see above)
2. Run `npm start` or `expo start`
3. Test onboarding flow end-to-end
4. Customize colors/fonts if needed in individual files
5. Add analytics events at key points (optional)
6. Implement actual Apple sign-in (currently stubbed)

## 🐛 Troubleshooting

### "Cannot find module @gorhom/bottom-sheet"
→ Run `npm install @gorhom/bottom-sheet react-native-reanimated`

### Bottom sheets not opening
→ Ensure GestureHandlerRootView wraps app (already done)
→ Add reanimated plugin to babel.config.js

### Drag-to-reorder not working
→ Install `react-native-draggable-flatlist`
→ Ensure GestureHandlerRootView is present

### Store not persisting
→ Check AsyncStorage permissions
→ Verify `hydrate()` is called in RootNavigator

### Parser not detecting exercises
→ Ensure text has patterns like "3x8" or "3 sets of 8"
→ Use "Insert example" button to see expected format

---

**Implementation Complete!** 🎉

All files generated, navigation wired, and ready to run. Install dependencies and test the flow.

