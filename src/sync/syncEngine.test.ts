import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { db } from '../db/database.ts';
import { resetDb, seedGenerator, seedTask } from '../test/helpers.ts';
import type { SyncPayload } from './syncEngine.ts';

const mockFilesUpload = vi.fn();
const mockFilesDownload = vi.fn();

vi.mock('./dropboxAuth.ts', async (importOriginal) => {
    const actual = await importOriginal<typeof import('./dropboxAuth.ts')>();
    return {
        ...actual,
        isAuthenticated: () => true,
        getDropboxClient: () => ({
            filesUpload: mockFilesUpload,
            filesDownload: mockFilesDownload,
            auth: { getAccessToken: () => 'test-token' },
        }),
    };
});

const { pullFromDropbox, pushToDropbox, getSyncMeta } = await import('./syncEngine.ts');

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

describe('syncEngine', () => {
    beforeEach(async () => {
        await resetDb();
        mockFilesUpload.mockReset();
        mockFilesDownload.mockReset();
        mockFilesUpload.mockResolvedValue({});
    });

    afterEach(() => resetDb());

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
});
