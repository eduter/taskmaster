import { Navigate } from '@solidjs/router';
import { onMount, type JSX } from 'solid-js';
import { AddTask } from './components/AddTask.tsx';
import { AppTabs } from './components/AppTabs.tsx';
import { GeneratorEditorModal } from './components/GeneratorEditorModal.tsx';
import { GeneratorsTab } from './components/GeneratorsTab.tsx';
import { InstallPrompt } from './components/InstallPrompt.tsx';
import { OfflineIndicator } from './components/OfflineIndicator.tsx';
import { SyncSettings } from './components/SyncSettings.tsx';
import { SyncStatusBar } from './components/SyncStatusBar.tsx';
import { TaskDetail } from './components/TaskDetail.tsx';
import { TaskList } from './components/TaskList.tsx';
import { runGenerators } from './scheduling/generate.ts';
import { invalidateGenerators } from './stores/generatorStore.ts';
import { markConnected, refreshAuthState } from './stores/syncStore.ts';
import { invalidateTasks } from './stores/taskStore.ts';
import { handleAuthRedirect } from './sync/dropboxAuth.ts';
import { loadSyncMetaIntoStore, pushToDropbox, sync } from './sync/syncEngine.ts';
import './App.css';

interface AppProps {
    children?: JSX.Element;
}

function App(props: AppProps) {
    onMount(async () => {
        const authed = await handleAuthRedirect();
        if (authed) {
            markConnected();
        }
        refreshAuthState();
        await loadSyncMetaIntoStore();

        const outcome = await sync();
        if (!outcome.ok) {
            return;
        }
        if (outcome.dataChanged) {
            invalidateTasks({ push: false });
            invalidateGenerators({ push: false });
        }

        const created = await runGenerators();
        if (created > 0) {
            invalidateTasks({ push: false });
            await pushToDropbox();
        }
    });

    return (
        <div class="app">
            <header class="app-header">
                <AppTabs />
                <SyncSettings />
            </header>
            <main class="app-main">{props.children}</main>
            <SyncStatusBar />
            <OfflineIndicator />
            <InstallPrompt />
        </div>
    );
}

function RedirectToTasks() {
    return <Navigate href="/tasks" />;
}

function TasksSection() {
    return (
        <>
            <AddTask />
            <TaskList />
            <TaskDetail />
        </>
    );
}

function CalendarSection() {
    return <p class="app-placeholder">Not implemented yet.</p>;
}

function GeneratorsSection() {
    return (
        <>
            <GeneratorsTab />
            <GeneratorEditorModal />
        </>
    );
}

export { App, CalendarSection, GeneratorsSection, RedirectToTasks, TasksSection };
