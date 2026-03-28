import { createMemo } from "solid-js";
import type { Task } from "../db/types.ts";
import { toggleComplete, setSelectedTaskId, today } from "../stores/taskStore.ts";
import "./TaskCard.css";

interface TaskCardProps {
  task: Task;
}

function TaskCard(props: TaskCardProps) {
  const isCarriedOver = createMemo(() => props.task.date < today());

  return (
    <div
      class="task-card"
      classList={{ "task-card--completed": props.task.completed, "task-card--carried": isCarriedOver() }}
      onClick={() => setSelectedTaskId(props.task.id)}
    >
      <button
        class="task-card__check"
        classList={{ "task-card__check--done": props.task.completed }}
        onClick={(e) => {
          e.stopPropagation();
          toggleComplete(props.task.id);
        }}
        aria-label={props.task.completed ? "Mark incomplete" : "Mark complete"}
      >
        {props.task.completed && (
          <svg viewBox="0 0 16 16" fill="none" width="14" height="14">
            <path d="M3 8.5l3.5 3.5 6.5-7" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
          </svg>
        )}
      </button>
      <div class="task-card__content">
        <span class="task-card__summary">{props.task.summary}</span>
        {props.task.labels.length > 0 && (
          <div class="task-card__labels">
            {props.task.labels.map((label) => (
              <span class="task-card__label">{label}</span>
            ))}
          </div>
        )}
      </div>
      {isCarriedOver() && <span class="task-card__carried-badge">carried</span>}
    </div>
  );
}

export { TaskCard };
export type { TaskCardProps };
