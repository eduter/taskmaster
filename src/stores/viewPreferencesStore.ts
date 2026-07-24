import { createSignal } from 'solid-js';

const SHOW_TASK_LABELS_KEY = 'taskmaster.showTaskLabels';
const CALENDAR_VIEW_KEY = 'taskmaster.calendarView';
const CALENDAR_FILTER_KEY = 'taskmaster.calendarFilter';

const [showTaskLabels, setShowTaskLabelsSignal] = createSignal(loadShowTaskLabels());
const [calendarView, setCalendarViewSignal] = createSignal<CalendarView>(loadCalendarView());
const [calendarFilter, setCalendarFilterSignal] = createSignal<CalendarFilter>(loadCalendarFilter());

type CalendarView = 'month' | 'week';
type CalendarFilter = 'all' | 'scheduled' | 'projected';

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

function loadCalendarView(): CalendarView {
    if (typeof localStorage === 'undefined') {
        return 'month';
    }
    return localStorage.getItem(CALENDAR_VIEW_KEY) === 'week' ? 'week' : 'month';
}

function loadCalendarFilter(): CalendarFilter {
    if (typeof localStorage === 'undefined') {
        return 'all';
    }
    const stored = localStorage.getItem(CALENDAR_FILTER_KEY);
    return stored === 'scheduled' || stored === 'projected' ? stored : 'all';
}

function setCalendarView(view: CalendarView): void {
    setCalendarViewSignal(view);
    persistPreference(CALENDAR_VIEW_KEY, view);
}

function setCalendarFilter(filter: CalendarFilter): void {
    setCalendarFilterSignal(filter);
    persistPreference(CALENDAR_FILTER_KEY, filter);
}

function persistPreference(key: string, value: string): void {
    if (typeof localStorage === 'undefined') {
        return;
    }
    try {
        localStorage.setItem(key, value);
    } catch {
        // The in-memory signal still updates when browser storage is unavailable.
    }
}

export {
    calendarFilter,
    calendarView,
    setCalendarFilter,
    setCalendarView,
    setTaskLabelsVisible,
    showTaskLabels,
    toggleTaskLabels,
};
export type { CalendarFilter, CalendarView };
