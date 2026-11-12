import { describe, expect, it } from 'vitest';
import {
    advanceWave,
    createWaveState,
    dragWaveTarget,
    type DragWaveConfig,
    type DragWaveSample,
    sampleVelocity,
    waveDeflection,
} from './dragWave.ts';

const CONFIG: DragWaveConfig = {
    airLeanPer1000: 6,
    airPitchPer1000: 4,
    gravityDeg: 4,
    maxDeg: 15,
    stiffness: 90,
    damping: 9,
};

const POSE = { pitch: -15, yaw: -5, lean: 0 };

function sample(t: number, x: number, y: number): DragWaveSample {
    return { t, x, y };
}

describe('sampleVelocity', () => {
    it('returns zero with fewer than two samples', () => {
        expect(sampleVelocity([], 100)).toEqual({ x: 0, y: 0 });
        expect(sampleVelocity([sample(0, 10, 10)], 100)).toEqual({ x: 0, y: 0 });
    });

    it('averages displacement over the trailing window', () => {
        // 100px over 100ms = 1000px/s.
        const trail = [sample(0, 0, 0), sample(50, 50, 0), sample(100, 100, 0)];
        const v = sampleVelocity(trail, 100);
        expect(v.x).toBeCloseTo(1000, 5);
        expect(v.y).toBeCloseTo(0, 5);
    });

    it('ignores samples older than the window', () => {
        // The old sample at t=0 is outside a 100ms window ending at t=250.
        const trail = [sample(0, 0, 0), sample(200, 200, 0), sample(250, 260, 0)];
        const v = sampleVelocity(trail, 100);
        // Only t=200..250 counts: 60px over 50ms = 1200px/s.
        expect(v.x).toBeCloseTo(1200, 5);
    });

    it('decays to zero when the pointer stops, even with a window of identical samples', () => {
        const trail = [sample(100, 500, 300), sample(150, 500, 300), sample(200, 500, 300)];
        expect(sampleVelocity(trail, 100)).toEqual({ x: 0, y: 0 });
    });
});

describe('dragWaveTarget', () => {
    it('holds the base pose plus gravity sag when still', () => {
        const target = dragWaveTarget(POSE, { x: 0, y: 0 }, CONFIG);
        expect(target.pitch).toBeCloseTo(POSE.pitch + CONFIG.gravityDeg, 5);
        expect(target.yaw).toBeCloseTo(POSE.yaw, 5);
        expect(target.lean).toBeCloseTo(POSE.lean, 5);
    });

    it('leans against a rightward drag (air resistance)', () => {
        const target = dragWaveTarget(POSE, { x: 1000, y: 0 }, CONFIG);
        expect(target.lean).toBeCloseTo(-CONFIG.airLeanPer1000, 5);
    });

    it('leans the other way for a leftward drag', () => {
        const target = dragWaveTarget(POSE, { x: -1000, y: 0 }, CONFIG);
        expect(target.lean).toBeCloseTo(CONFIG.airLeanPer1000, 5);
    });

    it('pitches with vertical speed', () => {
        const target = dragWaveTarget(POSE, { x: 0, y: 1000 }, CONFIG);
        expect(target.pitch).toBeCloseTo(POSE.pitch + CONFIG.gravityDeg + CONFIG.airPitchPer1000, 5);
    });

    it('clamps the air deflection to the amplitude cap', () => {
        const target = dragWaveTarget(POSE, { x: 100000, y: 0 }, CONFIG);
        expect(target.lean).toBeCloseTo(-CONFIG.maxDeg, 5);
    });
});

describe('advanceWave', () => {
    it('pulls a displaced wave back toward its target', () => {
        const state = createWaveState(POSE, CONFIG);
        const target = dragWaveTarget(POSE, { x: 0, y: 0 }, CONFIG);
        // Kick the lean well away from rest, then step.
        state.lean = 12;
        const before = Math.abs(state.lean - target.lean);
        for (let i = 0; i < 5; i++) {
            advanceWave(state, target, CONFIG, 1 / 60);
        }
        expect(Math.abs(state.lean - target.lean)).toBeLessThan(before);
    });

    it('settles back to the target and stops moving', () => {
        const state = createWaveState(POSE, CONFIG);
        const target = dragWaveTarget(POSE, { x: 0, y: 0 }, CONFIG);
        state.lean = 10;
        for (let i = 0; i < 600; i++) {
            advanceWave(state, target, CONFIG, 1 / 60);
        }
        expect(state.lean).toBeCloseTo(target.lean, 2);
        expect(state.leanVelocity).toBeCloseTo(0, 2);
    });

    it('overshoots on the way to a suddenly-moved target', () => {
        const state = createWaveState(POSE, CONFIG);
        const target = dragWaveTarget(POSE, { x: 1000, y: 0 }, CONFIG);
        let minLean = 0;
        for (let i = 0; i < 60; i++) {
            advanceWave(state, target, CONFIG, 1 / 60);
            minLean = Math.min(minLean, state.lean);
        }
        // Damped spring: it should pass its target (negative lean) before settling.
        expect(minLean).toBeLessThan(target.lean);
    });
});

describe('waveDeflection', () => {
    it('reports the signed offset from the base pose', () => {
        const state = createWaveState(POSE, CONFIG);
        state.lean = -3;
        state.pitch = POSE.pitch + 1;
        const d = waveDeflection(state, POSE);
        expect(d.lean).toBeCloseTo(-3, 5);
        expect(d.pitch).toBeCloseTo(1, 5);
        expect(d.yaw).toBeCloseTo(0, 5);
    });
});
