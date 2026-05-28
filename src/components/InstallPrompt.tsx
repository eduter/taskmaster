import { createSignal, onMount, Show } from 'solid-js';
import './InstallPrompt.css';

interface BeforeInstallPromptEvent extends Event {
    prompt(): Promise<void>;
    userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

function InstallPrompt() {
    const [deferredPrompt, setDeferredPrompt] = createSignal<BeforeInstallPromptEvent | null>(null);
    const [dismissed, setDismissed] = createSignal(false);

    onMount(() => {
        window.addEventListener('beforeinstallprompt', (e) => {
            e.preventDefault();
            setDeferredPrompt(e as BeforeInstallPromptEvent);
        });
    });

    async function handleInstall() {
        const prompt = deferredPrompt();
        if (!prompt) {
            return;
        }
        await prompt.prompt();
        const { outcome } = await prompt.userChoice;
        if (outcome === 'accepted') {
            setDeferredPrompt(null);
        }
    }

    function handleDismiss() {
        setDismissed(true);
    }

    return (
        <Show when={deferredPrompt() && !dismissed()}>
            <div class="install-banner">
                <span class="install-banner__text">Install TaskMaster for offline use</span>
                <div class="install-banner__actions">
                    <button type="button" class="install-banner__btn" onClick={handleInstall}>
                        Install
                    </button>
                    <button type="button" class="install-banner__dismiss" onClick={handleDismiss}>
                        &times;
                    </button>
                </div>
            </div>
        </Show>
    );
}

export { InstallPrompt };
