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

/**
 * Width of the delete action strip behind the card. Must clear the label ring,
 * which overhangs the checkbox by 4px on each side: at a smaller reveal the
 * ring's right edge stays inside the row's clipped viewport and peeks out.
 */
const REVEAL_WIDTH_PX = 42;

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

/**
 * Drag overlay pose. The card is lifted off the board in 3D; the wave below
 * displaces this base pose as the pointer moves. Values match the drag-wave
 * playground so what the preview shows is what the app renders.
 */
const DRAG_PERSPECTIVE_PX = 520;
const DRAG_TILT_X_DEG = -15;
const DRAG_TILT_Y_DEG = -5;
const DRAG_LEAN_Z_DEG = 0;

/** Gravity: the pitch (degrees) a still dragged card sags to. */
const DRAG_GRAVITY_DEG = 4;

/** Air resistance: lean/pitch degrees per 1000px/s of pointer speed. */
const DRAG_AIR_LEAN_PER_1000 = 6;
const DRAG_AIR_PITCH_PER_1000 = 4;

/** Cap (degrees) on the wave's air deflection, per axis. */
const DRAG_WAVE_MAX_DEG = 15;

/** Damped-spring tuning for the drag wave: stiffness (rad^2/s^2) and damping (1/s). */
const DRAG_WAVE_STIFFNESS = 90;
const DRAG_WAVE_DAMPING = 9;

/** Pointer velocity is averaged over this trailing window (ms) to smooth event bursts. */
const DRAG_VELOCITY_WINDOW_MS = 100;

/**
 * Edge auto-scroll while dragging: how close to the container's top/bottom edge
 * the pointer must get before the list starts scrolling. Larger = kicks in earlier.
 */
const DRAG_AUTOSCROLL_EDGE_PX = 72;

/**
 * Edge auto-scroll speed (px/second) at the inner boundary of the edge zone.
 * The scroll speed ramps proportionally from this value up to the max below.
 */
const DRAG_AUTOSCROLL_MIN_SPEED_PX_PER_SEC = 180;

/** Edge auto-scroll speed (px/second) when the pointer reaches the very edge. */
const DRAG_AUTOSCROLL_MAX_SPEED_PX_PER_SEC = 1400;

/** Upper bound on a single animation frame's time delta, so a background tab can't jump the list. */
const DRAG_AUTOSCROLL_MAX_FRAME_MS = 50;

export {
    AXIS_LOCK_PX,
    CHECK_COMPLETE_RATIO,
    DRAG_AIR_LEAN_PER_1000,
    DRAG_AIR_PITCH_PER_1000,
    DRAG_AUTOSCROLL_EDGE_PX,
    DRAG_AUTOSCROLL_MAX_FRAME_MS,
    DRAG_AUTOSCROLL_MAX_SPEED_PX_PER_SEC,
    DRAG_AUTOSCROLL_MIN_SPEED_PX_PER_SEC,
    DRAG_GRAVITY_DEG,
    DRAG_LEAN_Z_DEG,
    DRAG_PERSPECTIVE_PX,
    DRAG_TILT_X_DEG,
    DRAG_TILT_Y_DEG,
    DRAG_VELOCITY_WINDOW_MS,
    DRAG_WAVE_DAMPING,
    DRAG_WAVE_MAX_DEG,
    DRAG_WAVE_STIFFNESS,
    LONG_PRESS_MS,
    REVEAL_OPEN_RATIO,
    REVEAL_WIDTH_PX,
    SCROLL_LOCK_DELAY_MS,
    SWIPE_HORIZONTAL_DOMINANCE,
    TAP_MAX_MS,
    TAP_MAX_PX,
    TAP_MAX_PX_TOUCH,
};
