import { useParams } from '@solidjs/router';
import { createEffect, createMemo, createResource, createSignal, For, on, onCleanup, Show, type JSX } from 'solid-js';
import { getISOWeekNumber, getWeekDates, indexOfMonthStartWeek, isMonthStartWeek, startOfMonth, startOfWeek, visibleMonthForWeekIndex } from '../calendar/calendarDate.ts';
import { loadCalendarRange } from '../calendar/calendarData.ts';
import type { ProjectedTask } from '../calendar/project.ts';
import { indexCalendarItemsByDate, shouldRenderCalendarPage } from '../calendar/calendarViewModel.ts';
import type { Task } from '../db/types.ts';
import { useAppNavigate, useLabelsPanelOpen, usePostponePanelOpen } from '../routing/navigation.ts';
import { genVersion } from '../stores/generatorStore.ts';
import { editTask, reorder, taskVersion, today } from '../stores/taskStore.ts';
import {
    calendarFilter,
    calendarView,
    setCalendarFilter,
    type CalendarFilter,
} from '../stores/viewPreferencesStore.ts';
import { formatFullDate } from '../utils/formatLogicalDay.ts';
import { addDays } from '../utils/logicalDay.ts';
import { AddTask } from './AddTask.tsx';
import { Dialog } from './Dialog.tsx';
import { SegmentedControl, type SegmentedOption } from './SegmentedControl.tsx';
import { TaskCardView } from './TaskCard.tsx';
import { PostponeDialog } from './PostponeDialog.tsx';
import { TaskEditorDialog } from './TaskEditorDialog.tsx';
import { TaskRows } from './TaskRows.tsx';
import { LabelMarks } from './labels';
import { LabelsDialog } from './labels/LabelsDialog.tsx';
import './CalendarTab.css';

const MONTH_WEEK_COUNT = 110;
const MONTH_WEEK_MIDDLE_INDEX = 55;
const WEEK_PAGE_COUNT = 53;
const WEEK_MIDDLE_INDEX = 26;
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
    const postponeOpen = usePostponePanelOpen();
    const navigation = useAppNavigate();
    const [monthWeekIndex, setMonthWeekIndex] = createSignal(MONTH_WEEK_MIDDLE_INDEX);
    const [weekIndex, setWeekIndex] = createSignal(WEEK_MIDDLE_INDEX);
    let monthScroller: HTMLDivElement | undefined;
    let weekScroller: HTMLDivElement | undefined;
    let monthScrollFrame: number | undefined;
    let weekScrollTimer: ReturnType<typeof setTimeout> | undefined;

    const baseMonthStartWeek = createMemo(() => startOfWeek(startOfMonth(today())));
    const monthWeeks = createMemo(() =>
        Array.from({ length: MONTH_WEEK_COUNT }, (_, index) =>
            addDays(baseMonthStartWeek(), (index - MONTH_WEEK_MIDDLE_INDEX) * 7)
        )
    );
    const baseWeek = createMemo(() => startOfWeek(today()));
    const weeks = createMemo(() =>
        Array.from({ length: WEEK_PAGE_COUNT }, (_, index) => addDays(baseWeek(), (index - WEEK_MIDDLE_INDEX) * 7))
    );
    const rangeStart = createMemo(() => monthWeeks()[0] ?? baseMonthStartWeek());
    const rangeEnd = createMemo(() => addDays(monthWeeks().at(-1) ?? baseMonthStartWeek(), 6));
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
    const visibleMonth = createMemo(() => visibleMonthForWeekIndex(monthWeeks(), monthWeekIndex()));
    const visibleWeek = createMemo(() => weeks()[weekIndex()] ?? baseWeek());

    createEffect(
        on(calendarView, () => {
            requestAnimationFrame(() => scrollToCurrent(false));
        })
    );
    onCleanup(() => {
        if (monthScrollFrame !== undefined) {
            cancelAnimationFrame(monthScrollFrame);
        }
        clearTimeout(weekScrollTimer);
    });

    function syncMonthWeekIndexFromScroll(): void {
        if (!monthScroller) {
            return;
        }
        const rowHeight = monthWeekRowHeight();
        if (rowHeight <= 0) {
            return;
        }
        const index = Math.round(monthScroller.scrollTop / rowHeight);
        if (index !== monthWeekIndex()) {
            setMonthWeekIndex(index);
        }
    }

    function monthWeekRowHeight(): number {
        return (monthScroller?.clientHeight ?? 0) / 6;
    }

    function scrollToCurrent(smooth: boolean): void {
        const behavior: ScrollBehavior = smooth ? 'smooth' : 'auto';
        if (calendarView() === 'month' && monthScroller) {
            const targetIndex = indexOfMonthStartWeek(monthWeeks(), startOfMonth(today()));
            const rowHeight = monthWeekRowHeight();
            monthScroller.scrollTo({ top: targetIndex * rowHeight, behavior });
            if (!smooth) {
                setMonthWeekIndex(targetIndex);
            }
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
        if (monthScrollFrame !== undefined) {
            return;
        }
        monthScrollFrame = requestAnimationFrame(() => {
            monthScrollFrame = undefined;
            syncMonthWeekIndexFromScroll();
        });
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

    async function pickPostponeDate(date: string): Promise<void> {
        const task = selectedTask();
        if (!task) {
            return;
        }
        await editTask(task.id, { date });
        navigation.closePostponePicker();
    }

    return (
        <section class="calendar-tab">
            <header class="calendar-toolbar">
                <div class="calendar-toolbar__headline">
                    <Show
                        when={calendarView() === 'month'}
                        fallback={<h1 class="calendar-toolbar__title">{formatWeek(visibleWeek())}</h1>}
                    >
                        <CrossfadeTitle text={formatMonth(visibleMonth())} />
                    </Show>
                    <button
                        type="button"
                        class="btn btn--secondary calendar-toolbar__today"
                        onClick={() => scrollToCurrent(true)}
                    >
                        Today
                    </button>
                </div>
                <div class="calendar-toolbar__controls">
                    <SegmentedControl
                        label="Task type"
                        value={calendarFilter()}
                        options={FILTER_OPTIONS}
                        onChange={setCalendarFilter}
                    />
                </div>
            </header>

            <Show
                when={loadedData() != null || !calendarData.loading}
                fallback={<p class="calendar-status">Loading calendar…</p>}
            >
                <Show
                    when={!calendarData.error || loadedData() != null}
                    fallback={<p class="calendar-status">Unable to load calendar.</p>}
                >
                    <Show
                        when={calendarView() === 'month'}
                        fallback={
                            <WeekPager
                                weeks={weeks()}
                                currentIndex={weekIndex()}
                                scheduledFor={scheduledFor}
                                projectedFor={projectedFor}
                                onTask={(date, id) => navigation.toCalendarTask(date, id)}
                                onGenerator={navigation.toGenerator}
                                scrollerRef={(element) => {
                                    weekScroller = element;
                                    requestAnimationFrame(() => scrollToCurrent(false));
                                }}
                                onScroll={handleWeekScroll}
                            />
                        }
                    >
                        <MonthWeekScroller
                            weeks={monthWeeks()}
                            visibleMonth={visibleMonth()}
                            scheduledFor={scheduledFor}
                            projectedFor={projectedFor}
                            onDay={navigation.toCalendarDay}
                            scrollerRef={(element) => {
                                monthScroller = element;
                                enableMouseDragScroll(element, monthWeekRowHeight);
                                requestAnimationFrame(() => scrollToCurrent(false));
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
                        loadFailed={loadedData() == null && calendarData.error != null}
                        onClose={navigation.closeCalendarDetail}
                        onTask={(id) => navigation.toCalendarTask(date(), id)}
                        onGenerator={navigation.toGenerator}
                    />
                )}
            </Show>

            <Show when={selectedTask()}>
                {(task) => (
                    <TaskEditorDialog
                        task={task()}
                        onClose={navigation.closeCalendarDetail}
                        onOpenLabelsPicker={navigation.openLabelsPicker}
                        onOpenPostponePicker={navigation.openPostponePicker}
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

            <PostponeDialog
                open={postponeOpen() && !!selectedTask()}
                selectedDate={selectedTask()?.date ?? ''}
                onClose={navigation.closePostponePicker}
                onPick={pickPostponeDate}
                stackLevel={2}
            />
        </section>
    );
}

/** Adds mouse drag paging while leaving Chrome's native touch panning unchanged. */
function enableMouseDragScroll(scroller: HTMLDivElement, rowHeight: () => number): void {
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
            top: Math.round(scroller.scrollTop / rowHeight()) * rowHeight(),
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

interface MonthWeekScrollerProps extends CalendarLookupProps {
    weeks: string[];
    visibleMonth: string;
    onDay: (date: string) => void;
    scrollerRef: (element: HTMLDivElement) => void;
    onScroll: () => void;
}

function MonthWeekScroller(props: MonthWeekScrollerProps): JSX.Element {
    return (
        <div class="calendar-month-view">
            <div class="calendar-month-weekdays" aria-hidden="true">
                <span>W</span>
                <For each={WEEKDAY_LABELS}>{(weekday) => <span>{weekday}</span>}</For>
            </div>
            <div ref={props.scrollerRef} class="calendar-month-scroller" onScroll={props.onScroll}>
                <For each={props.weeks}>
                    {(weekMonday) => (
                        <section
                            class="calendar-month-week-row"
                            classList={{ 'calendar-month-week-row--snap': isMonthStartWeek(weekMonday) }}
                        >
                            <MonthWeekRow weekMonday={weekMonday} {...props} />
                        </section>
                    )}
                </For>
            </div>
        </div>
    );
}

function MonthWeekRow(props: MonthWeekScrollerProps & { weekMonday: string }): JSX.Element {
    const monthKey = () => props.visibleMonth.slice(0, 7);

    return (
        <>
            <div class="calendar-week-number">{getISOWeekNumber(props.weekMonday)}</div>
            <For each={getWeekDates(props.weekMonday)}>
                {(date) => {
                    const items = () => [
                        ...props.scheduledFor(date).map((task) => ({
                            id: task.id,
                            summary: task.summary,
                            projected: false,
                            labelIds: task.labelIds,
                        })),
                        ...props.projectedFor(date).map((task) => ({
                            id: task.id,
                            summary: task.summary,
                            projected: true,
                            labelIds: task.labelIds,
                        })),
                    ];
                    return (
                        <button
                            type="button"
                            class="calendar-day-cell"
                            classList={{
                                'calendar-day-cell--outside': !date.startsWith(monthKey()),
                                'calendar-day-cell--today': date === today(),
                            }}
                            onClick={() => props.onDay(date)}
                            aria-label={`${formatFullDate(date)}, ${items().length} tasks`}
                        >
                            <span class="calendar-day-cell__number">{Number(date.slice(-2))}</span>
                            <MonthCellItems items={items()} />
                        </button>
                    );
                }}
            </For>
        </>
    );
}

interface MonthCellItem {
    id: string;
    summary: string;
    projected: boolean;
    labelIds: string[];
}

function MonthCellItems(props: { items: MonthCellItem[] }): JSX.Element {
    const hasOverflow = () => props.items.length > 3;
    const shown = () => (hasOverflow() ? props.items.slice(0, 2) : props.items.slice(0, 3));
    return (
        <span class="calendar-day-cell__items">
            <For each={shown()}>
                {(item) => (
                    <span class="calendar-month-task" classList={{ 'calendar-month-task--projected': item.projected }}>
                        <span class="calendar-month-task__summary">{item.summary}</span>
                        <LabelMarks labelIds={item.labelIds} />
                    </span>
                )}
            </For>
            <Show when={hasOverflow()}>
                <span class="calendar-month-task calendar-month-task--more">+{props.items.length - 2}</span>
            </Show>
        </span>
    );
}

interface WeekPagerProps extends CalendarLookupProps {
    weeks: string[];
    currentIndex: number;
    onTask: (date: string, id: string) => void;
    onGenerator: (id: string) => void;
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
                            <WeekPage week={week} {...props} />
                        </Show>
                    </section>
                )}
            </For>
        </div>
    );
}

function WeekPage(props: WeekPagerProps & { week: string }): JSX.Element {
    return (
        <For each={getWeekDates(props.week)}>
            {(date, index) => (
                <section class="calendar-week-day" classList={{ 'calendar-week-day--today': date === today() }}>
                    <header class="calendar-week-day__header">
                        <span>{WEEKDAY_LABELS[index()]}</span>
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
                            {(task) => (
                                <ProjectedTaskCard task={task} onOpen={() => props.onGenerator(task.generatorId)} />
                            )}
                        </For>
                    </div>
                </section>
            )}
        </For>
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
    onGenerator: (id: string) => void;
}

function DayDialog(props: DayDialogProps): JSX.Element {
    return (
        <Dialog open={true} onClose={props.onClose} title={formatFullDate(props.date)} panelClass="calendar-day-dialog">
            <AddTask date={props.date} />
            <div class="calendar-day-dialog__tasks">
                <Show when={props.scheduled.length > 0}>
                    <TaskRows
                        items={props.scheduled}
                        onReorder={reorder}
                        onOpen={props.onTask}
                        celebrateCompletion={false}
                    />
                </Show>
                <Show when={props.projected.length > 0}>
                    <div class="calendar-day-dialog__projected">
                        <For each={props.projected}>
                            {(task) => (
                                <ProjectedTaskCard task={task} onOpen={() => props.onGenerator(task.generatorId)} />
                            )}
                        </For>
                    </div>
                </Show>
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
    return (
        <div class="calendar-task-button" classList={{ 'calendar-task-button--compact': props.compact }}>
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
                    labelsMode={props.compact ? 'marks' : undefined}
                />
            </button>
        </div>
    );
}

/** Interactive projected task that opens its source generator. */
function ProjectedTaskCard(props: { task: ProjectedTask; onOpen: () => void }): JSX.Element {
    return (
        <div class="calendar-projected-card">
            <button
                type="button"
                class="calendar-projected-card__open"
                aria-label={`Edit generator ${props.task.generatorName}`}
                onClick={props.onOpen}
            >
                <TaskCardView
                    summary={props.task.summary}
                    labelIds={props.task.labelIds}
                    variant="projected"
                    showCheck={true}
                    inertCheck={true}
                    generatorName={props.task.generatorName}
                />
            </button>
        </div>
    );
}

function CrossfadeTitle(props: { text: string }): JSX.Element {
    const [layers, setLayers] = createSignal<{ visible: string; leaving?: string }>({ visible: props.text });

    createEffect(
        on(
            () => props.text,
            (text, previous) => {
                if (previous === undefined || text === previous) {
                    setLayers({ visible: text });
                    return;
                }
                setLayers({ visible: text, leaving: previous });
            }
        )
    );

    function clearLeaving(): void {
        setLayers((state) => ({ visible: state.visible }));
    }

    return (
        <h1 class="calendar-toolbar__title">
            <Show when={layers().leaving}>
                {(leaving) => (
                    <span
                        class="calendar-toolbar__title-layer calendar-toolbar__title-layer--leaving"
                        onAnimationEnd={clearLeaving}
                    >
                        {leaving()}
                    </span>
                )}
            </Show>
            <Show when={layers().visible} keyed>
                {(visible) => (
                    <span class="calendar-toolbar__title-layer calendar-toolbar__title-layer--entering">{visible}</span>
                )}
            </Show>
        </h1>
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

function parseDate(date: string): Date {
    return new Date(`${date}T12:00:00`);
}

export { CalendarTab, ProjectedTaskCard };
