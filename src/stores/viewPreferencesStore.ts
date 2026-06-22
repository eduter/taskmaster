import { createSignal } from 'solid-js';

const SHOW_TASK_LABELS_KEY = 'taskmaster.showTaskLabels';

const [showTaskLabels, setShowTaskLabelsSignal] = createSignal(loadShowTaskLabels());

function loadShowTaskLabels(): boolean {
    if (typeof localStorage === 'undefined') {
        return false;
    }

    return localStorage.getItem(SHOW_TASK_LABELS_KEY) === 'true';
}

function setTaskLabelsVisible(visible: boolean): void {
    setShowTaskLabelsSignal(visible);

    if (typeof localStorage === 'undefined') {
        return;
    }

    try {
        localStorage.setItem(SHOW_TASK_LABELS_KEY, String(visible));
    } catch {
        // The in-memory signal still updates when browser storage is unavailable.
    }
}

function toggleTaskLabels(): void {
    setTaskLabelsVisible(!showTaskLabels());
}

export { setTaskLabelsVisible, showTaskLabels, toggleTaskLabels };
