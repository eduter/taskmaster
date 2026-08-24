import { createEffect, createMemo, createSignal, on, Show, type JSX } from 'solid-js';
import type { ChecklistItemTemplate, TaskTemplate } from '../db/types.ts';
import { generateId } from '../utils/id.ts';
import { ChecklistEditor } from './ChecklistEditor.tsx';
import { Dialog } from './Dialog.tsx';
import { EditableSummaryHeading } from './EditableSummaryHeading.tsx';
import { LabelsDialog } from './labels/LabelsDialog.tsx';
import { TaskFields } from './TaskFields.tsx';
import './TaskDetailEditor.css';
import './TaskTemplateDetail.css';

/** Task-template form data with its editor-only identity. */
interface TaskTemplateDraft extends TaskTemplate {
    id: string;
}

/** Props for editing one task template inside a generator draft. */
interface TaskTemplateDetailProps {
    open: boolean;
    template: TaskTemplateDraft | undefined;
    onClose: () => void;
    onSave: (id: string, template: TaskTemplate) => void;
    onDelete: (id: string) => void;
}

/** Nested editor for the task fields stored on a generator template draft. */
function TaskTemplateDetail(props: TaskTemplateDetailProps): JSX.Element {
    const [summary, setSummary] = createSignal('');
    const [description, setDescription] = createSignal('');
    const [labelIds, setLabelIds] = createSignal<string[]>([]);
    const [checklistItems, setChecklistItems] = createSignal<ChecklistItemTemplate[]>([]);
    const [labelsOpen, setLabelsOpen] = createSignal(false);
    const [showDescription, setShowDescription] = createSignal(false);
    const [showChecklist, setShowChecklist] = createSignal(false);
    const templateId = createMemo(() => props.template?.id ?? '');

    createEffect(
        on(templateId, () => {
            const template = props.template;
            if (!template) {
                return;
            }
            setSummary(template.summary);
            setDescription(template.description);
            setLabelIds([...template.labelIds]);
            setChecklistItems(template.checklistItems.map((item) => ({ ...item })));
            setLabelsOpen(false);
            setShowDescription(template.description.trim().length > 0);
            setShowChecklist(template.checklistItems.length > 0);
        })
    );

    function persistToParent(summaryOverride = summary()): void {
        const template = props.template;
        if (!template) {
            return;
        }

        const nextSummary = summaryOverride;
        props.onSave(template.id, {
            summary: nextSummary || template.summary,
            description: description(),
            labelIds: labelIds(),
            checklistItems: checklistItems(),
        });
    }

    function handleSummaryChange(value: string): void {
        setSummary(value);
        persistToParent();
    }

    function commitSummaryEdit(): void {
        const template = props.template;
        if (!template) {
            return;
        }

        const nextSummary = summary().trim();
        if (!nextSummary) {
            setSummary(template.summary);
            return;
        }

        setSummary(nextSummary);
        persistToParent(nextSummary);
    }

    function cancelSummaryEdit(): void {
        const template = props.template;
        if (template) {
            setSummary(template.summary);
        }
    }

    function handleDescriptionChange(value: string): void {
        setDescription(value);
        persistToParent();
    }

    function toggleLabel(labelId: string) {
        setLabelIds((ids) => (ids.includes(labelId) ? ids.filter((id) => id !== labelId) : [...ids, labelId]));
        persistToParent();
    }

    function pruneDeletedLabel(labelId: string) {
        setLabelIds((ids) => ids.filter((id) => id !== labelId));
        persistToParent();
    }

    function addChecklistItem(itemSummary: string): void {
        setChecklistItems((items) => [...items, { id: generateId(), summary: itemSummary }]);
        persistToParent();
    }

    function renameChecklistItem(id: string, itemSummary: string): void {
        setChecklistItems((items) => items.map((item) => (item.id === id ? { ...item, summary: itemSummary } : item)));
        persistToParent();
    }

    function deleteChecklistItem(id: string): void {
        setChecklistItems((items) => items.filter((item) => item.id !== id));
        persistToParent();
    }

    function reorderChecklistItems(orderedIds: string[]): void {
        const byId = new Map(checklistItems().map((item) => [item.id, item]));
        setChecklistItems(
            orderedIds.map((id) => byId.get(id)).filter((item): item is ChecklistItemTemplate => item !== undefined)
        );
        persistToParent();
    }

    function deleteTemplate() {
        const template = props.template;
        if (!template) {
            return;
        }

        props.onDelete(template.id);
        props.onClose();
    }

    function close() {
        commitSummaryEdit();
        setLabelsOpen(false);
        props.onClose();
    }

    const hasLabels = () => labelIds().length > 0;
    const descriptionVisible = () => showDescription() || description().trim().length > 0;
    const checklistVisible = () => showChecklist() || checklistItems().length > 0;
    const summaryHeading = (
        <EditableSummaryHeading
            summary={summary()}
            inputId="task-template-detail-summary"
            resetKey={templateId()}
            onInput={handleSummaryChange}
            onCommit={commitSummaryEdit}
            onCancel={cancelSummaryEdit}
        />
    );

    return (
        <Show when={props.open && props.template}>
            <Dialog
                open={true}
                onClose={close}
                title={summary() || 'Task Template'}
                titleSlot={summaryHeading}
                stackLevel={1}
            >
                <TaskFields
                    summary={summary()}
                    description={description()}
                    labelIds={labelIds()}
                    summaryInputId="task-template-detail-summary"
                    descriptionInputId="task-template-detail-description"
                    labelsButtonLabel="Edit template labels"
                    includeSummary={false}
                    showDescription={descriptionVisible()}
                    hideEmptyLabels={true}
                    onSummaryChange={handleSummaryChange}
                    onDescriptionChange={handleDescriptionChange}
                    onOpenLabelsPicker={() => setLabelsOpen(true)}
                />

                <Show when={checklistVisible()}>
                    <ChecklistEditor
                        items={checklistItems()}
                        startAdding={checklistItems().length === 0}
                        onAdd={addChecklistItem}
                        onRename={renameChecklistItem}
                        onDelete={deleteChecklistItem}
                        onReorder={reorderChecklistItems}
                    />
                </Show>

                <Show when={!hasLabels() || !descriptionVisible() || !checklistVisible()}>
                    <div class="task-detail-editor__extras">
                        <Show when={!hasLabels()}>
                            <button type="button" class="task-detail-editor__extra" onClick={() => setLabelsOpen(true)}>
                                + Labels
                            </button>
                        </Show>
                        <Show when={!descriptionVisible()}>
                            <button
                                type="button"
                                class="task-detail-editor__extra"
                                onClick={() => setShowDescription(true)}
                            >
                                + Description
                            </button>
                        </Show>
                        <Show when={!checklistVisible()}>
                            <button
                                type="button"
                                class="task-detail-editor__extra"
                                onClick={() => setShowChecklist(true)}
                            >
                                + Checklist
                            </button>
                        </Show>
                    </div>
                </Show>

                <div class="task-template-detail__actions">
                    <button type="button" class="btn btn--danger" onClick={deleteTemplate}>
                        Delete
                    </button>
                </div>

                <LabelsDialog
                    open={labelsOpen()}
                    onClose={() => setLabelsOpen(false)}
                    selectedLabelIds={labelIds()}
                    onToggleLabel={toggleLabel}
                    onDeleteLabel={pruneDeletedLabel}
                    stackLevel={2}
                />
            </Dialog>
        </Show>
    );
}

export type { TaskTemplateDraft, TaskTemplateDetailProps };
export { TaskTemplateDetail };
