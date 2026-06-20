# Backlog

Backlog is for open work only. Don't add completed items — history is in git. When you finish a backlog item, remove it.
If the work reveals follow-up tasks, add those as new items. If something is worth documenting permanently, it belongs
in code comments, or other doc files — not the backlog.

* Fix 3550ddb7 -> the UI should still make clear syncing is not setup, but still allow using the app. If setup, but failing to sync, blocking the user is fine, probably good. The bar at the bottom + the icon must clearly indicate that syncing is not working and which of the 2 situation is it. 
* The sync dialog should display the actual error, when the latest try failed. I've been getting a lot of failures lately, it would be nice to see what error I'm getting.
* Fix gestures in TaskList
* Implement filters by label and name substring
* Implement the calendar tab
* Create multiple tasks/task templates when pasting multiple lines
* When creating a new generator, rerun the schedule, in case today is a day when the new generator should create tasks. If the anchor date the user set is in the future, the generator should be set up such that it won't run until then, or at least not today. Is it currently possible to create, for example, a daily task generator that starts one week from now? If not, how hard would it be? 
