import type { RowGestureState } from './rowGesture.ts';

/** Whether a touch pointermove should call preventDefault to block browser scrolling. */
function shouldPreventTouchScroll(g: RowGestureState, dx: number, dy: number, axisLockPx: number): boolean {
    if (
        g.phase === 'dragging' ||
        g.phase === 'reveal-pull' ||
        g.phase === 'reveal-close' ||
        g.phase === 'check-stroke'
    ) {
        return true;
    }
    if (g.phase === 'pending') {
        const absX = Math.abs(dx);
        const absY = Math.abs(dy);
        if (absY > absX && absY >= axisLockPx) {
            return false;
        }
        return true;
    }
    return false;
}

/** Whether a surface touchmove listener should block the browser's default pan. */
function shouldPreventActiveTouchMove(g: RowGestureState, isTouchDragging: boolean): boolean {
    return g.phase === 'dragging' || isTouchDragging;
}

/** Whether vertical movement during pending should keep native page scroll. */
function shouldAllowNativeVerticalScrollWhilePending(
    g: RowGestureState,
    dx: number,
    dy: number,
    axisLockPx: number
): boolean {
    if (g.phase !== 'pending') {
        return false;
    }
    const absX = Math.abs(dx);
    const absY = Math.abs(dy);
    return absY > absX && absY >= axisLockPx;
}

export { shouldAllowNativeVerticalScrollWhilePending, shouldPreventActiveTouchMove, shouldPreventTouchScroll };
