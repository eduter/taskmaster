/** @vitest-environment jsdom */
import { cleanup, render, screen } from '@solidjs/testing-library';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { GeneratorsTab } from './GeneratorsTab.tsx';

vi.mock('../stores/labelStore.ts', () => ({
    labels: () => [
        { id: 'home', name: 'Home', color: '#4f46e5' },
        { id: 'work', name: 'Work', color: '#3366ff' },
        { id: 'errands', name: 'Errands', color: '#f59e0b' },
    ],
}));

vi.mock('../routing/navigation.ts', () => ({
    useAppNavigate: () => ({ toGenerator: vi.fn() }),
}));

vi.mock('../stores/generatorStore.ts', () => ({
    generators: () => [
        {
            id: 'g1',
            name: 'Morning chores',
            rrule: 'FREQ=DAILY',
            templates: [
                { summary: 'Stretch', description: '', labelIds: ['home', 'work'], checklistItems: [] },
                { summary: 'Shop', description: '', labelIds: ['work', 'errands'], checklistItems: [] },
            ],
            active: true,
            lastGeneratedDate: null,
            createdAt: 1,
            updatedAt: 1,
        },
    ],
}));

afterEach(() => {
    cleanup();
});

describe('GeneratorsTab', () => {
    it('shows the union of template labels as nameless color bars', () => {
        const { container } = render(() => <GeneratorsTab />);
        const item = screen.getByRole('button', { name: /Morning chores/ });
        const bars = [...item.querySelectorAll<HTMLElement>('.label-marks__bar')];

        expect(bars.map((bar) => bar.style.background)).toEqual([
            'rgb(79, 70, 229)',
            'rgb(51, 102, 255)',
            'rgb(245, 158, 11)',
        ]);
        expect(container.querySelector('.label-marks')?.textContent).toBe('');
        expect(screen.queryByText('Home')).toBeNull();
        expect(screen.queryByText('Work')).toBeNull();
        expect(screen.queryByText('Errands')).toBeNull();
    });
});
