import { For, type JSX } from 'solid-js';
import './SegmentedControl.css';

interface SegmentedOption<T extends string> {
    value: T;
    label: string;
}

interface SegmentedControlProps<T extends string> {
    label: string;
    value: T;
    options: SegmentedOption<T>[];
    onChange: (value: T) => void;
}

/** Accessible compact selector for mutually exclusive display options. */
function SegmentedControl<T extends string>(props: SegmentedControlProps<T>): JSX.Element {
    return (
        <fieldset class="segmented-control">
            <legend class="segmented-control__legend">{props.label}</legend>
            <For each={props.options}>
                {(option) => (
                    <button
                        type="button"
                        class="segmented-control__option"
                        classList={{ 'segmented-control__option--active': props.value === option.value }}
                        aria-pressed={props.value === option.value}
                        onClick={() => props.onChange(option.value)}
                    >
                        {option.label}
                    </button>
                )}
            </For>
        </fieldset>
    );
}

export type { SegmentedControlProps, SegmentedOption };
export { SegmentedControl };
