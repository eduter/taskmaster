import { createMemo, createSignal, createUniqueId, For, onCleanup, onMount, Show } from 'solid-js';
import type { Task } from '../db/types.ts';
import { addTask, copyPreviousTask, filterTaskCandidates, loadCompletedTaskCandidates } from '../stores/taskStore.ts';
import './AddTask.css';

const MIN_SUGGESTION_QUERY_LENGTH = 2;

interface AddTaskProps {
    date?: string;
    onAdded?: () => void;
}

/** Adds a concrete task to today or an explicitly supplied logical date. */
function AddTask(props: AddTaskProps) {
    const [value, setValue] = createSignal('');
    const [candidates, setCandidates] = createSignal<Task[]>([]);
    const [suggestionsOpen, setSuggestionsOpen] = createSignal(false);
    const [activeIndex, setActiveIndex] = createSignal(-1);
    const [pending, setPending] = createSignal(false);
    const listboxId = createUniqueId();
    let formRef: HTMLFormElement | undefined;
    let loadVersion = 0;

    const matches = createMemo(() => {
        if (value().trim().length < MIN_SUGGESTION_QUERY_LENGTH) {
            return [];
        }
        return filterTaskCandidates(candidates(), value());
    });
    const suggestionsVisible = () => suggestionsOpen() && matches().length > 0;

    onMount(() => {
        const closeOnOutsidePointer = (event: PointerEvent) => {
            if (!formRef?.contains(event.target as Node)) {
                closeSuggestions();
            }
        };
        document.addEventListener('pointerdown', closeOnOutsidePointer);
        onCleanup(() => document.removeEventListener('pointerdown', closeOnOutsidePointer));
    });

    async function handleSubmit(e: SubmitEvent) {
        e.preventDefault();
        const summary = value().trim();
        if (!summary || pending()) {
            return;
        }

        setPending(true);
        try {
            await addTask(summary, props.date);
            finishAdding();
        } finally {
            setPending(false);
        }
    }

    async function loadCandidates(): Promise<void> {
        const version = ++loadVersion;
        try {
            const loaded = await loadCompletedTaskCandidates();
            if (version === loadVersion) {
                setCandidates(loaded);
            }
        } catch (error: unknown) {
            // Suggestions are optional; task creation must remain available if history cannot be read.
            console.error('Failed to load previous task suggestions:', error);
        }
    }

    async function selectSuggestion(task: Task): Promise<void> {
        if (pending()) {
            return;
        }

        setPending(true);
        try {
            await copyPreviousTask(task, props.date);
            finishAdding();
        } finally {
            setPending(false);
        }
    }

    function finishAdding(): void {
        setValue('');
        closeSuggestions();
        props.onAdded?.();
    }

    function closeSuggestions(): void {
        setSuggestionsOpen(false);
        setActiveIndex(-1);
    }

    function handleInput(nextValue: string): void {
        setValue(nextValue);
        setSuggestionsOpen(true);
        setActiveIndex(-1);
    }

    function handleInputFocus(): void {
        setSuggestionsOpen(true);
        setActiveIndex(-1);
        void loadCandidates();
    }

    function handleInputKeyDown(event: KeyboardEvent): void {
        if (event.key === 'Escape') {
            closeSuggestions();
            return;
        }
        if (event.key === 'Tab') {
            closeSuggestions();
            return;
        }
        if (!suggestionsVisible()) {
            return;
        }

        if (event.key === 'ArrowDown') {
            event.preventDefault();
            setActiveIndex((index) => (index + 1) % matches().length);
            return;
        }
        if (event.key === 'ArrowUp') {
            event.preventDefault();
            setActiveIndex((index) => (index <= 0 ? matches().length - 1 : index - 1));
            return;
        }
        if (event.key === 'Enter' && activeIndex() >= 0) {
            event.preventDefault();
            const selected = matches()[activeIndex()];
            if (selected) {
                void selectSuggestion(selected);
            }
        }
    }

    return (
        <form ref={formRef} class="add-task" onSubmit={handleSubmit}>
            <div class="add-task__input-wrap">
                <input
                    class="form-input add-task__input"
                    type="text"
                    role="combobox"
                    aria-autocomplete="list"
                    aria-expanded={suggestionsVisible()}
                    aria-controls={listboxId}
                    aria-activedescendant={activeIndex() >= 0 ? `${listboxId}-option-${activeIndex()}` : undefined}
                    placeholder="Add a task…"
                    value={value()}
                    onInput={(event) => handleInput(event.currentTarget.value)}
                    onFocus={handleInputFocus}
                    onKeyDown={handleInputKeyDown}
                />
                <Show when={suggestionsVisible()}>
                    <div id={listboxId} class="add-task__suggestions" role="listbox" aria-label="Previous tasks">
                        <For each={matches()}>
                            {(task, index) => (
                                <button
                                    id={`${listboxId}-option-${index()}`}
                                    class="add-task__suggestion"
                                    classList={{ 'add-task__suggestion--active': activeIndex() === index() }}
                                    type="button"
                                    role="option"
                                    aria-selected={activeIndex() === index()}
                                    tabIndex={-1}
                                    onPointerDown={(event) => event.preventDefault()}
                                    onPointerEnter={() => setActiveIndex(index())}
                                    onClick={() => void selectSuggestion(task)}
                                >
                                    {task.summary.trim()}
                                </button>
                            )}
                        </For>
                    </div>
                </Show>
            </div>
            <button class="btn btn--primary" type="submit" disabled={!value().trim() || pending()}>
                Add
            </button>
        </form>
    );
}

export type { AddTaskProps };
export { AddTask };
