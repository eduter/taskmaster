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
    it('renders a dashed inert check and generator icon instead of a text badge', () => {
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

        expect(result.container.querySelector('.task-card--projected')).not.toBeNull();
        expect(result.container.querySelector('.task-card__check--inert')).toBeInstanceOf(HTMLSpanElement);
        expect(result.container.querySelector('.task-card__generator-indicator')?.getAttribute('aria-label')).toBe(
            'Projected by Weekly chores'
        );
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

        expect(result.container.querySelector('.task-card--labels-visible')).not.toBeNull();
        expect(result.getByText('Home')).toBeInstanceOf(HTMLElement);
    });

    it('keeps projected labels collapsed when the preference is off', () => {
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

        expect(result.container.querySelector('.task-card--labels-visible')).toBeNull();
    });

    it('shows nameless color bars in marks mode even when the preference is off', () => {
        const result = render(() => <TaskCardView summary="Template task" labelIds={['label-1']} labelsMode="marks" />);

        expect(result.container.querySelector('.task-card--labels-visible')).toBeNull();
        expect(result.container.querySelector('.label-marks__bar')).toBeInstanceOf(HTMLElement);
        expect((result.container.querySelector('.label-marks__bar') as HTMLElement).style.background).toBe(
            'rgb(79, 70, 229)'
        );
        expect(result.queryByText('Home')).toBeNull();
    });

    it('keeps marks mode from showing label names when the preference is on', () => {
        preferences.labelsVisible = true;

        const result = render(() => <TaskCardView summary="Template task" labelIds={['label-1']} labelsMode="marks" />);

        expect(result.container.querySelector('.task-card--labels-visible')).toBeNull();
        expect(result.queryByText('Home')).toBeNull();
        expect(result.container.querySelector('.label-marks__bar')).not.toBeNull();
    });
});

describe('TaskCardView checklist completion ring', () => {
    function dasharrayValues(element: Element | null): [number, number] | null {
        const value = element?.getAttribute('stroke-dasharray');
        if (!value) {
            return null;
        }
        const [filled, total] = value.split(/\s+/).map(Number);
        return [filled, total];
    }

    it('draws no ring for a task without a checklist', () => {
        const result = render(() => (
            <TaskCardView summary="Plain task" labelIds={[]} showCheck={true} checklistItems={[]} />
        ));

        expect(result.container.querySelector('.task-card__check-progress')).toBeNull();
        expect(result.container.querySelector('.task-card__check-track')).toBeNull();
    });

    it('draws no ring for a completed task', () => {
        const result = render(() => (
            <TaskCardView
                summary="Done task"
                labelIds={[]}
                showCheck={true}
                completed={true}
                checklistItems={[{ id: 'a', summary: 'A', completed: true }]}
            />
        ));

        expect(result.container.querySelector('.task-card__check-progress')).toBeNull();
    });

    it('draws a half ring for a partially complete checklist', () => {
        const result = render(() => (
            <TaskCardView
                summary="Half task"
                labelIds={[]}
                showCheck={true}
                checklistItems={[
                    { id: 'a', summary: 'A', completed: true },
                    { id: 'b', summary: 'B', completed: false },
                ]}
            />
        ));

        const dasharray = dasharrayValues(result.container.querySelector('.task-card__check-progress'));
        expect(dasharray?.[0]).toBeCloseTo(28.274, 2);
        expect(dasharray?.[1]).toBeCloseTo(56.549, 2);
        expect(result.container.querySelector('.task-card__check-progress')?.getAttribute('stroke')).toBe('#fa9a1d');
    });

    it('draws no progress arc when the checklist is empty but present', () => {
        const result = render(() => (
            <TaskCardView summary="Empty checklist" labelIds={[]} showCheck={true} checklistItems={[]} />
        ));

        expect(result.container.querySelector('.task-card__check-progress')).toBeNull();
    });
});
