import { Show } from 'solid-js';
import type { Task } from '../db/types.ts';
import { reorder, tasks } from '../stores/taskStore.ts';
import { TaskCard } from './TaskCard.tsx';
import { TaskLikeSortableList } from './TaskLikeSortableList.tsx';
import { TaskRow } from './TaskRow.tsx';
import './TaskList.css';

function SortableTaskList() {
    return (
        <TaskLikeSortableList<Task>
            items={tasks() ?? []}
            onReorder={reorder}
            renderRow={(task, row) => (
                <TaskRow
                    task={task}
                    deleteRevealed={row.deleteRevealed}
                    onRevealChange={row.onRevealChange}
                    onRowTouchStart={row.onRowTouchStart}
                />
            )}
            renderOverlay={(task) => <TaskCard task={task} />}
        />
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
