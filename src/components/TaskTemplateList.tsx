import type { DragEvent } from '@thisbeyond/solid-dnd';
import {
    closestCenter,
    DragDropProvider,
    DragOverlay,
    SortableProvider,
    useDragDropContext,
} from '@thisbeyond/solid-dnd';
import { createMemo, createSignal, For, Show, type JSX } from 'solid-js';
import { DRAG_ROTATE_DEG } from '../gestures/constants.ts';
import { TouchDragProvider, useTouchDrag } from '../gestures/touchDragContext.tsx';
import { applyReorder } from '../utils/reorder.ts';
import { GestureRow } from './GestureRow.tsx';
import { TaskCardView } from './TaskCard.tsx';
import type { TaskTemplateDraft } from './TaskTemplateDetail.tsx';
import './TaskDragOverlay.css';
import './TaskList.css';

interface TaskTemplateListProps {
    templates: TaskTemplateDraft[];
    onReorder: (orderedIds: string[]) => void;
    onOpen: (id: string) => void;
    onDelete: (id: string) => void;
}

function TaskTemplateDragOverlay(props: Pick<TaskTemplateListProps, 'templates'>): JSX.Element {
    const dndContext = useDragDropContext();
    if (!dndContext) {
        throw new Error('TaskTemplateDragOverlay must be used within DragDropProvider');
    }
    const [dndState] = dndContext;
    const touchDrag = useTouchDrag();

    const activeTemplate = createMemo(() => {
        const id = dndState.active.draggableId;
        if (id == null) {
            return undefined;
        }
        return props.templates.find((template) => template.id === String(id));
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
            width: `${draggable.layout.width}px`,
            boxSizing: 'border-box' as const,
            transform: `translate3d(${t.x}px, ${t.y}px, 0) rotate(${DRAG_ROTATE_DEG}deg)`,
            'transform-origin': `${grab.x}px ${grab.y}px`,
        };
    });

    return (
        <DragOverlay class="task-drag-overlay" style={overlayStyle()}>
            <Show when={activeTemplate()}>
                {(template) => (
                    <div class="task-drag-overlay__card">
                        <TaskCardView summary={template().summary} labelIds={template().labelIds} />
                    </div>
                )}
            </Show>
        </DragOverlay>
    );
}

function SortableTaskTemplateListItems(props: TaskTemplateListProps): JSX.Element {
    const dndContext = useDragDropContext();
    if (!dndContext) {
        throw new Error('SortableTaskTemplateListItems must be used within DragDropProvider');
    }
    const [dndState] = dndContext;
    const [openRevealId, setOpenRevealId] = createSignal<string | null>(null);
    const templateIds = () => props.templates.map((template) => template.id);

    function handleRevealChange(templateId: string, open: boolean) {
        setOpenRevealId(open ? templateId : null);
    }

    function handleRowTouchStart(templateId: string) {
        const openId = openRevealId();
        if (openId && openId !== templateId) {
            setOpenRevealId(null);
        }
    }

    function deleteTemplate(id: string) {
        props.onDelete(id);
        setOpenRevealId(null);
    }

    return (
        <SortableProvider ids={templateIds()}>
            <div
                class="task-list__items"
                classList={{
                    'task-list__items--dragging': !!dndState.active.draggable,
                }}
            >
                <For each={props.templates}>
                    {(template) => (
                        <GestureRow
                            id={template.id}
                            deleteRevealed={openRevealId() === template.id}
                            deleteLabel="Delete task template"
                            allowCheckSwipe={false}
                            onRevealChange={handleRevealChange}
                            onRowTouchStart={handleRowTouchStart}
                            onOpen={() => props.onOpen(template.id)}
                            onDelete={() => deleteTemplate(template.id)}
                            renderContent={() => (
                                <TaskCardView summary={template.summary} labelIds={template.labelIds} />
                            )}
                        />
                    )}
                </For>
            </div>
        </SortableProvider>
    );
}

function TaskTemplateList(props: TaskTemplateListProps): JSX.Element {
    const templateIds = () => props.templates.map((template) => template.id);

    function handleDragEnd(event: DragEvent) {
        const { draggable, droppable } = event;
        if (!draggable || !droppable) {
            return;
        }

        const reordered = applyReorder(templateIds(), String(draggable.id), String(droppable.id));
        if (!reordered) {
            return;
        }
        props.onReorder(reordered);
    }

    return (
        <DragDropProvider onDragEnd={handleDragEnd} collisionDetector={closestCenter}>
            <TouchDragProvider>
                <TaskTemplateDragOverlay templates={props.templates} />
                <SortableTaskTemplateListItems
                    templates={props.templates}
                    onReorder={props.onReorder}
                    onOpen={props.onOpen}
                    onDelete={props.onDelete}
                />
            </TouchDragProvider>
        </DragDropProvider>
    );
}

export type { TaskTemplateListProps };
export { TaskTemplateList };
