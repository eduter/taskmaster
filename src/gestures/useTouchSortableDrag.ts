import type { Id } from '@thisbeyond/solid-dnd';
import { useDragDropContext } from '@thisbeyond/solid-dnd';
import { createSignal, onCleanup, onMount } from 'solid-js';
import {
    DRAG_AUTOSCROLL_EDGE_PX,
    DRAG_AUTOSCROLL_MAX_FRAME_MS,
    DRAG_AUTOSCROLL_MAX_SPEED_PX_PER_SEC,
    DRAG_AUTOSCROLL_MIN_SPEED_PX_PER_SEC,
} from './constants.ts';
import { createDragAutoScroller, type DragAutoScrollConfig } from './dragAutoScroll.ts';
import { lockGestureScroll, unlockGestureScroll } from './scrollLock.ts';

const SENSOR_ID = 'touch-row-sensor';

const AUTO_SCROLL_CONFIG: DragAutoScrollConfig = {
    edgePx: DRAG_AUTOSCROLL_EDGE_PX,
    minSpeedPxPerSec: DRAG_AUTOSCROLL_MIN_SPEED_PX_PER_SEC,
    maxSpeedPxPerSec: DRAG_AUTOSCROLL_MAX_SPEED_PX_PER_SEC,
    maxFrameMs: DRAG_AUTOSCROLL_MAX_FRAME_MS,
};

interface GrabOffset {
    x: number;
    y: number;
}

function useTouchSortableDrag() {
    const context = useDragDropContext();
    if (!context) {
        throw new Error('useTouchSortableDrag must be used within DragDropProvider');
    }
    const [state, actions] = context;
    const [grabOffset, setGrabOffset] = createSignal<GrabOffset>({ x: 0, y: 0 });

    // Auto-scroll moves the list under a stationary pointer, so solid-dnd's cached
    // row layouts must be refreshed for collision detection to track the new positions.
    const autoScroller = createDragAutoScroller(AUTO_SCROLL_CONFIG, () => {
        actions.recomputeLayouts();
        actions.detectCollisions();
    });

    onMount(() => {
        actions.addSensor({ id: SENSOR_ID, activators: {} });
    });

    onCleanup(() => {
        autoScroller.stop();
        unlockGestureScroll();
        actions.removeSensor(SENSOR_ID);
    });

    function startDrag(draggableId: Id, clientX: number, clientY: number, surfaceEl: HTMLElement) {
        const rect = surfaceEl.getBoundingClientRect();
        setGrabOffset({ x: clientX - rect.left, y: clientY - rect.top });
        lockGestureScroll();
        actions.sensorStart(SENSOR_ID, { x: clientX, y: clientY });
        actions.dragStart(draggableId);
        autoScroller.start(surfaceEl);
        autoScroller.moveTo(clientY);
    }

    function moveDrag(clientX: number, clientY: number) {
        if (state.active.sensorId !== SENSOR_ID) {
            return;
        }
        actions.sensorMove({ x: clientX, y: clientY });
        autoScroller.moveTo(clientY);
    }

    function endDragIfActive() {
        if (state.active.sensorId === SENSOR_ID) {
            autoScroller.stop();
            actions.dragEnd();
            actions.sensorEnd();
            unlockGestureScroll();
        }
    }

    const isDragging = () => state.active.sensorId === SENSOR_ID;

    return { startDrag, moveDrag, endDragIfActive, isDragging, grabOffset };
}

export type { GrabOffset };
export { SENSOR_ID, useTouchSortableDrag };
