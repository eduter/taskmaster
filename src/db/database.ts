import type { Table } from 'dexie';
import Dexie from 'dexie';
import type { Generator, Label, SyncMeta, Task, TaskTemplate } from './types.ts';

type LegacyTask = Task & { labelIds?: string[] };
type LegacyTaskTemplate = TaskTemplate & { labelIds?: string[] };
type LegacyGenerator = Generator & { templates: LegacyTaskTemplate[] };

class TaskMasterDB extends Dexie {
    tasks!: Table<Task, string>;
    generators!: Table<Generator, string>;
    labels!: Table<Label, string>;
    syncMeta!: Table<SyncMeta, string>;

    constructor() {
        super('taskmaster');

        this.version(1).stores({
            tasks: 'id, date, generatorId, completed, sortOrder, [date+completed]',
            generators: 'id, active',
            syncMeta: 'key',
        });

        this.version(2)
            .stores({
                tasks: 'id, date, generatorId, completed, sortOrder, [date+completed]',
                generators: 'id, active',
                labels: 'id, name',
                syncMeta: 'key',
            })
            .upgrade(async (tx) => {
                await tx
                    .table<LegacyTask, string>('tasks')
                    .toCollection()
                    .modify((task) => {
                        task.labelIds ??= [];
                    });

                await tx
                    .table<LegacyGenerator, string>('generators')
                    .toCollection()
                    .modify((generator) => {
                        generator.templates = generator.templates.map((template) => ({
                            ...template,
                            labelIds: template.labelIds ?? [],
                        }));
                    });
            });
    }
}

const db = new TaskMasterDB();

export { db, TaskMasterDB };
