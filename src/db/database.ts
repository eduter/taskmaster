import Dexie from 'dexie';
import type { Table } from 'dexie';
import type { Task, Generator, SyncMeta } from './types.ts';

class TaskMasterDB extends Dexie {
    tasks!: Table<Task, string>;
    generators!: Table<Generator, string>;
    syncMeta!: Table<SyncMeta, string>;

    constructor() {
        super('taskmaster');

        this.version(1).stores({
            tasks: 'id, date, generatorId, completed, sortOrder, [date+completed]',
            generators: 'id, active',
            syncMeta: 'key',
        });
    }
}

const db = new TaskMasterDB();

export { db, TaskMasterDB };
