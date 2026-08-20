/** @vitest-environment jsdom */
import { cleanup, fireEvent, render, screen } from '@solidjs/testing-library';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Task } from '../db/types.ts';
import { TaskRows } from './TaskRows.tsx';

const { removeTask, toggleComplete } = vi.hoisted(() => ({
    removeTask: vi.fn(async () => {}),
    toggleComplete: vi.fn(async () => true),
}));

vi.mock('../stores/taskStore.ts', () => ({
    removeTask,
    tasks: () => [],
    today: () => '2026-08-20',
    toggleComplete,
}));
vi.mock('../stores/labelStore.ts', () => ({
    labels: () => [{ id: 'work', name: 'Work', color: '#3366ff' }],
}));
vi.mock('../stores/viewPreferencesStore.ts', () => ({
    showTaskLabels: () => false,
}));
vi.mock('../utils/confetti.ts', () => ({
    fireConfetti: vi.fn(),
    shouldCelebrateLastTask: () => false,
}));

function makeTask(): Task {
    return {
        id: 'future-task',
        summary: 'Prepare presentation',
        description: '',
        labelIds: ['work'],
        date: '2026-08-25',
        sortOrder: 0,
        completed: false,
        completedAt: null,
        createdAt: 1,
        updatedAt: 1,
        generatorId: null,
        parentTaskId: null,
    };
}

describe('TaskRows', () => {
    afterEach(() => {
        cleanup();
        removeTask.mockClear();
        toggleComplete.mockClear();
    });

    it('reuses task controls while allowing calendar labels and navigation', async () => {
        const onOpen = vi.fn();

        const { container } = render(() => (
            <TaskRows
                items={[makeTask()]}
                onReorder={() => {}}
                onOpen={onOpen}
                labelsVisible={true}
                celebrateCompletion={false}
            />
        ));

        expect(container.querySelector('.task-card--labels-visible')).not.toBeNull();
        expect(screen.getByText('Work')).not.toBeNull();

        const surface = container.querySelector<HTMLElement>('.task-row__surface');
        if (!surface) {
            throw new Error('expected a shared task row gesture surface');
        }
        surface.dispatchEvent(
            new PointerEvent('pointerdown', {
                bubbles: true,
                pointerId: 1,
                pointerType: 'mouse',
                button: 0,
                clientX: 20,
                clientY: 20,
            })
        );
        document.dispatchEvent(
            new PointerEvent('pointerup', {
                bubbles: true,
                pointerId: 1,
                pointerType: 'mouse',
                button: 0,
                clientX: 20,
                clientY: 20,
            })
        );
        await vi.waitFor(() => expect(onOpen).toHaveBeenCalledWith('future-task'));

        fireEvent.click(screen.getByRole('button', { name: 'Mark complete' }));
        await vi.waitFor(() => expect(toggleComplete).toHaveBeenCalledWith('future-task'));

        fireEvent.click(screen.getByRole('button', { name: 'Delete task' }));
        await vi.waitFor(() => expect(removeTask).toHaveBeenCalledWith('future-task'));
    });
});
