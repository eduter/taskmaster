/** Minimum movement before horizontal vs vertical intent is chosen. */
const AXIS_LOCK_PX = 10;

/** Hold duration before sort drag may start. */
const LONG_PRESS_MS = 450;

/** Tap must finish within this window to open a task. */
const TAP_MAX_MS = 350;

/** Max movement during a tap (mouse / precise pointer). */
const TAP_MAX_PX = 12;

/** Max movement during a tap on touch screens (more finger slop). */
const TAP_MAX_PX_TOUCH = 24;

/** Horizontal swipe must exceed vertical by this factor (avoids stealing long-press drag). */
const SWIPE_HORIZONTAL_DOMINANCE = 1.5;

/** Width of the delete action strip behind the card. */
const REVEAL_WIDTH_PX = 40;

/** Swipe-left release opens delete when past this fraction of reveal width. */
const REVEAL_OPEN_RATIO = 0.45;

/**
 * Swipe-right-to-check completes when your finger has moved this fraction of the
 * card width. Lower = easier to complete; higher = longer stroke.
 * Used by swipeCheck.ts and wired through rowGesture / TaskRow.
 */
const CHECK_COMPLETE_RATIO = 0.3;

/** After holding a row, lock page scroll this many ms before long-press drag fires. */
const SCROLL_LOCK_DELAY_MS = 80;

/** Drag overlay tilt (degrees), Trello-style. */
const DRAG_ROTATE_DEG = 2.5;

export {
    AXIS_LOCK_PX,
    LONG_PRESS_MS,
    TAP_MAX_MS,
    TAP_MAX_PX,
    TAP_MAX_PX_TOUCH,
    SWIPE_HORIZONTAL_DOMINANCE,
    REVEAL_WIDTH_PX,
    REVEAL_OPEN_RATIO,
    CHECK_COMPLETE_RATIO,
    SCROLL_LOCK_DELAY_MS,
    DRAG_ROTATE_DEG,
};
