import { generateId } from '../utils/id.ts';
import { getLogicalDay } from '../utils/logicalDay.ts';
import { db } from './database.ts';
import type { Task } from './types.ts';

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
    };
    await db.tasks.add(task);
    return task;
}

async function updateTask(id: string, changes: Partial<Omit<Task, 'id' | 'createdAt'>>): Promise<void> {
    await db.tasks.update(id, { ...changes, updatedAt: Date.now() });
}

async function deleteTask(id: string): Promise<void> {
    await db.tasks.delete(id);
}

async function getTask(id: string): Promise<Task | undefined> {
    return db.tasks.get(id);
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

    // Seat above the first remaining incomplete (completed pile at top; uncomplete rejoins it)
    const today = getLogicalDay();
    const visible = await getVisibleTasks(today);
    if (!visible.some((t) => t.id === id)) {
        return completed;
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

    return completed;
}

async function getTasksForDay(date: string): Promise<Task[]> {
    return db.tasks.where('date').equals(date).sortBy('sortOrder');
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
    createTask,
    deleteTask,
    getTask,
    getTasksForDay,
    getVisibleTasks,
    reorderTasks,
    toggleTaskCompleted,
    updateTask,
    wasCompletedOn,
};
