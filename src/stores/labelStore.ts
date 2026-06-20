import { createResource, createSignal } from 'solid-js';
import { createLabel, deleteLabel, getAllLabels, updateLabel } from '../db/labels.ts';
import type { Label } from '../db/types.ts';
import { schedulePush } from '../sync/syncEngine.ts';
import { invalidateTasks } from './taskStore.ts';

const [labelVersion, setLabelVersion] = createSignal(0);

function invalidateLabels(options?: { push?: boolean }) {
    setLabelVersion((v) => v + 1);
    if (options?.push !== false) {
        schedulePush();
    }
}

const [labels, { refetch: refetchLabels }] = createResource(labelVersion, () => getAllLabels());

async function addLabel(name: string, color: string): Promise<Label> {
    const label = await createLabel({ name, color });
    invalidateLabels();
    return label;
}

async function editLabel(id: string, changes: Partial<Pick<Label, 'name' | 'color'>>): Promise<void> {
    await updateLabel(id, changes);
    invalidateLabels();
}

async function removeLabel(id: string): Promise<void> {
    await deleteLabel(id);
    invalidateLabels();
    invalidateTasks();
}

export { addLabel, editLabel, invalidateLabels, labels, refetchLabels, removeLabel };
