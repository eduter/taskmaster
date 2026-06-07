import { createResource, createSignal } from 'solid-js';
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
    return getVisibleTasks(today());
}

const [tasks, { refetch: refetchTasks }] = createResource(taskVersion, fetchTasks);

async function addTask(summary: string): Promise<Task> {
    const task = await createTask({ summary, date: today() });
    invalidateTasks();
    return task;
}

async function editTask(id: string, changes: Partial<Omit<Task, 'id' | 'createdAt'>>): Promise<void> {
    await updateTask(id, changes);
    invalidateTasks();
}

async function removeTask(id: string): Promise<void> {
    await deleteTask(id);
    invalidateTasks();
}

async function toggleComplete(id: string): Promise<void> {
    await toggleTaskCompleted(id);
    invalidateTasks();
}

async function reorder(orderedIds: string[]): Promise<void> {
    await reorderTasks(orderedIds);
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
