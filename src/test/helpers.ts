import { db } from '../db/database.ts';
import type { Generator, Task } from '../db/types.ts';

async function resetDb(): Promise<void> {
    await db.tasks.clear();
    await db.generators.clear();
    await db.syncMeta.clear();
}

async function seedGenerator(overrides: Partial<Generator> & Pick<Generator, 'name' | 'rrule'>): Promise<Generator> {
    const now = Date.now();
    const generator: Generator = {
        id: overrides.id ?? `gen-${now}`,
        name: overrides.name,
        rrule: overrides.rrule,
        templates: overrides.templates ?? [{ summary: 'Task A', description: '', labels: [] }],
        active: overrides.active ?? true,
        lastGeneratedDate: overrides.lastGeneratedDate ?? null,
        createdAt: overrides.createdAt ?? now,
        updatedAt: overrides.updatedAt ?? now,
    };
    await db.generators.add(generator);
    return generator;
}

async function seedTask(overrides: Partial<Task> & Pick<Task, 'summary'>): Promise<Task> {
    const now = Date.now();
    const task: Task = {
        id: overrides.id ?? `task-${now}`,
        summary: overrides.summary,
        description: overrides.description ?? '',
        labels: overrides.labels ?? [],
        date: overrides.date ?? '2026-01-01',
        sortOrder: overrides.sortOrder ?? now,
        completed: overrides.completed ?? false,
        completedAt: overrides.completedAt ?? null,
        createdAt: overrides.createdAt ?? now,
        updatedAt: overrides.updatedAt ?? now,
        generatorId: overrides.generatorId ?? null,
        parentTaskId: overrides.parentTaskId ?? null,
    };
    await db.tasks.add(task);
    return task;
}

export { resetDb, seedGenerator, seedTask };
