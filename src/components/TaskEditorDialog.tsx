import { createEffect, createSignal, on, onCleanup, Show, type JSX } from 'solid-js';
import type { Task } from '../db/types.ts';
import {
    addChecklistItem,
    deleteChecklistItem,
    editTask,
    reorderChecklistItems,
    today,
    toggleChecklistItemCompleted,
    updateChecklistItemSummary,
} from '../stores/taskStore.ts';
import { formatRelativeDay } from '../utils/formatLogicalDay.ts';
import { ChecklistEditor } from './ChecklistEditor.tsx';
import { Dialog } from './Dialog.tsx';
import { TaskFields } from './TaskFields.tsx';
import './TaskEditorDialog.css';

const FIELD_AUTOSAVE_MS = 300;

/** Props for the concrete-task editor used from Today and Calendar. */
interface TaskEditorDialogProps {
    task: Task;
    onClose: () => void;
    onOpenLabelsPicker: () => void;
    onOpenPostponePicker: () => void;
    stackLevel?: number;
}

/** Shared concrete-task editor used from Today and Calendar. */
function TaskEditorDialog(props: TaskEditorDialogProps): JSX.Element {
    const [summary, setSummary] = createSignal('');
    const [description, setDescription] = createSignal('');
    const [editingSummary, setEditingSummary] = createSignal(false);
    const [showDescription, setShowDescription] = createSignal(false);
    const [showChecklist, setShowChecklist] = createSignal(false);
    let dismissGuardUntil = Date.now() + 500;
    let autosaveTimer: ReturnType<typeof setTimeout> | undefined;

    createEffect(
        on(
            () => props.task.id,
            () => {
                setSummary(props.task.summary);
                setDescription(props.task.description);
                setEditingSummary(false);
                setShowDescription(props.task.description.trim().length > 0);
                setShowChecklist(props.task.checklistItems.length > 0);
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

    async function openWhen(): Promise<void> {
        clearAutosaveTimer();
        const persist = persistFields();
        props.onOpenPostponePicker();
        await persist;
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

    const whenLabel = () => formatRelativeDay(props.task.date, today());
    const hasLabels = () => props.task.labelIds.length > 0;
    const descriptionVisible = () => showDescription() || description().trim().length > 0;
    const checklistVisible = () => showChecklist() || props.task.checklistItems.length > 0;

    function commitSummaryEdit(): void {
        const next = summary().trim();
        if (!next) {
            clearAutosaveTimer();
            setSummary(props.task.summary);
        }
        setEditingSummary(false);
    }

    function summarySlot(): JSX.Element {
        return (
            <Show
                when={editingSummary()}
                fallback={
                    <button type="button" class="task-editor__summary" onClick={() => setEditingSummary(true)}>
                        {summary()}
                    </button>
                }
            >
                <input
                    id={`task-detail-summary-${props.task.id}`}
                    class="task-editor__summary-input"
                    aria-label="Summary"
                    value={summary()}
                    onInput={(e) => handleSummaryChange(e.currentTarget.value)}
                    onBlur={commitSummaryEdit}
                    onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                            e.preventDefault();
                            commitSummaryEdit();
                        } else if (e.key === 'Escape') {
                            e.preventDefault();
                            clearAutosaveTimer();
                            setSummary(props.task.summary);
                            setEditingSummary(false);
                        }
                    }}
                    ref={focusAndSelectInput}
                />
            </Show>
        );
    }

    return (
        <Dialog
            open={true}
            onClose={tryDismiss}
            canClose={canClose}
            title={summary() || 'Task'}
            titleSlot={summarySlot()}
            stackLevel={props.stackLevel}
        >
            <div class="form-field">
                <span class="form-label">When</span>
                <button
                    type="button"
                    class="task-editor__when"
                    aria-label={`When: ${whenLabel()}`}
                    onClick={() => void openWhen()}
                >
                    {whenLabel()}
                </button>
            </div>

            <TaskFields
                summary={summary()}
                description={description()}
                labelIds={props.task.labelIds}
                summaryInputId={`task-detail-summary-${props.task.id}`}
                descriptionInputId={`task-detail-description-${props.task.id}`}
                includeSummary={false}
                showDescription={descriptionVisible()}
                hideEmptyLabels={true}
                onSummaryChange={handleSummaryChange}
                onDescriptionChange={handleDescriptionChange}
                onOpenLabelsPicker={props.onOpenLabelsPicker}
            />

            <Show when={checklistVisible()}>
                <ChecklistEditor
                    items={props.task.checklistItems}
                    startAdding={props.task.checklistItems.length === 0}
                    onAdd={addItem}
                    onRename={renameItem}
                    onToggle={toggleItem}
                    onDelete={deleteItem}
                    onReorder={reorderItems}
                />
            </Show>

            <Show when={!hasLabels() || !descriptionVisible() || !checklistVisible()}>
                <div class="task-editor__extras">
                    <Show when={!hasLabels()}>
                        <button type="button" class="task-editor__extra" onClick={props.onOpenLabelsPicker}>
                            + Labels
                        </button>
                    </Show>
                    <Show when={!descriptionVisible()}>
                        <button type="button" class="task-editor__extra" onClick={() => setShowDescription(true)}>
                            + Description
                        </button>
                    </Show>
                    <Show when={!checklistVisible()}>
                        <button type="button" class="task-editor__extra" onClick={() => setShowChecklist(true)}>
                            + Checklist
                        </button>
                    </Show>
                </div>
            </Show>
        </Dialog>
    );
}

function focusAndSelectInput(element: HTMLInputElement): void {
    queueMicrotask(() => {
        element.focus();
        element.select();
    });
}

export type { TaskEditorDialogProps };
export { TaskEditorDialog };
