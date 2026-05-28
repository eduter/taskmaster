import { onMount } from 'solid-js';
import { AddTask } from './components/AddTask.tsx';
import { GeneratorList } from './components/GeneratorList.tsx';
import { InstallPrompt } from './components/InstallPrompt.tsx';
import { OfflineIndicator } from './components/OfflineIndicator.tsx';
import { SyncSettings } from './components/SyncSettings.tsx';
import { SyncStatusBar } from './components/SyncStatusBar.tsx';
import { TaskDetail } from './components/TaskDetail.tsx';
import { TaskList } from './components/TaskList.tsx';
import { runGenerators } from './scheduling/generate.ts';
import { invalidateGenerators, setShowGeneratorList } from './stores/generatorStore.ts';
import { markConnected, refreshAuthState } from './stores/syncStore.ts';
import { invalidateTasks, today } from './stores/taskStore.ts';
import { handleAuthRedirect } from './sync/dropboxAuth.ts';
import { loadSyncMetaIntoStore, markLocalChange, pushToDropbox, sync } from './sync/syncEngine.ts';
import './App.css';

function App() {
    onMount(async () => {
        const authed = await handleAuthRedirect();
        if (authed) {
            markConnected();
        }
        refreshAuthState();
        await loadSyncMetaIntoStore();

        const outcome = await sync();
        if (outcome.dataChanged) {
            invalidateTasks({ push: false });
            invalidateGenerators({ push: false });
        }

        const created = await runGenerators();
        if (created > 0) {
            await markLocalChange();
            invalidateTasks({ push: false });
            await pushToDropbox();
        }
    });

    return (
        <div class="app">
            <header class="app-header">
                <h1>TaskMaster</h1>
                <span class="app-date">{today()}</span>
                <SyncSettings />
                <button
                    type="button"
                    class="app-generators-btn"
                    onClick={() => setShowGeneratorList(true)}
                    aria-label="Generators"
                >
                    <svg viewBox="0 0 20 20" width="20" height="20" fill="none" aria-hidden="true">
                        <path d="M10 3v14M3 10h14" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
                    </svg>
                </button>
            </header>
            <AddTask />
            <TaskList />
            <TaskDetail />
            <GeneratorList />
            <SyncStatusBar />
            <OfflineIndicator />
            <InstallPrompt />
        </div>
    );
}

export { App };
