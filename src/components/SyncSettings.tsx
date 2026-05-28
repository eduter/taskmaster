import { createSignal, onMount, Show } from 'solid-js';
import { startAuthFlow, clearTokens } from '../sync/dropboxAuth.ts';
import { sync, loadSyncMetaIntoStore } from '../sync/syncEngine.ts';
import { invalidateTasks } from '../stores/taskStore.ts';
import { invalidateGenerators } from '../stores/generatorStore.ts';
import {
    connection,
    operation,
    lastResult,
    lastMessage,
    lastSyncedAt,
    lastErrorAt,
    pendingPush,
    refreshAuthState,
    markDisconnected,
    formatRelativeTime,
    hasSyncIssue,
} from '../stores/syncStore.ts';
import './SyncSettings.css';

function SyncSettings() {
    const [showPanel, setShowPanel] = createSignal(false);

    onMount(async () => {
        refreshAuthState();
        await loadSyncMetaIntoStore();
    });

    function openPanel() {
        refreshAuthState();
        void loadSyncMetaIntoStore();
        setShowPanel(true);
    }

    async function handleSync() {
        const outcome = await sync();
        if (outcome.dataChanged) {
            invalidateTasks({ push: false });
            invalidateGenerators({ push: false });
        }
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
        if (conn === 'needs_reauth') return 'sync-panel__status--error';
        if (lastResult() === 'error') return 'sync-panel__status--error';
        if (pendingPush() || operation() !== 'idle') return 'sync-panel__status--pending';
        if (conn === 'connected') return 'sync-panel__status--ok';
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
        if (operation() === 'syncing') return 'Syncing with Dropbox…';
        if (operation() === 'pushing') return 'Uploading local changes…';
        if (pendingPush()) return 'Changes waiting to upload…';
        return null;
    }

    function resultLabel(): string | null {
        if (operation() !== 'idle') return null;
        return lastMessage();
    }

    const isConnected = () => connection() === 'connected' || connection() === 'needs_reauth';

    return (
        <>
            <button
                class="sync-trigger"
                classList={{ 'sync-trigger--attention': hasSyncIssue() }}
                onClick={openPanel}
                aria-label="Sync settings"
            >
                <svg viewBox="0 0 20 20" width="20" height="20" fill="none">
                    <path
                        d="M14 3l3 3-3 3M6 17l-3-3 3-3M17 6H7M3 14h10"
                        stroke="currentColor"
                        stroke-width="1.5"
                        stroke-linecap="round"
                        stroke-linejoin="round"
                    />
                </svg>
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
            <Show when={showPanel()}>
                <div class="sync-overlay" onClick={() => setShowPanel(false)}>
                    <div class="sync-panel" onClick={(e) => e.stopPropagation()}>
                        <div class="sync-panel__header">
                            <h2 class="sync-panel__title">Dropbox Sync</h2>
                            <button class="sync-panel__close" onClick={() => setShowPanel(false)} aria-label="Close">
                                &times;
                            </button>
                        </div>

                        <div class="sync-panel__info">
                            <p class={`sync-panel__status ${statusClass()}`}>{connectionLabel()}</p>
                            <Show when={isConnected()}>
                                <p class="sync-panel__meta">Last synced: {formatRelativeTime(lastSyncedAt())}</p>
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
                                    <p class="sync-panel__text">
                                        Connect to Dropbox to sync tasks across your devices.
                                    </p>
                                    <button class="sync-panel__btn-primary" onClick={handleConnect}>
                                        Connect to Dropbox
                                    </button>
                                </div>
                            }
                        >
                            <div class="sync-panel__connected">
                                <div class="sync-panel__actions">
                                    <button
                                        class="sync-panel__btn-primary"
                                        onClick={handleSync}
                                        disabled={operation() !== 'idle'}
                                    >
                                        {operation() === 'syncing' ? 'Syncing…' : 'Sync Now'}
                                    </button>
                                    <Show
                                        when={connection() === 'needs_reauth'}
                                        fallback={
                                            <button class="sync-panel__btn-danger" onClick={handleDisconnect}>
                                                Disconnect
                                            </button>
                                        }
                                    >
                                        <button class="sync-panel__btn-primary" onClick={handleConnect}>
                                            Reconnect
                                        </button>
                                    </Show>
                                </div>
                                <Show when={connection() === 'connected'}>
                                    <button class="sync-panel__btn-text" onClick={handleDisconnect}>
                                        Disconnect
                                    </button>
                                </Show>
                            </div>
                        </Show>
                    </div>
                </div>
            </Show>
        </>
    );
}

export { SyncSettings };
