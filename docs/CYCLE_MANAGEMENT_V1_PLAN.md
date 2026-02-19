# Cycle Management v1 — Decided Plan

This document records the **decided** scope and design for Cycle Management v1, based on the planning analysis and your answers to the clarifying questions. Use it as the single source of truth for implementation.

---

## 1. Clarification decisions (locked)

| # | Question | Decision |
|---|----------|----------|
| 1.1 | Multiple active plans? | **Only one active plan at a time.** Banner and “active” logic assume a single active plan. |
| 1.2 | Reactivate after End? | **No.** Once a cycle is ended, it cannot be reactivated. User can Duplicate and apply the copy if they want to run it again. |
| 1.3 | Pause: preserve or extend end date? | **Extend.** The plan’s end date changes based on when the cycle is resumed. Remaining weeks continue from resume date; total duration extends. |
| 1.4 | How are cycles stored? | *(No answer needed for implementation.)* In code: `cyclePlans[]` in Zustand, persisted via `storage.saveCyclePlans()`. Scheduled workouts have `source: 'cycle'` and `programId` (plan id). |
| 1.5 | Reuse CycleDetail or separate screen? | **Separate screen.** New screen for CyclePlan management (e.g. **CyclePlanDetailScreen**). Existing CycleDetailScreen stays for legacy Cycle (cycleId). |
| 1.6 | Include “Completed” status? | **Yes.** Status can be: **Active** | **Ended Early** | **Completed**. |

---

## 2. State model (CyclePlan only)

- **Single source of truth:** One active plan; “which workouts belong to this cycle” = `scheduledWorkouts` where `source === 'cycle'` and `programId === planId` (or `cyclePlanId`).
- **No separate “AppliedCycleInstance” entity.**

### 2.1 New/updated fields on CyclePlan

- **`endedAt?: string`** (ISO date, e.g. YYYY-MM-DD)  
  Set when user taps “End cycle”. If present, plan is not active and cannot be reactivated.

- **`status`** (derived or stored): **`'active' | 'ended_early' | 'completed'`**
  - **active:** Plan is current (`active === true`, no `endedAt`).
  - **ended_early:** User ended the cycle (`endedAt` set).
  - **completed:** All planned workouts in the plan’s date range are in the past (either done or not); no future cycle workouts left. Derived from scheduled workouts + plan range.

- **`pausedUntil?: string`** (YYYY-MM-DD)  
  Resume date for Pause/Shift. While we’re before this date, the plan does not schedule workouts; from this date onward we regenerate remaining workouts (see Pause/Shift below).  
  Optional: **`originalEndDate?: string`** (or derive from startDate + weeks) if we need to show “originally would have ended on X” in the UI.

### 2.2 Pause/Shift semantics (extend plan)

- User picks a **resume date** (date picker).
- Set **`pausedUntil = resumeDate`**.
- **Remove** all future cycle workouts for this plan from **today** through **day before** `pausedUntil`.
- **Re-apply** the plan from `pausedUntil` onward:
  - Same weekday mapping and template structure.
  - “Remaining” weeks = weeks that were not yet fully in the past before the pause (or define as: total weeks minus weeks already fully past as of pause).
  - New end date = `pausedUntil + (remaining weeks * 7 days)` (plan **extends**).
- If any date in the new range already has a workout → use **CycleConflictsScreen** (same resolution as apply).
- **Never** change past or completed workouts.

### 2.3 Duplicate

- Unchanged: `duplicateCyclePlan(planId)` creates a new CyclePlan (new id, copy of structure), `active: false`, no `endedAt`/`pausedUntil`. Does not create scheduled workouts; user applies later.

---

## 3. Navigation

- **New screen:** **CyclePlanDetailScreen** (or name of your choice), param **`planId: string`**. Separate from existing CycleDetailScreen (which keeps `cycleId` for legacy Cycle).
- **Schedule tab (TodayScreen):**  
  If `getActiveCyclePlan()` is non-null → show **Cycle banner**. Tap “View” → `navigate('CyclePlanDetail', { planId: activePlan.id })`.
- **WorkoutsScreen:**  
  From plan list / row, add “View” or “Manage” → `navigate('CyclePlanDetail', { planId })` so the same management screen is reachable from Schedule and from Workouts.
- **Stack:** Register `CyclePlanDetail` in the root stack; back returns to Schedule or Workouts as appropriate.

---

## 4. UX summary

### 4.1 Cycle banner (Schedule tab)

- **Placement:** Below header, above ExpandableCalendarStrip.
- **When:** Only when there is exactly one active plan (`getActiveCyclePlan()` non-null). Optionally hide when that plan is “paused” (see 4.6) or show “Paused until [date]”.
- **Content:** Cycle name (e.g. “🔁 [name]”), “Week X of Y”, optional date range; small “View” CTA.
- **Design:** Background `#1C1C1E`, padding 16–20, radius 16, subtle border or flat; minimal lime (e.g. icon or week).

### 4.2 CyclePlanDetailScreen (new, separate)

- **Top:** Cycle name, **Status** (Active | Ended Early | Completed), start date, **end date** (computed: normal end, or after pause = extended, or ended early = `endedAt`), “Week X of Y”.
- **Actions:** 3-dot overflow menu: **End cycle** → **Pause / Shift** → **Duplicate** → **Delete** (destructive last).  
  When status is not Active, disable or hide End cycle and Pause / Shift; keep Duplicate and Delete.

### 4.3 End cycle

- Confirmation: “This will remove future workouts from this cycle. Completed workouts remain.”
- Set `endedAt = today`, `active = false`. Remove only **future** scheduled workouts for this plan. No reactivation.

### 4.4 Delete cycle

- Stronger confirmation: future cycle workouts removed; past workouts stay in history (optionally clear `programId`/`cyclePlanId`).
- Remove plan from `cyclePlans[]`; navigate back.

### 4.5 Pause / Shift

- Date picker: “Resume on [date]”.
- Set `pausedUntil = resumeDate`; remove future cycle workouts from today through day before resume; re-apply from resume date with **extended** end date; use CycleConflictsScreen if conflicts.

### 4.6 Duplicate

- Call `duplicateCyclePlan(planId)`; no confirmation. Optional: toast + navigate to Workouts or new plan’s detail.

### 4.7 Status “Completed”

- **Completed** = all cycle workouts in the plan’s (possibly extended) date range are in the past (no future cycle workouts left), and the plan was not explicitly ended early.  
  So: no `endedAt`, and the last scheduled cycle workout date is before today.  
  Banner can hide when status is Completed (only “active” plan is shown).

---

## 5. Guardrails (unchanged)

- Completed workouts and history are **immutable** (no deletion or date/template change for past/locked workouts).
- End / Delete / Pause only affect **future** workouts.
- No retroactive schedule mutation; metrics and PRs unchanged for past data.
- Conflicts on Pause/Shift reuse CycleConflictsScreen; do not overwrite without user choice.

---

## 6. Out of scope for v1 (reminder)

- Edit future weeks.
- Replace cycle (replace one plan with another in one action).
- Reactivation after End.

---

## 7. Implementation checklist (reference)

- [ ] Extend `CyclePlan` type: `endedAt?`, `pausedUntil?`, optional `status` or derive.
- [ ] Add store actions: `endCyclePlan(planId)`, `pauseShiftCyclePlan(planId, resumeDate)`, and ensure `deleteCyclePlan` (or equivalent) only removes plan + future workouts; keep duplicate as-is.
- [ ] Derive status: active / ended_early / completed (and week X of Y, end date) from plan + scheduledWorkouts.
- [ ] New screen: CyclePlanDetailScreen(planId); top section + 3-dot menu with four actions.
- [ ] TodayScreen: Cycle banner when active plan exists; “View” → CyclePlanDetail.
- [ ] WorkoutsScreen: “View”/“Manage” on plan → CyclePlanDetail.
- [ ] End cycle: confirmation → set endedAt, active=false, remove future cycle workouts.
- [ ] Delete cycle: stronger confirmation → remove plan + future cycle workouts.
- [ ] Pause/Shift: date picker → set pausedUntil, remove future workouts before that date, re-apply from resume date (extend end date), conflict flow if needed.
- [ ] Duplicate: existing duplicateCyclePlan; optional toast/navigation.
- [ ] Register CyclePlanDetail in navigator (param `planId`).

This document is the single reference for Cycle Management v1; implement from here.
