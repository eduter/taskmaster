/** @vitest-environment jsdom */
import { cleanup, fireEvent, render, screen } from '@solidjs/testing-library';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Task } from '../db/types.ts';
import { AddTask } from './AddTask.tsx';

const { addTask, copyPreviousTask, loadCompletedTaskCandidates } = vi.hoisted(() => ({
    addTask: vi.fn(async () => ({ id: 'created' })),
    copyPreviousTask: vi.fn(async () => ({ id: 'copied' })),
    loadCompletedTaskCandidates: vi.fn<() => Promise<Task[]>>(),
}));

vi.mock('../stores/taskStore.ts', () => ({
    addTask,
    copyPreviousTask,
    loadCompletedTaskCandidates,
    filterTaskCandidates: (candidates: Task[], query: string, limit = 5) => {
        const normalized = query.trim().toLocaleLowerCase();
        return candidates
            .filter((task) => task.summary.trim().toLocaleLowerCase().includes(normalized))
            .slice(0, limit);
    },
}));

vi.mock('../stores/labelStore.ts', () => ({
    labels: () => [{ id: 'home', name: 'Home', color: '#4f46e5' }],
}));

function task(id: string, summary: string, labelIds: string[] = []): Task {
    return {
        id,
        summary,
        description: '',
        labelIds,
        date: '2026-08-01',
        sortOrder: 0,
        completed: true,
        completedAt: 1,
        createdAt: 1,
        updatedAt: 1,
        generatorId: null,
        parentTaskId: null,
        checklistItems: [],
    };
}

describe('AddTask', () => {
    beforeEach(() => {
        loadCompletedTaskCandidates.mockResolvedValue([]);
    });

    afterEach(() => {
        cleanup();
        addTask.mockClear();
        copyPreviousTask.mockClear();
        loadCompletedTaskCandidates.mockReset();
    });

    it('creates a task on an explicitly supplied calendar date', async () => {
        render(() => <AddTask date="2026-08-14" />);

        fireEvent.input(screen.getByPlaceholderText('Add a task…'), { target: { value: 'Plan trip' } });
        fireEvent.click(screen.getByRole('button', { name: 'Add' }));

        await vi.waitFor(() => {
            expect(addTask).toHaveBeenCalledWith('Plan trip', '2026-08-14');
        });
        expect((screen.getByPlaceholderText('Add a task…') as HTMLInputElement).value).toBe('');
    });

    it('keeps the existing today behavior when no date is supplied', async () => {
        render(() => <AddTask />);

        fireEvent.input(screen.getByPlaceholderText('Add a task…'), { target: { value: 'Today task' } });
        fireEvent.click(screen.getByRole('button', { name: 'Add' }));

        await vi.waitFor(() => {
            expect(addTask).toHaveBeenCalledWith('Today task', undefined);
        });
    });

    it('copies a matching previous task onto the supplied date', async () => {
        const previous = task('package', 'Pick up package at the post office');
        loadCompletedTaskCandidates.mockResolvedValue([previous]);
        const onAdded = vi.fn();
        render(() => <AddTask date="2026-08-24" onAdded={onAdded} />);
        const input = screen.getByPlaceholderText('Add a task…');

        fireEvent.focus(input);
        fireEvent.input(input, { target: { value: 'package' } });
        fireEvent.click(await screen.findByRole('option', { name: previous.summary }));

        await vi.waitFor(() => {
            expect(copyPreviousTask).toHaveBeenCalledWith(previous, '2026-08-24');
        });
        expect(addTask).not.toHaveBeenCalled();
        expect((input as HTMLInputElement).value).toBe('');
        expect(onAdded).toHaveBeenCalledOnce();
    });

    it('selects suggestions with arrow keys without changing ordinary Enter behavior', async () => {
        const packageTask = task('package', 'Pick up package at the post office');
        const letterTask = task('letter', 'Post a letter');
        loadCompletedTaskCandidates.mockResolvedValue([packageTask, letterTask]);
        render(() => <AddTask />);
        const input = screen.getByPlaceholderText('Add a task…');

        fireEvent.focus(input);
        fireEvent.input(input, { target: { value: 'post' } });
        await screen.findAllByRole('option');
        fireEvent.keyDown(input, { key: 'ArrowDown' });
        fireEvent.keyDown(input, { key: 'ArrowDown' });
        fireEvent.keyDown(input, { key: 'Enter' });

        await vi.waitFor(() => {
            expect(copyPreviousTask).toHaveBeenCalledWith(letterTask, undefined);
        });
        expect(addTask).not.toHaveBeenCalled();
    });

    it('dismisses suggestions with Escape', async () => {
        loadCompletedTaskCandidates.mockResolvedValue([task('package', 'Pick up package')]);
        render(() => <AddTask />);
        const input = screen.getByPlaceholderText('Add a task…');

        fireEvent.focus(input);
        fireEvent.input(input, { target: { value: 'package' } });
        await screen.findByRole('option');
        fireEvent.keyDown(input, { key: 'Escape' });

        expect(screen.queryByRole('option')).toBeNull();
        expect(input.getAttribute('aria-expanded')).toBe('false');
    });

    it('does not open suggestions for a one-character query', async () => {
        loadCompletedTaskCandidates.mockResolvedValue([task('package', 'Pick up package')]);
        render(() => <AddTask />);
        const input = screen.getByPlaceholderText('Add a task…');

        fireEvent.focus(input);
        fireEvent.input(input, { target: { value: 'p' } });
        await vi.waitFor(() => expect(loadCompletedTaskCandidates).toHaveBeenCalled());

        expect(screen.queryByRole('option')).toBeNull();
    });

    it('shows nameless label marks on previous-task suggestions', async () => {
        const previous = task('package', 'Pick up package at the post office', ['home']);
        loadCompletedTaskCandidates.mockResolvedValue([previous]);
        render(() => <AddTask />);
        const input = screen.getByPlaceholderText('Add a task…');

        fireEvent.focus(input);
        fireEvent.input(input, { target: { value: 'package' } });
        const option = await screen.findByRole('option', { name: previous.summary });

        expect((option.querySelector('.label-marks__bar') as HTMLElement).style.background).toBe('rgb(79, 70, 229)');
        expect(screen.queryByText('Home')).toBeNull();
    });
});
