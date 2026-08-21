/** @vitest-environment jsdom */
import { cleanup, fireEvent, render } from '@solidjs/testing-library';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ProjectedTask } from '../calendar/project.ts';
import { ProjectedTaskCard } from './CalendarTab.tsx';

vi.mock('../stores/labelStore.ts', () => ({
    labels: () => [],
}));

vi.mock('../stores/viewPreferencesStore.ts', () => ({
    showTaskLabels: () => false,
}));

afterEach(cleanup);

describe('ProjectedTaskCard', () => {
    it('opens the source generator when clicked', () => {
        const onOpen = vi.fn();
        const task: ProjectedTask = {
            kind: 'projected',
            id: 'projected:generator-1:2026-08-24:0',
            date: '2026-08-24',
            summary: 'Take out recycling',
            description: '',
            labelIds: [],
            generatorId: 'generator-1',
            generatorName: 'Monday chores',
            templateIndex: 0,
        };
        const result = render(() => <ProjectedTaskCard task={task} onOpen={onOpen} />);

        fireEvent.click(result.getByRole('button', { name: 'Edit generator Monday chores' }));

        expect(onOpen).toHaveBeenCalledOnce();
    });
});
