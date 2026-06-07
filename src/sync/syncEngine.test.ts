import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { db } from '../db/database.ts';
import { resetDb, seedGenerator, seedTask } from '../test/helpers.ts';
import type { SyncPayload } from './syncEngine.ts';

const mockFilesUpload = vi.fn();
const mockFilesDownload = vi.fn();
const mockFilesGetMetadata = vi.fn();
const mockFilesCopyV2 = vi.fn();

vi.mock('./dropboxAuth.ts', async (importOriginal) => {
    const actual = await importOriginal<typeof import('./dropboxAuth.ts')>();
    return {
        ...actual,
        isAuthenticated: () => true,
        getDropboxClient: () => ({
            filesUpload: mockFilesUpload,
            filesDownload: mockFilesDownload,
            filesGetMetadata: mockFilesGetMetadata,
            filesCopyV2: mockFilesCopyV2,
            auth: { getAccessToken: () => 'test-token' },
        }),
    };
});

const {
    isSyncRunning,
    onSyncIdle,
    pullFromDropbox,
    pushToDropbox,
    getSyncMeta,
    isPushPending,
    schedulePush,
    setPushPending,
    sync,
} = await import('./syncEngine.ts');

function makePayload(overrides: Partial<SyncPayload> = {}): SyncPayload {
    return {
        version: 1,
        lastModifiedAt: overrides.lastModifiedAt ?? 1000,
        tasks: overrides.tasks ?? [],
        generators: overrides.generators ?? [],
    };
}

function blobFromPayload(payload: SyncPayload): Blob {
    return new Blob([JSON.stringify(payload)], { type: 'application/json' });
}

function waitForSyncIdle(): Promise<void> {
    if (!isSyncRunning()) {
        return Promise.resolve();
    }
    return new Promise((resolve) => {
        const unsubscribe = onSyncIdle(() => {
            unsubscribe();
            resolve();
        });
    });
}

describe('syncEngine', () => {
    beforeEach(async () => {
        await resetDb();
        mockFilesUpload.mockReset();
        mockFilesDownload.mockReset();
        mockFilesUpload.mockResolvedValue({});
        mockFilesGetMetadata.mockReset();
        mockFilesCopyV2.mockReset();
        mockFilesGetMetadata.mockRejectedValue({ status: 409 });
        mockFilesCopyV2.mockResolvedValue({});
    });

    afterEach(async () => {
        await waitForSyncIdle();
        await resetDb();
    });

    it('applyPayload clears local data when remote has empty tasks', async () => {
        await seedTask({ id: 'local-task', summary: 'Local' });

        const remote = makePayload({
            lastModifiedAt: 2000,
            tasks: [],
            generators: [],
        });
        mockFilesDownload.mockResolvedValue({
            result: { fileBlob: blobFromPayload(remote) },
        });

        const pulled = await pullFromDropbox();
        expect(pulled).toBe(true);
        expect(await db.tasks.count()).toBe(0);
    });

    it('pull replaces local tasks and generators when remote is newer', async () => {
        await seedTask({ id: 'old', summary: 'Old' });
        await db.syncMeta.put({ key: 'primary', lastSyncedAt: 0, lastModifiedAt: 500 });

        const remoteTask = {
            id: 'remote',
            summary: 'Remote',
            description: '',
            labels: [],
            date: '2026-05-23',
            sortOrder: 1,
            completed: false,
            completedAt: null,
            createdAt: 1,
            updatedAt: 1,
            generatorId: null,
            parentTaskId: null,
        };
        const remote = makePayload({
            lastModifiedAt: 3000,
            tasks: [remoteTask],
            generators: [],
        });
        mockFilesDownload.mockResolvedValue({
            result: { fileBlob: blobFromPayload(remote) },
        });

        await pullFromDropbox();

        const tasks = await db.tasks.toArray();
        expect(tasks).toHaveLength(1);
        expect(tasks[0].summary).toBe('Remote');

        const meta = await getSyncMeta();
        expect(meta.lastModifiedAt).toBe(3000);
    });

    it('push uploads local payload when remote is not newer', async () => {
        await seedTask({ id: 'local', summary: 'Local' });
        await db.syncMeta.put({ key: 'primary', lastSyncedAt: 0, lastModifiedAt: 5000 });

        const remote = makePayload({ lastModifiedAt: 1000, tasks: [], generators: [] });
        mockFilesDownload.mockResolvedValue({
            result: { fileBlob: blobFromPayload(remote) },
        });

        await pullFromDropbox();
        expect(mockFilesUpload).not.toHaveBeenCalled();

        await pushToDropbox();
        expect(mockFilesUpload).toHaveBeenCalledOnce();
        const uploadArg = mockFilesUpload.mock.calls[0][0];
        const uploaded = JSON.parse(uploadArg.contents as string) as SyncPayload;
        expect(uploaded.tasks).toHaveLength(1);
        expect(uploaded.tasks[0].summary).toBe('Local');
    });

    it('push includes generators from local db', async () => {
        await seedGenerator({
            id: 'gen-1',
            name: 'Gen',
            rrule: 'FREQ=DAILY',
        });
        await db.syncMeta.put({ key: 'primary', lastSyncedAt: 0, lastModifiedAt: 5000 });
        mockFilesDownload.mockRejectedValue({ status: 409 });

        await pushToDropbox();

        const uploaded = JSON.parse(mockFilesUpload.mock.calls[0][0].contents as string) as SyncPayload;
        expect(uploaded.generators).toHaveLength(1);
        expect(uploaded.generators[0].name).toBe('Gen');
    });

    describe('pushPending', () => {
        it('setPushPending(true) persists across reads', async () => {
            await setPushPending(true);
            expect(await isPushPending()).toBe(true);
            expect((await getSyncMeta()).pushPending).toBe(true);
        });

        it('setPushPending(false) clears the flag', async () => {
            await db.syncMeta.put({ key: 'primary', lastSyncedAt: 0, lastModifiedAt: 0, pushPending: true });
            await setPushPending(false);
            expect(await isPushPending()).toBe(false);
            expect((await getSyncMeta()).pushPending).toBeUndefined();
        });
    });

    describe('schedulePush()', () => {
        it('retries upload once on transient failure', async () => {
            vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
            try {
                await seedTask({ id: 'local', summary: 'Local', updatedAt: 8000 });
                await db.syncMeta.put({ key: 'primary', lastSyncedAt: 0, lastModifiedAt: 1000 });

                const remote = makePayload({ lastModifiedAt: 1000 });
                mockFilesDownload.mockResolvedValue({
                    result: { fileBlob: blobFromPayload(remote) },
                });
                mockFilesUpload.mockRejectedValueOnce(new Error('upload blip'));
                mockFilesUpload.mockResolvedValueOnce({});

                schedulePush();
                await vi.runAllTimersAsync();
                await waitForSyncIdle();

                expect(mockFilesUpload).toHaveBeenCalledTimes(2);
            } finally {
                vi.useRealTimers();
            }
        });

        it('uploads when meta matches remote but a task updatedAt is newer', async () => {
            vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
            try {
                const sharedTs = 1000;
                const editTs = 8000;
                await seedTask({ id: 'edited', summary: 'Edited', updatedAt: editTs });
                await db.syncMeta.put({ key: 'primary', lastSyncedAt: 0, lastModifiedAt: sharedTs });

                const remote = makePayload({ lastModifiedAt: sharedTs });
                mockFilesDownload.mockResolvedValue({
                    result: { fileBlob: blobFromPayload(remote) },
                });

                schedulePush();
                await vi.runAllTimersAsync();
                await waitForSyncIdle();

                expect(mockFilesUpload).toHaveBeenCalledOnce();
            } finally {
                vi.useRealTimers();
            }
        });
    });

    describe('sync serialization', () => {
        it('debounced push waits for active sync', async () => {
            vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
            try {
                await seedTask({ id: 'stale', summary: 'Stale local', updatedAt: 500 });
                await db.syncMeta.put({ key: 'primary', lastSyncedAt: 0, lastModifiedAt: 1000 });

                const remoteTask = {
                    id: 'remote',
                    summary: 'Remote newer',
                    description: '',
                    labels: [],
                    date: '2026-05-23',
                    sortOrder: 1,
                    completed: false,
                    completedAt: null,
                    createdAt: 1,
                    updatedAt: 5000,
                    generatorId: null,
                    parentTaskId: null,
                };
                const newerRemote = makePayload({ lastModifiedAt: 5000, tasks: [remoteTask] });
                const staleRemote = makePayload({ lastModifiedAt: 1000, tasks: [] });

                let releaseDownload!: () => void;
                const downloadGate = new Promise<void>((resolve) => {
                    releaseDownload = resolve;
                });
                let downloadCalls = 0;
                mockFilesDownload.mockImplementation(async () => {
                    downloadCalls++;
                    if (downloadCalls === 1) {
                        await downloadGate;
                        return { result: { fileBlob: blobFromPayload(newerRemote) } };
                    }
                    return { result: { fileBlob: blobFromPayload(staleRemote) } };
                });

                const syncPromise = sync();
                schedulePush();
                await vi.advanceTimersByTimeAsync(2000);

                expect(mockFilesUpload).not.toHaveBeenCalled();

                releaseDownload();
                const syncOutcome = await syncPromise;
                await vi.runAllTimersAsync();
                await waitForSyncIdle();

                expect(syncOutcome.pulled).toBe(true);

                const tasks = await db.tasks.toArray();
                expect(tasks).toHaveLength(1);
                expect(tasks[0].summary).toBe('Remote newer');

                const dataUploads = mockFilesUpload.mock.calls.filter((c) => c[0].path === '/taskmaster/data.json');
                for (const call of dataUploads) {
                    const uploaded = JSON.parse(call[0].contents as string) as SyncPayload;
                    expect(uploaded.tasks.some((t) => t.summary === 'Stale local')).toBe(false);
                }
            } finally {
                vi.useRealTimers();
            }
        });

        it('queued operations do not clear busy state early', async () => {
            vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
            try {
                await db.syncMeta.put({ key: 'primary', lastSyncedAt: 0, lastModifiedAt: 5000 });

                const remote = makePayload({ lastModifiedAt: 5000 });
                let releaseDownload!: () => void;
                const downloadGate = new Promise<void>((resolve) => {
                    releaseDownload = resolve;
                });
                mockFilesDownload.mockImplementation(async () => {
                    await downloadGate;
                    return { result: { fileBlob: blobFromPayload(remote) } };
                });

                const idleSpy = vi.fn();
                onSyncIdle(idleSpy);

                const syncPromise = sync();
                expect(isSyncRunning()).toBe(true);

                schedulePush();
                await vi.advanceTimersByTimeAsync(2000);
                expect(isSyncRunning()).toBe(true);

                releaseDownload();
                await syncPromise;
                expect(isSyncRunning()).toBe(true);

                await vi.runAllTimersAsync();
                await waitForSyncIdle();
                expect(isSyncRunning()).toBe(false);
                expect(idleSpy).toHaveBeenCalledOnce();
            } finally {
                vi.useRealTimers();
            }
        });
    });

    describe('sync()', () => {
        it('does not upload when download fails', async () => {
            await seedTask({ id: 'local', summary: 'Local' });
            mockFilesDownload.mockRejectedValue(new Error('network error'));

            const outcome = await sync();

            expect(outcome.ok).toBe(false);
            expect(outcome.pushed).toBe(false);
            expect(mockFilesUpload).not.toHaveBeenCalled();
        });

        it('applies remote when newer', async () => {
            await seedTask({ id: 'old', summary: 'Old', updatedAt: 100 });
            await db.syncMeta.put({ key: 'primary', lastSyncedAt: 0, lastModifiedAt: 500 });

            const remote = makePayload({
                lastModifiedAt: 3000,
                tasks: [
                    {
                        id: 'remote',
                        summary: 'Remote',
                        description: '',
                        labels: [],
                        date: '2026-05-23',
                        sortOrder: 1,
                        completed: false,
                        completedAt: null,
                        createdAt: 1,
                        updatedAt: 1,
                        generatorId: null,
                        parentTaskId: null,
                    },
                ],
            });
            mockFilesDownload.mockResolvedValue({
                result: { fileBlob: blobFromPayload(remote) },
            });

            const outcome = await sync();

            expect(outcome.ok).toBe(true);
            expect(outcome.pushed).toBe(false);
            expect((await db.tasks.toArray())[0].summary).toBe('Remote');
        });

        it('uploads when local is newer', async () => {
            await seedTask({ id: 'local', summary: 'Local' });
            await db.syncMeta.put({ key: 'primary', lastSyncedAt: 0, lastModifiedAt: 8000 });

            const remote = makePayload({ lastModifiedAt: 1000 });
            mockFilesDownload.mockResolvedValue({
                result: { fileBlob: blobFromPayload(remote) },
            });

            const outcome = await sync();

            expect(outcome.ok).toBe(true);
            expect(outcome.pushed).toBe(true);
            expect(mockFilesUpload).toHaveBeenCalledOnce();
        });

        it('is up to date when timestamps match', async () => {
            await db.syncMeta.put({ key: 'primary', lastSyncedAt: 0, lastModifiedAt: 5000 });

            const remote = makePayload({ lastModifiedAt: 5000 });
            mockFilesDownload.mockResolvedValue({
                result: { fileBlob: blobFromPayload(remote) },
            });

            const outcome = await sync();

            expect(outcome.ok).toBe(true);
            expect(outcome.pulled).toBe(false);
            expect(outcome.pushed).toBe(false);
            expect(mockFilesUpload).not.toHaveBeenCalled();
        });

        it('fails closed when remote sync file is invalid JSON', async () => {
            mockFilesDownload.mockResolvedValue({
                result: { fileBlob: new Blob(['not-json'], { type: 'application/json' }) },
            });

            const outcome = await sync();

            expect(outcome.ok).toBe(false);
            expect(mockFilesUpload).not.toHaveBeenCalled();
        });

        it('retries download on transient failure', async () => {
            mockFilesDownload.mockRejectedValueOnce(new Error('network blip'));
            const remote = makePayload({ lastModifiedAt: 5000 });
            mockFilesDownload.mockResolvedValueOnce({
                result: { fileBlob: blobFromPayload(remote) },
            });
            await db.syncMeta.put({ key: 'primary', lastSyncedAt: 0, lastModifiedAt: 5000 });

            const outcome = await sync();

            expect(outcome.ok).toBe(true);
            expect(mockFilesDownload).toHaveBeenCalledTimes(2);
        });

        it('blocks applying remote when lastModifiedAt invariant is violated', async () => {
            await seedTask({ id: 'local', summary: 'Local', updatedAt: 100 });
            await db.syncMeta.put({ key: 'primary', lastSyncedAt: 0, lastModifiedAt: 500 });

            const remote = makePayload({
                lastModifiedAt: 3000,
                tasks: [
                    {
                        id: 'remote',
                        summary: 'Remote',
                        description: '',
                        labels: [],
                        date: '2026-05-23',
                        sortOrder: 1,
                        completed: false,
                        completedAt: null,
                        createdAt: 1,
                        updatedAt: 9000,
                        generatorId: null,
                        parentTaskId: null,
                    },
                ],
            });
            mockFilesDownload.mockResolvedValue({
                result: { fileBlob: blobFromPayload(remote) },
            });

            const outcome = await sync();

            expect(outcome.ok).toBe(false);
            expect((await db.tasks.toArray())[0].summary).toBe('Local');
            const dataUploads = mockFilesUpload.mock.calls.filter((c) => c[0].path === '/taskmaster/data.json');
            expect(dataUploads).toHaveLength(0);
        });

        it('creates backup before overwriting remote from prior day', async () => {
            const priorDayTs = new Date('2026-05-22T12:00:00').getTime();
            await seedTask({ id: 'local', summary: 'Local', updatedAt: priorDayTs + 1000 });
            await db.syncMeta.put({ key: 'primary', lastSyncedAt: 0, lastModifiedAt: priorDayTs + 5000 });

            const remote = makePayload({ lastModifiedAt: priorDayTs });
            mockFilesDownload.mockResolvedValue({
                result: { fileBlob: blobFromPayload(remote) },
            });

            const outcome = await sync();

            expect(outcome.ok).toBe(true);
            expect(outcome.pushed).toBe(true);
            expect(mockFilesCopyV2).toHaveBeenCalledWith({
                from_path: '/taskmaster/data.json',
                to_path: '/taskmaster/backups/data-2026-05-22.json',
            });
        });

        it('skips backup when remote is from today', async () => {
            const todayTs = Date.now();
            await seedTask({ id: 'local', summary: 'Local', updatedAt: todayTs });
            await db.syncMeta.put({ key: 'primary', lastSyncedAt: 0, lastModifiedAt: todayTs + 1000 });

            const remote = makePayload({ lastModifiedAt: todayTs });
            mockFilesDownload.mockResolvedValue({
                result: { fileBlob: blobFromPayload(remote) },
            });

            const outcome = await sync();

            expect(outcome.ok).toBe(true);
            expect(mockFilesCopyV2).not.toHaveBeenCalled();
        });

        it('pushPending triggers push when remote is not newer', async () => {
            const sharedTs = 5000;
            await seedTask({ id: 'gen-task', summary: 'Generated', updatedAt: sharedTs });
            await db.syncMeta.put({
                key: 'primary',
                lastSyncedAt: 0,
                lastModifiedAt: sharedTs,
                pushPending: true,
            });

            const remote = makePayload({ lastModifiedAt: sharedTs, tasks: [], generators: [] });
            mockFilesDownload.mockResolvedValue({
                result: { fileBlob: blobFromPayload(remote) },
            });

            const outcome = await sync();

            expect(outcome.ok).toBe(true);
            expect(outcome.pushed).toBe(true);
            expect(mockFilesUpload).toHaveBeenCalledOnce();
            expect(await isPushPending()).toBe(false);
        });

        it('pushPending cleared when remote is newer (other device fixed it)', async () => {
            await seedTask({ id: 'orphan', summary: 'Orphaned local', updatedAt: 6000 });
            await db.syncMeta.put({
                key: 'primary',
                lastSyncedAt: 0,
                lastModifiedAt: 5000,
                pushPending: true,
            });

            const remoteTask = {
                id: 'remote-gen',
                summary: 'From device B',
                description: '',
                labels: [],
                date: '2026-05-23',
                sortOrder: 1,
                completed: false,
                completedAt: null,
                createdAt: 1,
                updatedAt: 8000,
                generatorId: 'daily',
                parentTaskId: null,
            };
            const remote = makePayload({
                lastModifiedAt: 9000,
                tasks: [remoteTask],
                generators: [],
            });
            mockFilesDownload.mockResolvedValue({
                result: { fileBlob: blobFromPayload(remote) },
            });

            const outcome = await sync();

            expect(outcome.ok).toBe(true);
            expect(outcome.pulled).toBe(true);
            expect(outcome.pushed).toBe(false);
            expect(mockFilesUpload).not.toHaveBeenCalled();
            expect((await db.tasks.toArray())[0].summary).toBe('From device B');
            expect(await isPushPending()).toBe(false);
        });

        it('pushes when records are newer than meta and remote', async () => {
            const remoteTs = 1000;
            const editTs = 8000;
            await seedTask({ id: 'edited', summary: 'Edited', updatedAt: editTs });
            await db.syncMeta.put({ key: 'primary', lastSyncedAt: 0, lastModifiedAt: remoteTs });

            const remote = makePayload({ lastModifiedAt: remoteTs });
            mockFilesDownload.mockResolvedValue({
                result: { fileBlob: blobFromPayload(remote) },
            });

            const outcome = await sync();

            expect(outcome.ok).toBe(true);
            expect(outcome.pushed).toBe(true);
            expect(mockFilesUpload).toHaveBeenCalledOnce();
        });

        it('pulls when remote is newer than effective local', async () => {
            await seedTask({ id: 'local', summary: 'Local', updatedAt: 2000 });
            await db.syncMeta.put({ key: 'primary', lastSyncedAt: 0, lastModifiedAt: 2000 });

            const remoteTask = {
                id: 'remote',
                summary: 'Remote edit',
                description: '',
                labels: [],
                date: '2026-05-23',
                sortOrder: 1,
                completed: false,
                completedAt: null,
                createdAt: 1,
                updatedAt: 5000,
                generatorId: null,
                parentTaskId: null,
            };
            const remote = makePayload({ lastModifiedAt: 5000, tasks: [remoteTask] });
            mockFilesDownload.mockResolvedValue({
                result: { fileBlob: blobFromPayload(remote) },
            });

            const outcome = await sync();

            expect(outcome.ok).toBe(true);
            expect(outcome.pulled).toBe(true);
            expect((await db.tasks.toArray())[0].summary).toBe('Remote edit');
        });

        it('is up to date when remote matches effective local', async () => {
            const ts = 5000;
            await seedTask({ id: 'task', summary: 'Task', updatedAt: ts });
            await db.syncMeta.put({ key: 'primary', lastSyncedAt: 0, lastModifiedAt: ts });

            const remote = makePayload({
                lastModifiedAt: ts,
                tasks: [
                    {
                        id: 'task',
                        summary: 'Task',
                        description: '',
                        labels: [],
                        date: '2026-01-01',
                        sortOrder: 1,
                        completed: false,
                        completedAt: null,
                        createdAt: 1,
                        updatedAt: ts,
                        generatorId: null,
                        parentTaskId: null,
                    },
                ],
            });
            mockFilesDownload.mockResolvedValue({
                result: { fileBlob: blobFromPayload(remote) },
            });

            const outcome = await sync();

            expect(outcome.ok).toBe(true);
            expect(outcome.pulled).toBe(false);
            expect(outcome.pushed).toBe(false);
            expect(mockFilesUpload).not.toHaveBeenCalled();
        });

        it('pushPending survives failed upload', async () => {
            await seedTask({ id: 'local', summary: 'Local', updatedAt: 8000 });
            await db.syncMeta.put({
                key: 'primary',
                lastSyncedAt: 0,
                lastModifiedAt: 5000,
                pushPending: true,
            });

            const remote = makePayload({ lastModifiedAt: 1000 });
            mockFilesDownload.mockResolvedValue({
                result: { fileBlob: blobFromPayload(remote) },
            });
            mockFilesUpload.mockRejectedValue(new Error('upload failed'));

            const outcome = await sync();

            expect(outcome.ok).toBe(false);
            expect(outcome.pushed).toBe(false);
            expect(await isPushPending()).toBe(true);
        });
    });
});
