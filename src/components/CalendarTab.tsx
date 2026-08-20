import { useParams } from '@solidjs/router';
import {
    createEffect,
    createMemo,
    createResource,
    createSignal,
    For,
    on,
    onCleanup,
    onMount,
    Show,
    type JSX,
} from 'solid-js';
import { addMonths, getMonthGrid, getWeekDates, startOfMonth, startOfWeek } from '../calendar/calendarDate.ts';
import { loadCalendarRange } from '../calendar/calendarData.ts';
import type { ProjectedTask } from '../calendar/project.ts';
import { indexCalendarItemsByDate, shouldRenderCalendarPage } from '../calendar/calendarViewModel.ts';
import type { Task } from '../db/types.ts';
import { useAppNavigate, useLabelsPanelOpen } from '../routing/navigation.ts';
import { genVersion } from '../stores/generatorStore.ts';
import { editTask, taskVersion, today, toggleComplete } from '../stores/taskStore.ts';
import {
    calendarFilter,
    calendarView,
    setCalendarFilter,
    setCalendarView,
    type CalendarFilter,
    type CalendarView,
} from '../stores/viewPreferencesStore.ts';
import { addDays } from '../utils/logicalDay.ts';
import { AddTask } from './AddTask.tsx';
import { Dialog } from './Dialog.tsx';
import { SegmentedControl, type SegmentedOption } from './SegmentedControl.tsx';
import { TaskCardView } from './TaskCard.tsx';
import { TaskEditorDialog } from './TaskEditorDialog.tsx';
import { LabelsDialog } from './labels/LabelsDialog.tsx';
import './CalendarTab.css';

const MONTH_PAGE_COUNT = 25;
const MONTH_MIDDLE_INDEX = 12;
const WEEK_PAGE_COUNT = 53;
const WEEK_MIDDLE_INDEX = 26;
const VIEW_OPTIONS: SegmentedOption<CalendarView>[] = [
    { value: 'month', label: 'Month' },
    { value: 'week', label: 'Week' },
];
const FILTER_OPTIONS: SegmentedOption<CalendarFilter>[] = [
    { value: 'all', label: 'All' },
    { value: 'scheduled', label: 'Scheduled' },
    { value: 'projected', label: 'Projected' },
];
const WEEKDAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

/** Mobile-first month and week calendar with concrete and projected tasks. */
function CalendarTab(): JSX.Element {
    const params = useParams();
    const labelsOpen = useLabelsPanelOpen();
    const navigation = useAppNavigate();
    const [monthIndex, setMonthIndex] = createSignal(MONTH_MIDDLE_INDEX);
    const [weekIndex, setWeekIndex] = createSignal(WEEK_MIDDLE_INDEX);
    let monthScroller: HTMLDivElement | undefined;
    let weekScroller: HTMLDivElement | undefined;
    let monthScrollTimer: ReturnType<typeof setTimeout> | undefined;
    let weekScrollTimer: ReturnType<typeof setTimeout> | undefined;

    const baseMonth = createMemo(() => startOfMonth(today()));
    const baseWeek = createMemo(() => startOfWeek(today()));
    const months = createMemo(() =>
        Array.from({ length: MONTH_PAGE_COUNT }, (_, index) => addMonths(baseMonth(), index - MONTH_MIDDLE_INDEX))
    );
    const weeks = createMemo(() =>
        Array.from({ length: WEEK_PAGE_COUNT }, (_, index) => addDays(baseWeek(), (index - WEEK_MIDDLE_INDEX) * 7))
    );
    const rangeStart = createMemo(() => getMonthGrid(months()[0] ?? baseMonth())[0]?.days[0]?.date ?? baseMonth());
    const rangeEnd = createMemo(() => {
        const grid = getMonthGrid(months().at(-1) ?? baseMonth());
        return grid.at(-1)?.days.at(-1)?.date ?? baseMonth();
    });
    const [calendarData] = createResource(
        () => `${rangeStart()}:${rangeEnd()}:${today()}:${taskVersion()}:${genVersion()}`,
        () => loadCalendarRange(rangeStart(), rangeEnd(), today())
    );

    const loadedData = createMemo(() => calendarData.latest);
    const scheduledByDate = createMemo(() => indexCalendarItemsByDate(loadedData()?.scheduled ?? []));
    const projectedByDate = createMemo(() => indexCalendarItemsByDate(loadedData()?.projected ?? []));
    const scheduledById = createMemo(
        () => new Map((loadedData()?.scheduled ?? []).map((task) => [task.id, task] as const))
    );
    const selectedDate = createMemo(() => (isDate(params.date) ? params.date : undefined));
    const selectedTask = createMemo(() => (params.taskId ? scheduledById().get(params.taskId) : undefined));
    const visibleMonth = createMemo(() => months()[monthIndex()] ?? baseMonth());
    const visibleWeek = createMemo(() => weeks()[weekIndex()] ?? baseWeek());

    onMount(() => scrollToCurrent(false));
    createEffect(
        on(calendarView, () => {
            requestAnimationFrame(() => scrollToCurrent(false));
        })
    );

    onCleanup(() => {
        clearTimeout(monthScrollTimer);
        clearTimeout(weekScrollTimer);
    });

    function scrollToCurrent(smooth: boolean): void {
        const behavior: ScrollBehavior = smooth ? 'smooth' : 'auto';
        if (calendarView() === 'month' && monthScroller) {
            monthScroller.scrollTo({ top: monthScroller.clientHeight * MONTH_MIDDLE_INDEX, behavior });
            setMonthIndex(MONTH_MIDDLE_INDEX);
        }
        if (calendarView() === 'week' && weekScroller) {
            const page = weekScroller.querySelector<HTMLElement>('.calendar-week-page');
            weekScroller.scrollTo({
                left: (page?.offsetWidth ?? weekScroller.clientWidth) * WEEK_MIDDLE_INDEX,
                behavior,
            });
            setWeekIndex(WEEK_MIDDLE_INDEX);
        }
    }

    function handleMonthScroll(): void {
        clearTimeout(monthScrollTimer);
        monthScrollTimer = setTimeout(() => {
            if (!monthScroller) {
                return;
            }
            setMonthIndex(Math.round(monthScroller.scrollTop / monthScroller.clientHeight));
        }, 80);
    }

    function handleWeekScroll(): void {
        clearTimeout(weekScrollTimer);
        weekScrollTimer = setTimeout(() => {
            const page = weekScroller?.querySelector<HTMLElement>('.calendar-week-page');
            if (!weekScroller || !page) {
                return;
            }
            setWeekIndex(Math.round(weekScroller.scrollLeft / page.offsetWidth));
        }, 80);
    }

    function scheduledFor(date: string): Task[] {
        if (calendarFilter() === 'projected') {
            return [];
        }
        return scheduledByDate().get(date) ?? [];
    }

    function projectedFor(date: string): ProjectedTask[] {
        if (calendarFilter() === 'scheduled') {
            return [];
        }
        return projectedByDate().get(date) ?? [];
    }

    function closeDay(): void {
        navigation.toCalendar();
    }

    async function toggleTaskLabel(labelId: string): Promise<void> {
        const task = selectedTask();
        if (!task) {
            return;
        }
        const labelIds = task.labelIds.includes(labelId)
            ? task.labelIds.filter((id) => id !== labelId)
            : [...task.labelIds, labelId];
        await editTask(task.id, { labelIds });
    }

    return (
        <section class="calendar-tab">
            <header class="calendar-toolbar">
                <div class="calendar-toolbar__headline">
                    <h1>{calendarView() === 'month' ? formatMonth(visibleMonth()) : formatWeek(visibleWeek())}</h1>
                    <button type="button" class="btn calendar-toolbar__today" onClick={() => scrollToCurrent(true)}>
                        Today
                    </button>
                </div>
                <div class="calendar-toolbar__controls">
                    <SegmentedControl
                        label="Calendar view"
                        value={calendarView()}
                        options={VIEW_OPTIONS}
                        onChange={setCalendarView}
                    />
                    <SegmentedControl
                        label="Task type"
                        value={calendarFilter()}
                        options={FILTER_OPTIONS}
                        onChange={setCalendarFilter}
                    />
                </div>
            </header>

            <Show
                when={calendarData() != null || !calendarData.loading}
                fallback={<p class="calendar-status">Loading calendar…</p>}
            >
                <Show when={!calendarData.error} fallback={<p class="calendar-status">Unable to load calendar.</p>}>
                    <Show
                        when={calendarView() === 'month'}
                        fallback={
                            <WeekPager
                                weeks={weeks()}
                                currentIndex={weekIndex()}
                                scheduledFor={scheduledFor}
                                projectedFor={projectedFor}
                                onTask={(date, id) => navigation.toCalendarTask(date, id)}
                                scrollerRef={(element) => {
                                    weekScroller = element;
                                }}
                                onScroll={handleWeekScroll}
                            />
                        }
                    >
                        <MonthPager
                            months={months()}
                            currentIndex={monthIndex()}
                            scheduledFor={scheduledFor}
                            projectedFor={projectedFor}
                            onDay={navigation.toCalendarDay}
                            scrollerRef={(element) => {
                                monthScroller = element;
                                enableMouseDragScroll(element);
                            }}
                            onScroll={handleMonthScroll}
                        />
                    </Show>
                </Show>
            </Show>

            <Show when={selectedDate()}>
                {(date) => (
                    <DayDialog
                        date={date()}
                        scheduled={scheduledFor(date())}
                        projected={projectedFor(date())}
                        loading={loadedData() == null && calendarData.loading}
                        loadFailed={calendarData.error != null}
                        onClose={closeDay}
                        onTask={(id) => navigation.toCalendarTask(date(), id)}
                    />
                )}
            </Show>

            <Show when={selectedTask()}>
                {(task) => (
                    <TaskEditorDialog
                        task={task()}
                        onClose={navigation.closeCalendarDetail}
                        onOpenLabelsPicker={navigation.openLabelsPicker}
                        stackLevel={1}
                    />
                )}
            </Show>

            <LabelsDialog
                open={labelsOpen() && !!selectedTask()}
                onClose={navigation.closeLabelsPicker}
                selectedLabelIds={selectedTask()?.labelIds ?? []}
                onToggleLabel={toggleTaskLabel}
                stackLevel={2}
            />
        </section>
    );
}

/** Adds mouse drag paging while leaving Chrome's native touch panning unchanged. */
function enableMouseDragScroll(scroller: HTMLDivElement): void {
    let pointerId: number | undefined;
    let lastY = 0;
    let dragged = false;
    let suppressClick = false;

    scroller.addEventListener('pointerdown', (event) => {
        if (event.pointerType !== 'mouse' || event.button !== 0) {
            return;
        }
        pointerId = event.pointerId;
        lastY = event.clientY;
        dragged = false;
    });
    scroller.addEventListener('pointermove', (event) => {
        if (event.pointerId !== pointerId) {
            return;
        }
        const delta = lastY - event.clientY;
        if (!dragged && Math.abs(delta) <= 2) {
            return;
        }
        if (!dragged) {
            dragged = true;
            scroller.style.scrollSnapType = 'none';
            scroller.setPointerCapture(event.pointerId);
        }
        lastY = event.clientY;
        scroller.scrollTop += delta;
        event.preventDefault();
    });

    const finishDrag = (event: PointerEvent, shouldSuppressClick: boolean) => {
        if (event.pointerId !== pointerId) {
            return;
        }
        suppressClick = dragged && shouldSuppressClick;
        pointerId = undefined;
        if (!dragged) {
            return;
        }
        scroller.style.scrollSnapType = '';
        if (scroller.hasPointerCapture(event.pointerId)) {
            scroller.releasePointerCapture(event.pointerId);
        }
        scroller.scrollTo({
            top: Math.round(scroller.scrollTop / scroller.clientHeight) * scroller.clientHeight,
            behavior: 'smooth',
        });
    };
    scroller.addEventListener('pointerup', (event) => finishDrag(event, true));
    scroller.addEventListener('pointercancel', (event) => finishDrag(event, false));
    scroller.addEventListener(
        'click',
        (event) => {
            if (!suppressClick) {
                return;
            }
            suppressClick = false;
            event.preventDefault();
            event.stopImmediatePropagation();
        },
        true
    );
}

interface CalendarLookupProps {
    scheduledFor: (date: string) => Task[];
    projectedFor: (date: string) => ProjectedTask[];
}

interface MonthPagerProps extends CalendarLookupProps {
    months: string[];
    currentIndex: number;
    onDay: (date: string) => void;
    scrollerRef: (element: HTMLDivElement) => void;
    onScroll: () => void;
}

function MonthPager(props: MonthPagerProps): JSX.Element {
    return (
        <div ref={props.scrollerRef} class="calendar-month-scroller" onScroll={props.onScroll}>
            <For each={props.months}>
                {(month, index) => (
                    <section class="calendar-month-page" aria-label={formatMonth(month)}>
                        <Show when={shouldRenderCalendarPage(index(), props.currentIndex)}>
                            <div class="calendar-month-weekdays" aria-hidden="true">
                                <span>W</span>
                                <For each={WEEKDAY_LABELS}>{(weekday) => <span>{weekday}</span>}</For>
                            </div>
                            <div class="calendar-month-grid">
                                <For each={getMonthGrid(month)}>
                                    {(week) => (
                                        <>
                                            <div class="calendar-week-number">{week.weekNumber}</div>
                                            <For each={week.days}>
                                                {(day) => {
                                                    const items = () => [
                                                        ...props.scheduledFor(day.date).map((task) => ({
                                                            id: task.id,
                                                            summary: task.summary,
                                                            projected: false,
                                                        })),
                                                        ...props.projectedFor(day.date).map((task) => ({
                                                            id: task.id,
                                                            summary: task.summary,
                                                            projected: true,
                                                        })),
                                                    ];
                                                    return (
                                                        <button
                                                            type="button"
                                                            class="calendar-day-cell"
                                                            classList={{
                                                                'calendar-day-cell--outside': !day.inMonth,
                                                                'calendar-day-cell--today': day.date === today(),
                                                            }}
                                                            onClick={() => props.onDay(day.date)}
                                                            aria-label={`${formatFullDate(day.date)}, ${items().length} tasks`}
                                                        >
                                                            <span class="calendar-day-cell__number">
                                                                {Number(day.date.slice(-2))}
                                                            </span>
                                                            <MonthCellItems items={items()} />
                                                        </button>
                                                    );
                                                }}
                                            </For>
                                        </>
                                    )}
                                </For>
                            </div>
                        </Show>
                    </section>
                )}
            </For>
        </div>
    );
}

interface MonthCellItem {
    id: string;
    summary: string;
    projected: boolean;
}

function MonthCellItems(props: { items: MonthCellItem[] }): JSX.Element {
    const hasOverflow = () => props.items.length > 2;
    const shown = () => (hasOverflow() ? props.items.slice(0, 1) : props.items.slice(0, 2));
    return (
        <span class="calendar-day-cell__items">
            <For each={shown()}>
                {(item) => (
                    <span class="calendar-month-task" classList={{ 'calendar-month-task--projected': item.projected }}>
                        {item.summary}
                    </span>
                )}
            </For>
            <Show when={hasOverflow()}>
                <span class="calendar-month-task calendar-month-task--more">+{props.items.length - 1}</span>
            </Show>
        </span>
    );
}

interface WeekPagerProps extends CalendarLookupProps {
    weeks: string[];
    currentIndex: number;
    onTask: (date: string, id: string) => void;
    scrollerRef: (element: HTMLDivElement) => void;
    onScroll: () => void;
}

function WeekPager(props: WeekPagerProps): JSX.Element {
    return (
        <div ref={props.scrollerRef} class="calendar-week-scroller" onScroll={props.onScroll}>
            <For each={props.weeks}>
                {(week, index) => (
                    <section class="calendar-week-page" aria-label={formatWeek(week)}>
                        <Show when={shouldRenderCalendarPage(index(), props.currentIndex)}>
                            <For each={getWeekDates(week)}>
                                {(date, dayIndex) => (
                                    <section
                                        class="calendar-week-day"
                                        classList={{ 'calendar-week-day--today': date === today() }}
                                    >
                                        <header class="calendar-week-day__header">
                                            <span>{WEEKDAY_LABELS[dayIndex()]}</span>
                                            <strong>{Number(date.slice(-2))}</strong>
                                        </header>
                                        <div class="calendar-week-day__tasks">
                                            <For each={props.scheduledFor(date)}>
                                                {(task) => (
                                                    <CalendarTaskButton
                                                        task={task}
                                                        compact={true}
                                                        onOpen={() => props.onTask(date, task.id)}
                                                    />
                                                )}
                                            </For>
                                            <For each={props.projectedFor(date)}>
                                                {(task) => <ProjectedTaskCard task={task} />}
                                            </For>
                                        </div>
                                    </section>
                                )}
                            </For>
                        </Show>
                    </section>
                )}
            </For>
        </div>
    );
}

interface DayDialogProps {
    date: string;
    scheduled: Task[];
    projected: ProjectedTask[];
    loading: boolean;
    loadFailed: boolean;
    onClose: () => void;
    onTask: (id: string) => void;
}

function DayDialog(props: DayDialogProps): JSX.Element {
    return (
        <Dialog open={true} onClose={props.onClose} title={formatFullDate(props.date)} panelClass="calendar-day-dialog">
            <AddTask date={props.date} />
            <div class="calendar-day-dialog__tasks">
                <For each={props.scheduled}>
                    {(task) => <CalendarTaskButton task={task} onOpen={() => props.onTask(task.id)} />}
                </For>
                <For each={props.projected}>{(task) => <ProjectedTaskCard task={task} />}</For>
                <Show when={props.loading}>
                    <p class="calendar-status">Loading tasks…</p>
                </Show>
                <Show when={props.loadFailed}>
                    <p class="calendar-status">Unable to load tasks.</p>
                </Show>
                <Show
                    when={!props.loading && !props.loadFailed && props.scheduled.length + props.projected.length === 0}
                >
                    <p class="calendar-status">No tasks for this day.</p>
                </Show>
            </div>
        </Dialog>
    );
}

function CalendarTaskButton(props: { task: Task; onOpen: () => void; compact?: boolean }): JSX.Element {
    async function handleCheck(): Promise<void> {
        await toggleComplete(props.task.id);
    }

    return (
        <div class="calendar-task-button" classList={{ 'calendar-task-button--compact': props.compact }}>
            <Show when={!props.compact}>
                <button
                    type="button"
                    class="calendar-task-button__check"
                    classList={{ 'calendar-task-button__check--done': props.task.completed }}
                    aria-label={props.task.completed ? 'Mark incomplete' : 'Mark complete'}
                    onClick={() => void handleCheck()}
                >
                    {props.task.completed ? '✓' : ''}
                </button>
            </Show>
            <button
                type="button"
                class="calendar-task-button__open"
                aria-label={`Edit ${props.task.summary}`}
                onClick={props.onOpen}
            >
                <TaskCardView
                    summary={props.task.summary}
                    labelIds={props.task.labelIds}
                    completed={props.task.completed}
                />
            </button>
        </div>
    );
}

function ProjectedTaskCard(props: { task: ProjectedTask }): JSX.Element {
    return (
        <div class="calendar-projected-card">
            <TaskCardView
                summary={props.task.summary}
                labelIds={props.task.labelIds}
                variant="projected"
                badge="projected"
            />
        </div>
    );
}

function isDate(value: string | undefined): value is string {
    return value != null && /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function formatMonth(date: string): string {
    return new Intl.DateTimeFormat(undefined, { month: 'long', year: 'numeric' }).format(parseDate(date));
}

function formatWeek(date: string): string {
    const dates = getWeekDates(date);
    return `${formatShortDate(dates[0] ?? date)} – ${formatShortDate(dates[6] ?? date)}`;
}

function formatShortDate(date: string): string {
    return new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric' }).format(parseDate(date));
}

function formatFullDate(date: string): string {
    return new Intl.DateTimeFormat(undefined, {
        weekday: 'long',
        month: 'long',
        day: 'numeric',
        year: 'numeric',
    }).format(parseDate(date));
}

function parseDate(date: string): Date {
    return new Date(`${date}T12:00:00`);
}

export { CalendarTab };
