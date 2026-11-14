const PAPER_DEFAULTS: PaperConfig = {
    lift: 80,
    bend: 140,
    followMs: 220,
    wave: 0,
    pickupMs: 500,
    shadow: 0.8,
};

/** Advance a bounded, dissipative sheet response; pointer translation stays immediate. */
function advancePaper(
    state: PaperState,
    pointer: PaperPointer,
    held: boolean,
    dtSeconds: number,
    config: PaperConfig = PAPER_DEFAULTS
): void {
    const { x, y } = pointer;
    const dt = Math.max(0, Math.min(dtSeconds, 0.05));
    if (dt === 0) {
        return;
    }

    // Integrate displacement as a ramp, so event frequency doesn't set the material
    const tau = Math.max(0.025, config.followMs / 1000);
    const decay = Math.exp(-dt / tau);
    const ramp = (tau / dt) * (1 - decay);
    state.lagX = bounded(state.lagX * decay + (x - state.pointerX) * ramp, 160);
    state.lagY = bounded(state.lagY * decay + (y - state.pointerY) * ramp, 160);
    state.pointerX = x;
    state.pointerY = y;

    // Saturate before smoothing, so a flick cannot store a large spring impulse
    const targetX = held ? config.bend * Math.tanh(state.lagX / 65) : 0;
    const verticalDrive = config.bend * Math.tanh(state.lagY / 65);
    // Pulling from the top tensions the sheet upward; only a downward push makes a broad curl
    const targetY = held ? (verticalDrive < 0 ? Math.max(-2, verticalDrive * 0.04) : verticalDrive) : 0;
    state.bendX = approach(state.bendX, targetX, dt, tau * 0.45);
    state.bendY = approach(state.bendY, targetY, dt, tau * 0.45);
    state.tipX = approach(state.tipX, state.bendX, dt, tau * 0.9);
    state.tipY = approach(state.tipY, state.bendY, dt, tau * 0.9);

    // The lower edge receives the lift through the sheet, after the held edge
    const pickup = Math.max(0.06, config.pickupMs / 1000);
    state.top = approach(state.top, held ? config.lift : 0, dt, pickup * 0.23);
    state.bottom = approach(state.bottom, state.top, dt, pickup * 0.42);
}

/** Material controls: lift in pixels, bend in degrees, times in ms, wave and shadow unitless. */
interface PaperConfig {
    lift: number;
    bend: number;
    followMs: number;
    wave: number;
    pickupMs: number;
    shadow: number;
}

/** Pointer coordinates in viewport pixels. */
interface PaperPointer {
    x: number;
    y: number;
}

/** Independent state for one sheet; no history arrays or per-event integration. */
interface PaperState {
    pointerX: number;
    pointerY: number;
    lagX: number;
    lagY: number;
    bendX: number;
    bendY: number;
    tipX: number;
    tipY: number;
    top: number;
    bottom: number;
}

/** Create a sheet resting flat at the initial pointer position. */
function createPaperState(x: number, y: number): PaperState {
    return { pointerX: x, pointerY: y, lagX: 0, lagY: 0, bendX: 0, bendY: 0, tipX: 0, tipY: 0, top: 0, bottom: 0 };
}

/** Sample the smooth centerline at a fraction of the sheet's height, in local 3D. */
function paperPoint(
    state: PaperState,
    fraction: number,
    height: number,
    config: PaperConfig = PAPER_DEFAULTS
): PaperPoint {
    const { bendX, bendY, tipX, tipY, top, bottom } = state;
    const s = Math.max(0, Math.min(1, fraction));
    const material = Math.min(1, height / 90);
    const curve = s * s;
    const trailing = curve * (2 * s - 1) * config.wave;
    const x = material * (-bendX * curve + (tipX - bendX) * trailing);
    const arc = curledPoint(bendY, tipY, s, config.wave);
    const z = top + (bottom * 0.94 - top) * s * s * (3 - 2 * s) + height * arc.z;
    const pickupShortening = Math.min(height * 0.04, (top - bottom * 0.94) ** 2 / (2 * Math.max(height, 1)));
    return { x: x * 0.22, y: (height - pickupShortening) * arc.y, z };
}

/** Integrate tangent angles instead of moving z alone, so curling preserves sheet length. */
function curledPoint(bend: number, tip: number, fraction: number, wave: number): { y: number; z: number } {
    const radians = Math.PI / 180;
    // Downward pulls bend away; keep every tangent forward-facing even at extreme settings
    const start = -bounded(bend * 0.35, 88) * radians;
    const end = -bounded(bend + (bend - tip) * wave, 88) * radians;
    const sweep = end - start;
    if (Math.abs(sweep) < 0.00001) {
        return { y: fraction * Math.cos(start), z: fraction * Math.sin(start) };
    }
    const angle = start + sweep * fraction;
    return { y: (Math.sin(angle) - Math.sin(start)) / sweep, z: (Math.cos(start) - Math.cos(angle)) / sweep };
}

/** A point on the sheet in local pixels, with positive z toward the viewer. */
interface PaperPoint {
    x: number;
    y: number;
    z: number;
}

function approach(value: number, target: number, dt: number, tau: number): number {
    return target + (value - target) * Math.exp(-dt / tau);
}

function bounded(value: number, limit: number): number {
    return Math.max(-limit, Math.min(limit, value));
}

export type { PaperConfig, PaperPoint, PaperPointer, PaperState };
export { advancePaper, createPaperState, PAPER_DEFAULTS, paperPoint };
