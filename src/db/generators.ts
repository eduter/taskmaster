import { db } from './database.ts';
import { generateId } from '../utils/id.ts';
import type { Generator, TaskTemplate } from './types.ts';

async function createGenerator(
    fields: Pick<Generator, 'name' | 'rrule'> & { templates?: TaskTemplate[] }
): Promise<Generator> {
    const now = Date.now();
    const generator: Generator = {
        id: generateId(),
        name: fields.name,
        rrule: fields.rrule,
        templates: fields.templates ?? [],
        active: true,
        lastGeneratedDate: null,
        createdAt: now,
        updatedAt: now,
    };
    await db.generators.add(generator);
    return generator;
}

async function updateGenerator(id: string, changes: Partial<Omit<Generator, 'id' | 'createdAt'>>): Promise<void> {
    await db.generators.update(id, { ...changes, updatedAt: Date.now() });
}

async function deleteGenerator(id: string): Promise<void> {
    await db.generators.delete(id);
}

async function getGenerator(id: string): Promise<Generator | undefined> {
    return db.generators.get(id);
}

async function getAllGenerators(): Promise<Generator[]> {
    return db.generators.toArray();
}

async function getActiveGenerators(): Promise<Generator[]> {
    return db.generators.filter((g) => g.active).toArray();
}

export { createGenerator, updateGenerator, deleteGenerator, getGenerator, getAllGenerators, getActiveGenerators };
