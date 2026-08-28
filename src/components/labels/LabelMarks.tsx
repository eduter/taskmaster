import { createMemo, For, Show, type JSX } from 'solid-js';
import type { Label } from '../../db/types.ts';
import { labels } from '../../stores/labelStore.ts';
import './LabelMarks.css';

/** Selected labels rendered as always-visible color bars. */
interface LabelMarksProps {
    labelIds: string[];
}

/** First-seen label ids across one or more id lists. */
function uniqueLabelIds(groups: readonly (readonly string[])[]): string[] {
    const seen = new Set<string>();
    const ids: string[] = [];

    for (const group of groups) {
        for (const id of group) {
            if (seen.has(id)) {
                continue;
            }
            seen.add(id);
            ids.push(id);
        }
    }

    return ids;
}

/** Thin color bars for labels that stay visible and never show names. */
function LabelMarks(props: LabelMarksProps): JSX.Element {
    const resolved = createMemo(() => {
        const byId = new Map((labels() ?? []).map((label) => [label.id, label]));
        return props.labelIds.map((id) => byId.get(id)).filter((label): label is Label => label !== undefined);
    });

    return (
        <Show when={resolved().length > 0}>
            <span class="label-marks" aria-hidden="true">
                <For each={resolved()}>
                    {(label) => <span class="label-marks__bar" style={{ background: label.color }} />}
                </For>
            </span>
        </Show>
    );
}

export type { LabelMarksProps };
export { LabelMarks, uniqueLabelIds };
