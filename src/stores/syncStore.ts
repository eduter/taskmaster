import { createSignal } from 'solid-js';
import { isAuthenticated } from '../sync/dropboxAuth.ts';

type SyncConnectionState = 'disconnected' | 'connected' | 'needs_reauth';
type SyncOperationState = 'idle' | 'syncing' | 'pushing';

type SyncResultKind = 'pulled' | 'pushed' | 'up_to_date' | 'not_authenticated' | 'error';

const [connection, setConnection] = createSignal<SyncConnectionState>(isAuthenticated() ? 'connected' : 'disconnected');
const [operation, setOperation] = createSignal<SyncOperationState>('idle');
const [lastResult, setLastResult] = createSignal<SyncResultKind | null>(null);
const [lastMessage, setLastMessage] = createSignal<string | null>(null);
const [lastSyncedAt, setLastSyncedAt] = createSignal<number | null>(null);
const [lastErrorAt, setLastErrorAt] = createSignal<number | null>(null);
const [pendingPush, setPendingPush] = createSignal(false);
const [lastBackupDay, setLastBackupDay] = createSignal<string | null>(null);

function refreshAuthState(): void {
    if (connection() === 'needs_reauth') {
        return;
    }
    setConnection(isAuthenticated() ? 'connected' : 'disconnected');
}

function markNeedsReauth(message: string): void {
    setConnection('needs_reauth');
    setLastResult('error');
    setLastMessage(message);
    setLastErrorAt(Date.now());
    setPendingPush(false);
}

function markDisconnected(): void {
    setConnection('disconnected');
    setOperation('idle');
    setLastResult(null);
    setLastMessage(null);
    setPendingPush(false);
}

function markConnected(): void {
    setConnection('connected');
    setLastResult(null);
    setLastMessage(null);
    setLastErrorAt(null);
}

function beginSync(): void {
    setOperation('syncing');
    setLastMessage(null);
}

function beginPush(): void {
    setOperation('pushing');
}

function endOperation(): void {
    setOperation('idle');
}

function recordSuccess(
    kind: Exclude<SyncResultKind, 'not_authenticated' | 'error'>,
    message: string,
    syncedAt?: number
): void {
    setLastResult(kind);
    setLastMessage(message);
    if (syncedAt != null) {
        setLastSyncedAt(syncedAt);
    }
    setLastErrorAt(null);
    setPendingPush(false);
}

function recordError(message: string, options?: { needsReauth?: boolean }): void {
    setLastResult('error');
    setLastMessage(message);
    setLastErrorAt(Date.now());
    setPendingPush(false);
    if (options?.needsReauth) {
        setConnection('needs_reauth');
    }
}

function setPendingPushScheduled(scheduled: boolean): void {
    setPendingPush(scheduled);
}

function hydrateLastSyncedAt(timestamp: number): void {
    if (timestamp > 0) {
        setLastSyncedAt(timestamp);
    }
}

function hydrateLastBackupDay(day: string): void {
    setLastBackupDay(day);
}

function formatRelativeTime(timestamp: number | null): string {
    if (timestamp == null || timestamp === 0) {
        return 'Never';
    }

    const diffMs = Date.now() - timestamp;
    const diffSec = Math.floor(diffMs / 1000);
    if (diffSec < 10) {
        return 'Just now';
    }
    if (diffSec < 60) {
        return `${diffSec}s ago`;
    }
    const diffMin = Math.floor(diffSec / 60);
    if (diffMin < 60) {
        return `${diffMin}m ago`;
    }
    const diffHr = Math.floor(diffMin / 60);
    if (diffHr < 24) {
        return `${diffHr}h ago`;
    }
    return new Date(timestamp).toLocaleString();
}

function hasSyncIssue(): boolean {
    return connection() === 'needs_reauth' || lastResult() === 'error';
}

export type { SyncConnectionState, SyncOperationState, SyncResultKind };
export {
    beginPush,
    beginSync,
    connection,
    endOperation,
    formatRelativeTime,
    hasSyncIssue,
    hydrateLastBackupDay,
    hydrateLastSyncedAt,
    lastBackupDay,
    lastErrorAt,
    lastMessage,
    lastResult,
    lastSyncedAt,
    markConnected,
    markDisconnected,
    markNeedsReauth,
    operation,
    pendingPush,
    recordError,
    recordSuccess,
    refreshAuthState,
    setPendingPushScheduled,
};
