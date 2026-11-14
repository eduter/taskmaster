import { describe, expect, it } from 'vitest';
import { advancePaper, createPaperState, PAPER_DEFAULTS, paperPoint } from './paperDrag.ts';

describe('paper drag', () => {
    it('lifts the top before the lower edge, then holds a slightly lifted sheet', () => {
        const state = createPaperState(0, 0);
        for (let i = 0; i < 6; i++) {
            advancePaper(state, { x: 0, y: 0 }, true, 1 / 60);
        }
        expect(paperPoint(state, 0, 100).z).toBeGreaterThan(paperPoint(state, 1, 100).z + 5);
        for (let i = 0; i < 120; i++) {
            advancePaper(state, { x: 0, y: 0 }, true, 1 / 60);
        }
        expect(paperPoint(state, 0, 100).z).toBeCloseTo(PAPER_DEFAULTS.lift, 1);
        expect(paperPoint(state, 1, 100).z).toBeGreaterThan(PAPER_DEFAULTS.lift * 0.8);
    });

    it('keeps the top attached and lets the bottom trail a rightward drag', () => {
        const state = createPaperState(0, 0);
        for (let i = 1; i <= 30; i++) {
            advancePaper(state, { x: i * 8, y: 0 }, true, 1 / 60);
        }
        expect(paperPoint(state, 0, 100).x).toBe(0);
        expect(paperPoint(state, 1, 100).x).toBeLessThan(-2);
        expect(Math.abs(paperPoint(state, 1, 100).x)).toBeLessThanOrEqual(PAPER_DEFAULTS.bend);
    });

    it('bounds violent flicks and settles without repeated oscillation', () => {
        const state = createPaperState(0, 0);
        for (let i = 0; i < 120; i++) {
            advancePaper(state, { x: (i % 2 ? 1 : -1) * 10000, y: i * 10000 }, true, 1 / 60);
            for (let j = 0; j <= 8; j++) {
                const point = paperPoint(state, j / 8, 100);
                expect(Number.isFinite(point.z)).toBe(true);
                expect(Math.abs(point.x)).toBeLessThanOrEqual(PAPER_DEFAULTS.bend * 1.3);
                expect(point.y).toBeGreaterThanOrEqual(0);
                expect(point.y).toBeLessThanOrEqual((j / 8) * 100);
            }
        }
        for (let i = 0; i < 180; i++) {
            advancePaper(state, { x: state.pointerX, y: state.pointerY }, true, 1 / 60);
        }
        expect(paperPoint(state, 1, 100).x).toBeCloseTo(0, 3);
        const resting = { ...createPaperState(0, 0), top: PAPER_DEFAULTS.lift, bottom: PAPER_DEFAULTS.lift };
        expect(paperPoint(state, 1, 100).y).toBeCloseTo(paperPoint(resting, 1, 100).y, 3);
    });

    it('curls away and leaves the lower edge behind during a downward pull', () => {
        const state = createPaperState(0, 0);
        for (let i = 0; i < 120; i++) {
            advancePaper(state, { x: 0, y: 0 }, true, 1 / 60);
        }
        const restingBottom = paperPoint(state, 1, 100);
        const restingTop = paperPoint(state, 0, 100);
        for (let i = 1; i <= 15; i++) {
            advancePaper(state, { x: 0, y: i * 18 }, true, 1 / 60);
        }
        const top = paperPoint(state, 0, 100);
        const bottom = paperPoint(state, 1, 100);
        expect(top.y).toBeCloseTo(0, 8);
        expect(bottom.z).toBeLessThan(top.z - 30);
        expect(bottom.y).toBeLessThan(restingBottom.y - 15);
        const restingTaper = restingBottom.z - restingTop.z;
        expect(Math.hypot(bottom.y, bottom.z - top.z - restingTaper)).toBeLessThanOrEqual(100.1);
    });

    it('allows an exaggerated near-edge-on curl without folding through itself', () => {
        const config = { ...PAPER_DEFAULTS, bend: 160, wave: 2 };
        const state = createPaperState(0, 0);
        for (let i = 1; i <= 30; i++) {
            advancePaper(state, { x: 0, y: i * 40 }, true, 1 / 60, config);
        }
        const bottom = paperPoint(state, 1, 100, config);
        const nearBottom = paperPoint(state, 0.99, 100, config);
        const angle = Math.atan2(bottom.z - nearBottom.z, bottom.y - nearBottom.y) * (180 / Math.PI);
        expect(angle).toBeLessThan(-80);
        expect(bottom.y).toBeLessThan(65);
        expect(bottom.y).toBeGreaterThan(0);
    });

    it.each([
        PAPER_DEFAULTS,
        { ...PAPER_DEFAULTS, bend: 160, wave: 2 },
    ])('keeps a straight upward pull nearly flat, including at extreme settings', (config) => {
        const state = createPaperState(0, 0);
        for (let i = 0; i < 180; i++) {
            advancePaper(state, { x: 0, y: 0 }, true, 1 / 60, config);
        }
        const rest = paperPoint(state, 1, 100, config);
        for (let i = 1; i <= 30; i++) {
            advancePaper(state, { x: 0, y: -i * 40 }, true, 1 / 60, config);
            const bottom = paperPoint(state, 1, 100, config);
            expect(Math.abs(bottom.z - rest.z)).toBeLessThan(5);
            expect(Math.abs(bottom.y - rest.y)).toBeLessThan(0.5);
        }
    });

    it('gives comparable results at 30, 60 and 120 Hz', () => {
        const poses = [30, 60, 120].map((hz) => {
            const state = createPaperState(0, 0);
            for (let i = 1; i <= hz; i++) {
                advancePaper(state, { x: (i / hz) * 400, y: 0 }, true, 1 / hz);
            }
            return paperPoint(state, 1, 100);
        });
        for (const pose of poses) {
            expect(Math.abs(pose.x - poses[1].x)).toBeLessThan(0.35);
            expect(Math.abs(pose.z - poses[1].z)).toBeLessThan(0.35);
        }
    });

    it('returns to the board on release, including after a stalled frame', () => {
        const state = createPaperState(0, 0);
        advancePaper(state, { x: 900, y: -900 }, true, 3);
        for (let i = 0; i < 150; i++) {
            advancePaper(state, { x: 900, y: -900 }, false, 1 / 60);
        }
        expect(paperPoint(state, 0, 100).z).toBeCloseTo(0, 3);
        expect(paperPoint(state, 1, 100).z).toBeCloseTo(0, 3);
    });
});
