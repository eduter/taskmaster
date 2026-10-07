import { describe, expect, it } from 'vitest';
import { completionRate } from './completionRate.ts';

describe('completionRate', () => {
    it('returns 0 for an absent or empty list', () => {
        expect(completionRate(undefined)).toBe(0);
        expect(completionRate([])).toBe(0);
    });

    it('returns the fraction of completed items', () => {
        expect(completionRate([{ completed: true }, { completed: false }])).toBe(0.5);
        expect(completionRate([{ completed: true }, { completed: true }])).toBe(1);
        expect(completionRate([{ completed: false }])).toBe(0);
    });
});
