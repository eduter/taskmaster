/** @vitest-environment jsdom */
import { MemoryRouter, Route, createMemoryHistory } from '@solidjs/router';
import { cleanup, fireEvent, render, screen } from '@solidjs/testing-library';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ProjectedTask } from '../calendar/project.ts';
import { CalendarTab, ProjectedTaskCard } from './CalendarTab.tsx';

vi.mock('../stores/labelStore.ts', () => ({
    labels: () => [],
}));

vi.mock('../stores/viewPreferencesStore.ts', () => ({
    showTaskLabels: () => false,
    calendarView: () => 'month',
    calendarFilter: () => 'all',
    setCalendarFilter: vi.fn(),
}));

const nav = vi.hoisted(() => ({
    toTab: vi.fn(),
    toTask: vi.fn(),
    closeTaskDetail: vi.fn(),
    toTasksList: vi.fn(),
    toCalendarDay: vi.fn(),
    toCalendarTask: vi.fn(),
    closeCalendarDetail: vi.fn(),
    toGenerator: vi.fn(),
    closeGeneratorDetail: vi.fn(),
    toGeneratorsList: vi.fn(),
    openSyncPanel: vi.fn(),
    closeSyncPanel: vi.fn(),
    openLabelsPicker: vi.fn(),
    closeLabelsPicker: vi.fn(),
}));

vi.mock('../routing/navigation.ts', () => ({
    useAppNavigate: () => nav,
    useLabelsPanelOpen: () => () => false,
}));

afterEach(() => {
    cleanup();
    vi.clearAllMocks();
});

describe('ProjectedTaskCard', () => {
    it('opens the source generator when clicked', () => {
        const onOpen = vi.fn();
        const task: ProjectedTask = {
            kind: 'projected',
            id: 'projected:generator-1:2026-08-24:0',
            date: '2026-08-24',
            summary: 'Take out recycling',
            description: '',
            labelIds: [],
            generatorId: 'generator-1',
            generatorName: 'Monday chores',
            templateIndex: 0,
        };
        const result = render(() => <ProjectedTaskCard task={task} onOpen={onOpen} />);

        fireEvent.click(result.getByRole('button', { name: 'Edit generator Monday chores' }));

        expect(onOpen).toHaveBeenCalledOnce();
    });
});

describe('CalendarTab day dialog', () => {
    beforeEach(() => {
        HTMLDialogElement.prototype.showModal = function showModal(): void {
            this.open = true;
        };
        HTMLDialogElement.prototype.close = function close(): void {
            this.open = false;
        };
    });

    it('pops the day overlay instead of replacing the calendar tab', () => {
        const history = createMemoryHistory();
        history.set({ value: '/calendar/2026-08-24', replace: true });

        render(() => (
            <MemoryRouter history={history}>
                <Route
                    path={['/calendar', '/calendar/:date', '/calendar/:date/tasks/:taskId']}
                    component={CalendarTab}
                />
            </MemoryRouter>
        ));

        fireEvent.click(screen.getAllByRole('button', { name: 'Close' })[0]);

        expect(nav.closeCalendarDetail).toHaveBeenCalledOnce();
    });
});
