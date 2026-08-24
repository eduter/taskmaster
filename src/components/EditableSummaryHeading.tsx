import { createEffect, createMemo, createSignal, on, Show, type JSX } from 'solid-js';
import './EditableSummaryHeading.css';

/** Inputs and lifecycle hooks for an editable dialog summary heading. */
interface EditableSummaryHeadingProps {
    summary: string;
    inputId: string;
    resetKey: string;
    onInput: (summary: string) => void;
    onCommit: () => void;
    onCancel: () => void;
}

/** Dialog heading that switches between display and focused summary editing. */
function EditableSummaryHeading(props: EditableSummaryHeadingProps): JSX.Element {
    const [editing, setEditing] = createSignal(false);
    const resetKey = createMemo(() => props.resetKey);

    createEffect(
        on(resetKey, () => {
            setEditing(false);
        })
    );

    function commit(): void {
        props.onCommit();
        setEditing(false);
    }

    function cancel(): void {
        props.onCancel();
        setEditing(false);
    }

    function focusAtEnd(input: HTMLInputElement): void {
        queueMicrotask(() => {
            if (!input.isConnected) {
                return;
            }
            input.focus();
            const end = input.value.length;
            input.setSelectionRange(end, end);
        });
    }

    return (
        <Show
            when={editing()}
            fallback={
                <button type="button" class="editable-summary-heading" onClick={() => setEditing(true)}>
                    {props.summary}
                </button>
            }
        >
            <input
                ref={focusAtEnd}
                id={props.inputId}
                class="editable-summary-heading__input"
                aria-label="Summary"
                value={props.summary}
                onInput={(event) => props.onInput(event.currentTarget.value)}
                onBlur={commit}
                onKeyDown={(event) => {
                    if (event.key === 'Enter') {
                        event.preventDefault();
                        commit();
                    } else if (event.key === 'Escape') {
                        event.preventDefault();
                        cancel();
                    }
                }}
            />
        </Show>
    );
}

export type { EditableSummaryHeadingProps };
export { EditableSummaryHeading };
