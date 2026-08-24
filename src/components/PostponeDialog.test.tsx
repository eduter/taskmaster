/** @vitest-environment jsdom */
import { cleanup, fireEvent, render, screen } from '@solidjs/testing-library';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PostponeDialog } from './PostponeDialog.tsx';

vi.mock('../stores/taskStore.ts', () => ({
    today: () => '2026-08-24',
}));

describe('PostponeDialog', () => {
    beforeEach(() => {
        HTMLDialogElement.prototype.showModal = function showModal(): void {
            this.open = true;
        };
    });

    afterEach(cleanup);

    it('offers postpone presets and a month grid', () => {
        render(() => (
            <PostponeDialog open={true} selectedDate="2026-08-24" onClose={() => {}} onPick={() => {}} />
        ));

        expect(screen.getByRole('heading', { name: 'When' })).toBeTruthy();
        expect(screen.getByRole('button', { name: 'Tomorrow' })).toBeTruthy();
        expect(screen.getByRole('button', { name: 'Next Monday' })).toBeTruthy();
        expect(screen.getByRole('button', { name: 'Next week' })).toBeTruthy();
        expect(screen.getByRole('button', { name: '2026-08-24' })).toBeTruthy();
        expect(screen.getByRole('button', { name: '2026-08-25' })).toBeTruthy();
    });

    it('picks a preset date', () => {
        const onPick = vi.fn();
        render(() => (
            <PostponeDialog open={true} selectedDate="2026-08-24" onClose={() => {}} onPick={onPick} />
        ));

        fireEvent.click(screen.getByRole('button', { name: 'Tomorrow' }));
        expect(onPick).toHaveBeenCalledWith('2026-08-25');
    });

    it('picks a calendar day on or after today', () => {
        const onPick = vi.fn();
        render(() => (
            <PostponeDialog open={true} selectedDate="2026-08-24" onClose={() => {}} onPick={onPick} />
        ));

        fireEvent.click(screen.getByRole('button', { name: '2026-08-28' }));
        expect(onPick).toHaveBeenCalledWith('2026-08-28');
    });

    it('does not pick days before today', () => {
        const onPick = vi.fn();
        render(() => (
            <PostponeDialog open={true} selectedDate="2026-08-24" onClose={() => {}} onPick={onPick} />
        ));

        expect(screen.getByRole('button', { name: '2026-08-23' })).toHaveProperty('disabled', true);
        expect(onPick).not.toHaveBeenCalled();
    });
});
