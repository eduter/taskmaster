import type { JSX } from 'solid-js';
import type { Task } from '../db/types.ts';
import { TaskCard } from './TaskCard.tsx';
import { TaskLikeSortableList } from './TaskLikeSortableList.tsx';
import { TaskRow } from './TaskRow.tsx';

/** Props for the shared persisted-task list used by Today and Calendar. */
interface TaskRowsProps {
    items: Task[];
    onReorder: (orderedIds: string[]) => void | Promise<void>;
    onOpen: (taskId: string, source?: HTMLElement) => void;
    labelsVisible?: boolean;
    celebrateCompletion?: boolean;
    /** Task whose detail dialog is open; its row is hidden so the card appears to become the dialog. */
    openTaskId?: string;
}

/** Renders persisted tasks with the app's shared open, check, delete, and reorder gestures. */
function TaskRows(props: TaskRowsProps): JSX.Element {
    return (
        <TaskLikeSortableList<Task>
            items={props.items}
            onReorder={props.onReorder}
            renderRow={(task, row) => (
                <TaskRow
                    task={task}
                    deleteRevealed={row.deleteRevealed}
                    hidden={task.id === props.openTaskId}
                    onRevealChange={row.onRevealChange}
                    onRowTouchStart={row.onRowTouchStart}
                    onOpen={props.onOpen}
                    labelsVisible={props.labelsVisible}
                    celebrateCompletion={props.celebrateCompletion}
                />
            )}
            renderOverlay={(task) => <TaskCard task={task} labelsVisible={props.labelsVisible} />}
        />
    );
}

export type { TaskRowsProps };
export { TaskRows };
