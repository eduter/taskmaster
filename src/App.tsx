import { onMount } from "solid-js";
import { today, invalidateTasks } from "./stores/taskStore.ts";
import { setShowGeneratorList, invalidateGenerators } from "./stores/generatorStore.ts";
import { runGenerators } from "./scheduling/generate.ts";
import { handleAuthRedirect } from "./sync/dropboxAuth.ts";
import { sync } from "./sync/syncEngine.ts";
import { AddTask } from "./components/AddTask.tsx";
import { TaskList } from "./components/TaskList.tsx";
import { TaskDetail } from "./components/TaskDetail.tsx";
import { GeneratorList } from "./components/GeneratorList.tsx";
import { SyncSettings } from "./components/SyncSettings.tsx";
import { OfflineIndicator } from "./components/OfflineIndicator.tsx";
import { InstallPrompt } from "./components/InstallPrompt.tsx";
import "./App.css";

function App() {
  onMount(async () => {
    await handleAuthRedirect();
    const pulled = await sync();
    if (pulled) {
      invalidateTasks();
      invalidateGenerators();
    }

    const created = await runGenerators();
    if (created > 0) {
      invalidateTasks();
      await sync();
    }
  });

  return (
    <div class="app">
      <header class="app-header">
        <h1>TaskMaster</h1>
        <span class="app-date">{today()}</span>
        <SyncSettings />
        <button class="app-generators-btn" onClick={() => setShowGeneratorList(true)} aria-label="Generators">
          <svg viewBox="0 0 20 20" width="20" height="20" fill="none">
            <path d="M10 3v14M3 10h14" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
          </svg>
        </button>
      </header>
      <AddTask />
      <TaskList />
      <TaskDetail />
      <GeneratorList />
      <OfflineIndicator />
      <InstallPrompt />
    </div>
  );
}

export { App };
