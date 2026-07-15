import { For, type JSX } from 'solid-js';
import type { Label } from '../../db/types.ts';
import './LabelRing.css';

interface LabelRingProps {
    labels: Label[];
}

/** Thin segmented ring that summarizes a task's labels around the checkbox. */
function LabelRing(props: LabelRingProps): JSX.Element {
    const ringLabels = () => [...props.labels].reverse();

    const sectorStyle = (index: number): JSX.CSSProperties => {
        const count = ringLabels().length;
        return {
            '--label-color': ringLabels()[index]?.color ?? 'transparent',
            '--label-start': `${index / count}turn`,
            '--label-sweep': `${1 / count}turn`,
            '--label-delay': `${index * 120}ms`,
            '--label-reverse-delay': `${(count - index - 1) * 120}ms`,
        };
    };

    return (
        <span class="label-ring" classList={{ 'label-ring--single': ringLabels().length === 1 }} aria-hidden="true">
            <For each={ringLabels()}>
                {(_, index) => <span class="label-ring__sector" style={sectorStyle(index())} />}
            </For>
        </span>
    );
}

export type { LabelRingProps };
export { LabelRing };
