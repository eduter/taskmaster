import { createSignal } from 'solid-js';
import { addTask } from '../stores/taskStore.ts';
import './AddTask.css';

interface AddTaskProps {
    date?: string;
    onAdded?: () => void;
}

/** Adds a concrete task to today or an explicitly supplied logical date. */
function AddTask(props: AddTaskProps) {
    const [value, setValue] = createSignal('');

    async function handleSubmit(e: SubmitEvent) {
        e.preventDefault();
        const summary = value().trim();
        if (!summary) {
            return;
        }
        await addTask(summary, props.date);
        setValue('');
        props.onAdded?.();
    }

    return (
        <form class="add-task" onSubmit={handleSubmit}>
            <input
                class="form-input add-task__input"
                type="text"
                placeholder="Add a task…"
                value={value()}
                onInput={(e) => setValue(e.currentTarget.value)}
            />
            <button class="btn btn--primary" type="submit" disabled={!value().trim()}>
                Add
            </button>
        </form>
    );
}

export type { AddTaskProps };
export { AddTask };
