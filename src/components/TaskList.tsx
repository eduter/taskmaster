import { For, Show } from "solid-js";
import {
  DragDropProvider,
  DragDropSensors,
  SortableProvider,
  createSortable,
  closestCenter,
} from "@thisbeyond/solid-dnd";
import type { DragEvent } from "@thisbeyond/solid-dnd";
import { tasks, reorder } from "../stores/taskStore.ts";
import { TaskCard } from "./TaskCard.tsx";
import type { Task } from "../db/types.ts";
import "./TaskList.css";

function SortableTask(props: { task: Task }) {
  const sortable = createSortable(props.task.id);

  return (
    <div
      ref={sortable.ref}
      class="task-list__item"
      classList={{
        "task-list__item--dragging": sortable.isActiveDraggable,
      }}
      {...sortable.dragActivators}
    >
      <TaskCard task={props.task} />
    </div>
  );
}

function TaskList() {
  const taskIds = () => (tasks() ?? []).map((t) => t.id);

  async function handleDragEnd(event: DragEvent) {
    const { draggable, droppable } = event;
    if (!draggable || !droppable) return;
    if (draggable.id === droppable.id) return;

    const ids = taskIds();
    const fromIndex = ids.indexOf(String(draggable.id));
    const toIndex = ids.indexOf(String(droppable.id));
    if (fromIndex === -1 || toIndex === -1) return;

    const reordered = [...ids];
    const [moved] = reordered.splice(fromIndex, 1);
    reordered.splice(toIndex, 0, moved);
    await reorder(reordered);
  }

  return (
    <div class="task-list">
      <Show when={!tasks.loading} fallback={<p class="task-list__empty">Loading…</p>}>
        <Show
          when={(tasks() ?? []).length > 0}
          fallback={<p class="task-list__empty">No tasks for today. Add one above!</p>}
        >
          <DragDropProvider onDragEnd={handleDragEnd} collisionDetector={closestCenter}>
            <DragDropSensors />
            <SortableProvider ids={taskIds()}>
              <div class="task-list__items">
                <For each={tasks() ?? []}>
                  {(task) => <SortableTask task={task} />}
                </For>
              </div>
            </SortableProvider>
          </DragDropProvider>
        </Show>
      </Show>
    </div>
  );
}

export { TaskList };
