import { createSignal } from 'solid-js';
import { withTimeout } from '../utils/timeout.ts';
import { db } from './database.ts';

const DB_OPEN_TIMEOUT_MS = 10_000;
const DB_READ_TIMEOUT_MS = 10_000;

type DbStatus = 'opening' | 'ready' | 'blocked' | 'error';

const [dbStatus, setDbStatus] = createSignal<DbStatus>('opening');
const [dbError, setDbError] = createSignal<string | null>(null);

function dbUnavailableMessage(): string {
    return dbError() ?? 'Local database is unavailable';
}

function failDbOpen(err: unknown): void {
    setDbStatus('error');
    const message = err instanceof Error ? err.message : 'Failed to open local database';
    setDbError(message);
}

db.on('versionchange', () => {
    db.close();
    setDbStatus('blocked');
    setDbError('Database updated in another tab — reload this page');
});

db.on('blocked', () => {
    setDbStatus('blocked');
    setDbError('Another TaskMaster tab is using the database — close it and reload');
});

const openPromise = db.open();

let resolveDbReady: () => void;
let rejectDbReady: (err: Error) => void;

const dbReady = new Promise<void>((resolve, reject) => {
    resolveDbReady = resolve;
    rejectDbReady = reject;
});

openPromise
    .then(() => {
        if (dbStatus() !== 'blocked') {
            setDbStatus('ready');
            setDbError(null);
            resolveDbReady();
        }
    })
    .catch((err: unknown) => {
        failDbOpen(err);
        rejectDbReady(err instanceof Error ? err : new Error('Failed to open local database'));
    });

void withTimeout(
    openPromise,
    DB_OPEN_TIMEOUT_MS,
    'Local database took too long to open — try reloading the page'
).catch((err: unknown) => {
    if (db.isOpen()) {
        return;
    }
    const message = err instanceof Error ? err.message : 'Local database took too long to open';
    setDbStatus('error');
    setDbError(message);
});

/** Wait until IndexedDB is open; throws when the database is blocked or failed to open. */
async function waitForDb(): Promise<void> {
    if (dbStatus() === 'blocked') {
        throw new Error(dbUnavailableMessage());
    }

    if (db.isOpen()) {
        if (dbStatus() !== 'ready') {
            setDbStatus('ready');
            setDbError(null);
        }
        return;
    }

    await dbReady;

    if (dbStatus() === 'blocked') {
        throw new Error(dbUnavailableMessage());
    }
}

/** Run a read against IndexedDB after the database is open; times out on a hung store. */
async function withDbRead<T>(read: () => Promise<T>): Promise<T> {
    if (dbStatus() === 'blocked') {
        throw new Error(dbUnavailableMessage());
    }

    await waitForDb();

    return withTimeout(read(), DB_READ_TIMEOUT_MS, 'Local database took too long to read — try reloading the page');
}

/** Run a write against IndexedDB after the database is open; times out on a hung store. */
async function withDbWrite<T>(write: () => Promise<T>): Promise<T> {
    if (dbStatus() === 'blocked') {
        throw new Error(dbUnavailableMessage());
    }

    await waitForDb();

    return withTimeout(write(), DB_READ_TIMEOUT_MS, 'Local database took too long to write — try reloading the page');
}

export type { DbStatus };
export { dbError, dbReady, dbStatus, waitForDb, withDbRead, withDbWrite };
