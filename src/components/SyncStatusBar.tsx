import { Show } from 'solid-js';
import { useAppNavigate } from '../routing/navigation.ts';
import { connection, hasSyncIssue, lastMessage } from '../stores/syncStore.ts';
import './SyncStatusBar.css';

function SyncStatusBar() {
    const { openSyncPanel } = useAppNavigate();
    const showBar = () => connection() === 'needs_reauth' || (hasSyncIssue() && !!lastMessage());

    const barMessage = () => {
        if (connection() === 'needs_reauth') {
            return lastMessage() ?? 'Dropbox session expired — tap sync to reconnect';
        }
        return lastMessage();
    };

    return (
        <Show when={showBar()}>
            <button
                type="button"
                class="sync-status-bar"
                classList={{ 'sync-status-bar--error': hasSyncIssue() }}
                onClick={openSyncPanel}
            >
                {barMessage()}
            </button>
        </Show>
    );
}

export { SyncStatusBar };
