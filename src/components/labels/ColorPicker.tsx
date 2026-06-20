import { createUniqueId, For } from 'solid-js';
import { LABEL_PALETTE } from './palette.ts';
import './ColorPicker.css';

interface ColorPickerProps {
    value: string;
    onChange: (color: string) => void;
    colors?: readonly string[];
    'aria-label'?: string;
}

/** Icon-sized swatch that opens a popover grid of palette colors. */
function ColorPicker(props: ColorPickerProps) {
    const popoverId = createUniqueId();
    const colors = () => props.colors ?? LABEL_PALETTE;
    let popoverRef: HTMLDivElement | undefined;

    function selectColor(color: string) {
        props.onChange(color);
        popoverRef?.hidePopover();
    }

    return (
        <div class="color-picker">
            <button
                type="button"
                class="color-picker__trigger"
                style={{ '--swatch-color': props.value }}
                popovertarget={popoverId}
                aria-label={props['aria-label'] ?? 'Choose label color'}
            />
            <div ref={popoverRef} id={popoverId} class="color-picker__popover" popover="auto">
                <div class="color-picker__grid" role="listbox" aria-label="Label colors">
                    <For each={[...colors()]}>
                        {(color) => (
                            <button
                                type="button"
                                class="color-picker__swatch"
                                classList={{ 'color-picker__swatch--selected': props.value === color }}
                                style={{ '--swatch-color': color }}
                                role="option"
                                aria-selected={props.value === color}
                                aria-label={`Color ${color}`}
                                onClick={() => selectColor(color)}
                            />
                        )}
                    </For>
                </div>
            </div>
        </div>
    );
}

export type { ColorPickerProps };
export { ColorPicker };
