import { describe, expect, it } from 'vitest';
import { createInitialRowGestureState } from './rowGesture.ts';
import {
    shouldAllowNativeVerticalScrollWhilePending,
    shouldPreventActiveTouchMove,
    shouldPreventTouchScroll,
} from './touchScrollGuard.ts';

const AXIS_LOCK_PX = 10;

describe('touchScrollGuard', () => {
    it('allows native vertical scroll while pending before axis lock', () => {
        const pending = createInitialRowGestureState();
        pending.phase = 'pending';

        expect(shouldAllowNativeVerticalScrollWhilePending(pending, 0, 30, AXIS_LOCK_PX)).toBe(true);
        expect(shouldPreventTouchScroll(pending, 0, 30, AXIS_LOCK_PX)).toBe(false);
        expect(shouldPreventActiveTouchMove(pending, false)).toBe(false);
    });

    it('blocks browser pan only after drag activation', () => {
        const dragging = createInitialRowGestureState();
        dragging.phase = 'dragging';

        expect(shouldPreventActiveTouchMove(dragging, false)).toBe(true);
        expect(shouldPreventActiveTouchMove(dragging, true)).toBe(true);
        expect(shouldPreventTouchScroll(dragging, 0, 30, AXIS_LOCK_PX)).toBe(true);
        expect(shouldAllowNativeVerticalScrollWhilePending(dragging, 0, 30, AXIS_LOCK_PX)).toBe(false);
    });

    it('still blocks horizontal swipe gestures before drag starts', () => {
        const pending = createInitialRowGestureState();
        pending.phase = 'pending';

        expect(shouldPreventTouchScroll(pending, -30, 0, AXIS_LOCK_PX)).toBe(true);
        expect(shouldAllowNativeVerticalScrollWhilePending(pending, -30, 0, AXIS_LOCK_PX)).toBe(false);
    });
});
