import type { JSX } from 'solid-js';
import './TaskDetailActions.css';

/** Props for shared task-like detail save and delete actions. */
interface TaskDetailActionsProps {
    onSave: () => void | Promise<void>;
    onDelete: () => void | Promise<void>;
}

/** Shared save/delete footer for task-like detail dialogs. */
function TaskDetailActions(props: TaskDetailActionsProps): JSX.Element {
    function save() {
        void props.onSave();
    }

    function deleteItem() {
        void props.onDelete();
    }

    return (
        <div class="task-detail-actions">
            <button type="button" class="btn btn--primary btn--grow" onClick={save}>
                Save
            </button>
            <button type="button" class="btn btn--danger" onClick={deleteItem}>
                Delete
            </button>
        </div>
    );
}

export type { TaskDetailActionsProps };
export { TaskDetailActions };
