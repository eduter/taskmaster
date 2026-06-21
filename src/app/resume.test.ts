import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { db } from '../db/database.ts';
import { resetDb, seedGenerator } from '../test/helpers.ts';

const sync = vi.fn();
const runGenerators = vi.fn();
const commitGeneratorRuns = vi.fn();
const setPushPending = vi.fn();
const isSyncRunning = vi.fn(() => false);
const invalidateLabels = vi.fn();
let syncIdleCallback: (() => void) | null = null;

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

describe('onAppResume', () => {
    beforeEach(async () => {
        await resetDb();
        sync.mockReset();
        runGenerators.mockReset();
        commitGeneratorRuns.mockReset();
        setPushPending.mockReset();
        invalidateLabels.mockReset();
        setPushPending.mockResolvedValue(undefined);
        isSyncRunning.mockReset();
        isSyncRunning.mockReturnValue(false);
        syncIdleCallback = null;
        runGenerators.mockResolvedValue({ created: 0, generatorIds: [] });
    });

    afterEach(() => resetDb());

    it('skips generators when sync fails', async () => {
        sync.mockResolvedValue({ ok: false, pulled: false, pushed: false, dataChanged: false });

        const { onAppResume } = await import('./resume.ts');
        await onAppResume();

        expect(runGenerators).not.toHaveBeenCalled();
    });

    it('refreshes labels after sync changes data', async () => {
        sync.mockResolvedValue({ ok: true, pulled: true, pushed: false, dataChanged: true });

        const { onAppResume } = await import('./resume.ts');
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

        const { onAppResume } = await import('./resume.ts');
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

            vi.resetModules();
            const { setupResumeListeners } = await import('./resume.ts');
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

        const { onAppResume } = await import('./resume.ts');
        await onAppResume();

        expect(commitGeneratorRuns).toHaveBeenCalledWith(['daily'], '2026-05-23');
        expect(setPushPending).toHaveBeenCalledWith(true);
        expect(sync).toHaveBeenCalledTimes(2);
        const commitOrder = commitGeneratorRuns.mock.invocationCallOrder[0];
        const secondSyncOrder = sync.mock.invocationCallOrder[1];
        expect(commitOrder).toBeLessThan(secondSyncOrder);
    });
});
