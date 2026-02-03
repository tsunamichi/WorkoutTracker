# Warmup Feature Guide

## ✅ Part 1: Your Warmup Example Parsed

### Your Input:
```
- 90/90 Hip Rotations x 6 reps
- World's Greatest Stretch x 5 reps
- Half-Kneeling Hip Flexor 30 sec
repeat this superset 2 times

- Knee-to-Wall Ankle Mobilization x 8
- Wall Sit x 45sec
repeat this superset 2 times

- Quadruped Thoracic Rotations x 6 reps
- Scapular Push-Ups x 8 reps
repeat this superset 2 times
```

### Parsed Structure:

**Superset 1 (2 rounds):**
- 90/90 Hip Rotations: 6 reps
- World's Greatest Stretch: 5 reps
- Half-Kneeling Hip Flexor: 30 seconds (time-based)

**Superset 2 (2 rounds):**
- Knee-to-Wall Ankle Mobilization: 8 reps
- Wall Sit: 45 seconds (time-based)

**Superset 3 (2 rounds):**
- Quadruped Thoracic Rotations: 6 reps
- Scapular Push-Ups: 8 reps

### Data Structure:
Each superset gets its own `cycleId` and exercises are ordered with `cycleOrder`. When executed, the app will show:
- **Round 1**: Hip Rotations (A) → Greatest Stretch (B) → Hip Flexor (C)
- **Round 2**: Hip Rotations (A) → Greatest Stretch (B) → Hip Flexor (C)

---

## ✅ Part 2: How to Use the New Feature

### In the AI Workout Creation Screen:

You have **TWO OPTIONS** for adding warmups:

#### Option 1: Include Warmup in Main Text (Recommended)
Just paste everything together - the parser will automatically extract the warmup section!

```
⭐️ WEEK 1

Warm up:
- 90/90 Hip Rotations x 6 reps
- World's Greatest Stretch x 5 reps
- Half-Kneeling Hip Flexor 30 sec
repeat this superset 2 times

DAY 1 — Pull
• Rear Delt Row — 3×10 @ 120 lb
• Barbell Row — 3×10 @ 105 lb
```

The parser will:
- Detect "Warm up:" section
- Extract all warmup exercises until it sees "DAY"
- Parse the rest as your workout
- Automatically attach warmup to the workout template

#### Option 2: Separate Input Fields
1. **Navigate to**: Create Workout with AI (or Create Plan with AI)
2. **Enter Your Workout**: Paste your workout details in the main text area
3. **Add Warmup (Optional)**:
   - Click "Warmup (Optional)" button to see format instructions
   - Paste your warmup in the separate "Warmup" text area below
   - The warmup will be automatically attached to the workout template

### Supported Formats:
   ```
   - Exercise x Number reps
   - Exercise x Number sec
   - Exercise Number sec (without 'x')
   repeat this superset N times
   ```

5. **Click "Create Workout"** or "Create Plan" - Your warmup is now part of the workout!

---

## Format Examples

### Example 1: Simple Superset
```
- Arm Circles x 10 reps
- Leg Swings x 10 reps
repeat this superset 2 times
```

### Example 2: Mix of Reps and Time
```
- Jumping Jacks x 20 reps
- Plank Hold 30 sec
- High Knees x 30 reps
repeat this superset 3 times
```

### Example 3: Multiple Supersets
```
- Exercise 1 x 10 reps
- Exercise 2 45 sec
repeat this superset 2 times

- Exercise 3 x 8 reps
- Exercise 4 x 12 reps
repeat this superset 3 times
```

---

## Technical Details

### Files Created/Modified:

1. **`src/utils/warmupParser.ts`** - Parser utility
   - `parseWarmupText()` - Parses warmup text into groups
   - `convertToWarmupItems()` - Converts to app format
   - Handles supersets, reps, time-based exercises

2. **`src/screens/AIWorkoutCreationScreen.tsx`** - Updated UI
   - Added warmup input section
   - Added warmup format instructions
   - Automatically attaches warmup to workout templates

3. **`src/utils/warmupParser.test.ts`** - Test/demo file
   - Shows how your example parses
   - Can run to see the output structure

### How It Works:

1. You paste warmup text in the format shown above
2. Parser identifies exercise groups (supersets)
3. Extracts:
   - Exercise names
   - Reps or seconds
   - Number of rounds
4. Generates `cycleId` and `cycleOrder` for supersets
5. Attaches to workout template as `warmupItems`
6. Displays properly in warm-up execution with round tracking

---

## Future Enhancements (Optional):

- Support for weight: `- Goblet Squat x 10 reps @ 35 lb`
- Support for ranges: `- Push-ups x 8-12 reps`
- Auto-detect exercises from your library
- Bulk edit warm-ups across multiple templates

---

## Testing Your Warmup:

1. Create a workout with your warmup text
2. Go to the workout template
3. You should see warm-up exercises with cycle indicators (A, B, C)
4. During execution, exercises will show round progression
5. Complete all exercises in a round before moving to next round

🎉 **Your warmup is now fully integrated!**
