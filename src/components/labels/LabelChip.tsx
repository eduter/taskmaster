import { Show } from 'solid-js';
import './LabelChip.css';

interface LabelChipProps {
    name: string;
    color: string;
}

/** Colored pill showing a label name with contrasting text. */
function LabelChip(props: LabelChipProps) {
    const unnamed = () => !props.name.trim();

    return (
        <Show
            when={!unnamed()}
            fallback={
                <span
                    class="label-chip label-surface label-chip--unnamed"
                    style={{ '--label-color': props.color }}
                    role="img"
                    aria-label="Unnamed label"
                />
            }
        >
            <span class="label-chip label-surface" style={{ '--label-color': props.color }}>
                {props.name}
            </span>
        </Show>
    );
}

export type { LabelChipProps };
export { LabelChip };
