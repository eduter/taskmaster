import { generateId } from '../utils/id.ts';
import { db } from './database.ts';
import type { Label } from './types.ts';

async function getAllLabels(): Promise<Label[]> {
    return db.labels.orderBy('name').toArray();
}

async function createLabel(fields: Pick<Label, 'name' | 'color'>): Promise<Label> {
    const label: Label = {
        id: generateId(),
        name: fields.name.trim(),
        color: fields.color,
    };
    await db.labels.add(label);
    return label;
}

async function updateLabel(id: string, changes: Partial<Pick<Label, 'name' | 'color'>>): Promise<void> {
    const patch: Partial<Label> = { ...changes };
    if (changes.name !== undefined) {
        patch.name = changes.name.trim();
    }
    await db.labels.update(id, patch);
}

/** Removes the label and strips its id from every task and generator template. */
async function deleteLabel(id: string): Promise<void> {
    await db.transaction('rw', [db.labels, db.tasks, db.generators], async () => {
        await db.labels.delete(id);

        const tasks = await db.tasks.toArray();
        for (const task of tasks) {
            if (task.labelIds.includes(id)) {
                await db.tasks.update(task.id, {
                    labelIds: task.labelIds.filter((labelId) => labelId !== id),
                    updatedAt: Date.now(),
                });
            }
        }

        const generators = await db.generators.toArray();
        for (const generator of generators) {
            let changed = false;
            const templates = generator.templates.map((tmpl) => {
                if (!tmpl.labelIds.includes(id)) {
                    return tmpl;
                }
                changed = true;
                return { ...tmpl, labelIds: tmpl.labelIds.filter((labelId) => labelId !== id) };
            });
            if (changed) {
                await db.generators.update(generator.id, { templates, updatedAt: Date.now() });
            }
        }
    });
}

export { createLabel, deleteLabel, getAllLabels, updateLabel };
