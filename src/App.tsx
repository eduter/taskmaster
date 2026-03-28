import { today } from "./stores/taskStore.ts";
import { AddTask } from "./components/AddTask.tsx";
import { TaskList } from "./components/TaskList.tsx";
import { TaskDetail } from "./components/TaskDetail.tsx";
import "./App.css";

function App() {
  return (
    <div class="app">
      <header class="app-header">
        <h1>TaskMaster</h1>
        <span class="app-date">{today()}</span>
      </header>
      <AddTask />
      <TaskList />
      <TaskDetail />
    </div>
  );
}

export { App };
