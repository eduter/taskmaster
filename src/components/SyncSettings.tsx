import { onMount, Show } from 'solid-js';
import { useAppNavigate, useSyncPanelOpen } from '../routing/navigation.ts';
import { onAppResume } from '../app/resume.ts';
import {
    connection,
    formatRelativeTime,
    hasSyncIssue,
    lastErrorAt,
    lastMessage,
    lastResult,
    lastBackupDay,
    lastSyncedAt,
    markDisconnected,
    operation,
    pendingPush,
    refreshAuthState,
} from '../stores/syncStore.ts';
import { clearTokens, startAuthFlow } from '../sync/dropboxAuth.ts';
import { loadSyncMetaIntoStore } from '../sync/syncEngine.ts';
import syncIcon from '../icons/sync.svg?raw';
import { Dialog } from './Dialog.tsx';
import { Icon } from './Icon.tsx';
import './SyncSettings.css';

function SyncSettings() {
    const syncPanelOpen = useSyncPanelOpen();
    const { openSyncPanel, closeSyncPanel } = useAppNavigate();

    onMount(async () => {
        refreshAuthState();
        await loadSyncMetaIntoStore();
    });

    function openPanel() {
        refreshAuthState();
        void loadSyncMetaIntoStore();
        openSyncPanel();
    }

    async function handleSync() {
        await onAppResume();
    }

    async function handleConnect() {
        if (connection() === 'needs_reauth') {
            clearTokens();
            markDisconnected();
        }
        const url = await startAuthFlow();
        window.location.href = url;
    }

    function handleDisconnect() {
        clearTokens();
        markDisconnected();
    }

    function statusClass(): string {
        const conn = connection();
        if (conn === 'needs_reauth') {
            return 'sync-panel__status--error';
        }
        if (lastResult() === 'error') {
            return 'sync-panel__status--error';
        }
        if (pendingPush() || operation() !== 'idle') {
            return 'sync-panel__status--pending';
        }
        if (conn === 'connected') {
            return 'sync-panel__status--ok';
        }
        return '';
    }

    function connectionLabel(): string {
        switch (connection()) {
            case 'connected':
                return 'Connected to Dropbox';
            case 'needs_reauth':
                return 'Session expired — reconnect required';
            default:
                return 'Not connected';
        }
    }

    function operationLabel(): string | null {
        if (operation() === 'syncing') {
            return 'Syncing with Dropbox…';
        }
        if (operation() === 'pushing') {
            return 'Uploading local changes…';
        }
        if (pendingPush()) {
            return 'Changes waiting to upload…';
        }
        return null;
    }

    function resultLabel(): string | null {
        if (operation() !== 'idle') {
            return null;
        }
        return lastMessage();
    }

    const isConnected = () => connection() === 'connected' || connection() === 'needs_reauth';

    return (
        <>
            <button
                type="button"
                class="sync-trigger"
                classList={{
                    'sync-trigger--attention': hasSyncIssue(),
                    'sync-trigger--active': operation() !== 'idle' || pendingPush(),
                }}
                onClick={openPanel}
                aria-label="Sync settings"
            >
                <Icon src={syncIcon} />
                <Show when={hasSyncIssue() || pendingPush()}>
                    <span
                        class="sync-trigger__badge"
                        classList={{
                            'sync-trigger__badge--error': hasSyncIssue(),
                            'sync-trigger__badge--pending': !hasSyncIssue() && pendingPush(),
                        }}
                    />
                </Show>
            </button>
            <Dialog open={syncPanelOpen()} onClose={closeSyncPanel} title="Dropbox Sync">
                <div class="sync-panel__info">
                    <p class={`sync-panel__status ${statusClass()}`}>{connectionLabel()}</p>
                    <Show when={isConnected()}>
                        <p class="sync-panel__meta">Last synced: {formatRelativeTime(lastSyncedAt())}</p>
                        <p class="sync-panel__meta">Latest backup: {lastBackupDay() ?? 'None'}</p>
                    </Show>
                    <Show when={operationLabel()}>
                        <p class="sync-panel__activity">{operationLabel()}</p>
                    </Show>
                    <Show when={resultLabel()}>
                        <p
                            class="sync-panel__result"
                            classList={{
                                'sync-panel__result--error': lastResult() === 'error',
                                'sync-panel__result--ok': lastResult() !== 'error' && lastResult() != null,
                            }}
                        >
                            {resultLabel()}
                        </p>
                    </Show>
                    <Show when={lastErrorAt()}>
                        <p class="sync-panel__meta">Last error: {formatRelativeTime(lastErrorAt())}</p>
                    </Show>
                </div>

                <Show
                    when={isConnected()}
                    fallback={
                        <div class="sync-panel__connect">
                            <p class="sync-panel__text">Connect to Dropbox to sync tasks across your devices.</p>
                            <button type="button" class="btn btn--primary btn--grow" onClick={handleConnect}>
                                Connect to Dropbox
                            </button>
                        </div>
                    }
                >
                    <div class="sync-panel__connected">
                        <div class="sync-panel__actions">
                            <button
                                type="button"
                                class="btn btn--primary btn--grow"
                                onClick={handleSync}
                                disabled={operation() !== 'idle'}
                            >
                                {operation() === 'syncing' ? 'Syncing…' : 'Sync Now'}
                            </button>
                            <Show
                                when={connection() === 'needs_reauth'}
                                fallback={
                                    <button type="button" class="btn btn--danger" onClick={handleDisconnect}>
                                        Disconnect
                                    </button>
                                }
                            >
                                <button type="button" class="btn btn--primary btn--grow" onClick={handleConnect}>
                                    Reconnect
                                </button>
                            </Show>
                        </div>
                        <Show when={connection() === 'connected'}>
                            <button
                                type="button"
                                class="btn btn--text sync-panel__disconnect"
                                onClick={handleDisconnect}
                            >
                                Disconnect
                            </button>
                        </Show>
                    </div>
                </Show>
            </Dialog>
        </>
    );
}

export { SyncSettings };
