/** @vitest-environment jsdom */
import { cleanup, render } from '@solidjs/testing-library';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { TaskCardView } from './TaskCard.tsx';

const preferences = vi.hoisted(() => ({ labelsVisible: false }));

vi.mock('../stores/labelStore.ts', () => ({
    labels: () => [{ id: 'label-1', name: 'Home', color: '#4f46e5' }],
}));

vi.mock('../stores/viewPreferencesStore.ts', () => ({
    showTaskLabels: () => preferences.labelsVisible,
}));

afterEach(() => {
    cleanup();
    preferences.labelsVisible = false;
});

describe('TaskCardView projected tasks', () => {
    it('renders a dashed inert check and generator indicator instead of a text badge', () => {
        const result = render(() => (
            <TaskCardView
                summary="Projected task"
                labelIds={['label-1']}
                variant="projected"
                showCheck={true}
                inertCheck={true}
                generatorName="Weekly chores"
            />
        ));

        expect(result.container.querySelector('.task-card')?.classList.contains('task-card--projected')).toBe(true);
        expect(result.container.querySelector('.task-card__check--inert')).toBeInstanceOf(HTMLSpanElement);
        expect(result.container.querySelector('.task-card__generator-indicator')?.getAttribute('aria-label')).toBe(
            'Projected by Weekly chores'
        );
        expect(result.container.querySelector('.task-card__carried-badge')).toBeNull();
    });

    it('uses the global show-labels preference', () => {
        preferences.labelsVisible = true;

        const result = render(() => (
            <TaskCardView
                summary="Projected task"
                labelIds={['label-1']}
                variant="projected"
                showCheck={true}
                inertCheck={true}
                generatorName="Weekly chores"
            />
        ));

        expect(result.container.querySelector('.task-card')?.classList.contains('task-card--labels-visible')).toBe(
            true
        );
        expect(result.getByText('Home')).toBeInstanceOf(HTMLElement);
    });
});
