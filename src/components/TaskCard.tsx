import { createMemo, For, Show } from 'solid-js';
import type { Task } from '../db/types.ts';
import checkIcon from '../icons/check.svg?raw';
import { labels } from '../stores/labelStore.ts';
import { today } from '../stores/taskStore.ts';
import { Icon } from './Icon.tsx';
import { LabelChip } from './labels';
import './TaskCard.css';

interface TaskCardProps {
    task: Task;
    /** When set, overrides completed appearance (e.g. swipe-to-check preview). */
    visualCompleted?: boolean;
    onCheckClick?: (event: MouseEvent) => void;
}

function TaskCard(props: TaskCardProps) {
    const isCarriedOver = createMemo(() => props.task.date < today());

    const showCompleted = createMemo(() => props.visualCompleted ?? props.task.completed);

    const taskLabels = createMemo(() => {
        const byId = new Map((labels() ?? []).map((l) => [l.id, l]));
        return props.task.labelIds
            .map((id) => byId.get(id))
            .filter((label): label is NonNullable<typeof label> => label !== undefined);
    });

    return (
        <div
            class="task-card"
            classList={{
                'task-card--completed': showCompleted(),
                'task-card--carried': isCarriedOver(),
            }}
        >
            <button
                type="button"
                class="task-card__check"
                classList={{ 'task-card__check--done': showCompleted() }}
                aria-label={showCompleted() ? 'Mark incomplete' : 'Mark complete'}
                onClick={props.onCheckClick}
                onPointerDown={(event) => event.stopPropagation()}
            >
                {showCompleted() && <Icon src={checkIcon} width={14} height={14} />}
            </button>
            <div class="task-card__content">
                <span class="task-card__summary">{props.task.summary}</span>
                <Show when={taskLabels().length > 0}>
                    <div class="task-card__labels">
                        <For each={taskLabels()}>{(label) => <LabelChip name={label.name} color={label.color} />}</For>
                    </div>
                </Show>
            </div>
            {isCarriedOver() && <span class="task-card__carried-badge">carried</span>}
        </div>
    );
}

export type { TaskCardProps };
export { TaskCard };
