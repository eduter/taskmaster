import { describe, expect, it } from 'vitest';
import { shouldCelebrateLastTask } from './confetti.ts';

describe('shouldCelebrateLastTask', () => {
    it('is true when id is the only incomplete task', () => {
        expect(
            shouldCelebrateLastTask(
                [
                    { id: 'a', completed: true },
                    { id: 'b', completed: false },
                ],
                'b'
            )
        ).toBe(true);
    });

    it('is false when other incomplete tasks remain', () => {
        expect(
            shouldCelebrateLastTask(
                [
                    { id: 'a', completed: false },
                    { id: 'b', completed: false },
                ],
                'a'
            )
        ).toBe(false);
    });

    it('is false when the task is already completed', () => {
        expect(shouldCelebrateLastTask([{ id: 'a', completed: true }], 'a')).toBe(false);
    });

    it('is false for an empty list', () => {
        expect(shouldCelebrateLastTask([], 'a')).toBe(false);
    });

    it('is false when id is not in the list', () => {
        expect(shouldCelebrateLastTask([{ id: 'a', completed: false }], 'missing')).toBe(false);
    });
});
