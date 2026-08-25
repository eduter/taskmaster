import './LabelChip.css';

interface LabelChipProps {
    name: string;
    color: string;
    /** When set, opens the labels picker (edit surfaces only). */
    onClick?: () => void;
}

/** Colored pill showing a label name with contrasting text. */
function LabelChip(props: LabelChipProps) {
    const style = { '--label-color': props.color };
    const className = 'label-chip label-surface';

    if (props.onClick) {
        return (
            <button
                type="button"
                class={className}
                style={style}
                aria-label={`Edit label ${props.name}`}
                onClick={props.onClick}
            >
                {props.name}
            </button>
        );
    }

    return (
        <span class={className} style={style}>
            {props.name}
        </span>
    );
}

export type { LabelChipProps };
export { LabelChip };
