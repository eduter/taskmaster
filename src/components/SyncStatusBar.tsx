import { Show } from 'solid-js';
import { connection, lastMessage, hasSyncIssue } from '../stores/syncStore.ts';
import './SyncStatusBar.css';

function SyncStatusBar() {
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
                onClick={() => document.querySelector<HTMLButtonElement>('.sync-trigger')?.click()}
            >
                {barMessage()}
            </button>
        </Show>
    );
}

export { SyncStatusBar };
