/** @vitest-environment jsdom */
import { render } from '@solidjs/testing-library';
import type { JSX } from 'solid-js';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Task } from '../db/types.ts';
import { SCROLL_LOCK_DELAY_MS } from '../gestures/constants.ts';
import { PAPER_BANDS, PAPER_PERSPECTIVE } from '../gestures/paperSurface.ts';
import { GestureRow } from './GestureRow.tsx';
import { TaskCard } from './TaskCard.tsx';
import { TaskLikeSortableList } from './TaskLikeSortableList.tsx';

const ROW_HEIGHT = 72;

function makeTask(id: string, summary: string, sortOrder: number): Task {
    return {
        id,
        summary,
        description: '',
        labelIds: [],
        date: '2026-07-18',
        sortOrder,
        completed: false,
        completedAt: null,
        createdAt: 1,
        updatedAt: 1,
        generatorId: null,
        parentTaskId: null,
    };
}

function rectAt(index: number): DOMRect {
    const top = index * ROW_HEIGHT;
    return DOMRect.fromRect({ x: 0, y: top, width: 320, height: ROW_HEIGHT - 8 });
}

/** jsdom has no layout; solid-dnd needs stacked row boxes for collision detection. */
function stubStackedRowLayouts(container: HTMLElement): void {
    const items = [...container.querySelectorAll<HTMLElement>('.task-list__item')];
    for (const [index, item] of items.entries()) {
        const box = rectAt(index);
        item.getBoundingClientRect = () => box;
        for (const child of item.querySelectorAll<HTMLElement>('*')) {
            child.getBoundingClientRect = () => box;
        }
    }
}

function dispatchPointer(
    target: EventTarget,
    type: 'pointerdown' | 'pointermove' | 'pointerup',
    clientX: number,
    clientY: number
): void {
    target.dispatchEvent(
        new PointerEvent(type, {
            bubbles: true,
            cancelable: true,
            clientX,
            clientY,
            pointerId: 1,
            pointerType: 'mouse',
            button: 0,
            buttons: type === 'pointerup' ? 0 : 1,
        })
    );
}

/** Mouse path: press, move past vertical threshold, drop on another row. */
function mouseDragReorder(fromSurface: HTMLElement, toY: number): void {
    const from = fromSurface.getBoundingClientRect();
    const startX = from.left + from.width / 2;
    const startY = from.top + from.height / 2;

    dispatchPointer(fromSurface, 'pointerdown', startX, startY);
    dispatchPointer(document, 'pointermove', startX, startY + 20);
    dispatchPointer(document, 'pointermove', startX, toY);
    dispatchPointer(document, 'pointerup', startX, toY);
}

interface HarnessProps {
    initial: Task[];
    onReorder: (orderedIds: string[]) => void | Promise<void>;
}

function SortableListHarness(props: HarnessProps): JSX.Element {
    return (
        <TaskLikeSortableList
            items={props.initial}
            onReorder={props.onReorder}
            renderRow={(task, row) => (
                <GestureRow
                    id={task.id}
                    deleteRevealed={row.deleteRevealed}
                    deleteLabel="Delete task"
                    onRevealChange={row.onRevealChange}
                    onRowTouchStart={row.onRowTouchStart}
                    onOpen={() => {}}
                    onDelete={() => {}}
                    renderContent={() => <TaskCard task={task} />}
                />
            )}
            renderOverlay={(task) => <TaskCard task={task} />}
        />
    );
}

describe('TaskLikeSortableList drag reorder', () => {
    beforeEach(() => {
        vi.stubGlobal('matchMedia', () => ({
            matches: false,
            addEventListener: vi.fn(),
            removeEventListener: vi.fn(),
        }));
    });

    afterEach(() => {
        vi.useRealTimers();
        vi.restoreAllMocks();
        vi.unstubAllGlobals();
    });

    it('blocks native text selection while a touch long-press is pending', () => {
        vi.useFakeTimers();
        const { container } = render(() => (
            <SortableListHarness initial={[makeTask('a', 'Alpha', 0)]} onReorder={() => {}} />
        ));
        const surface = container.querySelector<HTMLElement>('.task-row__surface');
        if (!surface) {
            throw new Error('expected a task surface to hold');
        }

        surface.dispatchEvent(
            new PointerEvent('pointerdown', {
                bubbles: true,
                cancelable: true,
                pointerId: 1,
                pointerType: 'touch',
                button: 0,
                clientX: 20,
                clientY: 20,
            })
        );

        const pendingSelection = new Event('selectstart', { bubbles: true, cancelable: true });
        expect(document.dispatchEvent(pendingSelection)).toBe(false);
        expect(pendingSelection.defaultPrevented).toBe(true);

        vi.advanceTimersByTime(SCROLL_LOCK_DELAY_MS);

        expect(document.documentElement.classList.contains('task-gesture-scroll-lock')).toBe(true);
        expect(document.body.classList.contains('task-gesture-scroll-lock')).toBe(true);

        document.dispatchEvent(
            new PointerEvent('pointerup', {
                bubbles: true,
                cancelable: true,
                pointerId: 1,
                pointerType: 'touch',
                button: 0,
                clientX: 20,
                clientY: 20,
            })
        );
        expect(document.documentElement.classList.contains('task-gesture-scroll-lock')).toBe(false);
        expect(document.body.classList.contains('task-gesture-scroll-lock')).toBe(false);

        const releasedSelection = new Event('selectstart', { bubbles: true, cancelable: true });
        expect(document.dispatchEvent(releasedSelection)).toBe(true);
        expect(releasedSelection.defaultPrevented).toBe(false);
    });

    it('auto-scrolls the page while a dragged row is held near the bottom edge', () => {
        const frames: FrameRequestCallback[] = [];
        vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
            frames.push(callback);
            return frames.length;
        });
        vi.stubGlobal('cancelAnimationFrame', () => {});

        const { container } = render(() => (
            <SortableListHarness
                initial={[makeTask('a', 'Alpha', 0), makeTask('b', 'Beta', 1), makeTask('c', 'Charlie', 2)]}
                onReorder={() => {}}
            />
        ));
        stubStackedRowLayouts(container);

        const surface = container.querySelector<HTMLElement>('.task-row__surface');
        if (!surface) {
            throw new Error('expected a task surface to drag');
        }
        const from = surface.getBoundingClientRect();
        const startX = from.left + from.width / 2;
        const startY = from.top + from.height / 2;

        dispatchPointer(surface, 'pointerdown', startX, startY);
        dispatchPointer(document, 'pointermove', startX, startY + 20);
        // Hold the pointer right at the bottom edge of the viewport (window.innerHeight in jsdom is 768).
        dispatchPointer(document, 'pointermove', startX, window.innerHeight - 2);

        const before = document.documentElement.scrollTop;
        // Run a couple of frames; the first establishes the time baseline.
        frames.shift()?.(0);
        frames.shift()?.(16);

        expect(document.documentElement.scrollTop).toBeGreaterThan(before);

        dispatchPointer(document, 'pointerup', startX, window.innerHeight - 2);
        vi.unstubAllGlobals();
    });

    it('keeps the measured overlay axis-aligned while bending an inert paper snapshot', () => {
        const { container } = render(() => (
            <SortableListHarness initial={[makeTask('a', 'Alpha', 0), makeTask('b', 'Beta', 1)]} onReorder={() => {}} />
        ));
        stubStackedRowLayouts(container);
        const surface = container.querySelector<HTMLElement>('.task-row__surface');
        if (!surface) {
            throw new Error('expected a task surface to drag');
        }
        const from = surface.getBoundingClientRect();
        const x = from.left + from.width / 2;
        const y = from.top + from.height / 2;
        dispatchPointer(surface, 'pointerdown', x, y);
        // A fractional pointer delta must not leak a fractional translate onto the
        // overlay either: solid-dnd floors measured coordinates, so fractions drift.
        dispatchPointer(document, 'pointermove', x + 3.5, y + 20.5);

        const overlay = container.querySelector<HTMLElement>('.task-drag-overlay');
        const card = overlay?.querySelector<HTMLElement>('.task-drag-overlay__card');
        if (!overlay || !card) {
            throw new Error('expected a drag overlay with a card');
        }

        // solid-dnd measures the overlay element itself; a rotated box inflates its
        // bounding rect and the repeated recomputes during auto-scroll drift it away.
        expect(overlay.style.transform).not.toContain('rotate');
        const paper = card.querySelector<HTMLElement>('.task-drag-overlay__paper');
        expect(paper?.style.perspective).toBe(`${PAPER_PERSPECTIVE}px`);
        expect(paper?.children).toHaveLength(PAPER_BANDS);
        expect(card.style.transform).toBe('');

        const match = overlay.style.transform.match(/translate3d\((-?[\d.]+)px, (-?[\d.]+)px/);
        if (!match) {
            throw new Error(`expected a translate3d transform, got '${overlay.style.transform}'`);
        }
        expect(Number.isInteger(Number(match[1]))).toBe(true);
        expect(Number.isInteger(Number(match[2]))).toBe(true);

        dispatchPointer(document, 'pointerup', x, y + 20);
    });

    it('keeps a low grip attached while lifting the top ahead of the bottom', () => {
        const frames: FrameRequestCallback[] = [];
        vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
            frames.push(callback);
            return frames.length;
        });
        vi.stubGlobal('cancelAnimationFrame', () => {});
        const { container } = render(() => (
            <SortableListHarness initial={[makeTask('a', 'Alpha', 0), makeTask('b', 'Beta', 1)]} onReorder={() => {}} />
        ));
        stubStackedRowLayouts(container);
        const surface = container.querySelector<HTMLElement>('.task-row__surface');
        if (!surface) {
            throw new Error('expected a task surface');
        }
        const rect = surface.getBoundingClientRect();
        const x = rect.left + rect.width * 0.75;
        const y = rect.bottom - 4;
        dispatchPointer(surface, 'pointerdown', x, y);
        dispatchPointer(document, 'pointermove', x, y + 20);
        for (let i = 0; i < 7; i++) {
            frames.shift()?.(1000 + i * 16);
        }
        const host = container.querySelector<HTMLElement>('.task-drag-overlay__paper');
        expect(host?.style.perspectiveOrigin).toBe(`${x}px ${y + 20 - rect.top}px`);
        const bands = [...(host?.children ?? [])] as HTMLElement[];
        const matrix = (band: HTMLElement) => band.style.transform.slice(9, -1).split(',').map(Number);
        expect(matrix(bands[0])[14]).toBeGreaterThan(matrix(bands[PAPER_BANDS - 1])[14]);
        expect(host?.inert).toBe(true);
        dispatchPointer(document, 'pointerup', x, y + 20);
    });

    it('keeps the paper visible while it settles, then commits the reorder', () => {
        const frames: FrameRequestCallback[] = [];
        vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
            frames.push(callback);
            return frames.length;
        });
        vi.stubGlobal('cancelAnimationFrame', () => {});
        let clock = 1000;
        vi.spyOn(performance, 'now').mockImplementation(() => clock);
        const onReorder = vi.fn();
        const { container } = render(() => (
            <SortableListHarness
                initial={[makeTask('a', 'Alpha', 0), makeTask('b', 'Beta', 1)]}
                onReorder={onReorder}
            />
        ));
        stubStackedRowLayouts(container);
        const surface = container.querySelector<HTMLElement>('.task-row__surface');
        if (!surface) {
            throw new Error('expected a task surface');
        }
        dispatchPointer(surface, 'pointerdown', 160, 20);
        dispatchPointer(document, 'pointermove', 160, 40);
        dispatchPointer(document, 'pointermove', 160, 100);
        for (let i = 0; i < 10; i++) {
            clock += 16;
            frames.shift()?.(clock);
        }
        dispatchPointer(document, 'pointerup', 160, 100);
        expect(container.querySelector('.task-drag-overlay')).not.toBeNull();
        expect(onReorder).not.toHaveBeenCalled();
        expect(document.documentElement.classList.contains('task-gesture-scroll-lock')).toBe(false);
        for (let i = 0; i < 22; i++) {
            clock += 16;
            frames.shift()?.(clock);
        }
        expect(container.querySelector('.task-drag-overlay')).toBeNull();
        expect(onReorder).toHaveBeenCalledWith(['b', 'a']);
    });

    it('calls onReorder when a row is dragged onto another', async () => {
        const onReorder = vi.fn();

        const { container } = render(() => (
            <SortableListHarness
                initial={[makeTask('a', 'Alpha', 0), makeTask('b', 'Beta', 1), makeTask('c', 'Charlie', 2)]}
                onReorder={onReorder}
            />
        ));

        stubStackedRowLayouts(container);

        const surfaces = [...container.querySelectorAll<HTMLElement>('.task-row__surface')];
        expect(surfaces).toHaveLength(3);
        const firstSurface = surfaces[0];
        if (!firstSurface) {
            throw new Error('expected a task surface to drag');
        }

        // Drag Alpha onto Charlie.
        mouseDragReorder(firstSurface, rectAt(2).top + rectAt(2).height / 2);

        await vi.waitFor(() => {
            expect(onReorder).toHaveBeenCalledWith(['b', 'c', 'a']);
        });
    });
});
