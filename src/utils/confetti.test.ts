/** @vitest-environment jsdom */
import { afterEach, describe, expect, it } from 'vitest';
import { shouldCelebrateLastTask, todayTabConfettiOrigin } from './confetti.ts';

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

describe('todayTabConfettiOrigin', () => {
    afterEach(() => {
        document.querySelector('.today-tab-icon')?.remove();
    });

    it('is undefined when the today tab icon is not mounted', () => {
        expect(todayTabConfettiOrigin()).toBeUndefined();
    });

    it('returns the center of the today tab icon', () => {
        const icon = document.createElement('span');
        icon.className = 'today-tab-icon';
        icon.getBoundingClientRect = () =>
            ({
                x: 40,
                y: 10,
                left: 40,
                top: 10,
                width: 20,
                height: 20,
                right: 60,
                bottom: 30,
                toJSON() {},
            }) as DOMRect;
        document.body.appendChild(icon);

        expect(todayTabConfettiOrigin()).toEqual({ x: 50, y: 20 });
    });
});
