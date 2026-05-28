import { describe, expect, it } from 'vitest';
import { createInitialRowGestureState, type RowGestureConfig, reduceRowGesture } from './rowGesture.ts';

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
        const afterDown = down(createInitialRowGestureState(), { time: 0 });
        const afterUp = up(afterDown.state, 0, 0, 200);
        expect(afterUp.effects).toEqual([{ type: 'OPEN_TASK' }]);
        expect(afterUp.state.phase).toBe('idle');
    });

    it('enters reveal-pull on swipe left', () => {
        const afterDown = down(createInitialRowGestureState());
        const afterMove = move(afterDown.state, -30, 0, 50);
        expect(afterMove.state.phase).toBe('reveal-pull');
        expect(afterMove.state.revealOffsetX).toBe(-30);
    });

    it('snaps reveal open after sufficient left swipe', () => {
        const afterDown = down(createInitialRowGestureState());
        const afterMove = move(afterDown.state, -50, 0, 50);
        const afterUp = up(afterMove.state, -50, 0, 100);
        expect(afterUp.effects).toContainEqual({ type: 'SET_REVEAL', open: true });
        expect(afterUp.state.deleteRevealed).toBe(true);
    });

    it('closes reveal on swipe right when delete is shown', () => {
        const afterDown = down(createInitialRowGestureState({ deleteRevealed: true }), { deleteRevealed: true });
        const afterMove = move(afterDown.state, 50, 0, 50);
        expect(afterMove.state.phase).toBe('reveal-close');
        const afterUp = up(afterMove.state, 50, 0, 100);
        expect(afterUp.effects).toContainEqual({ type: 'SET_REVEAL', open: false });
        expect(afterUp.state.deleteRevealed).toBe(false);
    });

    it('enters check-stroke on swipe right when delete hidden', () => {
        const afterDown = down(createInitialRowGestureState());
        const afterMove = move(afterDown.state, 60, 2, 50);
        expect(afterMove.state.phase).toBe('check-stroke');
        expect(afterMove.state.checkProgress).toBeGreaterThan(0);
    });

    it('stays pending on diagonal wobble while waiting to drag', () => {
        const afterDown = down(createInitialRowGestureState());
        const afterMove = move(afterDown.state, 12, 10, 50);
        expect(afterMove.state.phase).toBe('pending');
    });

    it('stays pending on vertical movement while waiting to drag', () => {
        const afterDown = down(createInitialRowGestureState());
        const afterMove = move(afterDown.state, 0, 30, 50);
        expect(afterMove.state.phase).toBe('pending');
    });

    it('emits MARK_COMPLETE when stroke passes threshold', () => {
        const afterDown = down(createInitialRowGestureState(), { cardWidth: 200, allowCheckSwipe: true });
        const afterMove = move(afterDown.state, 120, 0, 50);
        const afterUp = up(afterMove.state, 120, 0, 100);
        expect(afterUp.effects).toContainEqual({ type: 'MARK_COMPLETE' });
    });

    it('does not enter check-stroke on completed tasks', () => {
        const afterDown = down(createInitialRowGestureState(), { allowCheckSwipe: false });
        const afterMove = move(afterDown.state, 120, 0, 50);
        expect(afterMove.state.phase).toBe('pending');
        expect(afterMove.state.checkProgress).toBe(0);
    });

    it('emits START_DRAG on long press without horizontal lock', () => {
        const afterDown = down(createInitialRowGestureState(), { x: 10, y: 10, time: 0 });
        const afterLongPress = reduceRowGesture(
            afterDown.state,
            { type: 'LONG_PRESS', time: 500, x: 10, y: 10 },
            config
        );
        expect(afterLongPress.effects).toEqual([{ type: 'START_DRAG', x: 10, y: 10 }]);
        expect(afterLongPress.state.phase).toBe('dragging');
    });

    it('does not start drag after horizontal swipe began', () => {
        const afterDown = down(createInitialRowGestureState());
        const afterMove = move(afterDown.state, -30, 0, 50);
        const afterLongPress = reduceRowGesture(
            afterMove.state,
            { type: 'LONG_PRESS', time: 500, x: -30, y: 0 },
            config
        );
        expect(afterLongPress.effects).toEqual([]);
        expect(afterLongPress.state.phase).toBe('reveal-pull');
    });
});
