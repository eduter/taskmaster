import { useParams } from '@solidjs/router';
import { createEffect, createSignal, on, Show } from 'solid-js';
import type { Task } from '../db/types.ts';
import { useAppNavigate } from '../routing/navigation.ts';
import { editTask, removeTask, tasks } from '../stores/taskStore.ts';
import { Dialog } from './Dialog.tsx';
import { PostponeMenu } from './PostponeMenu.tsx';
import './TaskDetail.css';

function TaskDetail() {
    const params = useParams();
    const { closeTaskDetail, toTasksList } = useAppNavigate();
    const [summary, setSummary] = createSignal('');
    const [description, setDescription] = createSignal('');
    const [labelInput, setLabelInput] = createSignal('');
    const [labels, setLabels] = createSignal<string[]>([]);
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
                setLabels([...task.labels]);
                setLabelInput('');
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
            labels: labels(),
        });
    }

    function addLabel() {
        const val = labelInput().trim();
        if (!val || labels().includes(val)) {
            return;
        }
        setLabels([...labels(), val]);
        setLabelInput('');
    }

    function removeLabel(label: string) {
        setLabels(labels().filter((l) => l !== label));
    }

    function handleLabelKeyDown(e: KeyboardEvent) {
        if (e.key === 'Enter') {
            e.preventDefault();
            addLabel();
        }
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
                    <div class="form-field">
                        <label class="form-label" for="task-detail-summary">
                            Summary
                        </label>
                        <input
                            id="task-detail-summary"
                            class="form-input"
                            type="text"
                            value={summary()}
                            onInput={(e) => setSummary(e.currentTarget.value)}
                        />
                    </div>

                    <div class="form-field">
                        <label class="form-label" for="task-detail-description">
                            Description
                        </label>
                        <textarea
                            id="task-detail-description"
                            class="form-textarea"
                            value={description()}
                            onInput={(e) => setDescription(e.currentTarget.value)}
                            rows={4}
                        />
                    </div>

                    <div class="form-field">
                        <span class="form-label">Labels</span>
                        <div class="task-detail__labels">
                            {labels().map((label) => (
                                <span class="task-detail__label-tag">
                                    {label}
                                    <button
                                        type="button"
                                        class="task-detail__label-remove"
                                        onClick={() => removeLabel(label)}
                                    >
                                        &times;
                                    </button>
                                </span>
                            ))}
                        </div>
                        <div class="task-detail__label-add">
                            <input
                                id="task-detail-label-input"
                                class="form-input"
                                type="text"
                                placeholder="Add label…"
                                value={labelInput()}
                                onInput={(e) => setLabelInput(e.currentTarget.value)}
                                onKeyDown={handleLabelKeyDown}
                            />
                            <button class="btn btn--secondary" type="button" onClick={addLabel}>
                                Add
                            </button>
                        </div>
                    </div>

                    <PostponeMenu taskId={task().id} onDone={closeTaskDetail} />

                    <div class="task-detail__actions">
                        <button type="button" class="btn btn--primary btn--grow" onClick={save}>
                            Save
                        </button>
                        <button type="button" class="btn btn--danger" onClick={handleDelete}>
                            Delete
                        </button>
                    </div>
                </Dialog>
            )}
        </Show>
    );
}

export { TaskDetail };
