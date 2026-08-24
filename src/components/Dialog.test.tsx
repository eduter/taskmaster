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
});
