import { Show } from 'solid-js';
import { dbError, dbStatus } from '../db/dbLifecycle.ts';
import { useAppNavigate } from '../routing/navigation.ts';
import { reorder, tasks } from '../stores/taskStore.ts';
import { TaskRows } from './TaskRows.tsx';
import './TaskList.css';

function SortableTaskList() {
    const navigation = useAppNavigate();

    return (
        <TaskRows
            items={tasks() ?? []}
            onReorder={reorder}
            onOpen={navigation.toTask}
        />
    );
}

function taskLoadError(): string | null {
    const err = tasks.error;
    if (err == null) {
        return null;
    }
    return err instanceof Error ? err.message : String(err);
}

function TaskList() {
    const loadFailed = () => dbStatus() === 'blocked' || dbStatus() === 'error' || taskLoadError() != null;

    return (
        <div class="task-list">
            <Show
                when={loadFailed()}
                fallback={
                    <Show when={tasks() != null || !tasks.loading} fallback={<p class="task-list__empty">Loading…</p>}>
                        <Show
                            when={(tasks() ?? []).length > 0}
                            fallback={<p class="task-list__empty">No tasks for today. Add one above!</p>}
                        >
                            <SortableTaskList />
                        </Show>
                    </Show>
                }
            >
                <p class="task-list__empty task-list__empty--error">{dbError() ?? taskLoadError()}</p>
            </Show>
        </div>
    );
}

export { TaskList };
