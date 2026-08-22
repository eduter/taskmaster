/** @vitest-environment jsdom */
import { cleanup, fireEvent, render, screen } from '@solidjs/testing-library';
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

        fireEvent.click(screen.getByRole('button', { name: 'Add checklist item' }));
        const input = screen.getByRole('textbox', { name: 'New checklist item' });
        fireEvent.input(input, { target: { value: 'Bread' } });
        fireEvent.keyDown(input, { key: 'Enter' });
        fireEvent.click(screen.getByRole('button', { name: 'Save' }));

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
});
