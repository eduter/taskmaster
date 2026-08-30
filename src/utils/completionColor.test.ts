import { describe, expect, it } from 'vitest';
import { completionColor } from './completionColor.ts';

describe('completionColor', () => {
    it('returns danger red at 0% completion', () => {
        expect(completionColor(0)).toBe('#f87171');
    });

    it('returns success green at 100% completion', () => {
        expect(completionColor(1)).toBe('#34d399');
    });

    it('returns warning yellow near the midpoint', () => {
        expect(completionColor(0.66)).toBe('#fbbf24');
    });

    it('clamps out-of-range values', () => {
        expect(completionColor(-0.5)).toBe('#f87171');
        expect(completionColor(1.5)).toBe('#34d399');
    });
});
