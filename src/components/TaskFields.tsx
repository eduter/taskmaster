import { createMemo, For, type JSX } from 'solid-js';
import labelIcon from '../icons/label.svg?raw';
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
}

/** Shared summary, description, and labels fields for tasks and task templates. */
function TaskFields(props: TaskFieldsProps): JSX.Element {
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

    return (
        <>
            <div class="form-field">
                <label class="form-label" for={props.summaryInputId}>
                    Summary
                </label>
                <input
                    id={props.summaryInputId}
                    class="form-input"
                    type="text"
                    value={props.summary}
                    onInput={(e) => props.onSummaryChange(e.currentTarget.value)}
                />
            </div>

            <div class="form-field">
                <label class="form-label" for={props.descriptionInputId}>
                    Description
                </label>
                <textarea
                    id={props.descriptionInputId}
                    class="form-textarea"
                    value={props.description}
                    onInput={(e) => props.onDescriptionChange(e.currentTarget.value)}
                    rows={4}
                />
            </div>

            <div class="form-field">
                <span class="form-label">Labels</span>
                <div class="task-fields__labels-row">
                    <button
                        type="button"
                        class="task-fields__labels-btn"
                        aria-label={props.labelsButtonLabel ?? 'Edit labels'}
                        onClick={props.onOpenLabelsPicker}
                    >
                        <Icon src={labelIcon} width={18} height={18} />
                    </button>
                    <div class="task-fields__labels">
                        <For each={selectedLabels()}>
                            {(label) => <LabelChip name={label.name} color={label.color} />}
                        </For>
                    </div>
                </div>
            </div>
        </>
    );
}

export type { TaskFieldsProps };
export { TaskFields };
