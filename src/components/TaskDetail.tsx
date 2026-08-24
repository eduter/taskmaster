import { useParams } from '@solidjs/router';
import { createEffect, createResource, Show } from 'solid-js';
import { useAppNavigate } from '../routing/navigation.ts';
import { loadTask, taskVersion } from '../stores/taskStore.ts';
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

    return (
        <Show when={selectedTask()}>
            {(task) => (
                <TaskEditorDialog
                    task={task()}
                    onClose={closeTaskDetail}
                    onOpenLabelsPicker={openLabelsPicker}
                    onOpenPostponePicker={openPostponePicker}
                />
            )}
        </Show>
    );
}

export { TaskDetail };
