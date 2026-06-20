import { createEffect, onCleanup, type JSX } from 'solid-js';
import './Dialog.css';

const DIALOG_SCROLL_LOCK_CLASS = 'dialog-scroll-lock';
const DIALOG_BASE_Z_INDEX = 100;

let scrollLockCount = 0;

function acquireScrollLock(): void {
    scrollLockCount++;
    if (scrollLockCount === 1) {
        document.documentElement.classList.add(DIALOG_SCROLL_LOCK_CLASS);
        document.body.classList.add(DIALOG_SCROLL_LOCK_CLASS);
    }
}

function releaseScrollLock(): void {
    scrollLockCount = Math.max(0, scrollLockCount - 1);
    if (scrollLockCount === 0) {
        document.documentElement.classList.remove(DIALOG_SCROLL_LOCK_CLASS);
        document.body.classList.remove(DIALOG_SCROLL_LOCK_CLASS);
    }
}

interface DialogProps {
    open: boolean;
    onClose: () => void;
    title: string;
    /** When it returns false, ESC, backdrop click, and × are ignored. */
    canClose?: () => boolean;
    /** Optional extra class on the inner panel (e.g. max-height tweaks). */
    panelClass?: string;
    closeLabel?: string;
    /** Stacking order when multiple dialogs are open; higher values render on top. */
    stackLevel?: number;
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

    createEffect(() => {
        if (!props.open) {
            return;
        }
        acquireScrollLock();
        onCleanup(releaseScrollLock);
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

    const stackLevel = () => props.stackLevel ?? 0;

    return (
        <dialog
            ref={dialogRef}
            class="dialog"
            style={{ 'z-index': `${DIALOG_BASE_Z_INDEX + stackLevel()}` }}
            aria-labelledby={titleId}
            onCancel={handleCancel}
        >
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
                <div class="dialog__body">{props.children}</div>
            </div>
        </dialog>
    );
}

export { Dialog };
