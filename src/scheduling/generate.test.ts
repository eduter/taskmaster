import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { db } from '../db/database.ts';
import { getActiveGenerators } from '../db/generators.ts';
import { resetDb, seedGenerator } from '../test/helpers.ts';
import { runGenerators } from './generate.ts';

function dailyRrule(dtstart: string): string {
    const dObj = new Date(`${dtstart}T12:00:00`);
    const dStr = `${dObj.toISOString().replace(/[-:]/g, '').split('.')[0]}Z`;
    return `DTSTART:${dStr}\nRRULE:FREQ=DAILY;INTERVAL=1`;
}

function weeklyRrule(dtstart: string, byday: string): string {
    const dObj = new Date(`${dtstart}T12:00:00`);
    const dStr = `${dObj.toISOString().replace(/[-:]/g, '').split('.')[0]}Z`;
    return `DTSTART:${dStr}\nRRULE:FREQ=WEEKLY;INTERVAL=1;BYDAY=${byday}`;
}

describe('getActiveGenerators', () => {
    beforeEach(() => resetDb());
    afterEach(() => resetDb());

    it('returns only active generators', async () => {
        await seedGenerator({
            id: 'active-gen',
            name: 'Active',
            rrule: dailyRrule('2026-01-01'),
            active: true,
        });
        await seedGenerator({
            id: 'inactive-gen',
            name: 'Inactive',
            rrule: dailyRrule('2026-01-01'),
            active: false,
        });

        const active = await getActiveGenerators();
        expect(active.map((g) => g.id)).toEqual(['active-gen']);
    });
});

describe('runGenerators', () => {
    beforeEach(() => resetDb());
    afterEach(() => resetDb());

    it('creates tasks from DTSTART through today on first run', async () => {
        await seedGenerator({
            id: 'daily',
            name: 'Daily',
            rrule: dailyRrule('2026-05-20'),
            lastGeneratedDate: null,
        });

        const created = await runGenerators('2026-05-23');
        expect(created).toBe(4);

        const tasks = await db.tasks.toArray();
        expect(tasks.map((t) => t.date).sort()).toEqual(['2026-05-20', '2026-05-21', '2026-05-22', '2026-05-23']);

        const gen = await db.generators.get('daily');
        expect(gen?.lastGeneratedDate).toBe('2026-05-23');
    });

    it('catchs up from lastGeneratedDate', async () => {
        await seedGenerator({
            id: 'daily',
            name: 'Daily',
            rrule: dailyRrule('2026-05-01'),
            lastGeneratedDate: '2026-05-20',
        });

        const created = await runGenerators('2026-05-23');
        expect(created).toBe(3);

        const tasks = await db.tasks.toArray();
        expect(tasks.map((t) => t.date).sort()).toEqual(['2026-05-21', '2026-05-22', '2026-05-23']);
    });

    it('is idempotent when run twice on the same day', async () => {
        await seedGenerator({
            id: 'daily',
            name: 'Daily',
            rrule: dailyRrule('2026-05-23'),
            lastGeneratedDate: null,
        });

        const first = await runGenerators('2026-05-23');
        const second = await runGenerators('2026-05-23');

        expect(first).toBe(1);
        expect(second).toBe(0);
        expect((await db.tasks.toArray()).length).toBe(1);
    });

    it('skips inactive generators', async () => {
        await seedGenerator({
            id: 'inactive',
            name: 'Inactive',
            rrule: dailyRrule('2026-05-20'),
            active: false,
        });

        const created = await runGenerators('2026-05-23');
        expect(created).toBe(0);
        expect(await db.tasks.count()).toBe(0);
    });

    it('creates weekly tasks only on selected weekdays', async () => {
        await seedGenerator({
            id: 'weekly',
            name: 'Weekly',
            rrule: weeklyRrule('2026-05-18', 'MO,WE,FR'),
            lastGeneratedDate: null,
        });

        const created = await runGenerators('2026-05-23');
        expect(created).toBe(3);

        const tasks = await db.tasks.toArray();
        expect(tasks.map((t) => t.date).sort()).toEqual(['2026-05-18', '2026-05-20', '2026-05-22']);
    });
});
