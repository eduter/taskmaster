import { generateId } from '../utils/id.ts';
import { getLogicalDay } from '../utils/logicalDay.ts';
import { db } from './database.ts';
import type { ChecklistItem, Task } from './types.ts';

async function createTask(
    fields: Pick<Task, 'summary'> & Partial<Omit<Task, 'id' | 'createdAt' | 'updatedAt'>>
): Promise<Task> {
    const now = Date.now();
    const task: Task = {
        id: generateId(),
        summary: fields.summary,
        description: fields.description ?? '',
        labelIds: fields.labelIds ?? [],
        date: fields.date ?? getLogicalDay(),
        sortOrder: fields.sortOrder ?? now,
        completed: false,
        completedAt: null,
        createdAt: now,
        updatedAt: now,
        generatorId: fields.generatorId ?? null,
        parentTaskId: fields.parentTaskId ?? null,
        checklistItems: fields.checklistItems?.map((item) => ({ ...item })) ?? [],
    };
    await db.tasks.add(task);
    return task;
}

/** Creates a fresh incomplete task from the reusable fields of a completed task. */
async function copyTaskFromHistory(source: Task, date: string): Promise<Task> {
    return createTask({
        summary: source.summary.trim(),
        description: source.description,
        labelIds: [...source.labelIds],
        checklistItems: source.checklistItems.map((item) => ({
            id: generateId(),
            summary: item.summary,
            completed: false,
        })),
        date,
    });
}

async function updateTask(id: string, changes: Partial<Omit<Task, 'id' | 'createdAt'>>): Promise<void> {
    await db.tasks.update(id, { ...changes, updatedAt: Date.now() });
}

async function deleteTask(id: string): Promise<void> {
    await db.tasks.delete(id);
}

/** Deletes completed tasks from logical days before the retention cutoff. */
async function pruneCompletedTasks(cutoffDay: string): Promise<number> {
    const expiredIds = await db.tasks
        .filter(
            (task) =>
                task.completed && task.completedAt !== null && getLogicalDay(new Date(task.completedAt)) < cutoffDay
        )
        .primaryKeys();
    if (expiredIds.length === 0) {
        return 0;
    }

    await db.tasks.bulkDelete(expiredIds);
    return expiredIds.length;
}

async function getTask(id: string): Promise<Task | undefined> {
    return db.tasks.get(id);
}

/** Adds an incomplete checklist item to a task. */
async function addChecklistItem(taskId: string, summary: string): Promise<ChecklistItem | undefined> {
    const nextSummary = summary.trim();
    if (!nextSummary) {
        return undefined;
    }

    return db.transaction('rw', db.tasks, async () => {
        const task = await db.tasks.get(taskId);
        if (!task) {
            return undefined;
        }

        const item = { id: generateId(), summary: nextSummary, completed: false };
        await db.tasks.update(taskId, {
            checklistItems: [...task.checklistItems, item],
            updatedAt: Date.now(),
        });
        return item;
    });
}

/** Updates the text of one checklist item. */
async function updateChecklistItemSummary(taskId: string, itemId: string, summary: string): Promise<boolean> {
    const nextSummary = summary.trim();
    if (!nextSummary) {
        return false;
    }

    return db.transaction('rw', db.tasks, async () => {
        const task = await db.tasks.get(taskId);
        if (!task?.checklistItems.some((item) => item.id === itemId)) {
            return false;
        }

        await db.tasks.update(taskId, {
            checklistItems: task.checklistItems.map((item) =>
                item.id === itemId ? { ...item, summary: nextSummary } : item
            ),
            updatedAt: Date.now(),
        });
        return true;
    });
}

/** Toggles one checklist item and completes the parent after the final check. */
async function toggleChecklistItemCompleted(taskId: string, itemId: string): Promise<boolean | undefined> {
    let completedParent = false;
    const itemCompleted = await db.transaction('rw', db.tasks, async () => {
        const task = await db.tasks.get(taskId);
        const current = task?.checklistItems.find((item) => item.id === itemId);
        if (!task || !current) {
            return undefined;
        }

        const completed = !current.completed;
        const checklistItems = task.checklistItems.map((item) => (item.id === itemId ? { ...item, completed } : item));
        completedParent = completed && !task.completed && checklistItems.every((item) => item.completed);
        const now = Date.now();
        await db.tasks.update(taskId, {
            checklistItems,
            ...(completedParent ? { completed: true, completedAt: now } : {}),
            updatedAt: now,
        });
        return completed;
    });

    if (completedParent) {
        await seatTaskAtCompletionBoundary(taskId);
    }
    return itemCompleted;
}

/** Deletes one checklist item without changing parent completion. */
async function deleteChecklistItem(taskId: string, itemId: string): Promise<boolean> {
    return db.transaction('rw', db.tasks, async () => {
        const task = await db.tasks.get(taskId);
        if (!task?.checklistItems.some((item) => item.id === itemId)) {
            return false;
        }

        await db.tasks.update(taskId, {
            checklistItems: task.checklistItems.filter((item) => item.id !== itemId),
            updatedAt: Date.now(),
        });
        return true;
    });
}

/** Persists checklist array order while retaining any omitted items. */
async function reorderChecklistItems(taskId: string, orderedIds: string[]): Promise<boolean> {
    return db.transaction('rw', db.tasks, async () => {
        const task = await db.tasks.get(taskId);
        if (!task) {
            return false;
        }

        const byId = new Map(task.checklistItems.map((item) => [item.id, item]));
        const ordered = orderedIds
            .map((id) => byId.get(id))
            .filter((item): item is ChecklistItem => item !== undefined);
        const included = new Set(orderedIds);
        const checklistItems = [...ordered, ...task.checklistItems.filter((item) => !included.has(item.id))];
        await db.tasks.update(taskId, { checklistItems, updatedAt: Date.now() });
        return true;
    });
}

async function toggleTaskCompleted(id: string): Promise<boolean> {
    const task = await db.tasks.get(id);
    if (!task) {
        return false;
    }

    // Flip completion
    const completed = !task.completed;
    await db.tasks.update(id, {
        completed,
        completedAt: completed ? Date.now() : null,
        updatedAt: Date.now(),
    });

    await seatTaskAtCompletionBoundary(id);

    return completed;
}

async function seatTaskAtCompletionBoundary(id: string): Promise<void> {
    const today = getLogicalDay();
    const visible = await getVisibleTasks(today);
    if (!visible.some((t) => t.id === id)) {
        return;
    }
    const without = visible.filter((t) => t.id !== id);
    const firstIncompleteIdx = without.findIndex((t) => !t.completed);
    const insertAt = firstIncompleteIdx === -1 ? without.length : firstIncompleteIdx;
    const orderedIds = [
        ...without.slice(0, insertAt).map((t) => t.id),
        id,
        ...without.slice(insertAt).map((t) => t.id),
    ];
    await reorderTasks(orderedIds);
}

async function getTasksForDay(date: string): Promise<Task[]> {
    return db.tasks.where('date').equals(date).sortBy('sortOrder');
}

async function getTasksForDateRange(start: string, end: string): Promise<Task[]> {
    const tasks = await db.tasks.where('date').between(start, end, true, true).toArray();
    return tasks.sort((left, right) => left.date.localeCompare(right.date) || left.sortOrder - right.sortOrder);
}

/** Returns one recent completed task for each normalized summary. */
async function getCompletedTaskCandidates(): Promise<Task[]> {
    const tasks = await db.tasks.toArray();
    const completed = tasks
        .filter((task) => task.completed && task.completedAt !== null && task.summary.trim())
        .sort((left, right) => (right.completedAt ?? 0) - (left.completedAt ?? 0));
    const summaries = new Set<string>();

    return completed.filter((task) => {
        const key = normalizeTaskSummary(task.summary);
        if (summaries.has(key)) {
            return false;
        }
        summaries.add(key);
        return true;
    });
}

/** Filters reusable task candidates by a case-insensitive summary substring. */
function filterTaskCandidates(candidates: Task[], query: string, limit = 5): Task[] {
    const normalizedQuery = normalizeTaskSummary(query);
    if (!normalizedQuery) {
        return [];
    }

    return candidates.filter((task) => normalizeTaskSummary(task.summary).includes(normalizedQuery)).slice(0, limit);
}

function normalizeTaskSummary(summary: string): string {
    return summary.trim().toLocaleLowerCase();
}

function wasCompletedOn(task: Task, day: string): boolean {
    return task.completedAt != null && getLogicalDay(new Date(task.completedAt)) === day;
}

async function getVisibleTasks(today: string): Promise<Task[]> {
    const tasks = await db.tasks.where('date').belowOrEqual(today).toArray();

    return tasks
        .filter((t) => !t.completed || t.date === today || wasCompletedOn(t, today))
        .sort((a, b) => a.sortOrder - b.sortOrder);
}

async function reorderTasks(orderedIds: string[]): Promise<void> {
    await db.transaction('rw', db.tasks, async () => {
        const now = Date.now();
        for (let i = 0; i < orderedIds.length; i++) {
            await db.tasks.update(orderedIds[i], { sortOrder: i, updatedAt: now });
        }
    });
}

export {
    addChecklistItem,
    copyTaskFromHistory,
    createTask,
    deleteChecklistItem,
    deleteTask,
    filterTaskCandidates,
    getCompletedTaskCandidates,
    getTask,
    getTasksForDay,
    getTasksForDateRange,
    getVisibleTasks,
    pruneCompletedTasks,
    reorderChecklistItems,
    reorderTasks,
    toggleChecklistItemCompleted,
    toggleTaskCompleted,
    updateChecklistItemSummary,
    updateTask,
    wasCompletedOn,
};
