# 🧪 Testing Guide - Workout Tracker

## ✅ All Issues Fixed!

### **Issue 1: Week Duration** ✓
**Problem:** Cycle showed "Week 1 of 8" with only 1 week input  
**Fix:** Now parses "Week X" to determine cycle length  
**Example:** "Week 8" = 8-week cycle

### **Issue 2: Cycle Card Info** ✓
**Problem:** Too much metadata on cycle cards  
**Fix:** Simplified to show only:
- Cycle number
- Starting date
- Weeks left

### **Issue 3: Cycle Sorting** ✓
**Problem:** Cycles not sorted correctly  
**Fix:** Now sorted by creation date (newest first)

### **Issue 4: Today Tab Not Clickable** ✓
**Problem:** Tapping workout cards did nothing  
**Fix:** Changed `<View>` to `<TouchableOpacity>`

### **Issue 5: Exercises Not Persisting** ✓
**Problem:** Custom exercises not saved to store  
**Fix:** Using `addExercise()` to persist to Zustand + AsyncStorage

---

## 📋 **Test Format**

### **Create a Cycle with THIS exact input:**

```
Week 8

Push: Push A
- Bench Press: 4 × 6-8 @ 50kg
- Overhead Press: 3 × 8-10 @ 35kg
- Incline Press: 3 × 10-12 @ 30kg

Pull: Pull A
- Deadlift: 4 × 5-6 @ 80kg
- Pull-ups: 3 × 8-10 @ 0kg
```

---

## 🔍 **Expected Console Output**

When you create the cycle, you should see:

```
=== PARSING PLAN ===
Full plan: ## Cycle 1 Plan...
Parsed cycle length: 8 weeks
Found 3 workout sections

--- Processing section ---
Workout: Push A Type: Push
Found 3 exercise lines
Parsed exercise: Bench Press sets: 4 reps: 6
Creating new exercise: Bench Press (or using seed-0)
Added exercise: Bench Press {...}
Parsed exercise: Overhead Press sets: 3 reps: 8
Added exercise: Overhead Press {...}
Parsed exercise: Incline Press sets: 3 reps: 10
Creating new exercise: Incline Press
Added exercise: Incline Press {...}
Created template: Push A with 3 exercises

--- Processing section ---
Workout: Pull A Type: Pull
Found 2 exercise lines
Parsed exercise: Deadlift sets: 4 reps: 5
Added exercise: Deadlift {...}
Parsed exercise: Pull-ups sets: 3 reps: 8
Added exercise: Pull-ups {...}
Created template: Pull A with 2 exercises

=== FINAL CYCLE ===
Total workouts: 2
- Push A: 3 exercises
- Pull A: 2 exercises

About to save cycle: {...}
Cycle has 2 workouts
  Push A: 3 exercises
  Pull A: 2 exercises
Cycle saved!
```

---

## 📱 **Then Test Today Tab**

### **Go to Today tab, you should see:**

```
Cycle 1
Week 1 of 8

┌─────────────────────────┐
│ Push A         [Today]  │
│ 3 exercises             │
│ [Start Workout →]       │
└─────────────────────────┘

┌─────────────────────────┐
│ Pull A                  │
│ 2 exercises             │
└─────────────────────────┘
```

### **Tap on "Push A" card:**

**Expected Console Output:**
```
Card tapped: Push A
WorkoutExecutionScreen rendered
Workout: Push A
Exercises: 3
Exercise library size: [number]
Exercise 0: seed-0 Found: Bench Press
Exercise 1: seed-4 Found: Overhead Press  
Exercise 2: ex-... Found: Incline Press
```

**Expected UI:**
- Full-screen workout execution page opens
- Header: "Push A"
- Progress: "0 / 3 exercises"
- List of 3 exercises:
  1. Bench Press
  2. Overhead Press
  3. Incline Press

---

## 🐛 **If Exercises Still Don't Show**

### **Check Console For:**

1. **Are exercises being created?**
   ```
   Look for: "Creating new exercise: [name]"
   ```

2. **Are exercises in the cycle?**
   ```
   Look for: "Push A: 3 exercises"
   Should see array of exercise objects
   ```

3. **Are exercises in library when rendering?**
   ```
   Look for: "Exercise library size: X"
   Look for: "Exercise 0: ... Found: [name]" or "NOT FOUND"
   ```

4. **Is the execution screen opening?**
   ```
   Look for: "Card tapped: Push A"
   Look for: "WorkoutExecutionScreen rendered"
   ```

---

## 📊 **What the Logs Will Tell Us**

### **Scenario 1: Exercises NOT in library**
```
Exercise 0: ex-12345 NOT FOUND
```
→ Exercises not being saved to store

### **Scenario 2: Wrong exercise IDs**
```
Exercise 0: seed-0 Found: Squat
```
→ IDs are being mismatched

### **Scenario 3: Empty exercises array**
```
Exercises: 0
```
→ Exercises being lost during save

### **Scenario 4: Screen not opening**
```
No "Card tapped" log
```
→ TouchableOpacity not wired correctly

---

## 🚀 **Test Flow**

1. **Delete any existing cycles**
2. **Create fresh cycle** with the format above
3. **Watch console** during creation
4. **Go to Today tab**
5. **Tap "Push A" card**
6. **Watch console** for execution screen logs
7. **Report back:**
   - Did the screen open?
   - How many exercises showed?
   - What does the console say?

With these extensive logs, we'll identify the exact issue! 🔍

