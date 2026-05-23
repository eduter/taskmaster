import { createMemo, For, Show } from "solid-js";
import {
  DragDropProvider,
  DragDropSensors,
  SortableProvider,
  createSortable,
  closestCenter,
  transformStyle,
  useDragDropContext,
} from "@thisbeyond/solid-dnd";
import type { DragEvent } from "@thisbeyond/solid-dnd";
import { tasks, reorder } from "../stores/taskStore.ts";
import { applyReorder } from "../utils/reorder.ts";
import { TaskCard } from "./TaskCard.tsx";
import type { Task } from "../db/types.ts";
import "./TaskList.css";

function SortableTask(props: { task: Task }) {
  const sortable = createSortable(props.task.id);
  const itemStyle = createMemo(() => transformStyle(sortable.transform));

  function stopHandleEvent(event: Event) {
    event.stopPropagation();
  }

  return (
    <div
      ref={sortable.ref}
      class="task-list__item"
      style={itemStyle()}
      classList={{
        "task-list__item--dragging": sortable.isActiveDraggable,
      }}
    >
      <TaskCard
        task={props.task}
        dragHandle={
          <button
            type="button"
            class="task-card__drag-handle"
            aria-label="Drag to reorder"
            {...sortable.dragActivators}
            onClick={stopHandleEvent}
          >
            <svg viewBox="0 0 16 16" width="16" height="16" fill="currentColor" aria-hidden="true">
              <circle cx="5" cy="4" r="1.25" />
              <circle cx="11" cy="4" r="1.25" />
              <circle cx="5" cy="8" r="1.25" />
              <circle cx="11" cy="8" r="1.25" />
              <circle cx="5" cy="12" r="1.25" />
              <circle cx="11" cy="12" r="1.25" />
            </svg>
          </button>
        }
      />
    </div>
  );
}

function SortableTaskListItems() {
  const [dndState] = useDragDropContext()!;
  const taskIds = () => (tasks() ?? []).map((t) => t.id);

  return (
    <SortableProvider ids={taskIds()}>
      <div
        class="task-list__items"
        classList={{
          "task-list__items--dragging": !!dndState.active.draggable,
        }}
      >
        <For each={tasks() ?? []}>
          {(task) => <SortableTask task={task} />}
        </For>
      </div>
    </SortableProvider>
  );
}

function SortableTaskList() {
  const taskIds = () => (tasks() ?? []).map((t) => t.id);

  async function handleDragEnd(event: DragEvent) {
    const { draggable, droppable } = event;
    if (!draggable || !droppable) return;

    const reordered = applyReorder(
      taskIds(),
      String(draggable.id),
      String(droppable.id),
    );
    if (!reordered) return;
    await reorder(reordered);
  }

  return (
    <DragDropProvider onDragEnd={handleDragEnd} collisionDetector={closestCenter}>
      <DragDropSensors />
      <SortableTaskListItems />
    </DragDropProvider>
  );
}

function TaskList() {
  return (
    <div class="task-list">
      <Show when={!tasks.loading} fallback={<p class="task-list__empty">Loading…</p>}>
        <Show
          when={(tasks() ?? []).length > 0}
          fallback={<p class="task-list__empty">No tasks for today. Add one above!</p>}
        >
          <SortableTaskList />
        </Show>
      </Show>
    </div>
  );
}

export { TaskList };
