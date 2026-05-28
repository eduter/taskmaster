import { createSignal, onCleanup, onMount, Show } from 'solid-js';
import './OfflineIndicator.css';

function OfflineIndicator() {
    const [offline, setOffline] = createSignal(!navigator.onLine);

    function handleOnline() {
        setOffline(false);
    }
    function handleOffline() {
        setOffline(true);
    }

    onMount(() => {
        window.addEventListener('online', handleOnline);
        window.addEventListener('offline', handleOffline);
    });

    onCleanup(() => {
        window.removeEventListener('online', handleOnline);
        window.removeEventListener('offline', handleOffline);
    });

    return (
        <Show when={offline()}>
            <div class="offline-bar">Offline — changes saved locally</div>
        </Show>
    );
}

export { OfflineIndicator };
