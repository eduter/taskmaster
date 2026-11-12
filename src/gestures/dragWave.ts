/**
 * Drag-wave physics for the dragged card: a damped spring whose rest pose is set
 * by air resistance and by where the card is held.
 *
 * The card behaves like a light sheet held at a point. Its rest pose is the sum
 * of two effects, and a damped spring chases that pose so the motion lags the
 * pointer and overshoots instead of snapping:
 *
 * - Air resistance leans the card against the direction the pointer travels, so
 *   a rightward flick swings the card's trailing (left) side down before it
 *   catches up.
 * - Gravity drops the side farther from the grab point, so a card held at its
 *   right edge hangs its left end down.
 *
 * All angles are degrees, and the spring's deflection is measured from the
 * card's flat pose: zero means flat, positive lean tips the card's left edge up.
 */
interface DragWaveSample {
    t: number;
    x: number;
    y: number;
}

/** A velocity estimate from the trailing window, in px/s. */
interface DragWaveVelocity {
    x: number;
    y: number;
}

/** The spring's deflection from the card's flat pose, in degrees. */
interface DragWaveDeflection {
    pitch: number;
    yaw: number;
    lean: number;
}

/** The live spring state: deflection plus its per-axis angular velocity. */
interface DragWaveState {
    pitch: number;
    yaw: number;
    lean: number;
    pitchVelocity: number;
    yawVelocity: number;
    leanVelocity: number;
}

/** Tuning for the drag-wave spring. */
interface DragWaveConfig {
    /** Lean degrees per 1000px/s of horizontal pointer speed (air resistance). */
    airLeanPer1000: number;
    /** Pitch degrees per 1000px/s of vertical pointer speed (air resistance). */
    airPitchPer1000: number;
    /**
     * Lean degrees when the grab point sits at a card edge. Gravity scales this
     * by how far the grab point is from the card's centre, so a centred grab
     * hangs level and an edge grab drops the far end the most.
     */
    gravityLeanDeg: number;
    /** Cap on the total deflection, per axis, in degrees. */
    maxDeg: number;
    /** Spring stiffness (rad^2/s^2); higher snaps back faster. */
    stiffness: number;
    /** Damping (1/s); higher settles sooner. */
    damping: number;
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

/**
 * The pose the spring chases. `gravityOffX` is the grab point's horizontal
 * offset from the card's centre, normalized to -1 (left edge) .. 1 (right edge).
 *
 * Sign convention: positive lean tips the card's left edge up (a clockwise tilt
 * on screen). Both terms are therefore negated — a grab right of centre drops
 * the card's left (far) side, and a rightward flick (positive velocity) leans
 * the card against its travel, so its trailing left side sags.
 */
function dragWaveTarget(gravityOffX: number, velocity: DragWaveVelocity, config: DragWaveConfig): DragWaveDeflection {
    const gravity = config.gravityLeanDeg * clamp(gravityOffX, -1, 1);
    // `0 -` keeps a zero offset from producing a negative zero.
    const lean = clamp(0 - gravity - (config.airLeanPer1000 * velocity.x) / 1000, -config.maxDeg, config.maxDeg);
    // Moving up pitches the bottom edge away (negative pitch); moving down lifts it.
    const pitch = clamp((config.airPitchPer1000 * velocity.y) / 1000, -config.maxDeg, config.maxDeg);
    return { pitch, yaw: 0, lean };
}

/** A wave state resting flat, with no stored angular velocity. */
function createWaveState(): DragWaveState {
    return {
        pitch: 0,
        yaw: 0,
        lean: 0,
        pitchVelocity: 0,
        yawVelocity: 0,
        leanVelocity: 0,
    };
}

/** Advance the damped spring toward `target` by `dtSeconds`. Mutates `state`. */
function advanceWave(
    state: DragWaveState,
    target: DragWaveDeflection,
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

/** The spring's current deflection from the flat pose, in degrees. */
function waveDeflection(state: DragWaveState): DragWaveDeflection {
    return { pitch: state.pitch, yaw: state.yaw, lean: state.lean };
}

export type { DragWaveConfig, DragWaveDeflection, DragWaveSample, DragWaveState, DragWaveVelocity };
export { advanceWave, createWaveState, dragWaveTarget, sampleVelocity, waveDeflection };
