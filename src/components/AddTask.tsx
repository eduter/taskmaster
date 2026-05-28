import { createSignal } from 'solid-js';
import { addTask } from '../stores/taskStore.ts';
import './AddTask.css';

function AddTask() {
    const [value, setValue] = createSignal('');

    async function handleSubmit(e: SubmitEvent) {
        e.preventDefault();
        const summary = value().trim();
        if (!summary) return;
        await addTask(summary);
        setValue('');
    }

    return (
        <form class="add-task" onSubmit={handleSubmit}>
            <input
                class="add-task__input"
                type="text"
                placeholder="Add a task…"
                value={value()}
                onInput={(e) => setValue(e.currentTarget.value)}
            />
            <button class="add-task__btn" type="submit" disabled={!value().trim()}>
                Add
            </button>
        </form>
    );
}

export { AddTask };
