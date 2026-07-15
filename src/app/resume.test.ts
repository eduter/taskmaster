import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { db } from '../db/database.ts';
import { resetDb, seedGenerator } from '../test/helpers.ts';

const sync = vi.fn();
const runGenerators = vi.fn();
const commitGeneratorRuns = vi.fn();
const setPushPending = vi.fn();
const isSyncRunning = vi.fn(() => false);
const isAuthenticated = vi.fn(() => true);
const invalidateLabels = vi.fn();
const waitForDb = vi.fn();
const recordError = vi.fn();
let syncIdleCallback: (() => void) | null = null;

vi.mock('../db/dbLifecycle.ts', () => ({
    waitForDb: () => waitForDb(),
}));

vi.mock('../stores/syncStore.ts', () => ({
    recordError: (message: string) => recordError(message),
}));

vi.mock('../sync/dropboxAuth.ts', () => ({
    isAuthenticated: () => isAuthenticated(),
}));

vi.mock('../sync/syncEngine.ts', () => ({
    sync,
    isSyncRunning,
    setPushPending,
    onSyncIdle: (listener: () => void) => {
        syncIdleCallback = listener;
        return () => {
            syncIdleCallback = null;
        };
    },
}));

vi.mock('../scheduling/generate.ts', () => ({
    runGenerators,
    commitGeneratorRuns,
}));

vi.mock('../stores/taskStore.ts', () => ({
    invalidateTasks: vi.fn(),
    refreshTodayIfNeeded: vi.fn(),
    today: () => '2026-05-23',
}));

vi.mock('../stores/generatorStore.ts', () => ({
    invalidateGenerators: vi.fn(),
}));

vi.mock('../stores/labelStore.ts', () => ({
    invalidateLabels,
}));

async function importResume() {
    vi.resetModules();
    return import('./resume.ts');
}

describe('onAppResume', () => {
    beforeEach(async () => {
        await resetDb();
        sync.mockReset();
        runGenerators.mockReset();
        commitGeneratorRuns.mockReset();
        setPushPending.mockReset();
        invalidateLabels.mockReset();
        waitForDb.mockReset();
        recordError.mockReset();
        setPushPending.mockResolvedValue(undefined);
        isSyncRunning.mockReset();
        isSyncRunning.mockReturnValue(false);
        isAuthenticated.mockReset();
        isAuthenticated.mockReturnValue(true);
        syncIdleCallback = null;
        runGenerators.mockResolvedValue({ created: 0, generatorIds: [] });
        waitForDb.mockResolvedValue(undefined);
    });

    afterEach(() => {
        vi.unstubAllEnvs();
        return resetDb();
    });

    it('runs generators in dev when Dropbox is not configured', async () => {
        vi.stubEnv('DEV', true);
        vi.stubEnv('PROD', false);
        isAuthenticated.mockReturnValue(false);
        runGenerators.mockResolvedValue({ created: 1, generatorIds: ['daily'] });

        const { onAppResume } = await importResume();
        await onAppResume();

        expect(sync).not.toHaveBeenCalled();
        expect(runGenerators).toHaveBeenCalled();
        expect(commitGeneratorRuns).toHaveBeenCalledWith(['daily'], '2026-05-23');
        expect(setPushPending).not.toHaveBeenCalled();
    });

    it('blocks generators in prod when Dropbox is not configured', async () => {
        vi.stubEnv('DEV', false);
        vi.stubEnv('PROD', true);
        isAuthenticated.mockReturnValue(false);
        sync.mockResolvedValue({ ok: false, pulled: false, pushed: false, dataChanged: false });

        const { onAppResume } = await importResume();
        await onAppResume();

        expect(sync).toHaveBeenCalledOnce();
        expect(runGenerators).not.toHaveBeenCalled();
    });

    it('skips generators in dev when authenticated sync fails', async () => {
        vi.stubEnv('DEV', true);
        vi.stubEnv('PROD', false);
        sync.mockResolvedValue({ ok: false, pulled: false, pushed: false, dataChanged: false });

        const { onAppResume } = await importResume();
        await onAppResume();

        expect(sync).toHaveBeenCalledOnce();
        expect(runGenerators).not.toHaveBeenCalled();
    });

    it('records an error when the database is unavailable', async () => {
        waitForDb.mockRejectedValue(new Error('Another TaskMaster tab is using the database'));

        const { onAppResume } = await importResume();
        await onAppResume();

        expect(recordError).toHaveBeenCalledWith('Another TaskMaster tab is using the database');
        expect(sync).not.toHaveBeenCalled();
        expect(runGenerators).not.toHaveBeenCalled();
    });

    it('skips generators when sync fails', async () => {
        sync.mockResolvedValue({ ok: false, pulled: false, pushed: false, dataChanged: false });

        const { onAppResume } = await importResume();
        await onAppResume();

        expect(runGenerators).not.toHaveBeenCalled();
    });

    it('refreshes labels after sync changes data', async () => {
        sync.mockResolvedValue({ ok: true, pulled: true, pushed: false, dataChanged: true });

        const { onAppResume } = await importResume();
        await onAppResume();

        expect(invalidateLabels).toHaveBeenCalledWith({ push: false });
    });

    it('commits lastGeneratedDate before push; keeps pushPending when push fails', async () => {
        sync.mockResolvedValueOnce({ ok: true, pulled: false, pushed: false, dataChanged: false });
        sync.mockResolvedValueOnce({ ok: false, pulled: false, pushed: false, dataChanged: false });
        runGenerators.mockResolvedValue({ created: 2, generatorIds: ['daily'] });
        commitGeneratorRuns.mockImplementation(async (ids: string[], day: string) => {
            for (const id of ids) {
                const gen = await db.generators.get(id);
                if (gen) {
                    await db.generators.put({ ...gen, lastGeneratedDate: day });
                }
            }
        });

        await seedGenerator({
            id: 'daily',
            name: 'Daily',
            rrule: 'FREQ=DAILY',
            lastGeneratedDate: null,
        });

        const { onAppResume } = await importResume();
        await onAppResume();

        expect(commitGeneratorRuns).toHaveBeenCalledWith(['daily'], '2026-05-23');
        expect(setPushPending).toHaveBeenCalledWith(true);
        const gen = await db.generators.get('daily');
        expect(gen?.lastGeneratedDate).toBe('2026-05-23');
        expect(sync).toHaveBeenCalledTimes(2);
    });

    it('re-queues resume when sync is in flight', async () => {
        vi.useFakeTimers({ shouldAdvanceTime: true });
        const addEventListener = vi.fn();
        vi.stubGlobal('document', {
            visibilityState: 'visible',
            addEventListener,
        });
        vi.stubGlobal('window', { addEventListener: vi.fn() });
        try {
            sync.mockResolvedValue({ ok: true, pulled: false, pushed: false, dataChanged: false });
            isSyncRunning.mockReturnValue(true);

            const { setupResumeListeners } = await importResume();
            setupResumeListeners();

            const onVisible = addEventListener.mock.calls.find(([event]) => event === 'visibilitychange')?.[1] as
                | (() => void)
                | undefined;
            onVisible?.();
            await vi.advanceTimersByTimeAsync(500);

            expect(sync).not.toHaveBeenCalled();

            isSyncRunning.mockReturnValue(false);
            syncIdleCallback?.();
            await vi.runAllTimersAsync();

            expect(sync).toHaveBeenCalled();
        } finally {
            vi.useRealTimers();
            vi.unstubAllGlobals();
        }
    });

    it('commits generator meta before post-generation sync on success', async () => {
        sync.mockResolvedValue({ ok: true, pulled: false, pushed: true, dataChanged: true });
        runGenerators.mockResolvedValue({ created: 1, generatorIds: ['daily'] });

        const { onAppResume } = await importResume();
        await onAppResume();

        expect(commitGeneratorRuns).toHaveBeenCalledWith(['daily'], '2026-05-23');
        expect(setPushPending).toHaveBeenCalledWith(true);
        expect(sync).toHaveBeenCalledTimes(2);
        const commitOrder = commitGeneratorRuns.mock.invocationCallOrder[0];
        const secondSyncOrder = sync.mock.invocationCallOrder[1];
        expect(commitOrder).toBeLessThan(secondSyncOrder);
    });
});
