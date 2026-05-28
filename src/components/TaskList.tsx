import type { DragEvent } from '@thisbeyond/solid-dnd';
import { closestCenter, DragDropProvider, SortableProvider, useDragDropContext } from '@thisbeyond/solid-dnd';
import { createSignal, For, Show } from 'solid-js';
import type { Task } from '../db/types.ts';
import { TouchDragProvider } from '../gestures/touchDragContext.tsx';
import { reorder, tasks } from '../stores/taskStore.ts';
import { applyReorder } from '../utils/reorder.ts';
import { TaskDragOverlay } from './TaskDragOverlay.tsx';
import { TaskRow } from './TaskRow.tsx';
import './TaskList.css';

function SortableTask(props: {
    task: Task;
    deleteRevealed: boolean;
    onRevealChange: (taskId: string, open: boolean) => void;
    onRowTouchStart: (taskId: string) => void;
}) {
    return (
        <TaskRow
            task={props.task}
            deleteRevealed={props.deleteRevealed}
            onRevealChange={props.onRevealChange}
            onRowTouchStart={props.onRowTouchStart}
        />
    );
}

function SortableTaskListItems() {
    const dndContext = useDragDropContext();
    if (!dndContext) {
        throw new Error('SortableTaskListItems must be used within DragDropProvider');
    }
    const [dndState] = dndContext;
    const [openRevealId, setOpenRevealId] = createSignal<string | null>(null);
    const taskIds = () => (tasks() ?? []).map((t) => t.id);

    function handleRevealChange(taskId: string, open: boolean) {
        setOpenRevealId(open ? taskId : null);
    }

    function handleRowTouchStart(taskId: string) {
        const openId = openRevealId();
        if (openId && openId !== taskId) {
            setOpenRevealId(null);
        }
    }

    return (
        <SortableProvider ids={taskIds()}>
            <div
                class="task-list__items"
                classList={{
                    'task-list__items--dragging': !!dndState.active.draggable,
                }}
            >
                <For each={tasks() ?? []}>
                    {(task) => (
                        <SortableTask
                            task={task}
                            deleteRevealed={openRevealId() === task.id}
                            onRevealChange={handleRevealChange}
                            onRowTouchStart={handleRowTouchStart}
                        />
                    )}
                </For>
            </div>
        </SortableProvider>
    );
}

function SortableTaskList() {
    const taskIds = () => (tasks() ?? []).map((t) => t.id);

    async function handleDragEnd(event: DragEvent) {
        const { draggable, droppable } = event;
        if (!draggable || !droppable) {
            return;
        }

        const reordered = applyReorder(taskIds(), String(draggable.id), String(droppable.id));
        if (!reordered) {
            return;
        }
        await reorder(reordered);
    }

    return (
        <DragDropProvider onDragEnd={handleDragEnd} collisionDetector={closestCenter}>
            <TouchDragProvider>
                <TaskDragOverlay />
                <SortableTaskListItems />
            </TouchDragProvider>
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
