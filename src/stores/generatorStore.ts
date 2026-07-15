import { createResource, createSignal } from 'solid-js';
import { withDbRead, withDbWrite } from '../db/dbLifecycle.ts';
import { createGenerator, deleteGenerator, getAllGenerators, updateGenerator } from '../db/generators.ts';
import type { Generator, TaskTemplate } from '../db/types.ts';
import { schedulePush } from '../sync/syncEngine.ts';

const [genVersion, setGenVersion] = createSignal(0);

function invalidateGenerators(options?: { push?: boolean }) {
    setGenVersion((v) => v + 1);
    if (options?.push !== false) {
        schedulePush();
    }
}

const [generators, { refetch: refetchGenerators }] = createResource(genVersion, () =>
    withDbRead(() => getAllGenerators())
);

async function addGenerator(name: string, rrule: string, templates: TaskTemplate[]): Promise<Generator> {
    const gen = await withDbWrite(() => createGenerator({ name, rrule, templates }));
    invalidateGenerators();
    return gen;
}

async function editGenerator(id: string, changes: Partial<Omit<Generator, 'id' | 'createdAt'>>): Promise<void> {
    await withDbWrite(() => updateGenerator(id, changes));
    invalidateGenerators();
}

async function removeGenerator(id: string): Promise<void> {
    await withDbWrite(() => deleteGenerator(id));
    invalidateGenerators();
}

export { addGenerator, editGenerator, generators, invalidateGenerators, refetchGenerators, removeGenerator };
