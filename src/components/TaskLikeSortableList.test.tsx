/** @vitest-environment jsdom */
import { render } from '@solidjs/testing-library';
import type { JSX } from 'solid-js';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Task } from '../db/types.ts';
import {
    DRAG_GRAVITY_LEAN_DEG,
    DRAG_HANG_TOP_RATIO,
    DRAG_PERSPECTIVE_PX,
    SCROLL_LOCK_DELAY_MS,
} from '../gestures/constants.ts';
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
    afterEach(() => {
        vi.useRealTimers();
        vi.restoreAllMocks();
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

    it('keeps the measured overlay axis-aligned by tilting the inner card instead', () => {
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
        expect(overlay.style.perspective).toBe(`${DRAG_PERSPECTIVE_PX}px`);
        expect(card.style.transform).toContain('rotate');
        expect(card.style.transformOrigin).not.toBe('');

        const match = overlay.style.transform.match(/translate3d\((-?[\d.]+)px, (-?[\d.]+)px/);
        if (!match) {
            throw new Error(`expected a translate3d transform, got '${overlay.style.transform}'`);
        }
        expect(Number.isInteger(Number(match[1]))).toBe(true);
        expect(Number.isInteger(Number(match[2]))).toBe(true);

        dispatchPointer(document, 'pointerup', x, y + 20);
    });

    it('hangs the dragged card from a pivot near its top edge', () => {
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
        // Grab low on the row; the pivot must still sit near the top edge.
        const y = from.bottom - 4;
        dispatchPointer(surface, 'pointerdown', x, y);
        dispatchPointer(document, 'pointermove', x, y + 20);

        const card = container.querySelector<HTMLElement>('.task-drag-overlay__card');
        if (!card) {
            throw new Error('expected a drag overlay card');
        }
        const originY = Number(card.style.transformOrigin.split(' ')[1].replace('px', ''));
        expect(originY).toBeLessThanOrEqual(from.height * DRAG_HANG_TOP_RATIO + 0.001);
        expect(originY).toBeLessThan(from.height / 2);

        dispatchPointer(document, 'pointerup', x, y + 20);
    });

    it('hangs the far side of the card down when held off-centre', () => {
        const frames: FrameRequestCallback[] = [];
        vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
            frames.push(callback);
            return frames.length;
        });
        vi.stubGlobal('cancelAnimationFrame', () => {});
        let clock = 1000;
        const nowSpy = vi.spyOn(performance, 'now').mockImplementation(() => clock);

        const { container } = render(() => (
            <SortableListHarness initial={[makeTask('a', 'Alpha', 0), makeTask('b', 'Beta', 1)]} onReorder={() => {}} />
        ));
        stubStackedRowLayouts(container);
        const surface = container.querySelector<HTMLElement>('.task-row__surface');
        if (!surface) {
            throw new Error('expected a task surface to drag');
        }
        const from = surface.getBoundingClientRect();
        // Grab near the right edge so the left (far) end should hang down.
        const x = from.right - 6;
        const y = from.top + from.height / 2;
        dispatchPointer(surface, 'pointerdown', x, y);
        clock = 1016;
        dispatchPointer(document, 'pointermove', x, y + 20);
        // Let the spring settle under gravity with the pointer held still.
        for (let i = 0; i < 150; i++) {
            clock += 16;
            frames.shift()?.(clock);
        }

        const card = container.querySelector<HTMLElement>('.task-drag-overlay__card');
        if (!card) {
            throw new Error('expected a drag overlay card');
        }
        const lean = Number(card.style.transform.match(/rotateZ\((-?[\d.]+)deg\)/)?.[1]);
        // Negative lean drops the left edge; the magnitude is scaled by how far
        // off-centre the grab point sits, so it never exceeds the edge value.
        expect(lean).toBeLessThan(0);
        expect(lean).toBeGreaterThanOrEqual(-DRAG_GRAVITY_LEAN_DEG);

        dispatchPointer(document, 'pointerup', x, y + 20);
        nowSpy.mockRestore();
        vi.unstubAllGlobals();
    });

    it('swings the card against pointer speed, then settles when the pointer stops', () => {
        const frames: FrameRequestCallback[] = [];
        vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
            frames.push(callback);
            return frames.length;
        });
        vi.stubGlobal('cancelAnimationFrame', () => {});

        // Drive both the pointer trail and the animation frames from one clock so the
        // trailing-window velocity is deterministic.
        let clock = 1000;
        const nowSpy = vi.spyOn(performance, 'now').mockImplementation(() => clock);

        const { container } = render(() => (
            <SortableListHarness initial={[makeTask('a', 'Alpha', 0), makeTask('b', 'Beta', 1)]} onReorder={() => {}} />
        ));
        stubStackedRowLayouts(container);
        const surface = container.querySelector<HTMLElement>('.task-row__surface');
        if (!surface) {
            throw new Error('expected a task surface to drag');
        }
        const from = surface.getBoundingClientRect();
        // Grab at the horizontal centre so gravity contributes nothing and the lean
        // isolates the air-resistance swing.
        const x = from.left + from.width / 2;
        const y = from.top + from.height / 2;
        const rotateOf = (axis: string): number => {
            const card = container.querySelector<HTMLElement>('.task-drag-overlay__card');
            const match = card?.style.transform.match(new RegExp(`${axis}\\((-?[\\d.]+)deg\\)`));
            if (!match) {
                throw new Error(`expected a ${axis} in the card transform`);
            }
            return Number(match[1]);
        };

        dispatchPointer(surface, 'pointerdown', x, y);
        // Vertical first to start the drag, then sustain a fast horizontal swipe.
        clock = 1016;
        dispatchPointer(document, 'pointermove', x, y + 20);
        let pointerX = x;
        for (let i = 0; i < 8; i++) {
            clock += 16;
            pointerX += 24;
            dispatchPointer(document, 'pointermove', pointerX, y + 20);
            frames.shift()?.(clock);
        }

        // Air resistance swings the card against a rightward drag.
        expect(rotateOf('rotateZ')).toBeLessThan(-1);

        // Hold the pointer still and let the spring settle back to flat.
        for (let i = 0; i < 150; i++) {
            clock += 16;
            frames.shift()?.(clock);
        }
        expect(rotateOf('rotateZ')).toBeCloseTo(0, 1);
        expect(rotateOf('rotateX')).toBeCloseTo(0, 1);

        dispatchPointer(document, 'pointerup', pointerX, y + 20);
        nowSpy.mockRestore();
        vi.unstubAllGlobals();
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
