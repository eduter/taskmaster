import { describe, expect, it } from 'vitest';
import { createInitialRowGestureState, reduceRowGesture, type RowGestureConfig } from './rowGesture.ts';

const config: RowGestureConfig = {
    axisLockPx: 10,
    tapMaxMs: 350,
    tapMaxPx: 12,
    revealWidthPx: 40,
    revealOpenRatio: 0.45,
    checkCompleteRatio: 0.55,
    swipeHorizontalDominance: 1.5,
};

function down(
    state: ReturnType<typeof createInitialRowGestureState>,
    opts: {
        x?: number;
        y?: number;
        time?: number;
        deleteRevealed?: boolean;
        allowCheckSwipe?: boolean;
        cardWidth?: number;
    } = {}
) {
    return reduceRowGesture(
        state,
        {
            type: 'POINTER_DOWN',
            pointerId: 1,
            x: opts.x ?? 0,
            y: opts.y ?? 0,
            time: opts.time ?? 0,
            deleteRevealed: opts.deleteRevealed ?? state.deleteRevealed,
            allowCheckSwipe: opts.allowCheckSwipe ?? state.allowCheckSwipe,
            cardWidth: opts.cardWidth ?? state.cardWidth,
        },
        config
    );
}

function move(state: ReturnType<typeof createInitialRowGestureState>, x: number, y: number, time: number) {
    return reduceRowGesture(state, { type: 'POINTER_MOVE', x, y, time }, config);
}

function up(state: ReturnType<typeof createInitialRowGestureState>, x: number, y: number, time: number) {
    return reduceRowGesture(state, { type: 'POINTER_UP', x, y, time }, config);
}

describe('reduceRowGesture', () => {
    it('emits OPEN_TASK on a short tap', () => {
        let state = createInitialRowGestureState();
        let effects;
        ({ state } = down(state, { time: 0 }));
        ({ state, effects } = up(state, 0, 0, 200));
        expect(effects).toEqual([{ type: 'OPEN_TASK' }]);
        expect(state.phase).toBe('idle');
    });

    it('enters reveal-pull on swipe left', () => {
        let state = createInitialRowGestureState();
        ({ state } = down(state));
        ({ state } = move(state, -30, 0, 50));
        expect(state.phase).toBe('reveal-pull');
        expect(state.revealOffsetX).toBe(-30);
    });

    it('snaps reveal open after sufficient left swipe', () => {
        let state = createInitialRowGestureState();
        let effects;
        ({ state } = down(state));
        ({ state } = move(state, -50, 0, 50));
        ({ state, effects } = up(state, -50, 0, 100));
        expect(effects).toContainEqual({ type: 'SET_REVEAL', open: true });
        expect(state.deleteRevealed).toBe(true);
    });

    it('closes reveal on swipe right when delete is shown', () => {
        let state = createInitialRowGestureState({ deleteRevealed: true });
        let effects;
        ({ state } = down(state, { deleteRevealed: true }));
        ({ state } = move(state, 50, 0, 50));
        expect(state.phase).toBe('reveal-close');
        ({ state, effects } = up(state, 50, 0, 100));
        expect(effects).toContainEqual({ type: 'SET_REVEAL', open: false });
        expect(state.deleteRevealed).toBe(false);
    });

    it('enters check-stroke on swipe right when delete hidden', () => {
        let state = createInitialRowGestureState();
        ({ state } = down(state));
        ({ state } = move(state, 60, 2, 50));
        expect(state.phase).toBe('check-stroke');
        expect(state.checkProgress).toBeGreaterThan(0);
    });

    it('stays pending on diagonal wobble while waiting to drag', () => {
        let state = createInitialRowGestureState();
        ({ state } = down(state));
        ({ state } = move(state, 12, 10, 50));
        expect(state.phase).toBe('pending');
    });

    it('stays pending on vertical movement while waiting to drag', () => {
        let state = createInitialRowGestureState();
        ({ state } = down(state));
        ({ state } = move(state, 0, 30, 50));
        expect(state.phase).toBe('pending');
    });

    it('emits MARK_COMPLETE when stroke passes threshold', () => {
        let state = createInitialRowGestureState();
        let effects;
        ({ state } = down(state, { cardWidth: 200, allowCheckSwipe: true }));
        ({ state } = move(state, 120, 0, 50));
        ({ state, effects } = up(state, 120, 0, 100));
        expect(effects).toContainEqual({ type: 'MARK_COMPLETE' });
    });

    it('does not enter check-stroke on completed tasks', () => {
        let state = createInitialRowGestureState();
        ({ state } = down(state, { allowCheckSwipe: false }));
        ({ state } = move(state, 120, 0, 50));
        expect(state.phase).toBe('pending');
        expect(state.checkProgress).toBe(0);
    });

    it('emits START_DRAG on long press without horizontal lock', () => {
        let state = createInitialRowGestureState();
        let effects;
        ({ state } = down(state, { x: 10, y: 10, time: 0 }));
        ({ state, effects } = reduceRowGesture(state, { type: 'LONG_PRESS', time: 500, x: 10, y: 10 }, config));
        expect(effects).toEqual([{ type: 'START_DRAG', x: 10, y: 10 }]);
        expect(state.phase).toBe('dragging');
    });

    it('does not start drag after horizontal swipe began', () => {
        let state = createInitialRowGestureState();
        let effects;
        ({ state } = down(state));
        ({ state } = move(state, -30, 0, 50));
        ({ state, effects } = reduceRowGesture(state, { type: 'LONG_PRESS', time: 500, x: -30, y: 0 }, config));
        expect(effects).toEqual([]);
        expect(state.phase).toBe('reveal-pull');
    });
});
