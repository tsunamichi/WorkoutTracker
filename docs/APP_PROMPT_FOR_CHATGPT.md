# WorkoutTracker App — Full Context for ChatGPT

Use this document to give ChatGPT (or any AI) complete context about the app: what it is, its goals, flows, every screen, and UX/UI details so it can reason accurately about features, copy, and design.

---

## 1. What the app is

**WorkoutTracker** is a **mobile-first (React Native / Expo) strength-training and progress app** for iOS (and optionally Android). It is **schedule-first**: the user sees a week view (Schedule tab), picks a day, and either starts a scheduled workout, swaps it with another day, or adds a workout. Workouts are built from **templates** (warmup + main exercises + optional accessories). The app also has a **Progress** tab for weekly check-ins (photos, weight), progress gallery, and key lift/volume metrics. There is **no social or discovery**; it’s personal tracking and planning only.

- **Tech:** React Native, Expo (~53), React Navigation (native stack + custom bottom tabs), Zustand store, Supabase (optional backend), i18n (en/es).
- **Platform:** Primarily iOS; design uses safe areas, haptics, and dark theme.

---

## 2. Goals (product & user)

- **Plan the week:** See which days have which workouts; move or add workouts easily (swap, add from templates or AI).
- **Execute workouts in the gym:** One screen per “type” (warmup → main → accessories). Log sets/reps/weight (and time for time-based sets); track completion per exercise and for the whole workout; optional set rest timer.
- **Track progress:** Weekly check-ins (photos + optional weight), progress gallery, body weight history, and metrics (volume, key lifts vs last week).
- **Manage library and plans:** Build/edit workout templates (warmup, main, accessories); create or apply multi-week cycle plans; schedule templates to dates with conflict handling.
- **Keep it simple and fast:** Minimal taps to start a workout; clear states (Start / Resume / Complete); swap/add without opening many screens.

---

## 3. High-level flows

- **Schedule a workout (empty day):** Schedule tab → select day → “Add workout” → AddWorkoutSheet: choose “Blank workout”, “Create with AI”, or an existing template; or “From plan” (pick a plan and a day). Result: a scheduled workout on that date.
- **Swap a workout:** Schedule tab → day that has a workout (not completed, not locked) → “Swap” → swap drawer/sheet: pick another day in the week to swap with, or pick “Rest” to clear. Confirms and updates schedule.
- **Start/Resume workout:** Schedule tab → select day with scheduled workout → tap workout card → navigate to **ExerciseExecution** with `type='main'` (optionally warmup first). User does warmup (if any) → main exercises (log sets) → accessories (if any). Completion is tracked per section; “Complete” marks the workout done and locks it.
- **Progress check-in:** Progress tab → “Weekly check-in” (or similar) → add photos and/or weight → save. Shown in gallery and used for metrics.
- **Create template:** Workouts screen → “Create workout” → WorkoutCreationOptions (Blank / AI) → WorkoutBuilder or AI flow → save as template. Can then be scheduled from AddWorkoutSheet or from a plan.
- **Plans (cycles):** Create or apply a cycle plan (multi-week); apply fills a date range with templates; conflicts (overwriting existing scheduled workouts) can be resolved on CycleConflictsScreen (replace, skip, etc.).

---

## 4. Navigation and tabs

- **Root:** After login (or continue as guest), user sees a **custom tab bar** at the bottom with two tabs: **Schedule** and **Progress**. No standard React Navigation tab navigator; the tab bar is custom (animated indicator, icons + labels).
- **Schedule tab:** Renders **TodayScreen** (week strip + day detail + workout card or empty state + actions).
- **Progress tab:** Renders **ProgressHomeScreen** (header, weekly check-in, metrics, gallery entry, body weight).
- **Stack (over the tab content):** Profile, BodyWeightHistory, ProgressGallery, ProgressLogDetail, History, PlanHistoryDetail, WorkoutBuilder, Workouts, WorkoutTemplateDetail, WarmupEditor, WarmupExecution, AccessoriesEditor, AccessoriesExecution, **ExerciseExecution**, DesignSystem, CycleDetail, CycleConflicts, WorkoutEdit, ExerciseDetail, HIITTimerList, HIITTimerForm, HIITTimerExecution, TemplateEditor, CustomTemplateInput, ReviewCreateCycle, CreateCycleFlow, CreateCycleDayEditor, AIWorkoutCreation, WorkoutCreationOptions.
- **ExerciseExecution** is the main “doing the workout” screen; it receives `workoutKey`, `workoutTemplateId`, and `type: 'warmup' | 'main' | 'core'`.

---

## 5. Screens (summary and UX details)

### 5.1 Schedule tab — TodayScreen

- **Purpose:** Show the current week and let the user select a day, see its scheduled workout (or empty), start/resume it, or add/swap.
- **Layout:**
  - Top: Header with title “Schedule” (or similar), “Today” shortcut (calendar icon) when not on today, and Settings (profile) icon.
  - Below: **ExpandableCalendarStrip** — week strip (e.g. M T W T F S S) with day numbers; selected day highlighted; cycle plan indicators if applicable; completion dots/progress per day.
  - Main content:
    - **If day has a scheduled workout:** A **workout card** with: workout name (title snapshot), exercise count, optional program name, completion % (if started), and a primary button: “Start” / “Resume” / “Complete” (with checkmark). Tapping the card goes to ExerciseExecution (main).
    - **If day is empty:** “No workout planned” (rest day) and a single **“Add workout”** button.
  - **Actions under the card (same row):**
    - If workout exists and not completed/locked: **“Swap”** (swap with another day or rest).
    - If no workout: only **“Add workout”**.
  - **Intervals section:** For the selected day (today or past only): “Interval timers” title; list of completed HIIT timer sessions for that day; “Add timer” to open HIIT timer list. Future days hide this section.
- **UX details:** Rest days are not “empty” in a bad way — they’re explicit. Swap is only offered when the day has a workout and it’s not started/completed/locked. Haptics on day change and important actions.

### 5.2 Add Workout (AddWorkoutSheet) and Swap

- **AddWorkoutSheet:** Bottom drawer. Title: “Add workout for [date]”. Content: create options (Blank workout, Create with AI, etc.), then list of **workout templates** to schedule. Selecting a template schedules it on the selected date and closes. “From plan” can open plan selection (PlanSelectionSheet / ExtractDayFromPlanSheet) to pick a day from a cycle.
- **Swap:** Triggered from TodayScreen “Swap”. Can open a drawer/sheet that shows the same week; user picks another day to swap with (or “Rest” to clear current day). Logic: only uncompleted, non-locked days with no progress (or rest days) are valid targets. After swap, schedule updates and UI refreshes.

### 5.3 Exercise Execution (ExerciseExecutionScreen)

- **Purpose:** Execute one “type” of a workout at a time: warmup, main, or core (accessories). Same screen reused for all three via `type` param.
- **Params:** `workoutKey` (scheduled workout id), `workoutTemplateId`, `type: 'warmup' | 'main' | 'core'`.
- **Flow:** User can land on main directly from Schedule; from there they can open warmup or accessories from the same screen (segments/cards). For each exercise: show sets × reps (or time); user logs weight/reps (or marks time-based); optional rest timer between sets; completion per set and per exercise; “Complete” for the whole workout when on main.
- **UX details:**
  - **Swap exercise (main/warmup/core):** Not a drawer. A **floating overlay** (modal, transparent backdrop): search input **pinned at the bottom** (moves with keyboard); autocomplete list **above** in a **content-sized container** (dynamic height) with **24px side and top padding** and container background; label is **“Create [input]”** for the “add new exercise” row; **no divider** under the last option. Tapping backdrop or completing a swap closes the overlay.
  - Set inputs: weight (kg/lb from settings), reps or duration; +/- or direct edit; optional barbell mode (plate math). PRs can be updated when logging.
  - Action sheet (e.g. menu): Reset, Complete, Swap exercise, etc., depending on type.
  - Warmup/accessories can have time-based sets and “per side” timers; set rest timer available.
- **State:** Completion is stored per section (warmup, main, accessories); “Complete workout” marks the scheduled workout completed and can lock it.

### 5.4 Workout template detail (WorkoutTemplateDetailScreen)

- **Purpose:** View and edit a template: name, warmup list, main exercises list, accessories list. Navigate to WarmupEditor, WorkoutEdit (main), AccessoriesEditor. Option to duplicate, delete, or schedule.
- **UX:** Lists show exercise names and set/rep (or time) summary; tap to edit that section.

### 5.5 Workout builder (WorkoutBuilderScreen) and creation options

- **WorkoutCreationOptionsScreen:** Entry to create: “Blank workout” or “Create with AI” (and possibly “From template”). Routes to WorkoutBuilder or AIWorkoutCreationScreen.
- **WorkoutBuilderScreen:** Add exercises from library (search, categories), set sets/reps/weight, reorder; add warmup/accessories; name workout; save as template and optionally schedule.
- **AIWorkoutCreationScreen:** User describes workout or plan; AI suggests exercises/templates; user refines and saves.

### 5.6 Workouts screen (library)

- **Purpose:** List all workout templates. Create new (WorkoutCreationOptions), open template (WorkoutTemplateDetail), search/filter. “Single workouts” vs “Workout plans” (cycles) may be grouped.

### 5.7 Progress tab — ProgressHomeScreen

- **Purpose:** Weekly check-in (photos + optional weight), progress metrics (volume, key lifts), link to gallery and body weight history.
- **Layout:** Header aligned with Schedule (same style). Section for “Weekly check-in”: add photos (camera/library), optional weight; save. Metrics: e.g. volume vs last week, key lifts (squat, bench, etc.) with delta %. “See all progress” / “Log progress” and “Progress gallery” entry. Body weight history link.
- **UX:** Progress reminder (e.g. monthly) can be mentioned; empty states guide user to log.

### 5.8 Progress gallery and log detail

- **ProgressGalleryScreen:** Grid or list of progress logs (photos + date); tap to open detail.
- **ProgressLogDetailScreen:** Single log: photos, weight if any, date; optional delete/edit.

### 5.9 Body weight history

- **BodyWeightHistoryScreen:** List or chart of body weight entries over time; add entry (weight + date). Units from settings (kg/lb).

### 5.10 Profile and settings

- **ProfileScreen:** User info (if logged in), settings: units (kg/lb), language (en/es), progress reminder (monthly, day of month). Links to body weight history, maybe design system (dev). Sign out / continue as guest.

### 5.11 History and plan history

- **HistoryScreen:** Past completed workouts (sessions) list.
- **PlanHistoryDetailScreen:** Detail of a past “plan” (cycle) — which workouts were done when.

### 5.12 Cycles (plans)

- **CycleDetailScreen:** View a cycle plan: name, weeks, which template per day; apply, duplicate, repeat, archive.
- **CycleConflictsScreen:** When applying a plan would overwrite existing scheduled workouts, list conflicts and resolve (replace, skip, etc.) then apply.
- **CreateCycleFlow / CreateCycleDayEditor / ReviewCreateCycle:** Create a new cycle: basics (name, weeks), assign templates to weekdays, review and save.

### 5.13 HIIT timers

- **HIITTimerListScreen:** List of HIIT timer templates (create/edit).
- **HIITTimerFormScreen:** Create or edit a timer (work/rest rounds, durations).
- **HIITTimerExecutionScreen:** Run a timer; sessions are saved and shown on Schedule (Intervals) for that day.

### 5.14 Onboarding (optional first-run)

- **WelcomeScreen:** Intro.
- **ScheduleSetupScreen:** Pick start day or similar.
- **TemplatePickerScreen / TemplateEditorScreen / CustomTemplateInputScreen:** Pick or paste templates.
- **ReviewCreateCycleScreen:** Review and create initial cycle. Can be skipped.

### 5.15 Other

- **ExerciseDetailScreen:** Exercise history/PR for one exercise (from execution screen).
- **WorkoutEditScreen:** Edit main block of a template (exercises, sets, reps).
- **WarmupEditorScreen / AccessoriesEditorScreen:** Edit warmup or accessory block (exercise instances, time/reps, order).
- **DesignSystemScreen:** Dev-only; shows design tokens and components.

---

## 6. Data and state (concepts)

- **WorkoutTemplate:** Reusable definition: name, warmupItems, items (main), accessoryItems; ids, order, sets, reps (or time), optional weight.
- **ScheduledWorkout:** One workout scheduled on a date; references a template; has status (planned / in_progress / completed); can be locked; stores titleSnapshot, exercisesSnapshot, programName for display.
- **CyclePlan:** Multi-week plan; maps week/day to template id; has name, start date, duration.
- **Completion:** Stored per scheduled workout and per “section”: warmup, main, accessories. Main completion drives the Schedule card (Start/Resume/Complete and %).
- **Progress logs:** Photos + optional weight, date; used for gallery and metrics.
- **Settings:** useKg, language, progress reminder (monthly, day).
- **Exercise library:** Catalog of exercises (name, category, equipment); custom exercises can be added (e.g. from “Create [input]” in swap).

---

## 7. Design system (UI)

- **Theme:** Dark. Backgrounds: `#121212` (default), `#0D0D0D` (canvas), `#1C1C1E` (containers/cards).
- **Primary CTA / accent:** Lime yellow `#FFD500` (buttons, active states, links). Used sparingly.
- **Text:** White primary; secondary `#AEAEB2`; meta `#8E8E93`.
- **Borders:** Subtle (`#38383A` or rgba). Dividers between list rows; “last option” in swap autocomplete has no bottom divider.
- **Spacing:** 4–32 scale (xs 4, sm 8, md 12, lg 16, xl 20, xxl 24, xxxl 32).
- **Typography:** h1/h2/h3, body, meta, button, number, timer; weights 300–600.
- **Border radius:** 12–24 (squircle-friendly); cards 16–20.
- **Cards:** Flat and “deep” variants; background `#1C1C1E`; optional shadow.
- **Buttons:** Primary = lime, rounded (e.g. 16–20); full-width or fixed height (e.g. 56).
- **Bottom tabs:** Custom bar; two items (Schedule, Progress); animated indicator; icons + labels; safe area padding.
- **Sheets/drawers:** BottomDrawer component; max height (e.g. 50–80%); dark container background.
- **Modals:** Full-screen or transparent overlay; floating panels use same container color and padding (e.g. 24px).
- **Haptics:** Light impact on tab/button; success on completion/swap.
- **i18n:** All user-facing strings via translation keys (en/es); keys like `schedule`, `progress`, `addWorkout`, `swap`, `create`, `resume`, `completed`, etc.

---

## 8. Copy and terminology

- **Schedule:** The tab and week view (not “calendar” in UI).
- **Progress:** The tab for check-ins, gallery, metrics.
- **Start / Resume / Complete:** Workout card primary action states.
- **Swap:** Exchange the workout of the selected day with another day (or rest).
- **Add workout:** Add a workout to an empty day (opens AddWorkoutSheet).
- **Create “[input]”:** In swap-autocomplete, the row to create a new exercise from typed text.
- **Warmup / Main / Accessories (core):** The three sections of a workout template and execution.
- **Rest day:** Day with no scheduled workout; “No workout planned”.
- **Interval timers:** HIIT timers; completed sessions appear under the workout card for that day.
- **Weekly check-in:** Progress photo/weight entry.
- **Templates:** Reusable workouts (saved in library).
- **Plans / cycles:** Multi-week plans that assign templates to days; “Apply plan” fills the schedule.

---

## 9. Edge cases and rules

- **Swap:** Only offered when the day has a workout and it’s not completed and not locked and (in practice) not in progress. Target day must be uncompleted and not locked (or rest).
- **Completion %:** Driven by main exercises only (not warmup/accessories) for the Schedule card.
- **Future days:** Can schedule workouts; cannot “start” them (button may show different state); interval section hidden.
- **Past days:** Can log HIIT sessions; workout card may show “Complete” or “Start” (past) depending on product rules.
- **Units:** Weight in kg or lb from settings; applied everywhere (inputs, PRs, body weight).
- **Exercise swap:** Replaces the exercise in the template for that scheduled workout and migrates existing set data (cleanupAfterSwap) so the user doesn’t lose progress.

---

Use this document when asking ChatGPT to suggest copy, design changes, new flows, or to reason about how a feature should behave in WorkoutTracker. You can paste it in full or quote the sections that are relevant to the question.
