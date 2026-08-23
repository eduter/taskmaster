import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { resetDb, seedTask } from '../test/helpers.ts';
import { getLogicalDay } from '../utils/logicalDay.ts';
import { db } from './database.ts';
import {
    addChecklistItem,
    advanceIncompleteTasks,
    copyTaskFromHistory,
    deleteChecklistItem,
    filterTaskCandidates,
    getCompletedTaskCandidates,
    getTask,
    getTasksForDateRange,
    getVisibleTasks,
    pruneCompletedTasks,
    reorderChecklistItems,
    toggleChecklistItemCompleted,
    toggleTaskCompleted,
    updateChecklistItemSummary,
} from './tasks.ts';

describe('completed task candidates', () => {
    beforeEach(() => resetDb());
    afterEach(() => resetDb());

    it('deduplicates normalized summaries using the most recently completed task', async () => {
        await seedTask({
            id: 'older',
            summary: 'Pick up package',
            description: 'Old details',
            completed: true,
            completedAt: 1000,
        });
        await seedTask({
            id: 'newer',
            summary: '  PICK UP PACKAGE  ',
            description: 'Current details',
            completed: true,
            completedAt: 3000,
        });
        await seedTask({
            id: 'other',
            summary: 'Post letter',
            completed: true,
            completedAt: 2000,
        });
        await seedTask({ id: 'active', summary: 'Active package' });
        await seedTask({ id: 'legacy', summary: 'Legacy package', completed: true, completedAt: null });

        const candidates = await getCompletedTaskCandidates();

        expect(candidates.map((task) => task.id)).toEqual(['newer', 'other']);
        expect(candidates[0].description).toBe('Current details');
    });

    it('matches case-insensitive summary substrings and limits results', async () => {
        const candidates = [
            await seedTask({ id: 'package', summary: 'Pick up package at the post office' }),
            await seedTask({ id: 'letter', summary: 'Post a letter' }),
            await seedTask({ id: 'unrelated', summary: 'Buy groceries' }),
        ];

        expect(filterTaskCandidates(candidates, 'POST', 1).map((task) => task.id)).toEqual(['package']);
        expect(filterTaskCandidates(candidates, 'package').map((task) => task.id)).toEqual(['package']);
    });

    it('returns no matches for a blank query', async () => {
        const candidate = await seedTask({ id: 'task', summary: 'Task' });

        expect(filterTaskCandidates([candidate], '   ')).toEqual([]);
    });
});

describe('copyTaskFromHistory', () => {
    beforeEach(() => resetDb());
    afterEach(() => resetDb());

    it('copies reusable fields and resets task identity and completion state', async () => {
        const source = await seedTask({
            id: 'source',
            summary: 'Pick up package',
            description: 'Bring photo ID',
            labelIds: ['errands'],
            date: '2026-06-01',
            completed: true,
            completedAt: 1000,
            generatorId: 'generator',
            parentTaskId: 'parent',
            checklistItems: [{ id: 'old-item', summary: 'Take ID', completed: true }],
        });

        const copy = await copyTaskFromHistory(source, '2026-08-23');

        expect(copy).toMatchObject({
            summary: 'Pick up package',
            description: 'Bring photo ID',
            labelIds: ['errands'],
            date: '2026-08-23',
            completed: false,
            completedAt: null,
            generatorId: null,
            parentTaskId: null,
        });
        expect(copy.id).not.toBe(source.id);
        expect(copy.checklistItems).toEqual([{ id: expect.any(String), summary: 'Take ID', completed: false }]);
        expect(copy.checklistItems[0].id).not.toBe('old-item');
    });
});

describe('pruneCompletedTasks', () => {
    beforeEach(() => resetDb());
    afterEach(() => resetDb());

    it('deletes completed tasks before the cutoff logical day', async () => {
        await seedTask({
            id: 'expired',
            summary: 'Expired',
            completed: true,
            completedAt: new Date('2026-06-23T12:00:00').getTime(),
        });
        await seedTask({
            id: 'boundary',
            summary: 'Boundary',
            completed: true,
            completedAt: new Date('2026-06-24T12:00:00').getTime(),
        });
        await seedTask({
            id: 'recent',
            summary: 'Recent',
            completed: true,
            completedAt: new Date('2026-08-01T12:00:00').getTime(),
        });
        await seedTask({
            id: 'incomplete',
            summary: 'Incomplete',
            completedAt: new Date('2026-05-01T12:00:00').getTime(),
        });
        await seedTask({
            id: 'legacy',
            summary: 'Legacy',
            completed: true,
            completedAt: null,
        });

        const deleted = await pruneCompletedTasks('2026-06-24');

        expect(deleted).toBe(1);
        expect((await db.tasks.toArray()).map((task) => task.id).sort()).toEqual([
            'boundary',
            'incomplete',
            'legacy',
            'recent',
        ]);
    });

    it('is idempotent', async () => {
        await seedTask({
            id: 'expired',
            summary: 'Expired',
            completed: true,
            completedAt: new Date('2026-01-01T12:00:00').getTime(),
        });

        expect(await pruneCompletedTasks('2026-06-24')).toBe(1);
        expect(await pruneCompletedTasks('2026-06-24')).toBe(0);
    });
});

describe('advanceIncompleteTasks', () => {
    beforeEach(() => resetDb());
    afterEach(() => resetDb());

    it('moves incomplete past tasks onto today', async () => {
        await seedTask({ id: 'stale', summary: 'Leftover', date: '2026-05-20' });
        await seedTask({ id: 'today', summary: 'Today', date: '2026-05-23' });
        await seedTask({ id: 'future', summary: 'Later', date: '2026-05-24' });

        expect(await advanceIncompleteTasks('2026-05-23')).toBe(1);

        expect((await getTask('stale'))?.date).toBe('2026-05-23');
        expect((await getTask('today'))?.date).toBe('2026-05-23');
        expect((await getTask('future'))?.date).toBe('2026-05-24');
    });

    it('leaves completed past tasks on their original day', async () => {
        await seedTask({
            id: 'done',
            summary: 'Done',
            date: '2026-05-20',
            completed: true,
            completedAt: new Date('2026-05-20T12:00:00').getTime(),
        });

        expect(await advanceIncompleteTasks('2026-05-23')).toBe(0);
        expect((await getTask('done'))?.date).toBe('2026-05-20');
    });

    it('is idempotent', async () => {
        await seedTask({ id: 'stale', summary: 'Leftover', date: '2026-05-20' });

        expect(await advanceIncompleteTasks('2026-05-23')).toBe(1);
        expect(await advanceIncompleteTasks('2026-05-23')).toBe(0);
    });
});

describe('getVisibleTasks', () => {
    beforeEach(() => resetDb());
    afterEach(() => resetDb());

    it('shows a past-dated task completed today', async () => {
        const completedAt = new Date('2026-05-23T14:00:00').getTime();
        await seedTask({
            id: 'late-done',
            summary: 'Finished late',
            date: '2026-05-20',
            completed: true,
            completedAt,
        });

        const visible = await getVisibleTasks('2026-05-23');
        expect(visible.map((t) => t.id)).toContain('late-done');
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

    it('orders by sortOrder across dates so leftover tasks can sit below today', async () => {
        await seedTask({
            id: 'leftover',
            summary: 'Leftover',
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
        expect(visible.map((t) => t.id)).toEqual(['today', 'leftover']);
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
