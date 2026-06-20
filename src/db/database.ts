import type { Table } from 'dexie';
import Dexie from 'dexie';
import type { Generator, Label, SyncMeta, Task } from './types.ts';

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

        this.version(2).stores({
            tasks: 'id, date, generatorId, completed, sortOrder, [date+completed]',
            generators: 'id, active',
            labels: 'id, name',
            syncMeta: 'key',
        });
    }
}

const db = new TaskMasterDB();

export { db, TaskMasterDB };
