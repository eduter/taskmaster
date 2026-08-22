import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { resetDb, seedTask } from '../test/helpers.ts';
import { getLogicalDay } from '../utils/logicalDay.ts';
import {
    addChecklistItem,
    deleteChecklistItem,
    getTask,
    getTasksForDateRange,
    getVisibleTasks,
    reorderChecklistItems,
    toggleChecklistItemCompleted,
    toggleTaskCompleted,
    updateChecklistItemSummary,
} from './tasks.ts';

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

describe('getTasksForDateRange', () => {
    beforeEach(() => resetDb());
    afterEach(() => resetDb());

    it('returns tasks in the inclusive range ordered by date and sort order', async () => {
        await seedTask({ id: 'late', summary: 'Late', date: '2026-07-25', sortOrder: 2 });
        await seedTask({ id: 'early', summary: 'Early', date: '2026-07-25', sortOrder: 1 });
        await seedTask({ id: 'outside', summary: 'Outside', date: '2026-07-27' });
        await seedTask({ id: 'first-day', summary: 'First day', date: '2026-07-24' });

        const tasks = await getTasksForDateRange('2026-07-24', '2026-07-25');

        expect(tasks.map((task) => task.id)).toEqual(['first-day', 'early', 'late']);
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

describe('task checklist mutations', () => {
    beforeEach(() => resetDb());
    afterEach(() => resetDb());

    it('adds, renames, reorders, and deletes checklist items', async () => {
        const task = await seedTask({ id: 'groceries', summary: 'Groceries', updatedAt: 1 });

        const milk = await addChecklistItem(task.id, 'Milk');
        const bread = await addChecklistItem(task.id, 'Bread');
        expect(milk).toMatchObject({ summary: 'Milk', completed: false });
        expect(bread).toMatchObject({ summary: 'Bread', completed: false });

        await updateChecklistItemSummary(task.id, milk?.id ?? '', 'Oat milk');
        await reorderChecklistItems(task.id, [bread?.id ?? '', milk?.id ?? '']);
        await deleteChecklistItem(task.id, bread?.id ?? '');

        const stored = await getTask(task.id);
        expect(stored?.checklistItems).toEqual([{ id: milk?.id, summary: 'Oat milk', completed: false }]);
        expect(stored?.updatedAt).toBeGreaterThan(1);
    });

    it('completes the parent when the final unchecked item is checked', async () => {
        const task = await seedTask({
            id: 'groceries',
            summary: 'Groceries',
            checklistItems: [
                { id: 'milk', summary: 'Milk', completed: true },
                { id: 'bread', summary: 'Bread', completed: false },
            ],
        });

        const completed = await toggleChecklistItemCompleted(task.id, 'bread');
        const stored = await getTask(task.id);

        expect(completed).toBe(true);
        expect(stored).toMatchObject({ completed: true });
        expect(stored?.completedAt).not.toBeNull();
    });

    it('does not reopen the parent when an item is unchecked', async () => {
        const task = await seedTask({
            id: 'groceries',
            summary: 'Groceries',
            completed: true,
            completedAt: Date.now(),
            checklistItems: [{ id: 'milk', summary: 'Milk', completed: true }],
        });

        await toggleChecklistItemCompleted(task.id, 'milk');
        const stored = await getTask(task.id);

        expect(stored).toMatchObject({
            completed: true,
            checklistItems: [{ id: 'milk', summary: 'Milk', completed: false }],
        });
    });

    it('does not complete the parent when deletion leaves only completed items', async () => {
        const task = await seedTask({
            id: 'groceries',
            summary: 'Groceries',
            checklistItems: [
                { id: 'milk', summary: 'Milk', completed: true },
                { id: 'bread', summary: 'Bread', completed: false },
            ],
        });

        await deleteChecklistItem(task.id, 'bread');
        const stored = await getTask(task.id);

        expect(stored).toMatchObject({ completed: false });
    });
});
