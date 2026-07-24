/** @vitest-environment jsdom */
import { cleanup, fireEvent, render, screen } from '@solidjs/testing-library';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AddTask } from './AddTask.tsx';

const { addTask } = vi.hoisted(() => ({
    addTask: vi.fn(async () => ({ id: 'created' })),
}));

vi.mock('../stores/taskStore.ts', () => ({ addTask }));

describe('AddTask', () => {
    afterEach(() => {
        cleanup();
        addTask.mockClear();
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
});
