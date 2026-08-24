/** @vitest-environment jsdom */
import { cleanup, fireEvent, render, screen } from '@solidjs/testing-library';
import { createSignal } from 'solid-js';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { TaskTemplateDraft } from './TaskTemplateDetail.tsx';
import { TaskTemplateDetail } from './TaskTemplateDetail.tsx';

describe('TaskTemplateDetail', () => {
    beforeEach(() => {
        HTMLDialogElement.prototype.showModal = function showModal(): void {
            this.open = true;
        };
    });

    afterEach(cleanup);

    it('preserves existing checklist items and adds new template items', () => {
        const onSave = vi.fn();
        const template: TaskTemplateDraft = {
            id: 'template',
            summary: 'Groceries',
            description: '',
            labelIds: [],
            checklistItems: [{ id: 'milk', summary: 'Milk' }],
        };
        render(() => (
            <TaskTemplateDetail
                open={true}
                template={template}
                onClose={() => {}}
                onSave={onSave}
                onDelete={() => {}}
            />
        ));

        expect(screen.queryByRole('button', { name: 'Mark Milk complete' })).toBeNull();
        fireEvent.click(screen.getByRole('button', { name: 'Add checklist item' }));
        const input = screen.getByRole('textbox', { name: 'New checklist item' });
        fireEvent.input(input, { target: { value: 'Bread' } });
        fireEvent.keyDown(input, { key: 'Enter' });

        expect(onSave).toHaveBeenCalledWith(
            'template',
            expect.objectContaining({
                checklistItems: [{ id: 'milk', summary: 'Milk' }, expect.objectContaining({ summary: 'Bread' })],
            })
        );
    });

    it('does not retarget a touch checklist deletion to the template delete action', () => {
        const onDelete = vi.fn();
        const template: TaskTemplateDraft = {
            id: 'template',
            summary: 'Groceries',
            description: '',
            labelIds: [],
            checklistItems: [{ id: 'milk', summary: 'Milk' }],
        };
        render(() => (
            <TaskTemplateDetail
                open={true}
                template={template}
                onClose={() => {}}
                onSave={() => {}}
                onDelete={onDelete}
            />
        ));

        const checklistDelete = screen.getByRole('button', { name: 'Delete Milk from checklist' });
        const templateDelete = screen.getByRole('button', { name: 'Delete' });
        document.elementFromPoint = () => templateDelete;
        fireEvent.pointerDown(checklistDelete, {
            pointerId: 1,
            pointerType: 'touch',
            button: 0,
            clientX: 0,
            clientY: 0,
        });
        fireEvent.pointerUp(checklistDelete, {
            pointerId: 1,
            pointerType: 'touch',
            button: 0,
            clientX: 0,
            clientY: 0,
        });
        fireEvent.click(templateDelete);

        expect(screen.queryByRole('button', { name: 'Delete Milk from checklist' })).toBeNull();
        expect(onDelete).not.toHaveBeenCalled();
    });

    it('has no Save button', () => {
        render(() => (
            <TaskTemplateDetail
                open={true}
                template={{
                    id: 'template',
                    summary: 'Groceries',
                    description: '',
                    labelIds: [],
                    checklistItems: [],
                }}
                onClose={() => {}}
                onSave={() => {}}
                onDelete={() => {}}
            />
        ));

        expect(screen.queryByRole('button', { name: 'Save' })).toBeNull();
        expect(screen.getByRole('button', { name: 'Delete' })).toBeTruthy();
    });

    it('matches the task editor structure while retaining template-specific actions', () => {
        render(() => (
            <TaskTemplateDetail
                open={true}
                template={{
                    id: 'template',
                    summary: 'Groceries',
                    description: '',
                    labelIds: [],
                    checklistItems: [],
                }}
                onClose={() => {}}
                onSave={() => {}}
                onDelete={() => {}}
            />
        ));

        expect(screen.getByRole('button', { name: 'Groceries' })).toBeTruthy();
        expect(screen.queryByText('When')).toBeNull();
        expect(screen.queryByLabelText('Description')).toBeNull();
        expect(screen.queryByRole('region', { name: 'Checklist' })).toBeNull();
        expect(screen.getByRole('button', { name: '+ Labels' })).toBeTruthy();
        expect(screen.getByRole('button', { name: '+ Description' })).toBeTruthy();
        expect(screen.getByRole('button', { name: '+ Checklist' })).toBeTruthy();
        expect(screen.getByRole('button', { name: 'Delete' })).toBeTruthy();
    });

    it('preserves in-progress spaces when parent draft persistence feeds back', async () => {
        const [template, setTemplate] = createSignal<TaskTemplateDraft>({
            id: 'template',
            summary: 'Groceries',
            description: '',
            labelIds: [],
            checklistItems: [],
        });
        const onSave = vi.fn((id: string, draft: Omit<TaskTemplateDraft, 'id'>) => {
            setTemplate({ id, ...draft });
        });
        render(() => (
            <TaskTemplateDetail
                open={true}
                template={template()}
                onClose={() => {}}
                onSave={onSave}
                onDelete={() => {}}
            />
        ));

        fireEvent.click(screen.getByRole('button', { name: 'Groceries' }));
        await Promise.resolve();
        const input = screen.getByLabelText('Summary');
        fireEvent.input(input, { target: { value: 'Groceries ' } });

        expect(onSave).toHaveBeenLastCalledWith('template', expect.objectContaining({ summary: 'Groceries ' }));
        expect((input as HTMLInputElement).value).toBe('Groceries ');
        expect(document.activeElement).toBe(input);
    });

    it('writes field edits through to the parent draft and keeps them on close', () => {
        const onSave = vi.fn();
        const onClose = vi.fn();
        render(() => (
            <TaskTemplateDetail
                open={true}
                template={{
                    id: 'template',
                    summary: 'Groceries',
                    description: '',
                    labelIds: [],
                    checklistItems: [],
                }}
                onClose={onClose}
                onSave={onSave}
                onDelete={() => {}}
            />
        ));

        fireEvent.click(screen.getByRole('button', { name: 'Groceries' }));
        fireEvent.input(screen.getByLabelText('Summary'), { target: { value: 'Weekly groceries' } });
        fireEvent.click(screen.getByRole('button', { name: '+ Description' }));
        fireEvent.input(screen.getByLabelText('Description'), { target: { value: 'Include bread' } });
        expect(onSave).toHaveBeenCalledWith(
            'template',
            expect.objectContaining({
                summary: 'Weekly groceries',
                description: 'Include bread',
            })
        );

        fireEvent.click(screen.getAllByRole('button', { name: 'Close' })[1]);
        expect(onClose).toHaveBeenCalled();
        expect(onSave).toHaveBeenLastCalledWith(
            'template',
            expect.objectContaining({
                summary: 'Weekly groceries',
                description: 'Include bread',
            })
        );
    });
});
