import { createEffect, createSignal, on, onCleanup, type JSX } from 'solid-js';
import type { Task } from '../db/types.ts';
import {
    addChecklistItem,
    deleteChecklistItem,
    editTask,
    reorderChecklistItems,
    toggleChecklistItemCompleted,
    updateChecklistItemSummary,
} from '../stores/taskStore.ts';
import { ChecklistEditor } from './ChecklistEditor.tsx';
import { Dialog } from './Dialog.tsx';
import { PostponeMenu } from './PostponeMenu.tsx';
import { TaskFields } from './TaskFields.tsx';

const FIELD_AUTOSAVE_MS = 300;

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
    let autosaveTimer: ReturnType<typeof setTimeout> | undefined;

    createEffect(
        on(
            () => props.task.id,
            () => {
                setSummary(props.task.summary);
                setDescription(props.task.description);
                dismissGuardUntil = Date.now() + 500;
                clearAutosaveTimer();
            }
        )
    );

    onCleanup(() => {
        const hadPending = autosaveTimer !== undefined;
        clearAutosaveTimer();
        if (hadPending) {
            void persistFields();
        }
    });

    function canClose(): boolean {
        return Date.now() >= dismissGuardUntil;
    }

    function clearAutosaveTimer(): void {
        if (autosaveTimer === undefined) {
            return;
        }
        clearTimeout(autosaveTimer);
        autosaveTimer = undefined;
    }

    function persistFields(): Promise<void> {
        const nextSummary = summary().trim();
        const nextDescription = description();
        if (!nextSummary) {
            return Promise.resolve();
        }
        if (nextSummary === props.task.summary && nextDescription === props.task.description) {
            return Promise.resolve();
        }
        return editTask(props.task.id, {
            summary: nextSummary,
            description: nextDescription,
        });
    }

    function schedulePersist(): void {
        clearAutosaveTimer();
        autosaveTimer = setTimeout(() => {
            autosaveTimer = undefined;
            void persistFields();
        }, FIELD_AUTOSAVE_MS);
    }

    function handleSummaryChange(value: string): void {
        setSummary(value);
        schedulePersist();
    }

    function handleDescriptionChange(value: string): void {
        setDescription(value);
        schedulePersist();
    }

    async function persistThenClose(): Promise<void> {
        clearAutosaveTimer();
        await persistFields();
        props.onClose();
    }

    function tryDismiss(): void {
        if (canClose()) {
            void persistThenClose();
        }
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
                onSummaryChange={handleSummaryChange}
                onDescriptionChange={handleDescriptionChange}
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

            <PostponeMenu taskId={props.task.id} onDone={() => void persistThenClose()} />
        </Dialog>
    );
}

export type { TaskEditorDialogProps };
export { TaskEditorDialog };
