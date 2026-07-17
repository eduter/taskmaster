import type { JSX } from 'solid-js';
import type { Task } from '../db/types.ts';
import { useAppNavigate } from '../routing/navigation.ts';
import { removeTask, tasks, toggleComplete } from '../stores/taskStore.ts';
import { fireConfetti, shouldCelebrateLastTask, type ConfettiOrigin } from '../utils/confetti.ts';
import { GestureRow } from './GestureRow.tsx';
import { TaskCard } from './TaskCard.tsx';

interface TaskRowProps {
    task: Task;
    deleteRevealed: boolean;
    onRevealChange: (taskId: string, open: boolean) => void;
    onRowTouchStart?: (taskId: string) => void;
    onDragEnd?: () => void;
}

function TaskRow(props: TaskRowProps): JSX.Element {
    const { toTask } = useAppNavigate();
    let checkEl: HTMLButtonElement | undefined;

    function openTaskDetail() {
        toTask(props.task.id);
    }

    function checkOrigin(): ConfettiOrigin | undefined {
        if (!checkEl) {
            return undefined;
        }
        const rect = checkEl.getBoundingClientRect();
        return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
    }

    async function toggleAndMaybeCelebrate(): Promise<void> {
        const celebrate = shouldCelebrateLastTask(tasks() ?? [], props.task.id);
        const origin = checkOrigin();
        const completed = await toggleComplete(props.task.id);
        if (completed && celebrate) {
            fireConfetti(origin);
        }
    }

    function completeTask() {
        void toggleAndMaybeCelebrate();
    }

    function handleCheckClick(event: MouseEvent) {
        event.stopPropagation();
        void toggleAndMaybeCelebrate();
    }

    function deleteTask() {
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
                        onCheckClick={handleCheckClick}
                        checkRef={(el) => {
                            checkEl = el;
                        }}
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
