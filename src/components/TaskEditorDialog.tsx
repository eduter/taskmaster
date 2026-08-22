import { createEffect, createSignal, on, type JSX } from 'solid-js';
import type { Task } from '../db/types.ts';
import {
    addChecklistItem,
    deleteChecklistItem,
    editTask,
    removeTask,
    reorderChecklistItems,
    toggleChecklistItemCompleted,
    updateChecklistItemSummary,
} from '../stores/taskStore.ts';
import { ChecklistEditor } from './ChecklistEditor.tsx';
import { Dialog } from './Dialog.tsx';
import { PostponeMenu } from './PostponeMenu.tsx';
import { TaskDetailActions } from './TaskDetailActions.tsx';
import { TaskFields } from './TaskFields.tsx';

interface TaskEditorDialogProps {
    task: Task;
    onClose: () => void;
    onOpenLabelsPicker: () => void;
    stackLevel?: number;
}

/** Shared concrete-task editor used from Today and Calendar. */
function TaskEditorDialog(props: TaskEditorDialogProps): JSX.Element {
    const [summary, setSummary] = createSignal('');
    const [description, setDescription] = createSignal('');
    let dismissGuardUntil = Date.now() + 500;

    createEffect(
        on(
            () => props.task.id,
            () => {
                setSummary(props.task.summary);
                setDescription(props.task.description);
                dismissGuardUntil = Date.now() + 500;
            }
        )
    );

    function canClose(): boolean {
        return Date.now() >= dismissGuardUntil;
    }

    function tryDismiss(): void {
        if (canClose()) {
            props.onClose();
        }
    }

    async function save(): Promise<void> {
        await editTask(props.task.id, {
            summary: summary(),
            description: description(),
        });
        props.onClose();
    }

    async function handleDelete(): Promise<void> {
        await removeTask(props.task.id);
        props.onClose();
    }

    async function addItem(itemSummary: string): Promise<void> {
        await addChecklistItem(props.task.id, itemSummary);
    }

    function renameItem(itemId: string, itemSummary: string): Promise<void> {
        return updateChecklistItemSummary(props.task.id, itemId, itemSummary);
    }

    async function toggleItem(itemId: string): Promise<void> {
        await toggleChecklistItemCompleted(props.task.id, itemId);
    }

    function deleteItem(itemId: string): Promise<void> {
        return deleteChecklistItem(props.task.id, itemId);
    }

    function reorderItems(orderedIds: string[]): Promise<void> {
        return reorderChecklistItems(props.task.id, orderedIds);
    }

    return (
        <Dialog open={true} onClose={tryDismiss} canClose={canClose} title="Edit Task" stackLevel={props.stackLevel}>
            <TaskFields
                summary={summary()}
                description={description()}
                labelIds={props.task.labelIds}
                summaryInputId={`task-detail-summary-${props.task.id}`}
                descriptionInputId={`task-detail-description-${props.task.id}`}
                onSummaryChange={setSummary}
                onDescriptionChange={setDescription}
                onOpenLabelsPicker={props.onOpenLabelsPicker}
            />

            <ChecklistEditor
                items={props.task.checklistItems}
                onAdd={addItem}
                onRename={renameItem}
                onToggle={toggleItem}
                onDelete={deleteItem}
                onReorder={reorderItems}
            />

            <PostponeMenu taskId={props.task.id} onDone={props.onClose} />

            <TaskDetailActions onSave={save} onDelete={handleDelete} />
        </Dialog>
    );
}

export type { TaskEditorDialogProps };
export { TaskEditorDialog };
