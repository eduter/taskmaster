import { createResource, createSignal } from 'solid-js';
import { dbStatus, withDbRead, withDbWrite } from '../db/dbLifecycle.ts';
import { createTask, deleteTask, getVisibleTasks, reorderTasks, toggleTaskCompleted, updateTask } from '../db/tasks.ts';
import type { Task } from '../db/types.ts';
import { schedulePush } from '../sync/syncEngine.ts';
import { getLogicalDay } from '../utils/logicalDay.ts';

const [today, setToday] = createSignal(getLogicalDay());
const [taskVersion, setTaskVersion] = createSignal(0);

function refreshTodayIfNeeded(): void {
    const current = getLogicalDay();
    if (current !== today()) {
        setToday(current);
        setTaskVersion((v) => v + 1);
    }
}

function invalidateTasks(options?: { push?: boolean }) {
    setTaskVersion((v) => v + 1);
    if (options?.push !== false) {
        schedulePush();
    }
}

async function fetchTasks(): Promise<Task[]> {
    taskVersion();
    if (dbStatus() === 'blocked') {
        return [];
    }
    return withDbRead(() => getVisibleTasks(today()));
}

const [tasks, { refetch: refetchTasks }] = createResource(taskVersion, fetchTasks);

async function addTask(summary: string): Promise<Task> {
    const task = await withDbWrite(() => createTask({ summary, date: today() }));
    invalidateTasks();
    return task;
}

async function editTask(id: string, changes: Partial<Omit<Task, 'id' | 'createdAt'>>): Promise<void> {
    await withDbWrite(() => updateTask(id, changes));
    invalidateTasks();
}

async function removeTask(id: string): Promise<void> {
    await withDbWrite(() => deleteTask(id));
    invalidateTasks();
}

/** @returns Whether the task is completed after the toggle. */
async function toggleComplete(id: string): Promise<boolean> {
    const completed = await withDbWrite(() => toggleTaskCompleted(id));
    invalidateTasks();
    return completed;
}

async function reorder(orderedIds: string[]): Promise<void> {
    await withDbWrite(() => reorderTasks(orderedIds));
    invalidateTasks();
}

export {
    addTask,
    editTask,
    invalidateTasks,
    refetchTasks,
    refreshTodayIfNeeded,
    removeTask,
    reorder,
    tasks,
    today,
    toggleComplete,
};
