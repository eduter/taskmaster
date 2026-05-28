import { createSignal, createResource } from 'solid-js';
import { getAllGenerators, createGenerator, updateGenerator, deleteGenerator } from '../db/generators.ts';
import { schedulePush } from '../sync/syncEngine.ts';
import type { Generator, TaskTemplate } from '../db/types.ts';

const [genVersion, setGenVersion] = createSignal(0);

function invalidateGenerators(options?: { push?: boolean }) {
    setGenVersion((v) => v + 1);
    if (options?.push !== false) {
        schedulePush();
    }
}

const [generators, { refetch: refetchGenerators }] = createResource(genVersion, () => getAllGenerators());

const [editingGeneratorId, setEditingGeneratorId] = createSignal<string | null>(null);
const [showGeneratorList, setShowGeneratorList] = createSignal(false);

async function addGenerator(name: string, rrule: string, templates: TaskTemplate[]): Promise<Generator> {
    const gen = await createGenerator({ name, rrule, templates });
    invalidateGenerators();
    return gen;
}

async function editGenerator(id: string, changes: Partial<Omit<Generator, 'id' | 'createdAt'>>): Promise<void> {
    await updateGenerator(id, changes);
    invalidateGenerators();
}

async function removeGenerator(id: string): Promise<void> {
    await deleteGenerator(id);
    if (editingGeneratorId() === id) setEditingGeneratorId(null);
    invalidateGenerators();
}

export {
    generators,
    refetchGenerators,
    editingGeneratorId,
    setEditingGeneratorId,
    showGeneratorList,
    setShowGeneratorList,
    addGenerator,
    editGenerator,
    removeGenerator,
    invalidateGenerators,
};
