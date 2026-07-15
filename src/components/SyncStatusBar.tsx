import { Show } from 'solid-js';
import { useAppNavigate } from '../routing/navigation.ts';
import { connection, hasSyncFailure, isSyncNotConfigured, lastMessage, lastResult } from '../stores/syncStore.ts';
import './SyncStatusBar.css';

function SyncStatusBar() {
    const { openSyncPanel } = useAppNavigate();
    const showBar = () =>
        connection() === 'needs_reauth' || isSyncNotConfigured() || (lastResult() === 'error' && !!lastMessage());

    const barMessage = () => {
        if (connection() === 'needs_reauth') {
            return lastMessage() ?? 'Dropbox session expired — tap sync to reconnect';
        }
        if (isSyncNotConfigured()) {
            return 'Not connected to Dropbox — tap to set up sync';
        }
        return lastMessage();
    };

    return (
        <Show when={showBar()}>
            <button
                type="button"
                class="sync-status-bar"
                classList={{
                    'sync-status-bar--error': hasSyncFailure(),
                    'sync-status-bar--warning': isSyncNotConfigured(),
                }}
                onClick={openSyncPanel}
            >
                {barMessage()}
            </button>
        </Show>
    );
}

export { SyncStatusBar };
