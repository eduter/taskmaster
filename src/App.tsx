import { Navigate } from '@solidjs/router';
import { onMount, type JSX } from 'solid-js';
import { onAppResume, setupResumeListeners } from './app/resume.ts';
import { AddTask } from './components/AddTask.tsx';
import { AppTabs } from './components/AppTabs.tsx';
import { GeneratorEditorModal } from './components/GeneratorEditorModal.tsx';
import { GeneratorsTab } from './components/GeneratorsTab.tsx';
import { InstallPrompt } from './components/InstallPrompt.tsx';
import { OfflineIndicator } from './components/OfflineIndicator.tsx';
import { SyncSettings } from './components/SyncSettings.tsx';
import { SyncStatusBar } from './components/SyncStatusBar.tsx';
import { TaskDetail } from './components/TaskDetail.tsx';
import { TaskLabelToggle } from './components/TaskLabelToggle.tsx';
import { LabelsPicker } from './components/labels';
import { TaskList } from './components/TaskList.tsx';
import { markConnected, refreshAuthState } from './stores/syncStore.ts';
import { handleAuthRedirect } from './sync/dropboxAuth.ts';
import { loadSyncMetaIntoStore } from './sync/syncEngine.ts';
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
        setupResumeListeners();
        await onAppResume();
    });

    return (
        <div class="app">
            <header class="app-header">
                <AppTabs />
                <TaskLabelToggle />
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
            <LabelsPicker />
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
