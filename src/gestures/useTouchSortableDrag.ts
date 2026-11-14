import type { Id } from '@thisbeyond/solid-dnd';
import { useDragDropContext } from '@thisbeyond/solid-dnd';
import { createSignal, onCleanup, onMount } from 'solid-js';
import {
    DRAG_AUTOSCROLL_EDGE_PX,
    DRAG_AUTOSCROLL_MAX_FRAME_MS,
    DRAG_AUTOSCROLL_MAX_SPEED_PX_PER_SEC,
    DRAG_AUTOSCROLL_MIN_SPEED_PX_PER_SEC,
} from './constants.ts';
import { createDragAutoScroller, type DragAutoScrollConfig, type DragFrame } from './dragAutoScroll.ts';
import { advancePaper, createPaperState } from './paperDrag.ts';
import { lockGestureScroll, unlockGestureScroll } from './scrollLock.ts';

const SENSOR_ID = 'touch-row-sensor';
const AUTO_SCROLL_CONFIG: DragAutoScrollConfig = {
    edgePx: DRAG_AUTOSCROLL_EDGE_PX,
    minSpeedPxPerSec: DRAG_AUTOSCROLL_MIN_SPEED_PX_PER_SEC,
    maxSpeedPxPerSec: DRAG_AUTOSCROLL_MAX_SPEED_PX_PER_SEC,
    maxFrameMs: DRAG_AUTOSCROLL_MAX_FRAME_MS,
};

/** Drive pointer translation and paper deformation from the shared auto-scroll loop. */
function useTouchSortableDrag() {
    const context = useDragDropContext();
    if (!context) {
        throw new Error('useTouchSortableDrag must be used within DragDropProvider');
    }
    const [state, actions] = context;
    const [grabOffset, setGrabOffset] = createSignal<GrabOffset>({ x: 0, y: 0 });
    const [paper, setPaper] = createSignal(createPaperState(0, 0), { equals: false });
    const [dropTranslation, setDropTranslation] = createSignal<GrabOffset | null>(null);
    let dropFrame: number | null = null;
    let pointer = { x: 0, y: 0 };
    let reducedMotion = false;

    function stepPaper(frame: DragFrame): void {
        advancePaper(paper(), pointer, !reducedMotion, frame.elapsedMs / 1000);
        setPaper(paper());
    }

    // Reuse the scroll loop so collision measurements and visual updates share a frame
    const autoScroller = createDragAutoScroller(
        AUTO_SCROLL_CONFIG,
        () => {
            actions.recomputeLayouts();
            actions.detectCollisions();
        },
        stepPaper
    );

    onMount(() => {
        actions.addSensor({ id: SENSOR_ID, activators: {} });
        const media = window.matchMedia('(prefers-reduced-motion: reduce)');
        reducedMotion = media.matches;
        function onMotionChange(event: MediaQueryListEvent): void {
            reducedMotion = event.matches;
        }
        media.addEventListener('change', onMotionChange);
        onCleanup(() => media.removeEventListener('change', onMotionChange));
    });

    onCleanup(() => {
        if (dropFrame !== null) {
            cancelAnimationFrame(dropFrame);
        }
        autoScroller.stop();
        unlockGestureScroll();
        actions.removeSensor(SENSOR_ID);
    });

    function startDrag(draggableId: Id, clientX: number, clientY: number, surfaceEl: HTMLElement): void {
        if (dropTranslation()) {
            finishDrop();
        }
        const rect = surfaceEl.getBoundingClientRect();
        // Preserve the actual grip even when a tall card is grabbed low down
        setGrabOffset({ x: clientX - rect.left, y: clientY - rect.top });
        pointer = { x: clientX, y: clientY };
        setPaper(createPaperState(clientX, clientY));
        lockGestureScroll();
        actions.sensorStart(SENSOR_ID, pointer);
        actions.dragStart(draggableId);
        autoScroller.start(surfaceEl);
        autoScroller.moveTo(clientY);
    }

    function moveDrag(clientX: number, clientY: number): void {
        if (dropTranslation()) {
            return;
        }
        if (state.active.sensorId !== SENSOR_ID) {
            return;
        }
        pointer = { x: clientX, y: clientY };
        actions.sensorMove(pointer);
        autoScroller.moveTo(clientY);
    }

    function endDragIfActive(): void {
        if (state.active.sensorId !== SENSOR_ID) {
            return;
        }
        if (dropTranslation()) {
            return;
        }
        autoScroller.stop();
        unlockGestureScroll();
        const draggable = state.active.draggable;
        const droppable = state.active.droppable;
        const overlay = state.active.overlay;
        if (reducedMotion || !draggable || !droppable || !overlay) {
            finishDrop();
            return;
        }

        // Keep the sortable placeholder live until the paper has landed in its final slot
        const targetTop =
            draggable.layout.top < droppable.layout.top
                ? droppable.layout.bottom - draggable.layout.height
                : droppable.layout.top;
        const from = { x: overlay.transform.x, y: overlay.transform.y };
        const to = { x: draggable.layout.left - overlay.layout.left, y: targetTop - overlay.layout.top };
        let started: number | null = null;
        let previous: number | null = null;
        setDropTranslation(from);

        function settle(now: number): void {
            dropFrame = null;
            started ??= now;
            previous ??= now;
            const progress = Math.max(0, Math.min(1, (now - started) / 270));
            const ease = 1 - (1 - progress) ** 3;
            setDropTranslation({ x: from.x + (to.x - from.x) * ease, y: from.y + (to.y - from.y) * ease });
            advancePaper(paper(), pointer, false, Math.max(0, now - previous) / 1000);
            setPaper(paper());
            previous = now;
            if (progress === 1) {
                finishDrop();
                return;
            }
            dropFrame = requestAnimationFrame(settle);
        }
        dropFrame = requestAnimationFrame(settle);
    }

    function finishDrop(): void {
        if (dropFrame !== null) {
            cancelAnimationFrame(dropFrame);
            dropFrame = null;
        }
        actions.dragEnd();
        actions.sensorEnd();
        setDropTranslation(null);
        unlockGestureScroll();
    }

    const isDragging = () => state.active.sensorId === SENSOR_ID && !dropTranslation();
    return { startDrag, moveDrag, endDragIfActive, isDragging, grabOffset, paper, dropTranslation };
}

/** Actual card-local pointer position, in pixels from the top-left. */
interface GrabOffset {
    x: number;
    y: number;
}

export type { GrabOffset };
export { SENSOR_ID, useTouchSortableDrag };
