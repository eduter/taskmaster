# Backlog

Backlog is for open work only. Don't add completed items — history is in git. When you finish a backlog item, remove it.
If the work reveals follow-up tasks, add those as new items. If something is worth documenting permanently, it belongs
in code comments, or other doc files — not the backlog.

* redesign the generator dialog to improve UX
* when dragging a task on list that doesn't fit the screen, when getting near the top/bottom edge of the screen, it should scroll -> the same problem probably exists in checklists
* make "Add" / "+" buttons usage and positioning consistent across tasks, checklists, labels, generators, and task templates
* redesign app's header - the tabs don't look great, the show/hide labels button is not very self-explanatory, and it's a bit crowded if I were to add filters
* Small styling fixes
  * Get rid of focus ring when opening dialog
  * Tweak padding for when revealing the delete button
  * Improve styling of task being dragged
  * Improve crossing task gesture styling
* Implement filters by label and name substring
* improve and re-enable calendar week view
* Create multiple tasks/task templates when pasting multiple lines
* When creating a new generator, rerun the schedule, in case today is a day when the new generator should create tasks. If the anchor date the user set is in the future, the generator should be set up such that it won't run until then, or at least not today. Is it currently possible to create, for example, a daily task generator that starts one week from now? If not, how hard would it be? 
