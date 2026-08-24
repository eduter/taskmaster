/** @vitest-environment jsdom */
import { cleanup, fireEvent, render, screen } from '@solidjs/testing-library';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ChecklistItem } from '../db/types.ts';
import { ChecklistEditor } from './ChecklistEditor.tsx';

const items: ChecklistItem[] = [
    { id: 'milk', summary: 'Milk', completed: false },
    { id: 'bread', summary: 'Bread', completed: true },
];

function tapRow(surface: HTMLElement, pointerId: number): void {
    surface.dispatchEvent(
        new PointerEvent('pointerdown', {
            bubbles: true,
            pointerId,
            pointerType: 'mouse',
            button: 0,
            clientX: 20,
            clientY: 20,
        })
    );
    document.dispatchEvent(
        new PointerEvent('pointerup', {
            bubbles: true,
            pointerId,
            pointerType: 'mouse',
            button: 0,
            clientX: 20,
            clientY: 20,
        })
    );
}

function stubRowLayouts(container: HTMLElement): void {
    const rows = container.querySelectorAll<HTMLElement>('.task-list__item');
    for (const [index, row] of [...rows].entries()) {
        const rect = DOMRect.fromRect({ x: 0, y: index * 52, width: 320, height: 44 });
        row.getBoundingClientRect = () => rect;
        for (const child of row.querySelectorAll<HTMLElement>('*')) {
            child.getBoundingClientRect = () => rect;
        }
    }
}

function dispatchMousePointer(target: EventTarget, type: string, clientY: number): void {
    target.dispatchEvent(
        new PointerEvent(type, {
            bubbles: true,
            cancelable: true,
            clientX: 160,
            clientY,
            pointerId: 7,
            pointerType: 'mouse',
            button: 0,
            buttons: type === 'pointerup' ? 0 : 1,
        })
    );
}

describe('ChecklistEditor', () => {
    afterEach(cleanup);

    it('places a matching plus button below the last item', () => {
        const { container } = render(() => (
            <ChecklistEditor
                items={items}
                onAdd={() => {}}
                onRename={() => {}}
                onDelete={() => {}}
                onReorder={() => {}}
            />
        ));

        const add = screen.getByRole('button', { name: 'Add checklist item' });
        const lastItem = screen.getByText('Bread');
        expect(add.compareDocumentPosition(lastItem) & Node.DOCUMENT_POSITION_PRECEDING).toBe(
            Node.DOCUMENT_POSITION_PRECEDING
        );
        expect(add.closest('.form-field-body')).toBeTruthy();
        expect(container.querySelector('.form-label')?.closest('.form-field-body')).toBeNull();
        expect(add.classList.contains('add-icon-btn')).toBe(true);
        expect(add.querySelector('svg')).toBeTruthy();
    });

    it('replaces the plus with the new-item input while adding', () => {
        render(() => (
            <ChecklistEditor
                items={items}
                onAdd={() => {}}
                onRename={() => {}}
                onDelete={() => {}}
                onReorder={() => {}}
            />
        ));

        fireEvent.click(screen.getByRole('button', { name: 'Add checklist item' }));
        expect(screen.queryByRole('button', { name: 'Add checklist item' })).toBeNull();
        expect(screen.getByRole('textbox', { name: 'New checklist item' })).toBeTruthy();
    });

    it('adds a focused checklist item inline', async () => {
        const onAdd = vi.fn();
        render(() => (
            <ChecklistEditor items={items} onAdd={onAdd} onRename={() => {}} onDelete={() => {}} onReorder={() => {}} />
        ));

        fireEvent.click(screen.getByRole('button', { name: 'Add checklist item' }));
        const input = screen.getByRole('textbox', { name: 'New checklist item' });
        await vi.waitFor(() => expect(document.activeElement).toBe(input));

        fireEvent.input(input, { target: { value: 'Eggs' } });
        fireEvent.keyDown(input, { key: 'Enter' });

        expect(onAdd).toHaveBeenCalledWith('Eggs');
    });

    it('renames an item inline and discards an empty edit', async () => {
        const onRename = vi.fn();
        const { container } = render(() => (
            <ChecklistEditor
                items={items}
                onAdd={() => {}}
                onRename={onRename}
                onDelete={() => {}}
                onReorder={() => {}}
            />
        ));

        const surfaces = container.querySelectorAll<HTMLElement>('.task-row__surface');
        tapRow(surfaces[0], 1);
        const input = await screen.findByRole('textbox', { name: 'Edit Milk' });
        fireEvent.input(input, { target: { value: 'Oat milk' } });
        fireEvent.blur(input);
        expect(onRename).toHaveBeenCalledWith('milk', 'Oat milk');

        tapRow(surfaces[1], 2);
        const emptyInput = await screen.findByRole('textbox', { name: 'Edit Bread' });
        fireEvent.input(emptyInput, { target: { value: '' } });
        fireEvent.blur(emptyInput);
        expect(onRename).toHaveBeenCalledTimes(1);
    });

    it('toggles and deletes checklist items', () => {
        const onToggle = vi.fn();
        const onDelete = vi.fn();
        render(() => (
            <ChecklistEditor
                items={items}
                onAdd={() => {}}
                onRename={() => {}}
                onToggle={onToggle}
                onDelete={onDelete}
                onReorder={() => {}}
            />
        ));

        fireEvent.click(screen.getByRole('button', { name: 'Mark Milk complete' }));
        expect(onToggle).toHaveBeenCalledWith('milk');

        const deleteButtons = screen.getAllByRole('button', { name: /Delete .* from checklist/ });
        fireEvent.click(deleteButtons[0]);
        expect(onDelete).toHaveBeenCalledWith('milk');
    });

    it('reorders checklist items by dragging', async () => {
        const onReorder = vi.fn();
        const { container } = render(() => (
            <ChecklistEditor
                items={items}
                onAdd={() => {}}
                onRename={() => {}}
                onDelete={() => {}}
                onReorder={onReorder}
            />
        ));
        stubRowLayouts(container);

        const firstSurface = container.querySelector<HTMLElement>('.task-row__surface');
        if (!firstSurface) {
            throw new Error('expected a checklist row');
        }
        dispatchMousePointer(firstSurface, 'pointerdown', 22);
        dispatchMousePointer(document, 'pointermove', 42);
        dispatchMousePointer(document, 'pointermove', 74);
        dispatchMousePointer(document, 'pointerup', 74);

        await vi.waitFor(() => expect(onReorder).toHaveBeenCalledWith(['bread', 'milk']));
    });

    it('checks an incomplete item with a right swipe', async () => {
        const onToggle = vi.fn();
        const { container } = render(() => (
            <ChecklistEditor
                items={items}
                onAdd={() => {}}
                onRename={() => {}}
                onToggle={onToggle}
                onDelete={() => {}}
                onReorder={() => {}}
            />
        ));
        const surface = container.querySelector<HTMLElement>('.task-row__surface');
        if (!surface) {
            throw new Error('expected a checklist row');
        }

        const pointer = (target: EventTarget, type: string, x: number) => {
            target.dispatchEvent(
                new PointerEvent(type, {
                    bubbles: true,
                    cancelable: true,
                    clientX: x,
                    clientY: 20,
                    pointerId: 8,
                    pointerType: 'touch',
                    button: 0,
                    buttons: type === 'pointerup' ? 0 : 1,
                })
            );
        };
        pointer(surface, 'pointerdown', 20);
        pointer(document, 'pointermove', 130);
        pointer(document, 'pointerup', 130);

        await vi.waitFor(() => expect(onToggle).toHaveBeenCalledWith('milk'));
    });
});
