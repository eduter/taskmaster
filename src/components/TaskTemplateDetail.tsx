import { createEffect, createSignal, on, Show, type JSX } from 'solid-js';
import type { TaskTemplate } from '../db/types.ts';
import { Dialog } from './Dialog.tsx';
import { LabelsDialog } from './labels/LabelsDialog.tsx';
import { TaskFields } from './TaskFields.tsx';
import './TaskTemplateDetail.css';

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
                setLabelsOpen(false);
            }
        )
    );

    function toggleLabel(labelId: string) {
        setLabelIds((ids) => (ids.includes(labelId) ? ids.filter((id) => id !== labelId) : [...ids, labelId]));
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

                <div class="task-template-detail__actions">
                    <button type="button" class="btn btn--primary btn--grow" onClick={save}>
                        Save
                    </button>
                    <button type="button" class="btn btn--danger" onClick={deleteTemplate}>
                        Delete
                    </button>
                </div>

                <LabelsDialog
                    open={labelsOpen()}
                    onClose={() => setLabelsOpen(false)}
                    selectedLabelIds={labelIds()}
                    onToggleLabel={toggleLabel}
                    stackLevel={2}
                />
            </Dialog>
        </Show>
    );
}

export type { TaskTemplateDraft, TaskTemplateDetailProps };
export { TaskTemplateDetail };
