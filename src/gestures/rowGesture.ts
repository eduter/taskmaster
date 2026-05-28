import { isDominantHorizontal } from './axisLock.ts';
import { checkProgress, shouldCompleteCheck } from './swipeCheck.ts';
import { revealOffsetX, snapRevealOpen } from './swipeReveal.ts';

type RowPhase = 'idle' | 'pending' | 'reveal-pull' | 'reveal-close' | 'check-stroke' | 'dragging';

interface RowGestureConfig {
    axisLockPx: number;
    tapMaxMs: number;
    tapMaxPx: number;
    revealWidthPx: number;
    revealOpenRatio: number;
    checkCompleteRatio: number;
    swipeHorizontalDominance: number;
}

interface RowGestureState {
    phase: RowPhase;
    pointerId: number | null;
    startX: number;
    startY: number;
    startTime: number;
    revealOffsetX: number;
    checkProgress: number;
    deleteRevealed: boolean;
    /** Swipe-right check stroke only when the task is incomplete. */
    allowCheckSwipe: boolean;
    cardWidth: number;
}

type RowGestureAction =
    | {
          type: 'POINTER_DOWN';
          pointerId: number;
          x: number;
          y: number;
          time: number;
          deleteRevealed: boolean;
          allowCheckSwipe: boolean;
          cardWidth: number;
      }
    | { type: 'POINTER_MOVE'; x: number; y: number; time: number }
    | { type: 'POINTER_UP'; x: number; y: number; time: number }
    | { type: 'LONG_PRESS'; time: number; x: number; y: number }
    | { type: 'DRAG_END' }
    | { type: 'SET_CARD_WIDTH'; cardWidth: number };

type RowGestureEffect =
    | { type: 'START_DRAG'; x: number; y: number }
    | { type: 'OPEN_TASK' }
    | { type: 'MARK_COMPLETE' }
    | { type: 'SET_REVEAL'; open: boolean };

interface RowGestureResult {
    state: RowGestureState;
    effects: RowGestureEffect[];
}

function createInitialRowGestureState(
    initial?: Partial<Pick<RowGestureState, 'deleteRevealed' | 'cardWidth'>>,
    revealWidthPx = 40
): RowGestureState {
    const deleteRevealed = initial?.deleteRevealed ?? false;
    return {
        phase: 'idle',
        pointerId: null,
        startX: 0,
        startY: 0,
        startTime: 0,
        revealOffsetX: deleteRevealed ? -revealWidthPx : 0,
        checkProgress: 0,
        deleteRevealed,
        allowCheckSwipe: true,
        cardWidth: initial?.cardWidth ?? 300,
    };
}

function idleState(state: RowGestureState, revealWidthPx: number): RowGestureState {
    return {
        ...state,
        phase: 'idle',
        pointerId: null,
        revealOffsetX: state.deleteRevealed ? -revealWidthPx : 0,
        checkProgress: 0,
    };
}

function reduceRowGesture(
    state: RowGestureState,
    action: RowGestureAction,
    config: RowGestureConfig
): RowGestureResult {
    const effects: RowGestureEffect[] = [];

    switch (action.type) {
        case 'SET_CARD_WIDTH':
            return { state: { ...state, cardWidth: action.cardWidth }, effects };

        case 'DRAG_END':
            return {
                state: {
                    ...state,
                    phase: 'idle',
                    pointerId: null,
                    checkProgress: 0,
                },
                effects,
            };

        case 'POINTER_DOWN': {
            if (state.phase !== 'idle') return { state, effects };
            const revealOffsetX0 = action.deleteRevealed ? -config.revealWidthPx : 0;
            return {
                state: {
                    ...state,
                    phase: 'pending',
                    pointerId: action.pointerId,
                    startX: action.x,
                    startY: action.y,
                    startTime: action.time,
                    deleteRevealed: action.deleteRevealed,
                    revealOffsetX: revealOffsetX0,
                    checkProgress: 0,
                    allowCheckSwipe: action.allowCheckSwipe,
                    cardWidth: action.cardWidth || state.cardWidth,
                },
                effects,
            };
        }

        case 'POINTER_MOVE': {
            if (state.phase === 'idle' || state.pointerId === null) return { state, effects };
            const dx = action.x - state.startX;
            const dy = action.y - state.startY;

            if (state.phase === 'pending') {
                const absX = Math.abs(dx);
                const absY = Math.abs(dy);
                if (absY > absX && absY >= config.axisLockPx) {
                    return { state, effects };
                }
                if (isDominantHorizontal(dx, dy, config.axisLockPx, config.swipeHorizontalDominance)) {
                    if (state.deleteRevealed && dx > 0) {
                        return {
                            state: {
                                ...state,
                                phase: 'reveal-close',
                                revealOffsetX: revealOffsetX(dx, config.revealWidthPx, true),
                            },
                            effects,
                        };
                    }
                    if (!state.deleteRevealed && dx < 0) {
                        return {
                            state: {
                                ...state,
                                phase: 'reveal-pull',
                                revealOffsetX: revealOffsetX(dx, config.revealWidthPx, false),
                            },
                            effects,
                        };
                    }
                    if (!state.deleteRevealed && dx > 0 && state.allowCheckSwipe) {
                        return {
                            state: {
                                ...state,
                                phase: 'check-stroke',
                                checkProgress: checkProgress(dx, state.cardWidth, config.checkCompleteRatio),
                            },
                            effects,
                        };
                    }
                }
                return { state, effects };
            }

            if (state.phase === 'reveal-pull') {
                const dxPull = action.x - state.startX;
                return {
                    state: {
                        ...state,
                        revealOffsetX: revealOffsetX(dxPull, config.revealWidthPx, false),
                    },
                    effects,
                };
            }

            if (state.phase === 'reveal-close') {
                const dxClose = action.x - state.startX;
                return {
                    state: {
                        ...state,
                        revealOffsetX: revealOffsetX(dxClose, config.revealWidthPx, true),
                    },
                    effects,
                };
            }

            if (state.phase === 'check-stroke') {
                const dxCheck = action.x - state.startX;
                return {
                    state: {
                        ...state,
                        checkProgress: checkProgress(dxCheck, state.cardWidth, config.checkCompleteRatio),
                    },
                    effects,
                };
            }

            return { state, effects };
        }

        case 'LONG_PRESS': {
            if (state.phase !== 'pending') return { state, effects };
            effects.push({ type: 'START_DRAG', x: action.x, y: action.y });
            return {
                state: { ...state, phase: 'dragging' },
                effects,
            };
        }

        case 'POINTER_UP': {
            if (state.phase === 'idle' || state.pointerId === null) return { state, effects };

            const dx = action.x - state.startX;
            const dy = action.y - state.startY;
            const elapsed = action.time - state.startTime;
            const distance = Math.hypot(dx, dy);

            if (state.phase === 'pending') {
                if (elapsed <= config.tapMaxMs && distance <= config.tapMaxPx) {
                    effects.push({ type: 'OPEN_TASK' });
                }
                return {
                    state: {
                        ...idleState(state, config.revealWidthPx),
                        deleteRevealed: state.deleteRevealed,
                    },
                    effects,
                };
            }

            if (state.phase === 'reveal-pull') {
                const open = snapRevealOpen(state.revealOffsetX, config.revealWidthPx, config.revealOpenRatio);
                effects.push({ type: 'SET_REVEAL', open });
                return {
                    state: {
                        ...state,
                        phase: 'idle',
                        pointerId: null,
                        deleteRevealed: open,
                        revealOffsetX: open ? -config.revealWidthPx : 0,
                        checkProgress: 0,
                    },
                    effects,
                };
            }

            if (state.phase === 'reveal-close') {
                const open = snapRevealOpen(state.revealOffsetX, config.revealWidthPx, config.revealOpenRatio);
                effects.push({ type: 'SET_REVEAL', open });
                return {
                    state: {
                        ...state,
                        phase: 'idle',
                        pointerId: null,
                        deleteRevealed: open,
                        revealOffsetX: open ? -config.revealWidthPx : 0,
                        checkProgress: 0,
                    },
                    effects,
                };
            }

            if (state.phase === 'check-stroke') {
                if (shouldCompleteCheck(state.checkProgress)) {
                    effects.push({ type: 'MARK_COMPLETE' });
                }
                return {
                    state: {
                        ...idleState(state, config.revealWidthPx),
                        deleteRevealed: state.deleteRevealed,
                    },
                    effects,
                };
            }

            return { state, effects };
        }

        default:
            return { state, effects };
    }
}

export { createInitialRowGestureState, reduceRowGesture };
export type { RowGestureConfig, RowGestureState, RowGestureAction, RowGestureEffect, RowGestureResult, RowPhase };
