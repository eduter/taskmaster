import { createResource, createSignal } from 'solid-js';
import { dbStatus, withDbRead, withDbWrite } from '../db/dbLifecycle.ts';
import {
    addChecklistItem as addChecklistItemRecord,
    copyTaskFromHistory,
    createTask,
    deleteChecklistItem as deleteChecklistItemRecord,
    deleteTask,
    filterTaskCandidates,
    getCompletedTaskCandidates,
    getTask as getTaskRecord,
    getVisibleTasks,
    reorderChecklistItems as reorderChecklistItemRecords,
    reorderTasks,
    toggleChecklistItemCompleted as toggleChecklistItemCompletedRecord,
    toggleTaskCompleted,
    updateChecklistItemSummary as updateChecklistItemSummaryRecord,
    updateTask,
} from '../db/tasks.ts';
import type { ChecklistItem, Task } from '../db/types.ts';
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

/** Loads one task by id, including items hidden from Today after postpone. */
async function loadTask(id: string): Promise<Task | undefined> {
    if (dbStatus() === 'blocked') {
        return undefined;
    }
    return withDbRead(() => getTaskRecord(id));
}

async function fetchTasks(): Promise<Task[]> {
    taskVersion();
    if (dbStatus() === 'blocked') {
        return [];
    }
    return withDbRead(() => getVisibleTasks(today()));
}

const [tasks, { refetch: refetchTasks }] = createResource(taskVersion, fetchTasks);

async function addTask(summary: string, date: string = today()): Promise<Task> {
    const task = await withDbWrite(() => createTask({ summary, date }));
    invalidateTasks();
    return task;
}

/** Loads completed tasks that can be reused from the add-task field. */
async function loadCompletedTaskCandidates(): Promise<Task[]> {
    return withDbRead(getCompletedTaskCandidates);
}

/** Creates a fresh task from a completed task's reusable fields. */
async function copyPreviousTask(source: Task, date: string = today()): Promise<Task> {
    const task = await withDbWrite(() => copyTaskFromHistory(source, date));
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

async function addChecklistItem(taskId: string, summary: string): Promise<ChecklistItem | undefined> {
    const item = await withDbWrite(() => addChecklistItemRecord(taskId, summary));
    invalidateTasks();
    return item;
}

async function updateChecklistItemSummary(taskId: string, itemId: string, summary: string): Promise<void> {
    await withDbWrite(() => updateChecklistItemSummaryRecord(taskId, itemId, summary));
    invalidateTasks();
}

async function toggleChecklistItemCompleted(taskId: string, itemId: string): Promise<boolean | undefined> {
    const completed = await withDbWrite(() => toggleChecklistItemCompletedRecord(taskId, itemId));
    invalidateTasks();
    return completed;
}

async function deleteChecklistItem(taskId: string, itemId: string): Promise<void> {
    await withDbWrite(() => deleteChecklistItemRecord(taskId, itemId));
    invalidateTasks();
}

async function reorderChecklistItems(taskId: string, orderedIds: string[]): Promise<void> {
    await withDbWrite(() => reorderChecklistItemRecords(taskId, orderedIds));
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
    addChecklistItem,
    addTask,
    copyPreviousTask,
    deleteChecklistItem,
    editTask,
    filterTaskCandidates,
    invalidateTasks,
    loadCompletedTaskCandidates,
    loadTask,
    refetchTasks,
    refreshTodayIfNeeded,
    removeTask,
    reorderChecklistItems,
    reorder,
    tasks,
    taskVersion,
    today,
    toggleChecklistItemCompleted,
    toggleComplete,
    updateChecklistItemSummary,
};
