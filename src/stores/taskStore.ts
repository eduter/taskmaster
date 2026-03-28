import { createSignal, createResource } from "solid-js";
import { getVisibleTasks, createTask, updateTask, deleteTask, toggleTaskCompleted, reorderTasks } from "../db/tasks.ts";
import { getLogicalDay } from "../utils/logicalDay.ts";
import { schedulePush } from "../sync/syncEngine.ts";
import type { Task } from "../db/types.ts";

const [today] = createSignal(getLogicalDay());
const [taskVersion, setTaskVersion] = createSignal(0);

function invalidateTasks() {
  setTaskVersion((v) => v + 1);
  schedulePush();
}

async function fetchTasks(): Promise<Task[]> {
  taskVersion();
  return getVisibleTasks(today());
}

const [tasks, { refetch: refetchTasks }] = createResource(taskVersion, fetchTasks);

const [selectedTaskId, setSelectedTaskId] = createSignal<string | null>(null);

async function addTask(summary: string): Promise<Task> {
  const task = await createTask({ summary, date: today() });
  invalidateTasks();
  return task;
}

async function editTask(id: string, changes: Partial<Omit<Task, "id" | "createdAt">>): Promise<void> {
  await updateTask(id, changes);
  invalidateTasks();
}

async function removeTask(id: string): Promise<void> {
  await deleteTask(id);
  if (selectedTaskId() === id) setSelectedTaskId(null);
  invalidateTasks();
}

async function toggleComplete(id: string): Promise<void> {
  await toggleTaskCompleted(id);
  invalidateTasks();
}

async function reorder(orderedIds: string[]): Promise<void> {
  await reorderTasks(orderedIds);
  invalidateTasks();
}

export {
  today,
  tasks,
  refetchTasks,
  selectedTaskId,
  setSelectedTaskId,
  addTask,
  editTask,
  removeTask,
  toggleComplete,
  reorder,
  invalidateTasks,
};
