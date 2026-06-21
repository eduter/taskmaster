import type { JSX } from 'solid-js';
import type { Task } from '../db/types.ts';
import { useAppNavigate } from '../routing/navigation.ts';
import { removeTask, toggleComplete } from '../stores/taskStore.ts';
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

    function openTaskDetail() {
        toTask(props.task.id);
    }

    function completeTask() {
        void toggleComplete(props.task.id);
    }

    function handleCheckClick(event: MouseEvent) {
        event.stopPropagation();
        void toggleComplete(props.task.id);
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
