import { useDragDropContext } from '@thisbeyond/solid-dnd';
import { createEffect, createMemo, createSignal, onCleanup, type JSX } from 'solid-js';
import { resolveAxis } from '../gestures/axisLock.ts';
import {
    AXIS_LOCK_PX,
    CHECK_COMPLETE_RATIO,
    LONG_PRESS_MS,
    REVEAL_OPEN_RATIO,
    REVEAL_WIDTH_PX,
    SCROLL_LOCK_DELAY_MS,
    SWIPE_HORIZONTAL_DOMINANCE,
    TAP_MAX_MS,
    TAP_MAX_PX,
    TAP_MAX_PX_TOUCH,
} from '../gestures/constants.ts';
import {
    createInitialRowGestureState,
    type RowGestureConfig,
    type RowGestureEffect,
    type RowGestureState,
    reduceRowGesture,
} from '../gestures/rowGesture.ts';
import { lockGestureScroll, unlockGestureScroll } from '../gestures/scrollLock.ts';
import {
    shouldAllowNativeVerticalScrollWhilePending,
    shouldPreventActiveTouchMove,
    shouldPreventTouchScroll,
} from '../gestures/touchScrollGuard.ts';
import { useTouchDrag } from '../gestures/touchDragContext.tsx';
import trashIcon from '../icons/trash.svg?raw';
import { transformStyle, useVariableHeightSortable } from './VariableHeightSortable.tsx';
import { Icon } from './Icon.tsx';
import './TaskRow.css';

interface GestureRowContentState {
    visualCompleted: boolean;
    showStrike: boolean;
    strikeWidth: string;
}

interface GestureRowProps {
    id: string;
    deleteRevealed: boolean;
    deleteLabel: string;
    completed?: boolean;
    allowCheckSwipe?: boolean;
    hideDuringDrag?: boolean;
    onRevealChange: (id: string, open: boolean) => void;
    onRowTouchStart?: (id: string) => void;
    onDragEnd?: () => void;
    onOpen: () => void;
    onDelete: () => void | Promise<void>;
    onComplete?: () => void | Promise<void>;
    renderContent: (state: GestureRowContentState) => JSX.Element;
}

const MOUSE_DRAG_VERTICAL_PX = 14;
const TAP_SUPPRESS_AFTER_DRAG_MS = 350;

const DOCUMENT_POINTER_OPTIONS: AddEventListenerOptions = { passive: false, capture: true };
const SURFACE_TOUCH_MOVE_OPTIONS: AddEventListenerOptions = { passive: false };

function nowMs(): number {
    return Date.now();
}

/** Sortable row surface with shared tap, swipe, delete reveal, and long-press drag gestures. */
function GestureRow(props: GestureRowProps): JSX.Element {
    const sortable = useVariableHeightSortable(props.id);
    const touchDrag = useTouchDrag();
    const dndContext = useDragDropContext();
    if (!dndContext) {
        throw new Error('GestureRow must be used within DragDropProvider');
    }
    const [dndState] = dndContext;
    let surfaceEl: HTMLDivElement | undefined;
    let longPressTimer: ReturnType<typeof setTimeout> | undefined;
    let scrollLockTimer: ReturnType<typeof setTimeout> | undefined;
    let interactionConsumed = false;
    let lastPointerType: string = 'touch';
    let activePointerId: number | null = null;
    let suppressTapUntil = 0;
    let lastClientX = 0;
    let lastClientY = 0;
    let gestureConfig: RowGestureConfig = buildGestureConfig(TAP_MAX_PX_TOUCH);

    function buildGestureConfig(tapMaxPx: number): RowGestureConfig {
        return {
            axisLockPx: AXIS_LOCK_PX,
            tapMaxMs: TAP_MAX_MS,
            tapMaxPx,
            revealWidthPx: REVEAL_WIDTH_PX,
            revealOpenRatio: REVEAL_OPEN_RATIO,
            checkCompleteRatio: CHECK_COMPLETE_RATIO,
            swipeHorizontalDominance: SWIPE_HORIZONTAL_DOMINANCE,
        };
    }

    const [gesture, setGesture] = createSignal<RowGestureState>(
        createInitialRowGestureState({ deleteRevealed: props.deleteRevealed }, REVEAL_WIDTH_PX)
    );

    const itemStyle = createMemo(() => transformStyle(sortable.transform));
    const isDraggingThis = () => dndState.active.draggableId === props.id;
    const hideDuringDrag = () => props.hideDuringDrag ?? true;
    const completed = () => props.completed ?? false;
    const allowCheckSwipe = () => props.allowCheckSwipe ?? !!props.onComplete;

    const surfaceTransform = createMemo(() => {
        return `translateX(${gesture().revealOffsetX}px)`;
    });

    const strikeWidth = createMemo(() => `${gesture().checkProgress * 100}%`);

    const visualCompleted = createMemo(() => {
        const g = gesture();
        if (g.phase === 'check-stroke' && !completed()) {
            return g.checkProgress >= 1;
        }
        return completed();
    });

    const showStrike = createMemo(() => !!props.onComplete && !completed() && gesture().checkProgress > 0);

    function clearLongPress() {
        if (longPressTimer !== undefined) {
            clearTimeout(longPressTimer);
            longPressTimer = undefined;
        }
    }

    function clearScrollLockTimer() {
        if (scrollLockTimer !== undefined) {
            clearTimeout(scrollLockTimer);
            scrollLockTimer = undefined;
        }
    }

    function releaseScrollLock() {
        clearScrollLockTimer();
        unlockGestureScroll();
    }

    function detachDocumentPointerListeners() {
        document.removeEventListener('pointermove', onDocumentPointerMove, true);
        document.removeEventListener('pointerup', onDocumentPointerUp, true);
        document.removeEventListener('pointercancel', onDocumentPointerCancel, true);
        activePointerId = null;
    }

    function attachDocumentPointerListeners(pointerId: number) {
        activePointerId = pointerId;
        document.addEventListener('pointermove', onDocumentPointerMove, DOCUMENT_POINTER_OPTIONS);
        document.addEventListener('pointerup', onDocumentPointerUp, DOCUMENT_POINTER_OPTIONS);
        document.addEventListener('pointercancel', onDocumentPointerCancel, DOCUMENT_POINTER_OPTIONS);
    }

    function detachSurfaceTouchMoveListener() {
        surfaceEl?.removeEventListener('touchmove', onSurfaceTouchMove);
    }

    function attachSurfaceTouchMoveListener(element: HTMLDivElement) {
        detachSurfaceTouchMoveListener();
        surfaceEl = element;
        element.addEventListener('touchmove', onSurfaceTouchMove, SURFACE_TOUCH_MOVE_OPTIONS);
    }

    function onSurfaceTouchMove(event: TouchEvent) {
        if (!shouldPreventActiveTouchMove(gesture(), touchDrag.isDragging())) {
            return;
        }
        event.preventDefault();
    }

    function markInteractionConsumed() {
        interactionConsumed = true;
    }

    function openItem() {
        window.setTimeout(() => {
            if (props.deleteRevealed) {
                props.onRevealChange(props.id, false);
            }
            props.onOpen();
        }, 0);
    }

    function applyEffects(effects: RowGestureEffect[], pointerX: number, pointerY: number) {
        for (const effect of effects) {
            switch (effect.type) {
                case 'OPEN_TASK':
                    markInteractionConsumed();
                    openItem();
                    break;
                case 'MARK_COMPLETE':
                    markInteractionConsumed();
                    if (!completed() && props.onComplete) {
                        void props.onComplete();
                    }
                    break;
                case 'SET_REVEAL':
                    markInteractionConsumed();
                    props.onRevealChange(props.id, effect.open);
                    break;
                case 'START_DRAG':
                    markInteractionConsumed();
                    if (surfaceEl) {
                        touchDrag.startDrag(props.id, pointerX, pointerY, surfaceEl);
                    }
                    break;
            }
        }
    }

    function dispatch(action: Parameters<typeof reduceRowGesture>[1], pointerX = 0, pointerY = 0) {
        const result = reduceRowGesture(gesture(), action, gestureConfig);
        setGesture(result.state);
        applyEffects(result.effects, pointerX, pointerY);

        if (
            result.state.phase === 'reveal-pull' ||
            result.state.phase === 'reveal-close' ||
            result.state.phase === 'check-stroke'
        ) {
            clearLongPress();
        }
    }

    function startDragAt(clientX: number, clientY: number) {
        clearLongPress();
        dispatch({ type: 'LONG_PRESS', time: nowMs(), x: clientX, y: clientY }, clientX, clientY);
    }

    function isActiveDrag() {
        return gesture().phase === 'dragging' || touchDrag.isDragging();
    }

    function handlePointerMove(event: PointerEvent) {
        lastClientX = event.clientX;
        lastClientY = event.clientY;
        const g = gesture();

        if (isActiveDrag()) {
            event.preventDefault();
            event.stopPropagation();
            touchDrag.moveDrag(event.clientX, event.clientY);
            return;
        }

        const dx = event.clientX - g.startX;
        const dy = event.clientY - g.startY;

        if (g.phase === 'pending' && event.pointerType === 'touch') {
            if (shouldAllowNativeVerticalScrollWhilePending(g, dx, dy, AXIS_LOCK_PX)) {
                clearLongPress();
            }
        }

        if (event.pointerType === 'touch' && shouldPreventTouchScroll(g, dx, dy, AXIS_LOCK_PX)) {
            event.preventDefault();
            event.stopPropagation();
        }

        if (g.phase === 'pending' && event.pointerType === 'mouse') {
            const axis = resolveAxis(dx, dy, AXIS_LOCK_PX);
            if (axis === 'vertical' && Math.abs(dy) >= MOUSE_DRAG_VERTICAL_PX) {
                lockGestureScroll();
                startDragAt(event.clientX, event.clientY);
                return;
            }
        }

        if (g.phase === 'reveal-pull' || g.phase === 'reveal-close' || g.phase === 'check-stroke') {
            markInteractionConsumed();
        }

        dispatch(
            { type: 'POINTER_MOVE', x: event.clientX, y: event.clientY, time: nowMs() },
            event.clientX,
            event.clientY
        );
    }

    function handlePointerUp(event: PointerEvent) {
        clearLongPress();

        if (isActiveDrag()) {
            event.preventDefault();
            event.stopPropagation();
            touchDrag.endDragIfActive();
            suppressTapUntil = nowMs() + TAP_SUPPRESS_AFTER_DRAG_MS;
            return;
        }

        releaseScrollLock();

        if (nowMs() < suppressTapUntil) {
            event.preventDefault();
            event.stopPropagation();
            return;
        }

        dispatch(
            { type: 'POINTER_UP', x: event.clientX, y: event.clientY, time: nowMs() },
            event.clientX,
            event.clientY
        );
    }

    function onDocumentPointerMove(event: PointerEvent) {
        if (event.pointerId !== activePointerId) {
            return;
        }
        handlePointerMove(event);
    }

    function handlePointerCancel() {
        clearLongPress();

        if (isActiveDrag()) {
            touchDrag.endDragIfActive();
            releaseScrollLock();
            setGesture((prev) => {
                if (prev.phase !== 'dragging') {
                    return prev;
                }
                return reduceRowGesture(prev, { type: 'DRAG_END' }, gestureConfig).state;
            });
            return;
        }

        releaseScrollLock();
        setGesture((prev) => {
            if (prev.phase === 'idle' || prev.pointerId === null) {
                return prev;
            }
            return {
                ...prev,
                phase: 'idle',
                pointerId: null,
                checkProgress: 0,
                revealOffsetX: prev.deleteRevealed ? -REVEAL_WIDTH_PX : 0,
            };
        });
    }

    function onDocumentPointerUp(event: PointerEvent) {
        if (event.pointerId !== activePointerId) {
            return;
        }
        event.preventDefault();
        event.stopPropagation();
        detachDocumentPointerListeners();
        handlePointerUp(event);
    }

    function onDocumentPointerCancel(event: PointerEvent) {
        if (event.pointerId !== activePointerId) {
            return;
        }
        event.preventDefault();
        event.stopPropagation();
        detachDocumentPointerListeners();
        handlePointerCancel();
    }

    function handlePointerDown(event: PointerEvent) {
        if (event.button !== 0) {
            return;
        }
        interactionConsumed = false;
        lastPointerType = event.pointerType;
        gestureConfig = buildGestureConfig(event.pointerType === 'touch' ? TAP_MAX_PX_TOUCH : TAP_MAX_PX);
        props.onRowTouchStart?.(props.id);

        const cardWidth = surfaceEl?.clientWidth ?? 300;
        // Prefer local (set on snap) so a stale props snapshot can't re-enter check-stroke
        // while the delete strip is still visually open.
        const deleteRevealedForDown = gesture().deleteRevealed || props.deleteRevealed;
        dispatch(
            {
                type: 'POINTER_DOWN',
                pointerId: event.pointerId,
                x: event.clientX,
                y: event.clientY,
                time: nowMs(),
                deleteRevealed: deleteRevealedForDown,
                allowCheckSwipe: allowCheckSwipe() && !completed(),
                cardWidth,
            },
            event.clientX,
            event.clientY
        );

        lastClientX = event.clientX;
        lastClientY = event.clientY;
        clearLongPress();
        clearScrollLockTimer();

        attachDocumentPointerListeners(event.pointerId);

        if (event.pointerType === 'mouse') {
            scrollLockTimer = setTimeout(() => {
                if (gesture().phase === 'pending') {
                    lockGestureScroll();
                }
            }, SCROLL_LOCK_DELAY_MS);
        }

        if (event.pointerType === 'touch') {
            longPressTimer = setTimeout(() => {
                startDragAt(lastClientX, lastClientY);
            }, LONG_PRESS_MS);
        }
    }

    function handleSurfaceClick(event: MouseEvent) {
        if (lastPointerType === 'touch') {
            return;
        }
        if (interactionConsumed) {
            event.preventDefault();
            return;
        }
        openItem();
    }

    function handleDeleteClick(event: MouseEvent) {
        event.stopPropagation();
        void props.onDelete();
        props.onRevealChange(props.id, false);
    }

    createEffect(() => {
        const revealed = props.deleteRevealed;
        setGesture((prev) => {
            if (prev.phase !== 'idle') {
                return prev;
            }
            return {
                ...prev,
                deleteRevealed: revealed,
                revealOffsetX: revealed ? -REVEAL_WIDTH_PX : 0,
            };
        });
    });

    let wasDraggingThis = false;
    createEffect(() => {
        const dragging = isDraggingThis();
        if (wasDraggingThis && !dragging) {
            setGesture((prev) => {
                if (prev.phase !== 'dragging') {
                    return prev;
                }
                return reduceRowGesture(prev, { type: 'DRAG_END' }, gestureConfig).state;
            });
            props.onDragEnd?.();
        }
        wasDraggingThis = dragging;
    });

    onCleanup(() => {
        clearLongPress();
        releaseScrollLock();
        detachSurfaceTouchMoveListener();
        detachDocumentPointerListeners();
        if (touchDrag.isDragging() && isDraggingThis()) {
            touchDrag.endDragIfActive();
        }
    });

    return (
        <div
            ref={sortable.ref}
            class="task-list__item"
            style={itemStyle()}
            classList={{
                'task-list__item--dragging': sortable.isActiveDraggable,
                'task-list__item--placeholder': isDraggingThis(),
            }}
        >
            <div class="task-row">
                <div class="task-row__delete-slot" classList={{ 'task-row__delete-slot--hidden': isDraggingThis() }}>
                    <button
                        type="button"
                        class="task-row__delete"
                        aria-label={props.deleteLabel}
                        onClick={handleDeleteClick}
                    >
                        <Icon src={trashIcon} />
                    </button>
                </div>
                {/* Gesture surface: div required because content may include nested controls. */}
                {/* biome-ignore lint/a11y/noStaticElementInteractions: custom pointer gesture handler */}
                {/* biome-ignore lint/a11y/useKeyWithClickEvents: keyboard affordances are provided by row content */}
                <div
                    ref={attachSurfaceTouchMoveListener}
                    class="task-row__surface"
                    classList={{
                        'task-row__surface--placeholder': hideDuringDrag() && isDraggingThis(),
                        'task-row__surface--interacting': gesture().phase !== 'idle',
                        'task-row__surface--drag-pending':
                            gesture().phase === 'pending' || gesture().phase === 'dragging',
                    }}
                    style={{ transform: surfaceTransform() }}
                    onPointerDown={handlePointerDown}
                    onClick={handleSurfaceClick}
                >
                    {props.renderContent({
                        visualCompleted: visualCompleted(),
                        showStrike: showStrike(),
                        strikeWidth: strikeWidth(),
                    })}
                </div>
            </div>
        </div>
    );
}

export type { GestureRowContentState, GestureRowProps };
export { GestureRow };
