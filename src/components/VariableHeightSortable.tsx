import { createDraggable, createDroppable, type Id, transformStyle, useDragDropContext } from '@thisbeyond/solid-dnd';
import { createContext, createMemo, type JSX, onCleanup, onMount, type ParentComponent, useContext } from 'solid-js';
import { applyReorder } from '../utils/reorder.ts';

interface VariableHeightSortableContextValue {
    ids: () => Id[];
    sortedIds: () => Id[];
}

const VariableHeightSortableContext = createContext<VariableHeightSortableContextValue>();

interface VariableHeightSortableProviderProps {
    ids: Id[];
    children: JSX.Element;
}

const VariableHeightSortableProvider: ParentComponent<VariableHeightSortableProviderProps> = (props) => {
    const dndContext = useDragDropContext();
    if (!dndContext) {
        throw new Error('VariableHeightSortableProvider must be used within DragDropProvider');
    }
    const [dndState] = dndContext;

    const ids = () => props.ids;
    const sortedIds = createMemo(() => {
        const draggableId = dndState.active.draggableId;
        const droppableId = dndState.active.droppableId;
        if (draggableId == null || droppableId == null) {
            return [...props.ids];
        }

        return applyReorderIds(props.ids, draggableId, droppableId) ?? [...props.ids];
    });

    return (
        <VariableHeightSortableContext.Provider value={{ ids, sortedIds }}>
            {props.children}
        </VariableHeightSortableContext.Provider>
    );
};

function useVariableHeightSortable(id: Id) {
    const dndContext = useDragDropContext();
    const sortableContext = useContext(VariableHeightSortableContext);
    if (!dndContext || !sortableContext) {
        throw new Error(
            'useVariableHeightSortable must be used within DragDropProvider and VariableHeightSortableProvider'
        );
    }

    const [dndState, actions] = dndContext;
    const draggable = createDraggable(id);
    const droppable = createDroppable(id);
    const transformer = {
        id: 'variableHeightSortableOffset',
        order: 100,
        callback: (transform: { x: number; y: number }) => {
            const offsetY = verticalOffsetFor(
                id,
                dndState.active.draggableId,
                sortableContext.ids(),
                sortableContext.sortedIds(),
                dndState.droppables
            );
            return { x: transform.x, y: transform.y + offsetY };
        },
    };

    function ref(element: HTMLElement | null) {
        draggable.ref(element);
        droppable.ref(element);
    }

    onMount(() => {
        actions.addTransformer('droppables', id, transformer);
    });

    onCleanup(() => {
        actions.removeTransformer('droppables', id, transformer.id);
    });

    const transform = () => {
        if (id === dndState.active.draggableId && !dndState.active.overlay) {
            return draggable.transform;
        }
        return droppable.transform;
    };

    return {
        ref,
        get isActiveDraggable() {
            return draggable.isActiveDraggable;
        },
        get transform() {
            return transform();
        },
    };
}

interface LayoutLike {
    top: number;
    bottom: number;
    height: number;
}

interface DroppableLike {
    layout: LayoutLike;
}

function verticalOffsetFor(
    id: Id,
    activeId: Id | null,
    initialIds: Id[],
    sortedIds: Id[],
    droppables: Record<Id, DroppableLike | undefined>
): number {
    if (activeId == null || id === activeId) {
        return 0;
    }

    const activeInitialIndex = initialIds.indexOf(activeId);
    const activeSortedIndex = sortedIds.indexOf(activeId);
    const itemInitialIndex = initialIds.indexOf(id);
    if (activeInitialIndex === -1 || activeSortedIndex === -1 || itemInitialIndex === -1) {
        return 0;
    }

    const activeLayout = droppables[activeId]?.layout;
    if (!activeLayout) {
        return 0;
    }

    if (activeSortedIndex > activeInitialIndex) {
        if (itemInitialIndex <= activeInitialIndex || itemInitialIndex > activeSortedIndex) {
            return 0;
        }
        return -(activeLayout.height + gapNearActive(initialIds, activeInitialIndex, droppables, 'after'));
    }

    if (itemInitialIndex < activeSortedIndex || itemInitialIndex >= activeInitialIndex) {
        return 0;
    }
    return activeLayout.height + gapNearActive(initialIds, activeInitialIndex, droppables, 'before');
}

function gapNearActive(
    ids: Id[],
    activeIndex: number,
    droppables: Record<Id, DroppableLike | undefined>,
    side: 'before' | 'after'
): number {
    const active = droppables[ids[activeIndex]]?.layout;
    if (!active) {
        return fallbackGap(ids, droppables);
    }

    const neighborIndex = side === 'after' ? activeIndex + 1 : activeIndex - 1;
    const neighbor = droppables[ids[neighborIndex]]?.layout;
    if (neighbor) {
        const gap = side === 'after' ? neighbor.top - active.bottom : active.top - neighbor.bottom;
        if (gap >= 0) {
            return gap;
        }
    }

    return fallbackGap(ids, droppables);
}

function fallbackGap(ids: Id[], droppables: Record<Id, DroppableLike | undefined>): number {
    for (let index = 1; index < ids.length; index++) {
        const prev = droppables[ids[index - 1]]?.layout;
        const next = droppables[ids[index]]?.layout;
        if (!prev || !next) {
            continue;
        }
        const gap = next.top - prev.bottom;
        if (gap >= 0) {
            return gap;
        }
    }
    return 0;
}

function applyReorderIds(ids: Id[], draggableId: Id, droppableId: Id): Id[] | null {
    const reordered = applyReorder(ids.map(String), String(draggableId), String(droppableId));
    if (!reordered) {
        return null;
    }

    const byString = new Map(ids.map((id) => [String(id), id]));
    return reordered.map((id) => byString.get(id)).filter((id): id is Id => id !== undefined);
}

export { transformStyle, useVariableHeightSortable, VariableHeightSortableProvider };
