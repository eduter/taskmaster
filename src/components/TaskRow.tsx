import type { JSX } from 'solid-js';
import type { Task } from '../db/types.ts';
import { removeTask, tasks, toggleComplete } from '../stores/taskStore.ts';
import { fireConfetti, shouldCelebrateLastTask, todayTabConfettiOrigin } from '../utils/confetti.ts';
import { GestureRow } from './GestureRow.tsx';
import { TaskCard } from './TaskCard.tsx';

interface TaskRowProps {
    task: Task;
    deleteRevealed: boolean;
    onRevealChange: (taskId: string, open: boolean) => void;
    onRowTouchStart?: (taskId: string) => void;
    onDragEnd?: () => void;
    onOpen: (taskId: string) => void;
    labelsVisible?: boolean;
    celebrateCompletion?: boolean;
}

function TaskRow(props: TaskRowProps): JSX.Element {
    function openTaskDetail(): void {
        props.onOpen(props.task.id);
    }

    async function toggleAndMaybeCelebrate(): Promise<void> {
        const celebrate = (props.celebrateCompletion ?? true) && shouldCelebrateLastTask(tasks() ?? [], props.task.id);
        const origin = todayTabConfettiOrigin();
        const completed = await toggleComplete(props.task.id);
        if (completed && celebrate) {
            fireConfetti(origin);
        }
    }

    function completeTask(): void {
        void toggleAndMaybeCelebrate();
    }

    function handleCheckClick(event: MouseEvent): void {
        event.stopPropagation();
        void toggleAndMaybeCelebrate();
    }

    function deleteTask(): void {
        void removeTask(props.task.id);
    }

    return (
        <GestureRow
            id={props.task.id}
            deleteRevealed={props.deleteRevealed}
            deleteLabel="Delete task"
            completed={props.task.completed}
            allowCheckSwipe={!props.task.completed}
            onRevealChange={props.onRevealChange}
            onRowTouchStart={props.onRowTouchStart}
            onDragEnd={props.onDragEnd}
            onOpen={openTaskDetail}
            onDelete={deleteTask}
            onComplete={completeTask}
            renderContent={(state) => (
                <>
                    <TaskCard
                        task={props.task}
                        visualCompleted={state.visualCompleted}
                        labelsVisible={props.labelsVisible}
                        onCheckClick={handleCheckClick}
                    />
                    {state.showStrike && (
                        <div class="task-row__strike" style={{ width: state.strikeWidth }} aria-hidden="true" />
                    )}
                </>
            )}
        />
    );
}

export type { TaskRowProps };
export { TaskRow };
