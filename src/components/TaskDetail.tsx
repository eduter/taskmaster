import { useParams } from '@solidjs/router';
import { createEffect, Show } from 'solid-js';
import type { Task } from '../db/types.ts';
import { useAppNavigate } from '../routing/navigation.ts';
import { tasks } from '../stores/taskStore.ts';
import { TaskEditorDialog } from './TaskEditorDialog.tsx';

function TaskDetail() {
    const params = useParams();
    const { closeTaskDetail, openLabelsPicker, toTasksList } = useAppNavigate();
    const taskId = () => params.id;

    const selectedTask = (): Task | undefined => {
        const id = taskId();
        if (!id) {
            return undefined;
        }
        return (tasks() ?? []).find((t) => t.id === id);
    };

    createEffect(() => {
        const id = taskId();
        if (!id || tasks.loading) {
            return;
        }
        if (!selectedTask()) {
            toTasksList();
        }
    });

    return (
        <Show when={selectedTask()}>
            {(task) => (
                <TaskEditorDialog task={task()} onClose={closeTaskDetail} onOpenLabelsPicker={openLabelsPicker} />
            )}
        </Show>
    );
}

export { TaskDetail };
