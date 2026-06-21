import { useParams } from '@solidjs/router';
import { createEffect, createSignal, on, Show } from 'solid-js';
import type { Task } from '../db/types.ts';
import { useAppNavigate } from '../routing/navigation.ts';
import { editTask, removeTask, tasks } from '../stores/taskStore.ts';
import { Dialog } from './Dialog.tsx';
import { PostponeMenu } from './PostponeMenu.tsx';
import { TaskDetailActions } from './TaskDetailActions.tsx';
import { TaskFields } from './TaskFields.tsx';

function TaskDetail() {
    const params = useParams();
    const { closeTaskDetail, openLabelsPicker, toTasksList } = useAppNavigate();
    const [summary, setSummary] = createSignal('');
    const [description, setDescription] = createSignal('');
    let dismissGuardUntil = 0;

    const taskId = () => params.id;

    createEffect(
        on(taskId, (id) => {
            if (id) {
                dismissGuardUntil = Date.now() + 500;
            }
        })
    );

    function canClose() {
        return Date.now() >= dismissGuardUntil;
    }

    function tryDismiss() {
        if (!canClose()) {
            return;
        }
        closeTaskDetail();
    }

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

    createEffect(
        on(taskId, () => {
            const task = selectedTask();
            if (task) {
                setSummary(task.summary);
                setDescription(task.description);
            }
        })
    );

    async function save() {
        const id = taskId();
        if (!id) {
            return;
        }
        await editTask(id, {
            summary: summary(),
            description: description(),
        });
        closeTaskDetail();
    }

    async function handleDelete() {
        const id = taskId();
        if (!id) {
            return;
        }
        await removeTask(id);
        closeTaskDetail();
    }

    return (
        <Show when={selectedTask()}>
            {(task) => (
                <Dialog open={true} onClose={tryDismiss} canClose={canClose} title="Edit Task">
                    <TaskFields
                        summary={summary()}
                        description={description()}
                        labelIds={task().labelIds}
                        summaryInputId="task-detail-summary"
                        descriptionInputId="task-detail-description"
                        onSummaryChange={setSummary}
                        onDescriptionChange={setDescription}
                        onOpenLabelsPicker={openLabelsPicker}
                    />

                    <PostponeMenu taskId={task().id} onDone={closeTaskDetail} />

                    <TaskDetailActions onSave={save} onDelete={handleDelete} />
                </Dialog>
            )}
        </Show>
    );
}

export { TaskDetail };
