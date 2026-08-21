/** @vitest-environment jsdom */
import { render } from '@solidjs/testing-library';
import type { JSX } from 'solid-js';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Task } from '../db/types.ts';
import { SCROLL_LOCK_DELAY_MS } from '../gestures/constants.ts';
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
