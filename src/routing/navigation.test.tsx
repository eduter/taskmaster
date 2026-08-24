/** @vitest-environment jsdom */
import { MemoryRouter, Route, useLocation, type LocationChange, type MemoryHistory } from '@solidjs/router';
import { cleanup, fireEvent, render, screen, waitFor } from '@solidjs/testing-library';
import type { JSX } from 'solid-js';
import { afterEach, describe, expect, it } from 'vitest';
import { RedirectToTasks } from '../App.tsx';
import { AppTabs } from '../components/AppTabs.tsx';
import { useAppNavigate, useLabelsPanelOpen, useSyncPanelOpen } from './navigation.ts';

interface HistorySnapshot {
    path: string;
    stack: string[];
    atRoot: boolean;
}

function createInspectableHistory(initialPath: string): {
    history: MemoryHistory;
    snapshot: () => HistorySnapshot;
} {
    const entries = [initialPath];
    let index = 0;
    const listeners: Array<(value: string) => void> = [];

    function currentPath(): string {
        return entries[index] ?? initialPath;
    }

    function notify(): void {
        const value = currentPath();
        for (const listener of listeners) {
            listener(value);
        }
    }

    const history: MemoryHistory = {
        get: () => currentPath(),
        set: ({ value, replace }: LocationChange) => {
            if (replace) {
                entries[index] = value;
            } else {
                entries.splice(index + 1, entries.length - index, value);
                index++;
            }
            notify();
        },
        go: (n: number) => {
            index = Math.max(0, Math.min(index + n, entries.length - 1));
            notify();
        },
        listen: (listener: (value: string) => void) => {
            listeners.push(listener);
            return () => {
                const at = listeners.indexOf(listener);
                if (at !== -1) {
                    listeners.splice(at, 1);
                }
            };
        },
    };

    return {
        history,
        snapshot: () => ({
            path: currentPath(),
            stack: entries.slice(0, index + 1),
            atRoot: index === 0,
        }),
    };
}

function EmptyPage() {
    return null;
}

function HistoryHarness(props: { children?: JSX.Element }) {
    const nav = useAppNavigate();
    const location = useLocation();
    useSyncPanelOpen();
    useLabelsPanelOpen();

    return (
        <div>
            <span data-testid="path">{`${location.pathname}${location.search}`}</span>
            <AppTabs />
            {props.children}
            <button type="button" onClick={() => nav.toTask('task-1')}>
                Open task
            </button>
            <button type="button" onClick={() => nav.closeTaskDetail()}>
                Close task
            </button>
            <button type="button" onClick={() => nav.toCalendarDay('2026-08-24')}>
                Open day
            </button>
            <button type="button" onClick={() => nav.toCalendarTask('2026-08-24', 'task-1')}>
                Open calendar task
            </button>
            <button type="button" onClick={() => nav.closeCalendarDetail()}>
                Close calendar detail
            </button>
            <button type="button" onClick={() => nav.toGenerator('gen-1')}>
                Open generator
            </button>
            <button type="button" onClick={() => nav.closeGeneratorDetail()}>
                Close generator
            </button>
            <button type="button" onClick={() => nav.openSyncPanel()}>
                Open sync
            </button>
            <button type="button" onClick={() => nav.closeSyncPanel()}>
                Close sync
            </button>
            <button type="button" onClick={() => nav.openLabelsPicker()}>
                Open labels
            </button>
            <button type="button" onClick={() => nav.closeLabelsPicker()}>
                Close labels
            </button>
        </div>
    );
}

function renderApp(initialPath = '/tasks') {
    const inspectable = createInspectableHistory(initialPath);
    const view = render(() => (
        <MemoryRouter history={inspectable.history} root={HistoryHarness}>
            <Route path="/" component={RedirectToTasks} />
            <Route path="/tasks" component={EmptyPage} />
            <Route path="/tasks/:id" component={EmptyPage} />
            <Route path="/calendar" component={EmptyPage} />
            <Route path="/calendar/:date" component={EmptyPage} />
            <Route path="/calendar/:date/tasks/:taskId" component={EmptyPage} />
            <Route path="/generators" component={EmptyPage} />
            <Route path="/generators/:id" component={EmptyPage} />
        </MemoryRouter>
    ));
    return { ...view, inspectable };
}

async function pathIs(expected: string): Promise<void> {
    await waitFor(() => {
        expect(screen.getByTestId('path').textContent).toBe(expected);
    });
}

afterEach(cleanup);

describe('tab history', () => {
    it('replaces the launch redirect so / does not sit under the Today tab', async () => {
        const { inspectable } = renderApp('/');

        await pathIs('/tasks');
        expect(inspectable.snapshot()).toEqual({
            path: '/tasks',
            stack: ['/tasks'],
            atRoot: true,
        });
    });

    it('keeps a single history entry when switching tabs', async () => {
        const { inspectable } = renderApp('/tasks');

        fireEvent.click(screen.getByRole('button', { name: 'Calendar' }));
        await pathIs('/calendar');
        expect(inspectable.snapshot().atRoot).toBe(true);

        fireEvent.click(screen.getByRole('button', { name: 'Generators' }));
        await pathIs('/generators');
        expect(inspectable.snapshot().atRoot).toBe(true);

        fireEvent.click(screen.getByRole('button', { name: "Today's tasks" }));
        await pathIs('/tasks');
        expect(inspectable.snapshot()).toEqual({
            path: '/tasks',
            stack: ['/tasks'],
            atRoot: true,
        });
    });
});

describe('dialog history', () => {
    it('pops a task dialog back to the Today tab', async () => {
        const { inspectable } = renderApp('/tasks');

        fireEvent.click(screen.getByRole('button', { name: 'Open task' }));
        await pathIs('/tasks/task-1');
        expect(inspectable.snapshot().atRoot).toBe(false);

        fireEvent.click(screen.getByRole('button', { name: 'Close task' }));
        await pathIs('/tasks');
        expect(inspectable.snapshot().atRoot).toBe(true);
    });

    it('pops a calendar day dialog back to the Calendar tab', async () => {
        const { inspectable } = renderApp('/tasks');

        fireEvent.click(screen.getByRole('button', { name: 'Calendar' }));
        await pathIs('/calendar');

        fireEvent.click(screen.getByRole('button', { name: 'Open day' }));
        await pathIs('/calendar/2026-08-24');
        expect(inspectable.snapshot()).toEqual({
            path: '/calendar/2026-08-24',
            stack: ['/calendar', '/calendar/2026-08-24'],
            atRoot: false,
        });

        fireEvent.click(screen.getByRole('button', { name: 'Close calendar detail' }));
        await pathIs('/calendar');
        expect(inspectable.snapshot()).toEqual({
            path: '/calendar',
            stack: ['/calendar'],
            atRoot: true,
        });
    });

    it('pops a nested calendar task then the day', async () => {
        const { inspectable } = renderApp('/calendar');

        fireEvent.click(screen.getByRole('button', { name: 'Open day' }));
        await pathIs('/calendar/2026-08-24');
        fireEvent.click(screen.getByRole('button', { name: 'Open calendar task' }));
        await pathIs('/calendar/2026-08-24/tasks/task-1');

        fireEvent.click(screen.getByRole('button', { name: 'Close calendar detail' }));
        await pathIs('/calendar/2026-08-24');
        fireEvent.click(screen.getByRole('button', { name: 'Close calendar detail' }));
        await pathIs('/calendar');
        expect(inspectable.snapshot().atRoot).toBe(true);
    });

    it('pops a generator dialog back to the Generators tab', async () => {
        const { inspectable } = renderApp('/generators');

        fireEvent.click(screen.getByRole('button', { name: 'Open generator' }));
        await pathIs('/generators/gen-1');
        fireEvent.click(screen.getByRole('button', { name: 'Close generator' }));
        await pathIs('/generators');
        expect(inspectable.snapshot().atRoot).toBe(true);
    });

    it('pops the sync dialog back to the current tab', async () => {
        const { inspectable } = renderApp('/tasks');

        fireEvent.click(screen.getByRole('button', { name: 'Open sync' }));
        await pathIs('/tasks?modal=sync');
        expect(inspectable.snapshot().atRoot).toBe(false);

        fireEvent.click(screen.getByRole('button', { name: 'Close sync' }));
        await pathIs('/tasks');
        expect(inspectable.snapshot().atRoot).toBe(true);
    });

    it('pops the labels dialog back to the task that opened it', async () => {
        const { inspectable } = renderApp('/tasks');

        fireEvent.click(screen.getByRole('button', { name: 'Open task' }));
        await pathIs('/tasks/task-1');
        fireEvent.click(screen.getByRole('button', { name: 'Open labels' }));
        await pathIs('/tasks/task-1?modal=labels');

        fireEvent.click(screen.getByRole('button', { name: 'Close labels' }));
        await pathIs('/tasks/task-1');
        expect(inspectable.snapshot().atRoot).toBe(false);

        fireEvent.click(screen.getByRole('button', { name: 'Close task' }));
        await pathIs('/tasks');
        expect(inspectable.snapshot().atRoot).toBe(true);
    });
});
