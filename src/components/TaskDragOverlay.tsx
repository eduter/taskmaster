import { Show, createMemo } from 'solid-js';
import { DragOverlay, useDragDropContext } from '@thisbeyond/solid-dnd';
import { DRAG_ROTATE_DEG } from '../gestures/constants.ts';
import { useTouchDrag } from '../gestures/touchDragContext.tsx';
import { TaskCard } from './TaskCard.tsx';
import { tasks } from '../stores/taskStore.ts';
import './TaskDragOverlay.css';

function TaskDragOverlay() {
    const [dndState] = useDragDropContext()!;
    const touchDrag = useTouchDrag();

    const activeTask = createMemo(() => {
        const id = dndState.active.draggableId;
        if (id == null) return undefined;
        return (tasks() ?? []).find((t) => t.id === String(id));
    });

    const overlayStyle = createMemo(() => {
        const overlay = dndState.active.overlay;
        const draggable = dndState.active.draggable;
        if (!overlay || !draggable) return {};
        const grab = touchDrag.grabOffset();
        const t = overlay.transform;
        return {
            width: `${draggable.layout.width}px`,
            boxSizing: 'border-box' as const,
            transform: `translate3d(${t.x}px, ${t.y}px, 0) rotate(${DRAG_ROTATE_DEG}deg)`,
            'transform-origin': `${grab.x}px ${grab.y}px`,
        };
    });

    return (
        <DragOverlay class="task-drag-overlay" style={overlayStyle()}>
            <Show when={activeTask()}>
                <div class="task-drag-overlay__card">
                    <TaskCard task={activeTask()!} />
                </div>
            </Show>
        </DragOverlay>
    );
}

export { TaskDragOverlay };
