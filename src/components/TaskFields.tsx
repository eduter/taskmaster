import { createMemo, For, Show, type JSX } from 'solid-js';
import plusIcon from '../icons/plus.svg?raw';
import { labels } from '../stores/labelStore.ts';
import { Icon } from './Icon.tsx';
import { LabelChip } from './labels';
import './TaskFields.css';

interface TaskFieldsProps {
    summary: string;
    description: string;
    labelIds: string[];
    summaryInputId: string;
    descriptionInputId: string;
    onSummaryChange: (summary: string) => void;
    onDescriptionChange: (description: string) => void;
    onOpenLabelsPicker: () => void;
    labelsButtonLabel?: string;
    /** When false, the parent owns the summary heading. */
    includeSummary?: boolean;
    /** When false, description stays hidden behind an add action. */
    showDescription?: boolean;
    /** Hide the labels row when nothing is selected (task editor extras cover it). */
    hideEmptyLabels?: boolean;
}

/** Shared summary, description, and labels fields for tasks and task templates. */
function TaskFields(props: TaskFieldsProps): JSX.Element {
    const includeSummary = () => props.includeSummary !== false;
    const showDescription = () => props.showDescription !== false;

    const labelById = createMemo(() => {
        const map = new Map<string, { name: string; color: string }>();
        for (const label of labels() ?? []) {
            map.set(label.id, { name: label.name, color: label.color });
        }
        return map;
    });

    const selectedLabels = createMemo(() => {
        return props.labelIds
            .map((id) => {
                const label = labelById().get(id);
                return label ? { id, ...label } : null;
            })
            .filter((entry): entry is { id: string; name: string; color: string } => entry !== null);
    });

    const showLabelsRow = () => !props.hideEmptyLabels || selectedLabels().length > 0;

    return (
        <>
            <Show when={includeSummary()}>
                <div class="form-field">
                    <label class="form-label" for={props.summaryInputId}>
                        Summary
                    </label>
                    <div class="form-field-body">
                        <input
                            id={props.summaryInputId}
                            class="form-input"
                            type="text"
                            value={props.summary}
                            onInput={(e) => props.onSummaryChange(e.currentTarget.value)}
                        />
                    </div>
                </div>
            </Show>

            <Show when={showDescription()}>
                <div class="form-field">
                    <label class="form-label" for={props.descriptionInputId}>
                        Description
                    </label>
                    <div class="form-field-body">
                        <textarea
                            id={props.descriptionInputId}
                            class="form-textarea"
                            value={props.description}
                            onInput={(e) => props.onDescriptionChange(e.currentTarget.value)}
                            rows={4}
                        />
                    </div>
                </div>
            </Show>

            <Show when={showLabelsRow()}>
                <div class="form-field">
                    <span class="form-label">Labels</span>
                    <div class="form-field-body">
                        <div class="task-fields__labels">
                            <For each={selectedLabels()}>
                                {(label) => (
                                    <LabelChip
                                        name={label.name}
                                        color={label.color}
                                        onClick={props.onOpenLabelsPicker}
                                    />
                                )}
                            </For>
                            <button
                                type="button"
                                class="add-icon-btn"
                                aria-label={props.labelsButtonLabel ?? 'Edit labels'}
                                onClick={props.onOpenLabelsPicker}
                                style={{
                                    height: '22px',
                                    width: '22px',
                                }}
                            >
                                <Icon src={plusIcon} width={18} height={18} />
                            </button>
                        </div>
                    </div>
                </div>
            </Show>
        </>
    );
}

export type { TaskFieldsProps };
export { TaskFields };
