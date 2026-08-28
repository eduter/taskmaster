/** @vitest-environment jsdom */
import { cleanup, render, screen } from '@solidjs/testing-library';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { TaskTemplateList } from './TaskTemplateList.tsx';

vi.mock('../stores/labelStore.ts', () => ({
    labels: () => [{ id: 'home', name: 'Home', color: '#4f46e5' }],
}));

vi.mock('../stores/viewPreferencesStore.ts', () => ({
    showTaskLabels: () => true,
}));

afterEach(() => {
    cleanup();
});

describe('TaskTemplateList', () => {
    it('shows template labels as nameless color bars even when names are enabled', () => {
        const { container } = render(() => (
            <TaskTemplateList
                templates={[
                    {
                        id: 'tmpl-1',
                        summary: 'Water the plants',
                        description: '',
                        labelIds: ['home'],
                        checklistItems: [],
                    },
                ]}
                onReorder={() => {}}
                onOpen={() => {}}
                onDelete={() => {}}
            />
        ));

        expect(screen.getByText('Water the plants')).toBeTruthy();
        expect(container.querySelector('.task-card--labels-visible')).toBeNull();
        expect((container.querySelector('.label-marks__bar') as HTMLElement).style.background).toBe('rgb(79, 70, 229)');
        expect(screen.queryByText('Home')).toBeNull();
    });
});
