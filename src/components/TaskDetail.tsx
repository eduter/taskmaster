import { useParams } from '@solidjs/router';
import { createEffect, createResource, Show } from 'solid-js';
import { useAppNavigate } from '../routing/navigation.ts';
import { loadTask, taskVersion } from '../stores/taskStore.ts';
import { morphTaskClose } from './taskMorph.ts';
import { TaskEditorDialog } from './TaskEditorDialog.tsx';

/** Looks up a concrete task by route id, including postponed items. */
function TaskDetail() {
    const params = useParams();
    const { closeTaskDetail, openLabelsPicker, openPostponePicker, toTasksList } = useAppNavigate();
    const taskId = () => params.id;

    const [selectedTask] = createResource(
        () => {
            const id = taskId();
            const version = taskVersion();
            if (!id) {
                return null;
            }
            return { id, version };
        },
        ({ id }) => loadTask(id)
    );

    createEffect(() => {
        const id = taskId();
        if (!id || selectedTask.loading) {
            return;
        }
        if (!selectedTask()) {
            toTasksList();
        }
    });

    function closeWithMorph(): void {
        const id = taskId();
        morphTaskClose(id ?? '', closeTaskDetail);
    }

    return (
        <Show when={selectedTask()}>
            {(task) => (
                <TaskEditorDialog
                    task={task()}
                    onClose={closeWithMorph}
                    onOpenLabelsPicker={openLabelsPicker}
                    onOpenPostponePicker={openPostponePicker}
                />
            )}
        </Show>
    );
}

export { TaskDetail };
