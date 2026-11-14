/** @vitest-environment jsdom */
import { describe, expect, it } from 'vitest';
import { advancePaper, createPaperState } from './paperDrag.ts';
import { createPaperSurface, PAPER_BANDS, PAPER_PERSPECTIVE } from './paperSurface.ts';

describe('paper surface geometry', () => {
    it('joins every band without cracks and pins a low off-center grip', () => {
        const host = document.createElement('div');
        const source = document.createElement('div');
        source.innerHTML = '<button id="original">Readable task</button>';
        const surface = createPaperSurface(host, source, 320, 120);
        const state = createPaperState(0, 0);
        const grip = { x: 250, y: 99 };
        for (let frame = 1; frame < 20; frame++) {
            advancePaper(state, { x: frame * 16, y: frame * -12 }, true, 1 / 60);
            surface.paint(state, grip);
            const bands = [...host.children] as HTMLElement[];
            for (let index = 0; index < PAPER_BANDS - 1; index++) {
                const end = point(bands[index], 320, 120 / PAPER_BANDS);
                const next = point(bands[index + 1], 320, 0);
                expect(end).toEqual(next.map((value) => expect.closeTo(value, 8)));
            }
            const index = Math.floor((grip.y / 120) * PAPER_BANDS);
            const p = point(bands[index], grip.x, grip.y - (index * 120) / PAPER_BANDS);
            const projectedX = grip.x + (p[0] - grip.x) / (1 - p[2] / PAPER_PERSPECTIVE);
            const projectedY = grip.y + (p[1] - grip.y) / (1 - p[2] / PAPER_PERSPECTIVE);
            expect(projectedX).toBeCloseTo(grip.x, 1);
            expect(projectedY).toBeCloseTo(grip.y, 1);
        }
        expect(host.querySelector('[id]')).toBeNull();
        expect(host.inert).toBe(true);
        expect(host.getAttribute('aria-hidden')).toBe('true');
        surface.destroy();
        expect(host.children).toHaveLength(0);
    });
});

function point(band: HTMLElement, x: number, y: number): number[] {
    const m = band.style.transform.slice(9, -1).split(',').map(Number);
    return [x + m[4] * y + m[12], m[5] * y + m[13], m[6] * y + m[14]];
}
