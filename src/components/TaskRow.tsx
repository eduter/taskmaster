import { createSortable, transformStyle, useDragDropContext } from '@thisbeyond/solid-dnd';
import { createEffect, createMemo, createSignal, onCleanup, Show } from 'solid-js';
import type { Task } from '../db/types.ts';
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
import { useTouchDrag } from '../gestures/touchDragContext.tsx';
import { useAppNavigate } from '../routing/navigation.ts';
import { removeTask, toggleComplete } from '../stores/taskStore.ts';
import { TaskCard } from './TaskCard.tsx';
import './TaskRow.css';

interface TaskRowProps {
    task: Task;
    deleteRevealed: boolean;
    onRevealChange: (taskId: string, open: boolean) => void;
    onRowTouchStart?: (taskId: string) => void;
    onDragEnd?: () => void;
}

const MOUSE_DRAG_VERTICAL_PX = 14;
const TAP_SUPPRESS_AFTER_DRAG_MS = 350;

const DOCUMENT_POINTER_OPTIONS: AddEventListenerOptions = { passive: false, capture: true };

function nowMs(): number {
    return Date.now();
}

function TaskRow(props: TaskRowProps) {
    const { toTask } = useAppNavigate();
    const sortable = createSortable(props.task.id);
    const touchDrag = useTouchDrag();
    const dndContext = useDragDropContext();
    if (!dndContext) {
        throw new Error('TaskRow must be used within DragDropProvider');
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
    const isDraggingThis = () => dndState.active.draggableId === props.task.id;

    const surfaceTransform = createMemo(() => {
        return `translateX(${gesture().revealOffsetX}px)`;
    });

    const strikeWidth = createMemo(() => `${gesture().checkProgress * 100}%`);

    const visualCompleted = createMemo(() => {
        const g = gesture();
        if (g.phase === 'check-stroke' && !props.task.completed) {
            return g.checkProgress >= 1;
        }
        return props.task.completed;
    });

    const showStrike = createMemo(() => !props.task.completed && gesture().checkProgress > 0);

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
        document.removeEventListener('pointerup', onDocumentPointerEnd, true);
        document.removeEventListener('pointercancel', onDocumentPointerEnd, true);
        activePointerId = null;
    }

    function attachDocumentPointerListeners(pointerId: number) {
        activePointerId = pointerId;
        document.addEventListener('pointermove', onDocumentPointerMove, DOCUMENT_POINTER_OPTIONS);
        document.addEventListener('pointerup', onDocumentPointerEnd, DOCUMENT_POINTER_OPTIONS);
        document.addEventListener('pointercancel', onDocumentPointerEnd, DOCUMENT_POINTER_OPTIONS);
    }

    function markInteractionConsumed() {
        interactionConsumed = true;
    }

    function openTaskDetail() {
        window.setTimeout(() => {
            if (props.deleteRevealed) {
                props.onRevealChange(props.task.id, false);
            }
            toTask(props.task.id);
        }, 0);
    }

    function applyEffects(effects: RowGestureEffect[], pointerX: number, pointerY: number) {
        for (const effect of effects) {
            switch (effect.type) {
                case 'OPEN_TASK':
                    markInteractionConsumed();
                    openTaskDetail();
                    break;
                case 'MARK_COMPLETE':
                    markInteractionConsumed();
                    if (!props.task.completed) {
                        void toggleComplete(props.task.id);
                    }
                    break;
                case 'SET_REVEAL':
                    markInteractionConsumed();
                    props.onRevealChange(props.task.id, effect.open);
                    break;
                case 'START_DRAG':
                    markInteractionConsumed();
                    if (surfaceEl) {
                        touchDrag.startDrag(props.task.id, pointerX, pointerY, surfaceEl);
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

    function shouldPreventTouchScroll(g: RowGestureState, dx: number, dy: number): boolean {
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
            if (absY > absX && absY >= AXIS_LOCK_PX) {
                return false;
            }
            return true;
        }
        return false;
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
            const absX = Math.abs(dx);
            const absY = Math.abs(dy);
            if (absY > absX && absY >= AXIS_LOCK_PX) {
                clearLongPress();
            }
        }

        if (event.pointerType === 'touch' && shouldPreventTouchScroll(g, dx, dy)) {
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

    function onDocumentPointerEnd(event: PointerEvent) {
        if (event.pointerId !== activePointerId) {
            return;
        }
        event.preventDefault();
        event.stopPropagation();
        detachDocumentPointerListeners();
        handlePointerUp(event);
    }

    function handlePointerDown(event: PointerEvent) {
        if (event.button !== 0) {
            return;
        }
        interactionConsumed = false;
        lastPointerType = event.pointerType;
        gestureConfig = buildGestureConfig(event.pointerType === 'touch' ? TAP_MAX_PX_TOUCH : TAP_MAX_PX);
        props.onRowTouchStart?.(props.task.id);

        const cardWidth = surfaceEl?.clientWidth ?? 300;
        dispatch(
            {
                type: 'POINTER_DOWN',
                pointerId: event.pointerId,
                x: event.clientX,
                y: event.clientY,
                time: nowMs(),
                deleteRevealed: props.deleteRevealed,
                allowCheckSwipe: !props.task.completed,
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
        openTaskDetail();
    }

    function handleCheckClick(event: MouseEvent) {
        event.stopPropagation();
        void toggleComplete(props.task.id);
    }

    function handleDeleteClick(event: MouseEvent) {
        event.stopPropagation();
        void removeTask(props.task.id);
        props.onRevealChange(props.task.id, false);
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
                    <button type="button" class="task-row__delete" aria-label="Delete task" onClick={handleDeleteClick}>
                        <svg viewBox="0 0 20 20" width="20" height="20" fill="none" aria-hidden="true">
                            <path
                                d="M5 6h10M8 6V4.5A1.5 1.5 0 0 1 9.5 3h1A1.5 1.5 0 0 1 12 4.5V6m2 0v9.5a1.5 1.5 0 0 1-1.5 1.5h-5A1.5 1.5 0 0 1 6 15.5V6"
                                stroke="currentColor"
                                stroke-width="1.5"
                                stroke-linecap="round"
                                stroke-linejoin="round"
                            />
                        </svg>
                    </button>
                </div>
                {/* Gesture surface: div required (nested controls in TaskCard); pointer + click open detail on desktop */}
                {/* biome-ignore lint/a11y/noStaticElementInteractions: custom pointer gesture handler */}
                {/* biome-ignore lint/a11y/useKeyWithClickEvents: task check button provides keyboard completion */}
                <div
                    ref={surfaceEl}
                    class="task-row__surface"
                    classList={{
                        'task-row__surface--placeholder': isDraggingThis(),
                        'task-row__surface--interacting': gesture().phase !== 'idle',
                        'task-row__surface--drag-pending':
                            gesture().phase === 'pending' || gesture().phase === 'dragging',
                    }}
                    style={{ transform: surfaceTransform() }}
                    onPointerDown={handlePointerDown}
                    onClick={handleSurfaceClick}
                >
                    <TaskCard task={props.task} visualCompleted={visualCompleted()} onCheckClick={handleCheckClick} />
                    <Show when={showStrike()}>
                        <div class="task-row__strike" style={{ width: strikeWidth() }} aria-hidden="true" />
                    </Show>
                </div>
            </div>
        </div>
    );
}

export type { TaskRowProps };
export { TaskRow };
