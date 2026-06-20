import { useParams } from '@solidjs/router';
import { createMemo } from 'solid-js';
import { useAppNavigate, useLabelsPanelOpen } from '../../routing/navigation.ts';
import { editTask, tasks } from '../../stores/taskStore.ts';
import { LabelsDialog } from './LabelsDialog.tsx';

function LabelsPicker() {
    const params = useParams();
    const labelsOpen = useLabelsPanelOpen();
    const { closeLabelsPicker } = useAppNavigate();

    const taskId = () => params.id;

    const task = createMemo(() => {
        const id = taskId();
        if (!id) {
            return undefined;
        }
        return (tasks() ?? []).find((t) => t.id === id);
    });

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
            selectedLabelIds={task()?.labelIds ?? []}
            onToggleLabel={toggleTaskLabel}
            stackLevel={1}
        />
    );
}

export { LabelsPicker };
