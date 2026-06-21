import './LabelChip.css';

interface LabelChipProps {
    name: string;
    color: string;
}

/** Colored pill showing a label name with contrasting text. */
function LabelChip(props: LabelChipProps) {
    return (
        <span class="label-chip label-surface" style={{ '--label-color': props.color }}>
            {props.name}
        </span>
    );
}

export type { LabelChipProps };
export { LabelChip };
