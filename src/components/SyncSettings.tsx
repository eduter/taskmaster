import { createSignal, Show } from "solid-js";
import {
  isAuthenticated,
  startAuthFlow,
  clearTokens,
} from "../sync/dropboxAuth.ts";
import { sync } from "../sync/syncEngine.ts";
import { invalidateTasks } from "../stores/taskStore.ts";
import { invalidateGenerators } from "../stores/generatorStore.ts";
import "./SyncSettings.css";

function SyncSettings() {
  const [showPanel, setShowPanel] = createSignal(false);
  const [syncing, setSyncing] = createSignal(false);
  const [authed, setAuthed] = createSignal(isAuthenticated());

  async function handleSync() {
    setSyncing(true);
    try {
      const pulled = await sync();
      if (pulled) {
        invalidateTasks();
        invalidateGenerators();
      }
    } finally {
      setSyncing(false);
    }
  }

  async function handleConnect() {
    const url = await startAuthFlow();
    window.location.href = url;
  }

  function handleDisconnect() {
    clearTokens();
    setAuthed(false);
  }

  return (
    <>
      <button class="sync-trigger" onClick={() => setShowPanel(true)} aria-label="Sync settings">
        <svg viewBox="0 0 20 20" width="20" height="20" fill="none">
          <path d="M14 3l3 3-3 3M6 17l-3-3 3-3M17 6H7M3 14h10" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" />
        </svg>
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

            <Show
              when={authed()}
              fallback={
                <div class="sync-panel__connect">
                  <p class="sync-panel__text">
                    Connect to Dropbox to enable sync.
                  </p>
                  <button class="sync-panel__btn-primary" onClick={handleConnect}>
                    Connect to Dropbox
                  </button>
                </div>
              }
            >
              <div class="sync-panel__connected">
                <p class="sync-panel__status">Connected to Dropbox</p>
                <div class="sync-panel__actions">
                  <button
                    class="sync-panel__btn-primary"
                    onClick={handleSync}
                    disabled={syncing()}
                  >
                    {syncing() ? "Syncing…" : "Sync Now"}
                  </button>
                  <button class="sync-panel__btn-danger" onClick={handleDisconnect}>
                    Disconnect
                  </button>
                </div>
              </div>
            </Show>
          </div>
        </div>
      </Show>
    </>
  );
}

export { SyncSettings };
