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
    today: () => '2026-08-22',
}));

const labelsMock = vi.hoisted(() => ({
    list: [] as { id: string; name: string; color: string }[],
}));

vi.mock('../stores/taskStore.ts', () => store);
vi.mock('../stores/labelStore.ts', () => ({
    labels: () => labelsMock.list,
}));

function makeTask(overrides: Partial<Task> = {}): Task {
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
        ...overrides,
    };
}

function stubDialog(): void {
    HTMLDialogElement.prototype.showModal = function showModal(): void {
        this.open = true;
    };
}

function beginSummaryEdit(): HTMLElement {
    fireEvent.click(screen.getByRole('button', { name: 'Groceries' }));
    return screen.getByLabelText('Summary');
}

describe('TaskEditorDialog checklist', () => {
    beforeEach(stubDialog);
    afterEach(() => {
        cleanup();
        vi.clearAllMocks();
        labelsMock.list = [];
    });

    it('persists concrete task checklist changes immediately', () => {
        render(() => (
            <TaskEditorDialog
                task={makeTask()}
                onClose={() => {}}
                onOpenLabelsPicker={() => {}}
                onOpenPostponePicker={() => {}}
            />
        ));

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

describe('TaskEditorDialog layout', () => {
    beforeEach(stubDialog);
    afterEach(() => {
        cleanup();
        vi.clearAllMocks();
        labelsMock.list = [];
    });

    it('has no Save or Delete footer buttons', () => {
        render(() => (
            <TaskEditorDialog
                task={makeTask()}
                onClose={() => {}}
                onOpenLabelsPicker={() => {}}
                onOpenPostponePicker={() => {}}
            />
        ));

        expect(screen.queryByRole('button', { name: 'Save' })).toBeNull();
        expect(screen.queryByRole('button', { name: 'Delete' })).toBeNull();
    });

    it('hides empty description and checklist behind add actions', () => {
        render(() => (
            <TaskEditorDialog
                task={makeTask({ checklistItems: [] })}
                onClose={() => {}}
                onOpenLabelsPicker={() => {}}
                onOpenPostponePicker={() => {}}
            />
        ));

        expect(screen.queryByLabelText('Description')).toBeNull();
        expect(screen.queryByRole('region', { name: 'Checklist' })).toBeNull();
        expect(screen.getByRole('button', { name: '+ Labels' })).toBeTruthy();
        expect(screen.getByRole('button', { name: '+ Description' })).toBeTruthy();
        expect(screen.getByRole('button', { name: '+ Checklist' })).toBeTruthy();
    });

    it('reveals description and checklist when requested', () => {
        render(() => (
            <TaskEditorDialog
                task={makeTask({ checklistItems: [] })}
                onClose={() => {}}
                onOpenLabelsPicker={() => {}}
                onOpenPostponePicker={() => {}}
            />
        ));

        fireEvent.click(screen.getByRole('button', { name: '+ Description' }));
        expect(screen.getByLabelText('Description')).toBeTruthy();
        expect(screen.queryByRole('button', { name: '+ Description' })).toBeNull();

        fireEvent.click(screen.getByRole('button', { name: '+ Checklist' }));
        expect(screen.getByRole('region', { name: 'Checklist' })).toBeTruthy();
        expect(screen.getByRole('textbox', { name: 'New checklist item' })).toBeTruthy();
        expect(screen.queryByRole('button', { name: '+ Checklist' })).toBeNull();
    });

    it('puts label chips left of the add button', () => {
        labelsMock.list = [{ id: 'home', name: 'Home', color: '#4363d8' }];
        render(() => (
            <TaskEditorDialog
                task={makeTask({ labelIds: ['home'] })}
                onClose={() => {}}
                onOpenLabelsPicker={() => {}}
                onOpenPostponePicker={() => {}}
            />
        ));

        expect(screen.queryByRole('button', { name: '+ Labels' })).toBeNull();
        const add = screen.getByRole('button', { name: 'Edit labels' });
        const row = add.parentElement;
        expect(row?.textContent).toContain('Home');
        expect(row?.lastElementChild).toBe(add);
    });

    it('shows the scheduled day as a When field', () => {
        const onOpenPostponePicker = vi.fn();
        render(() => (
            <TaskEditorDialog
                task={makeTask()}
                onClose={() => {}}
                onOpenLabelsPicker={() => {}}
                onOpenPostponePicker={onOpenPostponePicker}
            />
        ));

        fireEvent.click(screen.getByRole('button', { name: 'When: Today' }));
        expect(onOpenPostponePicker).toHaveBeenCalledOnce();
    });
});

describe('TaskEditorDialog field autosave', () => {
    beforeEach(() => {
        stubDialog();
        vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'Date'] });
    });
    afterEach(() => {
        cleanup();
        vi.useRealTimers();
        vi.clearAllMocks();
        labelsMock.list = [];
    });

    it('persists summary and description after a short debounce', async () => {
        render(() => (
            <TaskEditorDialog
                task={makeTask()}
                onClose={() => {}}
                onOpenLabelsPicker={() => {}}
                onOpenPostponePicker={() => {}}
            />
        ));

        fireEvent.input(beginSummaryEdit(), { target: { value: 'Milk run' } });
        fireEvent.click(screen.getByRole('button', { name: '+ Description' }));
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
        render(() => (
            <TaskEditorDialog
                task={makeTask()}
                onClose={onClose}
                onOpenLabelsPicker={() => {}}
                onOpenPostponePicker={() => {}}
            />
        ));

        await vi.advanceTimersByTimeAsync(500);
        fireEvent.input(beginSummaryEdit(), { target: { value: 'Milk run' } });
        expect(store.editTask).not.toHaveBeenCalled();

        fireEvent.click(screen.getAllByRole('button', { name: 'Close' })[1]);
        await Promise.resolve();

        expect(store.editTask).toHaveBeenCalledWith('groceries', {
            summary: 'Milk run',
            description: '',
        });
        expect(onClose).toHaveBeenCalled();
    });

    it('flushes pending field edits when opening the When picker', async () => {
        const onClose = vi.fn();
        const onOpenPostponePicker = vi.fn();
        render(() => (
            <TaskEditorDialog
                task={makeTask()}
                onClose={onClose}
                onOpenLabelsPicker={() => {}}
                onOpenPostponePicker={onOpenPostponePicker}
            />
        ));

        fireEvent.input(beginSummaryEdit(), { target: { value: 'Milk run' } });
        fireEvent.click(screen.getByRole('button', { name: 'When: Today' }));
        await Promise.resolve();

        expect(store.editTask).toHaveBeenCalledWith('groceries', {
            summary: 'Milk run',
            description: '',
        });
        expect(onOpenPostponePicker).toHaveBeenCalledOnce();
        expect(onClose).not.toHaveBeenCalled();
    });

    it('does not persist a blank summary', async () => {
        render(() => (
            <TaskEditorDialog
                task={makeTask()}
                onClose={() => {}}
                onOpenLabelsPicker={() => {}}
                onOpenPostponePicker={() => {}}
            />
        ));

        fireEvent.input(beginSummaryEdit(), { target: { value: '   ' } });
        await vi.advanceTimersByTimeAsync(400);
        expect(store.editTask).not.toHaveBeenCalled();
    });

    it('does not persist when fields are unchanged', async () => {
        const onClose = vi.fn();
        render(() => (
            <TaskEditorDialog
                task={makeTask()}
                onClose={onClose}
                onOpenLabelsPicker={() => {}}
                onOpenPostponePicker={() => {}}
            />
        ));

        await vi.advanceTimersByTimeAsync(500);
        fireEvent.click(screen.getAllByRole('button', { name: 'Close' })[1]);
        await Promise.resolve();

        expect(store.editTask).not.toHaveBeenCalled();
        expect(onClose).toHaveBeenCalled();
    });
});
