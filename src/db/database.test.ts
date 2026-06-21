import Dexie from 'dexie';
import { afterEach, describe, expect, it } from 'vitest';
import { TaskMasterDB } from './database.ts';

const TEST_DB_NAME = 'taskmaster';

describe('TaskMasterDB migrations', () => {
    afterEach(async () => {
        await Dexie.delete(TEST_DB_NAME);
    });

    it('adds empty labelIds to legacy tasks and generator templates', async () => {
        await Dexie.delete(TEST_DB_NAME);

        const legacyDb = new Dexie(TEST_DB_NAME);
        legacyDb.version(1).stores({
            tasks: 'id, date, generatorId, completed, sortOrder, [date+completed]',
            generators: 'id, active',
            syncMeta: 'key',
        });
        await legacyDb.open();
        await legacyDb.table('tasks').add({
            id: 'task-1',
            summary: 'Legacy task',
            description: '',
            date: '2026-06-22',
            sortOrder: 1,
            completed: false,
            completedAt: null,
            createdAt: 1,
            updatedAt: 1,
            generatorId: null,
            parentTaskId: null,
        });
        await legacyDb.table('generators').add({
            id: 'generator-1',
            name: 'Legacy generator',
            rrule: 'FREQ=DAILY',
            templates: [{ summary: 'Template', description: '' }],
            active: true,
            lastGeneratedDate: null,
            createdAt: 1,
            updatedAt: 1,
        });
        legacyDb.close();

        const migratedDb = new TaskMasterDB();
        const [task, generator] = await Promise.all([
            migratedDb.tasks.get('task-1'),
            migratedDb.generators.get('generator-1'),
        ]);

        expect(task?.labelIds).toEqual([]);
        expect(generator?.templates[0].labelIds).toEqual([]);

        migratedDb.close();
    });
});
