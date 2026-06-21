import { db } from '../db/database.ts';
import type { Generator, Label, SyncMeta, Task } from '../db/types.ts';
import {
    beginSync,
    endOperation,
    hydrateLastBackupDay,
    hydrateLastSyncedAt,
    lastResult,
    markNeedsReauth,
    recordError,
    recordSuccess,
    refreshAuthState,
    setPendingPushScheduled,
} from '../stores/syncStore.ts';
import { ensureBackupBeforeOverwrite } from './backups.ts';
import {
    clearTokens,
    getDropboxClient,
    getDropboxErrorMessage,
    getDropboxErrorStatus,
    isAuthenticated,
    persistTokensFromClient,
    tryRefreshAccessToken,
} from './dropboxAuth.ts';

const SYNC_FILE = '/taskmaster/data.json';
const DEBUG_PATH_PREFIX = '/taskmaster/debug/sync-anomaly-';
const DEBOUNCE_MS = 2000;

interface SyncPayload {
    version: 2;
    lastModifiedAt: number;
    labels: Label[];
    tasks: Task[];
    generators: Generator[];
}

type LegacyTask = Task & { labelIds?: string[] };
type LegacyTaskTemplate = Generator['templates'][number] & { labelIds?: string[] };
type LegacyGenerator = Omit<Generator, 'templates'> & { templates: LegacyTaskTemplate[] };

interface LegacySyncPayload {
    version?: number;
    lastModifiedAt: number;
    labels?: Label[];
    tasks: LegacyTask[];
    generators: LegacyGenerator[];
}

type SyncOutcome = {
    ok: boolean;
    pulled: boolean;
    pushed: boolean;
    dataChanged: boolean;
};

type DownloadResult = { ok: true; payload: SyncPayload | null } | { ok: false };

let debounceTimer: ReturnType<typeof setTimeout> | null = null;
let localDirty = false;
let syncQueue: Promise<unknown> = Promise.resolve();
let activeSyncOperations = 0;
let queuedSyncOperations = 0;
const syncIdleListeners = new Set<() => void>();

function onSyncIdle(listener: () => void): () => void {
    syncIdleListeners.add(listener);
    return () => syncIdleListeners.delete(listener);
}

function notifySyncIdle(): void {
    for (const listener of syncIdleListeners) {
        listener();
    }
}

function isSyncRunning(): boolean {
    return activeSyncOperations + queuedSyncOperations > 0;
}

async function runSerializedSync<T>(work: () => Promise<T>): Promise<T> {
    queuedSyncOperations++;

    const run = async (): Promise<T> => {
        queuedSyncOperations--;
        activeSyncOperations++;
        beginSync();

        try {
            return await work();
        } finally {
            activeSyncOperations--;
            if (!isSyncRunning()) {
                endOperation();
                notifySyncIdle();
            }
        }
    };

    const previous = syncQueue.catch(() => undefined);
    const current = previous.then(run);
    syncQueue = current.catch(() => undefined);
    return current;
}

async function markLocalDirty(): Promise<void> {
    localDirty = true;
    await updateSyncMeta({ localChangedAt: Date.now() });
}

async function getSyncMeta(): Promise<SyncMeta> {
    const meta = await db.syncMeta.get('primary');
    return meta ?? { key: 'primary', lastSyncedAt: 0, lastModifiedAt: 0 };
}

async function updateSyncMeta(changes: Partial<SyncMeta>): Promise<void> {
    const existing = await getSyncMeta();
    await db.syncMeta.put({ ...existing, ...changes });
}

async function isPushPending(): Promise<boolean> {
    const meta = await getSyncMeta();
    return meta.pushPending === true;
}

async function setPushPending(pending: boolean): Promise<void> {
    await updateSyncMeta({ pushPending: pending ? true : undefined });
}

async function getEffectiveLocalModifiedAt(): Promise<number> {
    const [tasks, generators, meta] = await Promise.all([db.tasks.toArray(), db.generators.toArray(), getSyncMeta()]);
    return Math.max(meta.lastModifiedAt, meta.localChangedAt ?? 0, maxRecordUpdatedAt({ tasks, generators }));
}

function maxRecordUpdatedAt(payload: Pick<SyncPayload, 'tasks' | 'generators'>): number {
    const taskTimes = payload.tasks.map((t) => t.updatedAt);
    const genTimes = payload.generators.map((g) => g.updatedAt);
    return Math.max(0, ...taskTimes, ...genTimes);
}

function normalizeSyncPayload(payload: LegacySyncPayload): SyncPayload {
    return {
        version: 2,
        lastModifiedAt: payload.lastModifiedAt,
        labels: payload.labels ?? [],
        tasks: payload.tasks.map((task) => ({
            ...task,
            labelIds: task.labelIds ?? [],
        })),
        generators: payload.generators.map((generator) => ({
            ...generator,
            templates: generator.templates.map((template) => ({
                ...template,
                labelIds: template.labelIds ?? [],
            })),
        })),
    };
}

async function buildPayload(): Promise<SyncPayload> {
    const [tasks, generators, labels, meta] = await Promise.all([
        db.tasks.toArray(),
        db.generators.toArray(),
        db.labels.toArray(),
        getSyncMeta(),
    ]);
    const recordMax = maxRecordUpdatedAt({ tasks, generators });
    const lastModifiedAt = Math.max(meta.lastModifiedAt, recordMax, Date.now());
    return { version: 2, lastModifiedAt, labels, tasks, generators };
}

async function applyPayload(payload: SyncPayload): Promise<void> {
    if (maxRecordUpdatedAt(payload) > payload.lastModifiedAt) {
        await logSyncAnomaly('corrupt remote payload', await buildPayload(), payload);
        recordError('Remote sync data has an invalid timestamp — sync blocked');
        throw new Error('corrupt remote payload');
    }

    await db.transaction('rw', [db.tasks, db.generators, db.labels, db.syncMeta], async () => {
        await db.tasks.clear();
        await db.generators.clear();
        await db.labels.clear();
        await db.tasks.bulkAdd(payload.tasks);
        await db.generators.bulkAdd(payload.generators);
        await db.labels.bulkAdd(payload.labels);
        await updateSyncMeta({
            lastSyncedAt: Date.now(),
            lastModifiedAt: payload.lastModifiedAt,
            pushPending: undefined,
            localChangedAt: undefined,
        });
    });
    localDirty = false;
}

async function logSyncAnomaly(reason: string, local: SyncPayload, remote: SyncPayload | null): Promise<void> {
    const dbx = getDropboxClient();
    if (!dbx) {
        return;
    }

    const meta = await getSyncMeta();
    const debug = { reason, local, remote, syncMeta: meta, at: Date.now() };
    const path = `${DEBUG_PATH_PREFIX}${new Date().toISOString().replace(/[:.]/g, '-')}.json`;

    try {
        await dbx.filesUpload({
            path,
            contents: JSON.stringify(debug),
            mode: { '.tag': 'add' },
            mute: true,
        });
        persistTokensFromClient(dbx);
    } catch (err: unknown) {
        console.error('Failed to upload sync anomaly log:', err);
    }
}

async function handleAuthFailure(err: unknown, context: string): Promise<never> {
    const status = getDropboxErrorStatus(err);
    const detail = getDropboxErrorMessage(err);

    if (status === 401) {
        const refreshed = await tryRefreshAccessToken();
        if (!refreshed) {
            clearTokens();
            markNeedsReauth('Dropbox session expired. Connect again to sync.');
            throw new Error(`${context}: authentication expired (401)`);
        }
        refreshAuthState();
        throw new Error(`${context}: authentication expired (401), retry`);
    }

    recordError(`${context}: ${detail}`);
    throw err instanceof Error ? err : new Error(detail);
}

async function downloadRemote(): Promise<DownloadResult> {
    const dbx = getDropboxClient();
    if (!dbx) {
        return { ok: false };
    }

    try {
        const response = await dbx.filesDownload({ path: SYNC_FILE });
        persistTokensFromClient(dbx);
        const blob = (response.result as unknown as { fileBlob: Blob }).fileBlob;
        const text = await blob.text();
        let remote: SyncPayload;
        try {
            remote = normalizeSyncPayload(JSON.parse(text) as LegacySyncPayload);
        } catch {
            recordError('Download failed: remote sync file is not valid JSON');
            return { ok: false };
        }
        return { ok: true, payload: remote };
    } catch (err: unknown) {
        const status = getDropboxErrorStatus(err);
        if (status === 409) {
            return { ok: true, payload: null };
        }
        if (status === 401) {
            try {
                await handleAuthFailure(err, 'Download failed');
            } catch (retryErr) {
                if (retryErr instanceof Error && retryErr.message.includes('retry')) {
                    return downloadRemote();
                }
                return { ok: false };
            }
        }
        console.error('Dropbox download failed:', err);
        recordError(`Download failed: ${getDropboxErrorMessage(err)}`);
        return { ok: false };
    }
}

async function uploadLocal(remoteForBackup: SyncPayload | null): Promise<boolean> {
    const dbx = getDropboxClient();
    if (!dbx) {
        return false;
    }

    const payload = await buildPayload();

    if (maxRecordUpdatedAt(payload) > payload.lastModifiedAt) {
        await logSyncAnomaly('lastModifiedAt invariant violation', payload, remoteForBackup);
        recordError('Local sync data has an invalid timestamp — upload blocked');
        return false;
    }

    if (remoteForBackup) {
        const backup = await ensureBackupBeforeOverwrite(remoteForBackup);
        if (!backup.ok) {
            recordError('Daily backup failed — upload blocked to prevent data loss');
            return false;
        }
        if (backup.day) {
            await updateSyncMeta({ lastBackupDay: backup.day });
            hydrateLastBackupDay(backup.day);
        }
    }

    const contents = JSON.stringify(payload);

    try {
        await dbx.filesUpload({
            path: SYNC_FILE,
            contents,
            mode: { '.tag': 'overwrite' },
            mute: true,
        });
        persistTokensFromClient(dbx);
        const syncedAt = Date.now();
        await updateSyncMeta({
            lastSyncedAt: syncedAt,
            lastModifiedAt: payload.lastModifiedAt,
            pushPending: undefined,
            localChangedAt: undefined,
        });
        localDirty = false;
        recordSuccess('pushed', 'Uploaded local changes to Dropbox', syncedAt);
        return true;
    } catch (err: unknown) {
        const status = getDropboxErrorStatus(err);
        if (status === 401) {
            try {
                await handleAuthFailure(err, 'Upload failed');
            } catch (retryErr) {
                if (retryErr instanceof Error && retryErr.message.includes('retry')) {
                    return uploadLocal(remoteForBackup);
                }
                return false;
            }
        }
        console.error('Dropbox upload failed:', err);
        recordError(`Upload failed: ${getDropboxErrorMessage(err)}`);
        return false;
    }
}

async function attemptWithRetry<T>(fn: () => Promise<T>, shouldRetry: (result: T) => boolean): Promise<T> {
    const first = await fn();
    if (!shouldRetry(first)) {
        return first;
    }
    return fn();
}

async function sync(): Promise<SyncOutcome> {
    if (!isAuthenticated()) {
        recordError('Not connected to Dropbox');
        return { ok: false, pulled: false, pushed: false, dataChanged: false };
    }

    return runSerializedSync(syncNow);
}

async function syncNow(): Promise<SyncOutcome> {
    const download = await attemptWithRetry(downloadRemote, (r) => !r.ok);
    if (!download.ok) {
        return { ok: false, pulled: false, pushed: false, dataChanged: false };
    }

    const effectiveLocal = await getEffectiveLocalModifiedAt();
    const pending = await isPushPending();
    const remote = download.payload;

    if (remote === null) {
        const pushed = await attemptWithRetry(
            () => uploadLocal(null),
            (ok) => !ok
        );
        if (pushed) {
            await setPushPending(false);
        }
        return { ok: pushed, pulled: false, pushed, dataChanged: pushed };
    }

    if (remote.lastModifiedAt > effectiveLocal) {
        try {
            await applyPayload(remote);
        } catch {
            return { ok: false, pulled: false, pushed: false, dataChanged: false };
        }
        await setPushPending(false);
        const syncedAt = Date.now();
        recordSuccess('pulled', 'Downloaded newer data from Dropbox', syncedAt);
        return { ok: true, pulled: true, pushed: false, dataChanged: true };
    }

    const needsPush = pending || localDirty || remote.lastModifiedAt < effectiveLocal;

    if (needsPush) {
        const pushed = await attemptWithRetry(
            () => uploadLocal(remote),
            (ok) => !ok
        );
        if (pushed) {
            await setPushPending(false);
        }
        return { ok: pushed, pulled: false, pushed, dataChanged: pushed };
    }

    if (lastResult() !== 'error') {
        recordSuccess('up_to_date', 'Already up to date with Dropbox');
    }
    return { ok: true, pulled: false, pushed: false, dataChanged: false };
}

function schedulePush(): void {
    if (!isAuthenticated()) {
        return;
    }
    void markLocalDirty();
    if (debounceTimer) {
        clearTimeout(debounceTimer);
    }
    setPendingPushScheduled(true);
    debounceTimer = setTimeout(() => {
        debounceTimer = null;
        setPendingPushScheduled(false);
        void sync();
    }, DEBOUNCE_MS);
}

/** @deprecated Use sync() — kept for tests that exercise pull in isolation */
async function pullFromDropbox(): Promise<boolean> {
    const download = await downloadRemote();
    if (!download.ok || download.payload === null) {
        return false;
    }
    const meta = await getSyncMeta();
    if (download.payload.lastModifiedAt > meta.lastModifiedAt) {
        try {
            await applyPayload(download.payload);
            recordSuccess('pulled', 'Downloaded newer data from Dropbox', Date.now());
            return true;
        } catch {
            return false;
        }
    }
    return false;
}

/** @deprecated Use sync() — kept for tests that exercise push in isolation */
async function pushToDropbox(): Promise<boolean> {
    const download = await downloadRemote();
    const remote = download.ok ? download.payload : null;
    return uploadLocal(remote);
}

async function loadSyncMetaIntoStore(): Promise<void> {
    const meta = await getSyncMeta();
    hydrateLastSyncedAt(meta.lastSyncedAt);
    if (meta.lastBackupDay) {
        hydrateLastBackupDay(meta.lastBackupDay);
    }
}

export type { SyncOutcome, SyncPayload };
export {
    getSyncMeta,
    isPushPending,
    isSyncRunning,
    loadSyncMetaIntoStore,
    markLocalDirty,
    maxRecordUpdatedAt,
    onSyncIdle,
    pullFromDropbox,
    pushToDropbox,
    schedulePush,
    setPushPending,
    sync,
};
