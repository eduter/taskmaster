import { createMemo, For, Show, type JSX } from 'solid-js';
import type { Task } from '../db/types.ts';
import checkIcon from '../icons/check.svg?raw';
import { labels } from '../stores/labelStore.ts';
import { today } from '../stores/taskStore.ts';
import { showTaskLabels } from '../stores/viewPreferencesStore.ts';
import { Icon } from './Icon.tsx';
import { LabelChip, LabelRing } from './labels';
import './TaskCard.css';

interface TaskCardProps {
    task: Task;
    /** When set, overrides completed appearance (e.g. swipe-to-check preview). */
    visualCompleted?: boolean;
    onCheckClick?: (event: MouseEvent) => void;
    checkRef?: (el: HTMLButtonElement | undefined) => void;
}

interface TaskCardViewProps {
    summary: string;
    labelIds: string[];
    completed?: boolean;
    visualCompleted?: boolean;
    carried?: boolean;
    showCheck?: boolean;
    onCheckClick?: (event: MouseEvent) => void;
    checkRef?: (el: HTMLButtonElement | undefined) => void;
}

/** Shared task-like card display for persisted tasks and generator templates. */
function TaskCardView(props: TaskCardViewProps): JSX.Element {
    const showCheck = () => props.showCheck ?? false;
    const showCompleted = createMemo(() => props.visualCompleted ?? props.completed ?? false);
    const labelsVisible = () => showTaskLabels();

    const cardLabels = createMemo(() => {
        const byId = new Map((labels() ?? []).map((l) => [l.id, l]));
        return props.labelIds
            .map((id) => byId.get(id))
            .filter((label): label is NonNullable<typeof label> => label !== undefined);
    });

    return (
        <div
            class="task-card"
            classList={{
                'task-card--completed': showCompleted(),
                'task-card--carried': props.carried,
                'task-card--labels-visible': labelsVisible(),
            }}
        >
            <Show when={showCheck()}>
                <span class="task-card__check-shell">
                    <Show when={cardLabels().length > 0}>
                        <LabelRing labels={cardLabels()} />
                    </Show>
                    <button
                        ref={(el) => props.checkRef?.(el)}
                        type="button"
                        class="task-card__check"
                        classList={{ 'task-card__check--done': showCompleted() }}
                        aria-label={showCompleted() ? 'Mark incomplete' : 'Mark complete'}
                        onClick={props.onCheckClick}
                        onPointerDown={(event) => event.stopPropagation()}
                    >
                        {showCompleted() && <Icon src={checkIcon} width={14} height={14} />}
                    </button>
                </span>
            </Show>
            <div class="task-card__content">
                <span class="task-card__summary">{props.summary}</span>
                <Show when={cardLabels().length > 0}>
                    <div class="task-card__labels">
                        <div class="task-card__labels-inner">
                            <For each={cardLabels()}>
                                {(label, index) => (
                                    <span
                                        class="task-card__label-item"
                                        style={{
                                            '--label-delay': `${(cardLabels().length - index() - 1) * 120}ms`,
                                            '--label-reverse-delay': `${index() * 120}ms`,
                                        }}
                                    >
                                        <LabelChip name={label.name} color={label.color} />
                                    </span>
                                )}
                            </For>
                        </div>
                    </div>
                </Show>
            </div>
            {props.carried && <span class="task-card__carried-badge">carried</span>}
        </div>
    );
}

function TaskCard(props: TaskCardProps): JSX.Element {
    const isCarriedOver = createMemo(() => props.task.date < today());

    return (
        <TaskCardView
            summary={props.task.summary}
            labelIds={props.task.labelIds}
            completed={props.task.completed}
            visualCompleted={props.visualCompleted}
            carried={isCarriedOver()}
            showCheck={true}
            onCheckClick={props.onCheckClick}
            checkRef={props.checkRef}
        />
    );
}

export type { TaskCardProps, TaskCardViewProps };
export { TaskCard, TaskCardView };
