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
vi.mock('./PostponeMenu.tsx', () => ({ PostponeMenu: () => null }));

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
