import { useDragDropContext } from '@thisbeyond/solid-dnd';
import { createMemo, Show, type JSX } from 'solid-js';
import { DRAG_ROTATE_DEG } from '../gestures/constants.ts';
import { useTouchDrag } from '../gestures/touchDragContext.tsx';
import './TaskDragOverlay.css';

interface TaskDragOverlayItem {
    id: string;
}

interface TaskDragOverlayProps<T extends TaskDragOverlayItem> {
    items: T[];
    renderCard: (item: T) => JSX.Element;
}

/** Rotated drag preview for task-like sortable rows. */
function TaskDragOverlay<T extends TaskDragOverlayItem>(props: TaskDragOverlayProps<T>): JSX.Element {
    const dndContext = useDragDropContext();
    if (!dndContext) {
        throw new Error('TaskDragOverlay must be used within DragDropProvider');
    }
    const [dndState, actions] = dndContext;
    const touchDrag = useTouchDrag();
    let overlayRef: HTMLDivElement | undefined;

    actions.onDragStart(({ draggable }) => {
        actions.setOverlay({
            node: draggable.node,
            layout: draggable.layout,
        });

        queueMicrotask(() => {
            if (!overlayRef) {
                return;
            }

            const layout = elementLayout(overlayRef);
            const delta = {
                x: (draggable.layout.width - layout.width) / 2,
                y: (draggable.layout.height - layout.height) / 2,
            };
            layout.x += delta.x;
            layout.y += delta.y;
            actions.setOverlay({
                node: overlayRef,
                layout,
            });
        });
    });

    actions.onDragEnd(() => queueMicrotask(actions.clearOverlay));

    const activeItem = createMemo(() => {
        const id = dndState.active.draggableId;
        if (id == null || !dndState.active.draggable) {
            return undefined;
        }
        return props.items.find((item) => item.id === String(id));
    });

    const overlayStyle = createMemo(() => {
        const overlay = dndState.active.overlay;
        const draggable = dndState.active.draggable;
        if (!overlay || !draggable) {
            return {};
        }
        const grab = touchDrag.grabOffset();
        const t = overlay.transform;
        return {
            top: `${overlay.layout.top}px`,
            left: `${overlay.layout.left}px`,
            width: `${draggable.layout.width}px`,
            'max-width': `${draggable.layout.width}px`,
            'min-height': `${draggable.layout.height}px`,
            boxSizing: 'border-box' as const,
            transform: `translate3d(${t.x}px, ${t.y}px, 0) rotate(${DRAG_ROTATE_DEG}deg)`,
            'transform-origin': `${grab.x}px ${grab.y}px`,
        };
    });

    return (
        <Show when={activeItem()}>
            {(item) => (
                <div ref={overlayRef} class="task-drag-overlay" style={overlayStyle()}>
                    <div class="task-drag-overlay__card">{props.renderCard(item())}</div>
                </div>
            )}
        </Show>
    );
}

interface OverlayLayout {
    x: number;
    y: number;
    width: number;
    height: number;
    readonly rect: {
        x: number;
        y: number;
        width: number;
        height: number;
    };
    readonly left: number;
    readonly top: number;
    readonly right: number;
    readonly bottom: number;
    readonly center: {
        x: number;
        y: number;
    };
    readonly corners: {
        topLeft: { x: number; y: number };
        topRight: { x: number; y: number };
        bottomRight: { x: number; y: number };
        bottomLeft: { x: number; y: number };
    };
}

function elementLayout(element: HTMLElement): OverlayLayout {
    const rect = element.getBoundingClientRect();
    const layout = createLayout({
        x: rect.x,
        y: rect.y,
        width: rect.width,
        height: rect.height,
    });
    const { transform } = getComputedStyle(element);
    if (!transform || transform === 'none') {
        return layout;
    }

    const { x, y } = transformTranslation(transform);
    layout.x -= x;
    layout.y -= y;
    return layout;
}

function createLayout(rect: { x: number; y: number; width: number; height: number }): OverlayLayout {
    return {
        x: Math.floor(rect.x),
        y: Math.floor(rect.y),
        width: Math.floor(rect.width),
        height: Math.floor(rect.height),
        get rect() {
            return { x: this.x, y: this.y, width: this.width, height: this.height };
        },
        get left() {
            return this.x;
        },
        get top() {
            return this.y;
        },
        get right() {
            return this.x + this.width;
        },
        get bottom() {
            return this.y + this.height;
        },
        get center() {
            return {
                x: this.x + this.width * 0.5,
                y: this.y + this.height * 0.5,
            };
        },
        get corners() {
            return {
                topLeft: { x: this.left, y: this.top },
                topRight: { x: this.right, y: this.top },
                bottomRight: { x: this.right, y: this.bottom },
                bottomLeft: { x: this.left, y: this.bottom },
            };
        },
    };
}

function transformTranslation(transform: string): { x: number; y: number } {
    if (transform.startsWith('matrix3d(')) {
        const matrix = transform.slice(9, -1).split(/, /);
        return { x: Number(matrix[12]), y: Number(matrix[13]) };
    }
    if (transform.startsWith('matrix(')) {
        const matrix = transform.slice(7, -1).split(/, /);
        return { x: Number(matrix[4]), y: Number(matrix[5]) };
    }
    return { x: 0, y: 0 };
}

export { TaskDragOverlay };
