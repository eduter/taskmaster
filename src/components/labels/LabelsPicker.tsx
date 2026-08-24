import { useParams } from '@solidjs/router';
import { createMemo, createResource } from 'solid-js';
import { useAppNavigate, useLabelsPanelOpen } from '../../routing/navigation.ts';
import { editTask, loadTask, taskVersion } from '../../stores/taskStore.ts';
import { LabelsDialog } from './LabelsDialog.tsx';

/** Route-backed labels overlay for the Today task editor. */
function LabelsPicker() {
    const params = useParams();
    const labelsOpen = useLabelsPanelOpen();
    const { closeLabelsPicker } = useAppNavigate();

    const taskId = () => params.id;

    const [task] = createResource(
        () => {
            const id = taskId();
            const version = taskVersion();
            if (!labelsOpen() || !id) {
                return null;
            }
            return { id, version };
        },
        ({ id }) => loadTask(id)
    );

    const selectedLabelIds = createMemo(() => task()?.labelIds ?? []);

    async function toggleTaskLabel(labelId: string) {
        const current = task();
        if (!current) {
            return;
        }
        const ids = current.labelIds;
        const next = ids.includes(labelId) ? ids.filter((id) => id !== labelId) : [...ids, labelId];
        await editTask(current.id, { labelIds: next });
    }

    return (
        <LabelsDialog
            open={labelsOpen() && !!taskId()}
            onClose={closeLabelsPicker}
            selectedLabelIds={selectedLabelIds()}
            onToggleLabel={toggleTaskLabel}
            stackLevel={1}
        />
    );
}

export { LabelsPicker };
