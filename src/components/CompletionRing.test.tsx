/** @vitest-environment jsdom */
import { cleanup, render } from '@solidjs/testing-library';
import { afterEach, describe, expect, it } from 'vitest';
import { CompletionRing } from './CompletionRing.tsx';

afterEach(cleanup);

function dasharrayValues(element: Element | null): [number, number] | null {
    const value = element?.getAttribute('stroke-dasharray');
    if (!value) {
        return null;
    }

    const [filled, total] = value.split(/\s+/).map(Number);
    return [filled, total];
}

describe('CompletionRing', () => {
    it('draws only the track at a zero rate', () => {
        const result = render(() => <CompletionRing rate={0} color="#f87171" size={20} radius={8} />);

        expect(result.container.querySelector('.completion-ring__track')).not.toBeNull();
        expect(result.container.querySelector('.completion-ring__progress')).toBeNull();
    });

    it('fills half the circumference at a half rate', () => {
        const result = render(() => <CompletionRing rate={0.5} color="#fbbf24" size={20} radius={8} />);

        const dasharray = dasharrayValues(result.container.querySelector('.completion-ring__progress'));
        expect(dasharray?.[0]).toBeCloseTo(25.133, 2);
        expect(dasharray?.[1]).toBeCloseTo(50.265, 2);
        expect(result.container.querySelector('.completion-ring__progress')?.getAttribute('stroke')).toBe('#fbbf24');
    });

    it('honors custom track and progress classes', () => {
        const result = render(() => (
            <CompletionRing
                rate={0.5}
                color="#fbbf24"
                size={22}
                radius={9}
                trackClass="task-card__check-track"
                progressClass="task-card__check-progress"
            />
        ));

        expect(result.container.querySelector('.task-card__check-track')).not.toBeNull();
        expect(result.container.querySelector('.task-card__check-progress')).not.toBeNull();
    });
});
