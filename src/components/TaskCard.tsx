import { createMemo, For, Show, type JSX } from 'solid-js';
import type { ChecklistItem, Task } from '../db/types.ts';
import checkIcon from '../icons/check.svg?raw';
import generatorIcon from '../icons/tab-generators.svg?raw';
import { labels } from '../stores/labelStore.ts';
import { showTaskLabels } from '../stores/viewPreferencesStore.ts';
import { completionColor } from '../utils/completionColor.ts';
import { completionRate } from '../utils/completionRate.ts';
import { CompletionRing } from './CompletionRing.tsx';
import { Icon } from './Icon.tsx';
import { LabelChip, LabelMarks, LabelRing } from './labels';
import './TaskCard.css';

const CHECK_SIZE = 22;
const CHECK_RING_RADIUS = 9;

interface TaskCardProps {
    task: Task;
    /** When set, overrides completed appearance (e.g. swipe-to-check preview). */
    visualCompleted?: boolean;
    /** When set, overrides the device task-label display preference. */
    labelsVisible?: boolean;
    onCheckClick?: (event: MouseEvent) => void;
    checkRef?: (el: HTMLButtonElement | undefined) => void;
}

interface TaskCardViewProps {
    summary: string;
    labelIds: string[];
    completed?: boolean;
    visualCompleted?: boolean;
    showCheck?: boolean;
    onCheckClick?: (event: MouseEvent) => void;
    checkRef?: (el: HTMLButtonElement | undefined) => void;
    variant?: 'default' | 'projected';
    inertCheck?: boolean;
    generatorName?: string;
    /** Checklist items driving the partial-completion ring on the check button. */
    checklistItems?: ChecklistItem[];
    /** When set, overrides the device task-label display preference. */
    labelsVisible?: boolean;
    /** `marks` always shows thin color bars and ignores the show-labels preference. */
    labelsMode?: 'toggle' | 'marks';
}

/** Shared task-like card display for persisted tasks and generator templates. */
function TaskCardView(props: TaskCardViewProps): JSX.Element {
    const showCheck = () => props.showCheck ?? false;
    const showCompleted = createMemo(() => props.visualCompleted ?? props.completed ?? false);
    const labelsMode = () => props.labelsMode ?? 'toggle';
    const labelsVisible = () => labelsMode() === 'toggle' && (props.labelsVisible ?? showTaskLabels());
    const checklistRate = createMemo(() => completionRate(props.checklistItems));
    // Only an incomplete task with a started checklist previews its progress; state stays binary.
    const showChecklistRing = createMemo(() => showCheck() && !showCompleted() && checklistRate() > 0);
    const ringColor = createMemo(() => completionColor(checklistRate()));

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
                'task-card--labels-visible': labelsVisible(),
                'task-card--projected': props.variant === 'projected',
            }}
        >
            <Show when={showCheck()}>
                <span
                    class="task-card__check-shell"
                    classList={{ 'task-card__check-shell--ring': showChecklistRing() }}
                >
                    <Show when={showChecklistRing()}>
                        <CompletionRing
                            class="task-card__check-ring"
                            trackClass="task-card__check-track"
                            progressClass="task-card__check-progress"
                            rate={checklistRate()}
                            color={ringColor()}
                            size={CHECK_SIZE}
                            radius={CHECK_RING_RADIUS}
                        />
                    </Show>
                    <Show when={labelsMode() === 'toggle' && cardLabels().length > 0}>
                        <LabelRing labels={cardLabels()} />
                    </Show>
                    <Show
                        when={!props.inertCheck}
                        fallback={<span class="task-card__check task-card__check--inert" aria-hidden="true" />}
                    >
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
                    </Show>
                </span>
            </Show>
            <div class="task-card__content">
                <span class="task-card__summary">{props.summary}</span>
                <Show when={labelsMode() === 'marks'}>
                    <LabelMarks labelIds={props.labelIds} />
                </Show>
                <Show when={labelsMode() === 'toggle' && cardLabels().length > 0}>
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
            <Show when={props.generatorName}>
                {(name) => (
                    <span
                        class="task-card__generator-indicator"
                        role="img"
                        aria-label={`Projected by ${name()}`}
                        title={name()}
                    >
                        <Icon src={generatorIcon} width={16} height={16} />
                    </span>
                )}
            </Show>
        </div>
    );
}

function TaskCard(props: TaskCardProps): JSX.Element {
    return (
        <TaskCardView
            summary={props.task.summary}
            labelIds={props.task.labelIds}
            completed={props.task.completed}
            visualCompleted={props.visualCompleted}
            showCheck={true}
            checklistItems={props.task.checklistItems}
            labelsVisible={props.labelsVisible}
            onCheckClick={props.onCheckClick}
            checkRef={props.checkRef}
        />
    );
}

export type { TaskCardProps, TaskCardViewProps };
export { TaskCard, TaskCardView };
