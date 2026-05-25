# TaskMaster — vision and roadmap

Personal task/chore manager built for one user: zero bloat, only what I need. Replaces the awkward Trello + Google Calendar setup I was abusing for scheduling and daily chores.

---

## Big picture

### Why build it

Commercial todo apps are either wrong-shaped or unstable. Trello automation is painful for real scheduling. I want something that matches how I actually work: a simple daily list, strong recurrence, easy postponement, and sync across Linux, Windows, and Android — without a backend I maintain.

### Core idea

The main view is like Trello with **one board and one list**: a flat, ordered checklist for **today**. Most tasks are just a summary line; some have a plain-text description and labels. Drag to reorder; tap to open details.

The product goal is **inbox zero per day**: finish each logical day with every task checked off. Tasks belong to a **day**, not a vague backlog. Postponing moves a task off today and brings it back only on the target day.

### Logical day

A “day” does **not** start at midnight. It starts at **4:00** (when I’m always asleep). That boundary is a constant — no settings UI needed.

- **Normal tasks** from generators are created on **first app open** after the day boundary (not at midnight in the background).
- **Tasks with a specific time** (for reminders) will need **different handling** from normal day-based tasks. That split is intentional; reminders are a future concern.

### Task generators

Recurring chores are defined as **generators**: a recurrence rule plus one or more task templates. Examples:

- Every day → Duolingo, Swedish podcast episode, Anki review
- Every other Saturday → …
- Every last Thursday of the month → …

Generators use RFC 5545-style recurrence (RRULE). Each run creates real tasks for the logical day(s) due since last generation (including catch-up if I didn’t open the app for several days).

### Uncompleted work

Incomplete tasks from earlier logical days **carry over** into today automatically. They stay visible until done or postponed.

### Sync and offline

- **Offline-first:** everything except sync works without network; local IndexedDB is the working store.
- **Dropbox** for background sync (one JSON blob, last-write-wins; one device at a time).
- **Installable PWA** on Linux, Windows, Android.

### UI principles

- **Dark mode only** — no light theme.
- **Plain text** descriptions — no rich editor.

---

## Open design questions

Things deliberately left unresolved; the data model should stay flexible.

| Topic | Notes |
|--------|--------|
| **Subtasks** | e.g. “Plan kid’s birthday party” over weeks; some subtasks on specific days (“pick up cake”). Unclear how this fits **daily inbox zero** and postpone/carry-over. Consider `parentTaskId` when modeling. |
| **Generator ↔ task link** | Tasks store `generatorId` for traceability but behave as **independent** instances once created. Deeper “linked” semantics (edit template → update future instances?) not decided. |

---

## Not yet implemented

### Views and navigation

- **Calendar view** showing:
  - Postponed tasks (by target date)
  - Tasks created for a specific date
  - **Projected** future tasks — not real rows yet, but what generators *would* create if rules stay unchanged
- **Search/filter** on task summary (substring) and labels — in **both** list and calendar views

### History

- **Task history** with **limited retention** — completed tasks kept for N days, then pruned (exact N TBD)

### Notifications and triggers

- **Scheduled reminders** — push/notification at a specific time  
  - Feasible on Android/Windows via Web Push + Notification API; Linux varies; background timing is imprecise in a pure PWA (service worker / periodic sync limits).
- **Geofencing** — e.g. “pick up package near post office”  
  - **Not available** as a real background feature in a pure PWA (no web Geofencing API). Likely needs a **native wrapper** (Capacitor, Tauri Mobile, etc.) later.
- **Voice commands** — e.g. “remind me to take out trash when I get home”  
  - **In-app:** Web Speech API while the app is open.  
  - **System-level** (“Hey Google…”): needs native wrapper or platform assistant integration.

### Subtasks

- Parent tasks spanning days/weeks
- Subtasks with their own dates
- UX that doesn’t break the “clear today’s list” habit — **design TBD**

---

## Platform notes (for later features)

| Feature | PWA alone | Likely path if PWA isn’t enough |
|---------|-----------|----------------------------------|
| Scheduled reminders | Partial (OS may throttle background work) | Accept imprecision or native wrapper |
| Geofencing | No real background geofencing | Capacitor / Tauri Mobile |
| Voice (system-wide) | No | Native wrapper or assistant APIs |
| Voice (in-app) | Yes (Chrome/Edge) | — |

Sync remains HTTP to Dropbox API on all platforms; no change expected for post-MVP features unless volume forces splitting the sync blob (e.g. per-month files).

---

## References

- Original implementation plan (with MVP todos): `.cursor/plans/personal_task_manager_pwa_a754c128.plan.md`
- Published app: https://eduter.github.io/taskmaster/
