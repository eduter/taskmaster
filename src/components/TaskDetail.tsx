import { createSignal, createEffect, Show, on } from "solid-js";
import { selectedTaskId, setSelectedTaskId, editTask, removeTask, tasks } from "../stores/taskStore.ts";
import { PostponeMenu } from "./PostponeMenu.tsx";
import type { Task } from "../db/types.ts";
import "./TaskDetail.css";

function TaskDetail() {
  const [summary, setSummary] = createSignal("");
  const [description, setDescription] = createSignal("");
  const [labelInput, setLabelInput] = createSignal("");
  const [labels, setLabels] = createSignal<string[]>([]);
  let dismissGuardUntil = 0;

  createEffect(
    on(selectedTaskId, (id) => {
      if (id) dismissGuardUntil = Date.now() + 500;
    }),
  );

  function tryDismiss() {
    if (Date.now() < dismissGuardUntil) return;
    setSelectedTaskId(null);
  }

  const selectedTask = (): Task | undefined => {
    const id = selectedTaskId();
    if (!id) return undefined;
    return (tasks() ?? []).find((t) => t.id === id);
  };

  createEffect(
    on(selectedTaskId, () => {
      const task = selectedTask();
      if (task) {
        setSummary(task.summary);
        setDescription(task.description);
        setLabels([...task.labels]);
        setLabelInput("");
      }
    }),
  );

  async function save() {
    const id = selectedTaskId();
    if (!id) return;
    await editTask(id, {
      summary: summary(),
      description: description(),
      labels: labels(),
    });
  }

  function addLabel() {
    const val = labelInput().trim();
    if (!val || labels().includes(val)) return;
    setLabels([...labels(), val]);
    setLabelInput("");
  }

  function removeLabel(label: string) {
    setLabels(labels().filter((l) => l !== label));
  }

  function handleLabelKeyDown(e: KeyboardEvent) {
    if (e.key === "Enter") {
      e.preventDefault();
      addLabel();
    }
  }

  async function handleDelete() {
    const id = selectedTaskId();
    if (!id) return;
    await removeTask(id);
  }

  return (
    <Show when={selectedTask()}>
      <div class="task-detail-overlay" onClick={tryDismiss}>
        <div class="task-detail" onClick={(e) => e.stopPropagation()}>
          <div class="task-detail__header">
            <h2 class="task-detail__title">Edit Task</h2>
            <button class="task-detail__close" onClick={tryDismiss} aria-label="Close">
              &times;
            </button>
          </div>

          <div class="task-detail__field">
            <label class="task-detail__label">Summary</label>
            <input
              class="task-detail__input"
              type="text"
              value={summary()}
              onInput={(e) => setSummary(e.currentTarget.value)}
            />
          </div>

          <div class="task-detail__field">
            <label class="task-detail__label">Description</label>
            <textarea
              class="task-detail__textarea"
              value={description()}
              onInput={(e) => setDescription(e.currentTarget.value)}
              rows={4}
            />
          </div>

          <div class="task-detail__field">
            <label class="task-detail__label">Labels</label>
            <div class="task-detail__labels">
              {labels().map((label) => (
                <span class="task-detail__label-tag">
                  {label}
                  <button class="task-detail__label-remove" onClick={() => removeLabel(label)}>
                    &times;
                  </button>
                </span>
              ))}
            </div>
            <div class="task-detail__label-add">
              <input
                class="task-detail__input"
                type="text"
                placeholder="Add label…"
                value={labelInput()}
                onInput={(e) => setLabelInput(e.currentTarget.value)}
                onKeyDown={handleLabelKeyDown}
              />
              <button class="task-detail__btn-secondary" type="button" onClick={addLabel}>
                Add
              </button>
            </div>
          </div>

          <PostponeMenu taskId={selectedTaskId()!} onDone={() => setSelectedTaskId(null)} />

          <div class="task-detail__actions">
            <button class="task-detail__btn-primary" onClick={save}>
              Save
            </button>
            <button class="task-detail__btn-danger" onClick={handleDelete}>
              Delete
            </button>
          </div>
        </div>
      </div>
    </Show>
  );
}

export { TaskDetail };
