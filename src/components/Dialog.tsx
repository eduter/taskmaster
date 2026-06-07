import { createEffect, type JSX } from 'solid-js';
import './Dialog.css';

interface DialogProps {
    open: boolean;
    onClose: () => void;
    title: string;
    /** When it returns false, ESC, backdrop click, and × are ignored. */
    canClose?: () => boolean;
    /** Optional extra class on the inner panel (e.g. max-height tweaks). */
    panelClass?: string;
    closeLabel?: string;
    children: JSX.Element;
}

/** Modal dialog built on the native `<dialog>` element with ESC and backdrop dismiss. */
function Dialog(props: DialogProps) {
    let dialogRef: HTMLDialogElement | undefined;
    const titleId = `dialog-title-${Math.random().toString(36).slice(2, 9)}`;

    createEffect(() => {
        const el = dialogRef;
        if (!el) {
            return;
        }
        if (props.open) {
            if (!el.open) {
                el.showModal();
            }
        } else if (el.open) {
            el.close();
        }
    });

    function requestClose() {
        if (props.canClose?.() === false) {
            return;
        }
        props.onClose();
    }

    function handleCancel(e: Event) {
        e.preventDefault();
        requestClose();
    }

    return (
        <dialog ref={dialogRef} class="dialog" aria-labelledby={titleId} onCancel={handleCancel}>
            <button
                type="button"
                class="dialog__backdrop"
                aria-label={props.closeLabel ?? 'Close'}
                onClick={requestClose}
            />
            <div class={`dialog__panel${props.panelClass ? ` ${props.panelClass}` : ''}`}>
                <div class="dialog__header">
                    <h2 id={titleId} class="dialog__title">
                        {props.title}
                    </h2>
                    <button
                        type="button"
                        class="dialog__close"
                        onClick={requestClose}
                        aria-label={props.closeLabel ?? 'Close'}
                    >
                        &times;
                    </button>
                </div>
                {props.children}
            </div>
        </dialog>
    );
}

export { Dialog };
