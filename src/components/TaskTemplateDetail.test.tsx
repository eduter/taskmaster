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

    it('has no Save or Delete buttons', () => {
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
            />
        ));

        expect(screen.queryByRole('button', { name: 'Save' })).toBeNull();
        expect(screen.queryByRole('button', { name: 'Delete' })).toBeNull();
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
            />
        ));

        expect(screen.getByRole('button', { name: 'Groceries' })).toBeTruthy();
        expect(screen.queryByText('When')).toBeNull();
        expect(screen.queryByLabelText('Description')).toBeNull();
        expect(screen.queryByRole('region', { name: 'Checklist' })).toBeNull();
        expect(screen.getByRole('button', { name: '+ Labels' })).toBeTruthy();
        expect(screen.getByRole('button', { name: '+ Description' })).toBeTruthy();
        expect(screen.getByRole('button', { name: '+ Checklist' })).toBeTruthy();
        expect(screen.queryByRole('button', { name: 'Delete' })).toBeNull();
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
