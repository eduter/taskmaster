import { beforeEach, describe, expect, it } from 'vitest';
import { db } from './database.ts';
import { resetDb } from '../test/helpers.ts';

describe('dbLifecycle', () => {
    beforeEach(async () => {
        await import('./dbLifecycle.ts');
        await resetDb();
    });

    it('waitForDb resolves once the database is open', async () => {
        const { waitForDb } = await import('./dbLifecycle.ts');

        await expect(waitForDb()).resolves.toBeUndefined();
        expect(db.isOpen()).toBe(true);
    });

    it('withDbRead returns query results after the database is open', async () => {
        const { withDbRead } = await import('./dbLifecycle.ts');

        await expect(withDbRead(() => db.tasks.count())).resolves.toBe(0);
    });

    it('withDbWrite persists changes after the database is open', async () => {
        const { withDbRead, withDbWrite } = await import('./dbLifecycle.ts');
        const { createTask } = await import('./tasks.ts');

        await withDbWrite(() => createTask({ summary: 'Test task' }));

        await expect(withDbRead(() => db.tasks.count())).resolves.toBe(1);
    });
});
