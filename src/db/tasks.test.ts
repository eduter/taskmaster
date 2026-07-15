import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { resetDb, seedTask } from '../test/helpers.ts';
import { getLogicalDay } from '../utils/logicalDay.ts';
import { getVisibleTasks, toggleTaskCompleted } from './tasks.ts';

describe('getVisibleTasks', () => {
    beforeEach(() => resetDb());
    afterEach(() => resetDb());

    it('shows a carried task completed today', async () => {
        const completedAt = new Date('2026-05-23T14:00:00').getTime();
        await seedTask({
            id: 'carried',
            summary: 'Carried',
            date: '2026-05-20',
            completed: true,
            completedAt,
        });

        const visible = await getVisibleTasks('2026-05-23');
        expect(visible.map((t) => t.id)).toContain('carried');
    });

    it('hides a task completed on a prior day', async () => {
        const completedAt = new Date('2026-05-22T14:00:00').getTime();
        await seedTask({
            id: 'old-done',
            summary: 'Done yesterday',
            date: '2026-05-20',
            completed: true,
            completedAt,
        });

        const visible = await getVisibleTasks('2026-05-23');
        expect(visible.map((t) => t.id)).not.toContain('old-done');
    });

    it('shows today task completed today', async () => {
        const completedAt = new Date('2026-05-23T10:00:00').getTime();
        await seedTask({
            id: 'today-done',
            summary: 'Today done',
            date: '2026-05-23',
            completed: true,
            completedAt,
        });

        const visible = await getVisibleTasks('2026-05-23');
        expect(visible.map((t) => t.id)).toContain('today-done');
    });

    it('orders by sortOrder across dates so carried tasks can sit below today', async () => {
        await seedTask({
            id: 'carried',
            summary: 'Carried',
            date: '2026-05-20',
            sortOrder: 1,
        });
        await seedTask({
            id: 'today',
            summary: 'Today',
            date: '2026-05-23',
            sortOrder: 0,
        });

        const visible = await getVisibleTasks('2026-05-23');
        expect(visible.map((t) => t.id)).toEqual(['today', 'carried']);
    });
});

describe('toggleTaskCompleted ordering', () => {
    beforeEach(() => resetDb());
    afterEach(() => resetDb());

    async function visibleIds(): Promise<string[]> {
        const visible = await getVisibleTasks(getLogicalDay());
        return visible.map((t) => t.id);
    }

    it('floats a newly completed task above the first incomplete', async () => {
        const today = getLogicalDay();
        await seedTask({
            id: 'a',
            summary: 'A',
            date: today,
            sortOrder: 0,
            completed: true,
            completedAt: Date.now(),
        });
        await seedTask({ id: 'b', summary: 'B', date: today, sortOrder: 1 });
        await seedTask({ id: 'c', summary: 'C', date: today, sortOrder: 2 });
        await seedTask({
            id: 'd',
            summary: 'D',
            date: today,
            sortOrder: 3,
            completed: true,
            completedAt: Date.now(),
        });

        await toggleTaskCompleted('c');

        expect(await visibleIds()).toEqual(['a', 'c', 'b', 'd']);
    });

    it('moves an uncompleted task to the top of the incomplete section', async () => {
        const today = getLogicalDay();
        await seedTask({
            id: 'a',
            summary: 'A',
            date: today,
            sortOrder: 0,
            completed: true,
            completedAt: Date.now(),
        });
        await seedTask({
            id: 'c',
            summary: 'C',
            date: today,
            sortOrder: 1,
            completed: true,
            completedAt: Date.now(),
        });
        await seedTask({ id: 'b', summary: 'B', date: today, sortOrder: 2 });
        await seedTask({ id: 'd', summary: 'D', date: today, sortOrder: 3 });

        await toggleTaskCompleted('c');

        expect(await visibleIds()).toEqual(['a', 'c', 'b', 'd']);
    });
});
