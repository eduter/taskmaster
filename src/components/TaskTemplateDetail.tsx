import { createEffect, createSignal, on, Show, type JSX } from 'solid-js';
import type { ChecklistItemTemplate, TaskTemplate } from '../db/types.ts';
import { generateId } from '../utils/id.ts';
import { ChecklistEditor } from './ChecklistEditor.tsx';
import { Dialog } from './Dialog.tsx';
import { LabelsDialog } from './labels/LabelsDialog.tsx';
import { TaskDetailActions } from './TaskDetailActions.tsx';
import { TaskFields } from './TaskFields.tsx';

interface TaskTemplateDraft extends TaskTemplate {
    id: string;
}

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

    createEffect(
        on(
            () => props.template?.id,
            () => {
                const template = props.template;
                if (!template) {
                    return;
                }
                setSummary(template.summary);
                setDescription(template.description);
                setLabelIds([...template.labelIds]);
                setChecklistItems(template.checklistItems.map((item) => ({ ...item })));
                setLabelsOpen(false);
            }
        )
    );

    function toggleLabel(labelId: string) {
        setLabelIds((ids) => (ids.includes(labelId) ? ids.filter((id) => id !== labelId) : [...ids, labelId]));
    }

    function pruneDeletedLabel(labelId: string) {
        setLabelIds((ids) => ids.filter((id) => id !== labelId));
    }

    function addChecklistItem(summary: string): void {
        setChecklistItems((items) => [...items, { id: generateId(), summary }]);
    }

    function renameChecklistItem(id: string, summary: string): void {
        setChecklistItems((items) => items.map((item) => (item.id === id ? { ...item, summary } : item)));
    }

    function deleteChecklistItem(id: string): void {
        setChecklistItems((items) => items.filter((item) => item.id !== id));
    }

    function reorderChecklistItems(orderedIds: string[]): void {
        const byId = new Map(checklistItems().map((item) => [item.id, item]));
        setChecklistItems(
            orderedIds.map((id) => byId.get(id)).filter((item): item is ChecklistItemTemplate => item !== undefined)
        );
    }

    function save() {
        const template = props.template;
        const nextSummary = summary().trim();
        if (!template || !nextSummary) {
            return;
        }

        props.onSave(template.id, {
            summary: nextSummary,
            description: description(),
            labelIds: labelIds(),
            checklistItems: checklistItems(),
        });
        props.onClose();
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
        setLabelsOpen(false);
        props.onClose();
    }

    return (
        <Show when={props.open && props.template}>
            <Dialog open={true} onClose={close} title="Edit Task Template" stackLevel={1}>
                <TaskFields
                    summary={summary()}
                    description={description()}
                    labelIds={labelIds()}
                    summaryInputId="task-template-detail-summary"
                    descriptionInputId="task-template-detail-description"
                    labelsButtonLabel="Edit template labels"
                    onSummaryChange={setSummary}
                    onDescriptionChange={setDescription}
                    onOpenLabelsPicker={() => setLabelsOpen(true)}
                />

                <ChecklistEditor
                    items={checklistItems()}
                    onAdd={addChecklistItem}
                    onRename={renameChecklistItem}
                    onDelete={deleteChecklistItem}
                    onReorder={reorderChecklistItems}
                />

                <TaskDetailActions onSave={save} onDelete={deleteTemplate} />

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
