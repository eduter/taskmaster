import type { DragEvent } from '@thisbeyond/solid-dnd';
import { closestCenter, DragDropProvider, useDragDropContext } from '@thisbeyond/solid-dnd';
import { createSignal, For, type JSX } from 'solid-js';
import { TouchDragProvider } from '../gestures/touchDragContext.tsx';
import { applyReorder } from '../utils/reorder.ts';
import { TaskDragOverlay } from './TaskDragOverlay.tsx';
import { VariableHeightSortableProvider } from './VariableHeightSortable.tsx';
import './TaskList.css';

interface TaskLikeSortableItem {
    id: string;
}

/** Row state supplied by the shared sortable task-like list shell. */
interface TaskLikeSortableRowState {
    deleteRevealed: boolean;
    onRevealChange: (id: string, open: boolean) => void;
    onRowTouchStart: (id: string) => void;
}

/** Props for rendering sortable task-like rows with shared drag and reveal behavior. */
interface TaskLikeSortableListProps<T extends TaskLikeSortableItem> {
    items: T[];
    onReorder: (orderedIds: string[]) => void | Promise<void>;
    renderRow: (item: T, state: TaskLikeSortableRowState) => JSX.Element;
    renderOverlay: (item: T) => JSX.Element;
}

function SortableTaskLikeListItems<T extends TaskLikeSortableItem>(props: TaskLikeSortableListProps<T>): JSX.Element {
    const dndContext = useDragDropContext();
    if (!dndContext) {
        throw new Error('SortableTaskLikeListItems must be used within DragDropProvider');
    }
    const [dndState] = dndContext;
    const [openRevealId, setOpenRevealId] = createSignal<string | null>(null);
    const itemIds = () => props.items.map((item) => item.id);

    function handleRevealChange(itemId: string, open: boolean) {
        setOpenRevealId(open ? itemId : null);
    }

    function handleRowTouchStart(itemId: string) {
        const openId = openRevealId();
        if (openId && openId !== itemId) {
            setOpenRevealId(null);
        }
    }

    return (
        <VariableHeightSortableProvider ids={itemIds()}>
            <div
                class="task-list__items"
                classList={{
                    'task-list__items--dragging': !!dndState.active.draggable,
                }}
            >
                <For each={props.items}>
                    {(item) =>
                        props.renderRow(item, {
                            // Getter so Solid prop reads stay live; a plain boolean
                            // snapped at render-prop call time never updates in GestureRow.
                            get deleteRevealed() {
                                return openRevealId() === item.id;
                            },
                            onRevealChange: handleRevealChange,
                            onRowTouchStart: handleRowTouchStart,
                        })
                    }
                </For>
            </div>
        </VariableHeightSortableProvider>
    );
}

/** Shared sortable shell for task-like rows and their drag preview. */
function TaskLikeSortableList<T extends TaskLikeSortableItem>(props: TaskLikeSortableListProps<T>): JSX.Element {
    const itemIds = () => props.items.map((item) => item.id);

    async function handleDragEnd(event: DragEvent) {
        const { draggable, droppable } = event;
        if (!draggable || !droppable) {
            return;
        }

        const reordered = applyReorder(itemIds(), String(draggable.id), String(droppable.id));
        if (!reordered) {
            return;
        }
        await props.onReorder(reordered);
    }

    return (
        <DragDropProvider onDragEnd={handleDragEnd} collisionDetector={closestCenter}>
            <TouchDragProvider>
                <TaskDragOverlay items={props.items} renderCard={props.renderOverlay} />
                <SortableTaskLikeListItems
                    items={props.items}
                    onReorder={props.onReorder}
                    renderRow={props.renderRow}
                    renderOverlay={props.renderOverlay}
                />
            </TouchDragProvider>
        </DragDropProvider>
    );
}

export type { TaskLikeSortableListProps, TaskLikeSortableRowState };
export { TaskLikeSortableList };
