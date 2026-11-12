/**
 * Drag-wave physics for the dragged card: a damped spring that air resistance
 * pushes off-centre and gravity biases downward.
 *
 * The card behaves like a light mass held by its grab point. Pointer speed
 * leans it against the direction of travel (air resistance); a spring pulls it
 * back toward that pushed pose, overshooting and settling; and a constant
 * downward bias (gravity) is the pose it falls into when still.
 *
 * `t` is a monotonic clock in milliseconds (performance.now or an animation
 * frame timestamp). All angles are degrees.
 */

/** A pointer sample for the trailing-window velocity estimate. */
interface DragWaveSample {
    t: number;
    x: number;
    y: number;
}

/** The card's un-displaced pose: the values the app already rotates the overlay to. */
interface DragWavePose {
    pitch: number;
    yaw: number;
    lean: number;
}

/** Tuning for the drag-wave spring. */
interface DragWaveConfig {
    /** Lean degrees per 1000px/s of horizontal speed. */
    airLeanPer1000: number;
    /** Pitch degrees per 1000px/s of vertical speed. */
    airPitchPer1000: number;
    /** Resting pitch sag in degrees; the pose a still card falls into. */
    gravityDeg: number;
    /** Cap on the air deflection in degrees, per axis. */
    maxDeg: number;
    /** Spring stiffness (rad^2/s^2); higher snaps back faster. */
    stiffness: number;
    /** Air resistance / damping (1/s); higher settles sooner. */
    damping: number;
}

/** The live spring state: pose plus its per-axis angular velocity. */
interface DragWaveState {
    pitch: number;
    yaw: number;
    lean: number;
    pitchVelocity: number;
    yawVelocity: number;
    leanVelocity: number;
}

/** A velocity estimate from the trailing window. */
interface DragWaveVelocity {
    x: number;
    y: number;
}

/** The spring's current offset from the base pose, in degrees. */
interface DragWaveDeflection {
    pitch: number;
    yaw: number;
    lean: number;
}

function clamp(value: number, min: number, max: number): number {
    return Math.min(max, Math.max(min, value));
}

/**
 * Pointer velocity (px/s) averaged over the trailing `windowMs`, using the
 * oldest in-window sample against the newest. Bursty pointer events average
 * out; a window of identical positions yields zero, so a stopped pointer
 * settles on its own.
 */
function sampleVelocity(trail: DragWaveSample[], windowMs: number): DragWaveVelocity {
    if (trail.length < 2) {
        return { x: 0, y: 0 };
    }

    const newest = trail[trail.length - 1];
    let oldest = trail[0];
    for (let index = trail.length - 1; index >= 0; index--) {
        const candidate = trail[index];
        if (newest.t - candidate.t <= windowMs) {
            oldest = candidate;
        } else {
            break;
        }
    }

    const dtMs = newest.t - oldest.t;
    if (dtMs <= 0) {
        return { x: 0, y: 0 };
    }
    return {
        x: ((newest.x - oldest.x) / dtMs) * 1000,
        y: ((newest.y - oldest.y) / dtMs) * 1000,
    };
}

/** The pose the spring chases: base pose plus gravity sag and air deflection. */
function dragWaveTarget(pose: DragWavePose, velocity: DragWaveVelocity, config: DragWaveConfig): DragWavePose {
    const lean = clamp((-config.airLeanPer1000 * velocity.x) / 1000, -config.maxDeg, config.maxDeg);
    const pitchAir = clamp((config.airPitchPer1000 * velocity.y) / 1000, -config.maxDeg, config.maxDeg);
    return {
        pitch: pose.pitch + config.gravityDeg + pitchAir,
        yaw: pose.yaw,
        lean: pose.lean + lean,
    };
}

/** A wave state seeded at rest on the given pose, already sagged by gravity. */
function createWaveState(pose: DragWavePose, config: DragWaveConfig): DragWaveState {
    return {
        pitch: pose.pitch + config.gravityDeg,
        yaw: pose.yaw,
        lean: pose.lean,
        pitchVelocity: 0,
        yawVelocity: 0,
        leanVelocity: 0,
    };
}

/** Advance the damped spring toward `target` by `dtSeconds`. Mutates `state`. */
function advanceWave(
    state: DragWaveState,
    target: DragWavePose,
    config: DragWaveConfig,
    dtSeconds: number
): DragWaveState {
    const axes = [
        ['pitch', target.pitch],
        ['yaw', target.yaw],
        ['lean', target.lean],
    ] as const;

    for (const [axis, targetValue] of axes) {
        const velocityKey = `${axis}Velocity` as const;
        // Hooke's law toward the target, minus air resistance (damping).
        const acceleration = config.stiffness * (targetValue - state[axis]) - config.damping * state[velocityKey];
        state[velocityKey] += acceleration * dtSeconds;
        state[axis] += state[velocityKey] * dtSeconds;
    }
    return state;
}

/** The spring's current offset from the base pose, in degrees. */
function waveDeflection(state: DragWaveState, pose: DragWavePose): DragWaveDeflection {
    return {
        pitch: state.pitch - pose.pitch,
        yaw: state.yaw - pose.yaw,
        lean: state.lean - pose.lean,
    };
}

export type { DragWaveConfig, DragWaveDeflection, DragWavePose, DragWaveSample, DragWaveState, DragWaveVelocity };
export { advanceWave, createWaveState, dragWaveTarget, sampleVelocity, waveDeflection };
