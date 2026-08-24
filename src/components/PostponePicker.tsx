import { useParams } from '@solidjs/router';
import { createMemo, createResource } from 'solid-js';
import { useAppNavigate, usePostponePanelOpen } from '../../routing/navigation.ts';
import { editTask, loadTask, taskVersion } from '../../stores/taskStore.ts';
import { PostponeDialog } from '../PostponeDialog.tsx';

/** Route-backed postpone overlay for the Today task editor. */
function PostponePicker() {
    const params = useParams();
    const postponeOpen = usePostponePanelOpen();
    const { closePostponePicker } = useAppNavigate();
    const taskId = () => params.id;

    const [task] = createResource(
        () => {
            const id = taskId();
            const version = taskVersion();
            if (!postponeOpen() || !id) {
                return null;
            }
            return { id, version };
        },
        ({ id }) => loadTask(id)
    );

    const selectedDate = createMemo(() => task()?.date ?? '');

    async function pickDate(date: string): Promise<void> {
        const id = taskId();
        if (!id) {
            return;
        }
        await editTask(id, { date });
        closePostponePicker();
    }

    return (
        <PostponeDialog
            open={postponeOpen() && !!taskId()}
            selectedDate={selectedDate()}
            onClose={closePostponePicker}
            onPick={pickDate}
            stackLevel={1}
        />
    );
}

export { PostponePicker };
