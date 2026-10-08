/** @vitest-environment jsdom */
import { cleanup, fireEvent, render, screen } from '@solidjs/testing-library';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Dialog } from './Dialog.tsx';

describe('Dialog', () => {
    beforeEach(() => {
        HTMLDialogElement.prototype.showModal = function showModal(): void {
            this.open = true;
        };
        HTMLDialogElement.prototype.close = function close(): void {
            this.open = false;
        };
    });

    afterEach(cleanup);

    it('requests close on the native cancel event so Android back dismisses it', () => {
        const onClose = vi.fn();
        render(() => (
            <Dialog open={true} onClose={onClose} title="Edit task">
                Body
            </Dialog>
        ));

        const dialog = screen.getByRole('dialog');
        const cancelEvent = new Event('cancel', { cancelable: true });
        fireEvent(dialog, cancelEvent);

        expect(cancelEvent.defaultPrevented).toBe(true);
        expect(onClose).toHaveBeenCalledOnce();
    });

    function renderDialog(onClose: () => void): HTMLElement {
        render(() => (
            <Dialog open={true} onClose={onClose} title="Edit task">
                Body
            </Dialog>
        ));
        const backdrop = document.querySelector<HTMLElement>('.dialog__backdrop');
        if (!backdrop) {
            throw new Error('backdrop not rendered');
        }
        return backdrop;
    }

    it('ignores a backdrop click with no matching pointerdown', () => {
        const onClose = vi.fn();
        const backdrop = renderDialog(onClose);

        // A tap that opens this dialog also emits a compatibility click; by the
        // time it fires the backdrop is mounted, but no pointerdown reached it.
        fireEvent.click(backdrop);

        expect(onClose).not.toHaveBeenCalled();
    });

    it('closes on a backdrop press (pointerdown then click)', () => {
        const onClose = vi.fn();
        const backdrop = renderDialog(onClose);

        fireEvent.pointerDown(backdrop);
        fireEvent.click(backdrop);

        expect(onClose).toHaveBeenCalledOnce();
    });

    it('closes on a backdrop press after an ignored stray click', () => {
        const onClose = vi.fn();
        const backdrop = renderDialog(onClose);

        fireEvent.click(backdrop);
        expect(onClose).not.toHaveBeenCalled();

        fireEvent.pointerDown(backdrop);
        fireEvent.click(backdrop);
        expect(onClose).toHaveBeenCalledOnce();
    });
});
