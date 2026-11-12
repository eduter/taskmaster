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
    DRAG_GRAVITY_DEG,
    DRAG_LEAN_Z_DEG,
    DRAG_TILT_X_DEG,
    DRAG_TILT_Y_DEG,
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
    type DragWavePose,
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
    gravityDeg: DRAG_GRAVITY_DEG,
    maxDeg: DRAG_WAVE_MAX_DEG,
    stiffness: DRAG_WAVE_STIFFNESS,
    damping: DRAG_WAVE_DAMPING,
};

const BASE_POSE: DragWavePose = {
    pitch: DRAG_TILT_X_DEG,
    yaw: DRAG_TILT_Y_DEG,
    lean: DRAG_LEAN_Z_DEG,
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
    const [waveDeflection, setWaveDeflection] = createSignal<DragWaveDeflection>({ pitch: 0, yaw: 0, lean: 0 });

    // Drag-wave spring state, shared across a drag. The pointer trail feeds the
    // trailing-window velocity that air resistance is derived from.
    const wave = createWaveState(BASE_POSE, WAVE_CONFIG);
    let waveTrail: DragWaveSample[] = [];
    let lastPointer: DragWaveSample = { t: 0, x: 0, y: 0 };

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
        const target = dragWaveTarget(BASE_POSE, velocity, WAVE_CONFIG);
        advanceWave(wave, target, WAVE_CONFIG, frame.elapsedMs / 1000);
        setWaveDeflection(computeWaveDeflection(wave, BASE_POSE));
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
        setGrabOffset({ x: clientX - rect.left, y: clientY - rect.top });
        lockGestureScroll();
        actions.sensorStart(SENSOR_ID, { x: clientX, y: clientY });
        actions.dragStart(draggableId);

        // Reset the spring to the base pose so each drag starts from rest, and seed
        // the velocity trail with the press point.
        Object.assign(wave, createWaveState(BASE_POSE, WAVE_CONFIG));
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

export type { GrabOffset };
export { SENSOR_ID, useTouchSortableDrag };
