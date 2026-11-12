import type { Id } from '@thisbeyond/solid-dnd';
import { useDragDropContext } from '@thisbeyond/solid-dnd';
import { createSignal, onCleanup, onMount } from 'solid-js';
import {
    DRAG_AIR_LEAN_PER_1000,
    DRAG_AIR_PITCH_PER_1000,
    DRAG_AUTOSCROLL_EDGE_PX,
    DRAG_AUTOSCROLL_MAX_FRAME_MS,
    DRAG_AUTOSCROLL_MAX_SPEED_PX_PER_SEC,
    DRAG_AUTOSCROLL_MIN_SPEED_PX_PER_SEC,
    DRAG_GRAVITY_LEAN_DEG,
    DRAG_HANG_TOP_RATIO,
    DRAG_VELOCITY_WINDOW_MS,
    DRAG_WAVE_DAMPING,
    DRAG_WAVE_MAX_DEG,
    DRAG_WAVE_STIFFNESS,
} from './constants.ts';
import { createDragAutoScroller, type DragAutoScrollConfig, type DragFrame } from './dragAutoScroll.ts';
import {
    advanceWave,
    createWaveState,
    type DragWaveConfig,
    type DragWaveDeflection,
    dragWaveTarget,
    type DragWaveSample,
    sampleVelocity,
    waveDeflection as computeWaveDeflection,
} from './dragWave.ts';
import { lockGestureScroll, unlockGestureScroll } from './scrollLock.ts';

const SENSOR_ID = 'touch-row-sensor';

const AUTO_SCROLL_CONFIG: DragAutoScrollConfig = {
    edgePx: DRAG_AUTOSCROLL_EDGE_PX,
    minSpeedPxPerSec: DRAG_AUTOSCROLL_MIN_SPEED_PX_PER_SEC,
    maxSpeedPxPerSec: DRAG_AUTOSCROLL_MAX_SPEED_PX_PER_SEC,
    maxFrameMs: DRAG_AUTOSCROLL_MAX_FRAME_MS,
};

const WAVE_CONFIG: DragWaveConfig = {
    airLeanPer1000: DRAG_AIR_LEAN_PER_1000,
    airPitchPer1000: DRAG_AIR_PITCH_PER_1000,
    gravityLeanDeg: DRAG_GRAVITY_LEAN_DEG,
    maxDeg: DRAG_WAVE_MAX_DEG,
    stiffness: DRAG_WAVE_STIFFNESS,
    damping: DRAG_WAVE_DAMPING,
};

/** The card-local point the overlay pivots around, in pixels from its top-left. */
interface GrabOffset {
    x: number;
    y: number;
}

/** Where the card pivots: a horizontal offset from centre (-1..1) and a pixel pivot. */
interface WaveGrip {
    offsetX: number;
    pivotX: number;
    pivotY: number;
}

function useTouchSortableDrag() {
    const context = useDragDropContext();
    if (!context) {
        throw new Error('useTouchSortableDrag must be used within DragDropProvider');
    }
    const [state, actions] = context;
    const [grabOffset, setGrabOffset] = createSignal<GrabOffset>({ x: 0, y: 0 });
    const [waveDeflection, setWaveDeflection] = createSignal<DragWaveDeflection>({ pitch: 0, yaw: 0, lean: 0 });

    // Drag-wave spring state, shared across a drag. The pointer trail feeds the
    // trailing-window velocity that air resistance is derived from, and the grip
    // tells gravity which side of the card to hang.
    const wave = createWaveState();
    let waveTrail: DragWaveSample[] = [];
    let lastPointer: DragWaveSample = { t: 0, x: 0, y: 0 };
    let grip: WaveGrip = { offsetX: 0, pivotX: 0, pivotY: 0 };

    function stepWave(frame: DragFrame): void {
        // Keep sampling while a drag is live, even between pointer events: repeated
        // positions push the window's velocity toward zero so the card settles.
        if (waveTrail.length > 0) {
            waveTrail.push({ t: frame.timestamp, x: lastPointer.x, y: lastPointer.y });
            if (waveTrail.length > 64) {
                waveTrail.shift();
            }
        }

        const velocity = sampleVelocity(waveTrail, DRAG_VELOCITY_WINDOW_MS);
        const target = dragWaveTarget(grip.offsetX, velocity, WAVE_CONFIG);
        advanceWave(wave, target, WAVE_CONFIG, frame.elapsedMs / 1000);
        setWaveDeflection(computeWaveDeflection(wave));
    }

    // Auto-scroll moves the list under a stationary pointer, so solid-dnd's cached
    // row layouts must be refreshed for collision detection to track the new positions.
    const autoScroller = createDragAutoScroller(
        AUTO_SCROLL_CONFIG,
        () => {
            actions.recomputeLayouts();
            actions.detectCollisions();
        },
        stepWave
    );

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
        const gripX = clientX - rect.left;
        const gripY = clientY - rect.top;
        // Pivot near the top edge so the row hangs from the pointer as if held by
        // its top, whichever row (or how tall) it happens to be.
        const pivotY = Math.min(gripY, rect.height * DRAG_HANG_TOP_RATIO);
        setGrabOffset({ x: gripX, y: pivotY });
        grip = {
            offsetX: rect.width > 0 ? clamp(gripX / rect.width, 0, 1) * 2 - 1 : 0,
            pivotX: gripX,
            pivotY,
        };
        lockGestureScroll();
        actions.sensorStart(SENSOR_ID, { x: clientX, y: clientY });
        actions.dragStart(draggableId);

        // Reset the spring to flat so each drag starts from rest, and seed the
        // velocity trail with the press point.
        Object.assign(wave, createWaveState());
        waveTrail = [];
        lastPointer = { t: performance.now(), x: clientX, y: clientY };
        waveTrail.push(lastPointer);

        autoScroller.start(surfaceEl);
        autoScroller.moveTo(clientY);
    }

    function moveDrag(clientX: number, clientY: number) {
        if (state.active.sensorId !== SENSOR_ID) {
            return;
        }
        actions.sensorMove({ x: clientX, y: clientY });
        autoScroller.moveTo(clientY);
        lastPointer = { t: performance.now(), x: clientX, y: clientY };
        waveTrail.push(lastPointer);
        if (waveTrail.length > 64) {
            waveTrail.shift();
        }
    }

    function endDragIfActive() {
        if (state.active.sensorId === SENSOR_ID) {
            autoScroller.stop();
            actions.dragEnd();
            actions.sensorEnd();
            unlockGestureScroll();
            waveTrail = [];
            setWaveDeflection({ pitch: 0, yaw: 0, lean: 0 });
        }
    }

    const isDragging = () => state.active.sensorId === SENSOR_ID;

    return { startDrag, moveDrag, endDragIfActive, isDragging, grabOffset, waveDeflection };
}

function clamp(value: number, min: number, max: number): number {
    return Math.min(max, Math.max(min, value));
}

export type { GrabOffset };
export { SENSOR_ID, useTouchSortableDrag };
