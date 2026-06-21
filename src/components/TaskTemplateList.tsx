import type { JSX } from 'solid-js';
import { GestureRow } from './GestureRow.tsx';
import { TaskCardView } from './TaskCard.tsx';
import { TaskLikeSortableList } from './TaskLikeSortableList.tsx';
import type { TaskTemplateDraft } from './TaskTemplateDetail.tsx';
import './TaskList.css';

interface TaskTemplateListProps {
    templates: TaskTemplateDraft[];
    onReorder: (orderedIds: string[]) => void;
    onOpen: (id: string) => void;
    onDelete: (id: string) => void;
}

function TaskTemplateList(props: TaskTemplateListProps): JSX.Element {
    return (
        <TaskLikeSortableList<TaskTemplateDraft>
            items={props.templates}
            onReorder={props.onReorder}
            renderRow={(template, row) => (
                <GestureRow
                    id={template.id}
                    deleteRevealed={row.deleteRevealed}
                    deleteLabel="Delete task template"
                    allowCheckSwipe={false}
                    onRevealChange={row.onRevealChange}
                    onRowTouchStart={row.onRowTouchStart}
                    onOpen={() => props.onOpen(template.id)}
                    onDelete={() => props.onDelete(template.id)}
                    renderContent={() => <TaskCardView summary={template.summary} labelIds={template.labelIds} />}
                />
            )}
            renderOverlay={(template) => <TaskCardView summary={template.summary} labelIds={template.labelIds} />}
        />
    );
}

export type { TaskTemplateListProps };
export { TaskTemplateList };
