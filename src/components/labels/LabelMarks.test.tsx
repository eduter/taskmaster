/** @vitest-environment jsdom */
import { cleanup, render } from '@solidjs/testing-library';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { LabelMarks, uniqueLabelIds } from './LabelMarks.tsx';

vi.mock('../../stores/labelStore.ts', () => ({
    labels: () => [
        { id: 'home', name: 'Home', color: '#4f46e5' },
        { id: 'work', name: 'Work', color: '#3366ff' },
        { id: 'errands', name: 'Errands', color: '#f59e0b' },
    ],
}));

afterEach(() => {
    cleanup();
});

describe('uniqueLabelIds', () => {
    it('keeps first-seen order across groups and drops duplicates', () => {
        expect(uniqueLabelIds([['home', 'work'], ['work', 'errands'], ['home']])).toEqual(['home', 'work', 'errands']);
    });

    it('returns an empty list when every group is empty', () => {
        expect(uniqueLabelIds([[], []])).toEqual([]);
    });
});

describe('LabelMarks', () => {
    it('renders a nameless color bar for each known label', () => {
        const { container } = render(() => <LabelMarks labelIds={['home', 'missing', 'work']} />);
        const bars = [...container.querySelectorAll<HTMLElement>('.label-marks__bar')];

        expect(container.querySelector('.label-marks')?.getAttribute('aria-hidden')).toBe('true');
        expect(bars.map((bar) => bar.style.background)).toEqual(['rgb(79, 70, 229)', 'rgb(51, 102, 255)']);
        expect(container.textContent).toBe('');
    });

    it('renders nothing when no known labels are selected', () => {
        const { container } = render(() => <LabelMarks labelIds={['missing']} />);

        expect(container.querySelector('.label-marks')).toBeNull();
    });
});
