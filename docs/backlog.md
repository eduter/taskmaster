# Backlog

Backlog is for open work only. Don't add completed items or
`[x]` checkboxes — history is in git. When you finish a backlog
item, remove it. If the work reveals follow-up tasks, add those as
new items. If something is worth documenting permanently, it belongs
in code comments, or other doc files — not the backlog.

* Implement labels CRUD, with id, name, and color
* Allow adding labels to task templates
* Implement filters by label and name substring
* Bug: syncing sometimes deletes new data in favor of old data.
* Sync either periodically or, ideally, when reopened/refocused
* Animate sync icon while syncing is in progress
* On devices with virtual keyboard (infer from pointer coarse), modals should take up the whole screen
* Bug: completing a carried task shouldn't make it disappear. Tasks remain on the day they were actually completed.
* Implement the calendar tab
* Bug: scrolling scrolls the whole body. It should scrool only the contents of the tab.
