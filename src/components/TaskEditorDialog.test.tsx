/** @vitest-environment jsdom */
import { cleanup, fireEvent, render, screen } from '@solidjs/testing-library';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Task } from '../db/types.ts';
import { TaskEditorDialog } from './TaskEditorDialog.tsx';

const store = vi.hoisted(() => ({
    addChecklistItem: vi.fn(),
    deleteChecklistItem: vi.fn(),
    editTask: vi.fn(),
    removeTask: vi.fn(),
    reorderChecklistItems: vi.fn(),
    toggleChecklistItemCompleted: vi.fn(),
    updateChecklistItemSummary: vi.fn(),
}));

vi.mock('../stores/taskStore.ts', () => store);
vi.mock('./PostponeMenu.tsx', () => ({
    PostponeMenu: (props: { onDone?: () => void }) => (
        <button type="button" onClick={() => props.onDone?.()}>
            Tomorrow
        </button>
    ),
}));

function makeTask(): Task {
    return {
        id: 'groceries',
        summary: 'Groceries',
        description: '',
        labelIds: [],
        date: '2026-08-22',
        sortOrder: 0,
        completed: false,
        completedAt: null,
        createdAt: 1,
        updatedAt: 1,
        generatorId: null,
        parentTaskId: null,
        checklistItems: [{ id: 'milk', summary: 'Milk', completed: false }],
    };
}

describe('TaskEditorDialog checklist', () => {
    beforeEach(() => {
        HTMLDialogElement.prototype.showModal = function showModal(): void {
            this.open = true;
        };
    });
    afterEach(() => {
        cleanup();
        vi.clearAllMocks();
    });

    it('persists concrete task checklist changes immediately', () => {
        render(() => <TaskEditorDialog task={makeTask()} onClose={() => {}} onOpenLabelsPicker={() => {}} />);

        fireEvent.click(screen.getByRole('button', { name: 'Mark Milk complete' }));
        expect(store.toggleChecklistItemCompleted).toHaveBeenCalledWith('groceries', 'milk');

        fireEvent.click(screen.getByRole('button', { name: 'Add checklist item' }));
        const input = screen.getByRole('textbox', { name: 'New checklist item' });
        fireEvent.input(input, { target: { value: 'Bread' } });
        fireEvent.keyDown(input, { key: 'Enter' });
        expect(store.addChecklistItem).toHaveBeenCalledWith('groceries', 'Bread');

        fireEvent.click(screen.getByRole('button', { name: 'Delete Milk from checklist' }));
        expect(store.deleteChecklistItem).toHaveBeenCalledWith('groceries', 'milk');
    });
});

describe('TaskEditorDialog field autosave', () => {
    beforeEach(() => {
        HTMLDialogElement.prototype.showModal = function showModal(): void {
            this.open = true;
        };
        vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'Date'] });
    });
    afterEach(() => {
        cleanup();
        vi.useRealTimers();
        vi.clearAllMocks();
    });

    it('has no Save or Delete footer buttons', () => {
        render(() => <TaskEditorDialog task={makeTask()} onClose={() => {}} onOpenLabelsPicker={() => {}} />);

        expect(screen.queryByRole('button', { name: 'Save' })).toBeNull();
        expect(screen.queryByRole('button', { name: 'Delete' })).toBeNull();
    });

    it('persists summary and description after a short debounce', async () => {
        render(() => <TaskEditorDialog task={makeTask()} onClose={() => {}} onOpenLabelsPicker={() => {}} />);

        fireEvent.input(screen.getByLabelText('Summary'), { target: { value: 'Milk run' } });
        fireEvent.input(screen.getByLabelText('Description'), { target: { value: 'Dont forget eggs' } });
        expect(store.editTask).not.toHaveBeenCalled();

        await vi.advanceTimersByTimeAsync(400);
        expect(store.editTask).toHaveBeenCalledWith('groceries', {
            summary: 'Milk run',
            description: 'Dont forget eggs',
        });
    });

    it('flushes pending field edits when the dialog closes', async () => {
        const onClose = vi.fn();
        render(() => <TaskEditorDialog task={makeTask()} onClose={onClose} onOpenLabelsPicker={() => {}} />);

        await vi.advanceTimersByTimeAsync(500);
        fireEvent.input(screen.getByLabelText('Summary'), { target: { value: 'Milk run' } });
        expect(store.editTask).not.toHaveBeenCalled();

        fireEvent.click(screen.getAllByRole('button', { name: 'Close' })[1]);
        await Promise.resolve();

        expect(store.editTask).toHaveBeenCalledWith('groceries', {
            summary: 'Milk run',
            description: '',
        });
        expect(onClose).toHaveBeenCalled();
    });

    it('flushes pending field edits when postponing', async () => {
        const onClose = vi.fn();
        render(() => <TaskEditorDialog task={makeTask()} onClose={onClose} onOpenLabelsPicker={() => {}} />);

        fireEvent.input(screen.getByLabelText('Summary'), { target: { value: 'Milk run' } });
        fireEvent.click(screen.getByRole('button', { name: 'Tomorrow' }));
        await Promise.resolve();

        expect(store.editTask).toHaveBeenCalledWith('groceries', {
            summary: 'Milk run',
            description: '',
        });
        expect(onClose).toHaveBeenCalled();
    });

    it('does not persist a blank summary', async () => {
        render(() => <TaskEditorDialog task={makeTask()} onClose={() => {}} onOpenLabelsPicker={() => {}} />);

        fireEvent.input(screen.getByLabelText('Summary'), { target: { value: '   ' } });
        await vi.advanceTimersByTimeAsync(400);
        expect(store.editTask).not.toHaveBeenCalled();
    });

    it('does not persist when fields are unchanged', async () => {
        const onClose = vi.fn();
        render(() => <TaskEditorDialog task={makeTask()} onClose={onClose} onOpenLabelsPicker={() => {}} />);

        await vi.advanceTimersByTimeAsync(500);
        fireEvent.click(screen.getAllByRole('button', { name: 'Close' })[1]);
        await Promise.resolve();

        expect(store.editTask).not.toHaveBeenCalled();
        expect(onClose).toHaveBeenCalled();
    });
});
