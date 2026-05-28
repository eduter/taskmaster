import { describe, expect, it } from 'vitest';
import { applyReorder } from './reorder.ts';

describe('applyReorder', () => {
    it('returns null when draggable and droppable are the same', () => {
        expect(applyReorder(['a', 'b', 'c'], 'b', 'b')).toBeNull();
    });

    it('returns null when draggable id is unknown', () => {
        expect(applyReorder(['a', 'b', 'c'], 'x', 'b')).toBeNull();
    });

    it('returns null when droppable id is unknown', () => {
        expect(applyReorder(['a', 'b', 'c'], 'a', 'x')).toBeNull();
    });

    it('moves first item to last', () => {
        expect(applyReorder(['a', 'b', 'c'], 'a', 'c')).toEqual(['b', 'c', 'a']);
    });

    it('moves last item to first', () => {
        expect(applyReorder(['a', 'b', 'c'], 'c', 'a')).toEqual(['c', 'a', 'b']);
    });

    it('moves middle item to start', () => {
        expect(applyReorder(['a', 'b', 'c'], 'b', 'a')).toEqual(['b', 'a', 'c']);
    });

    it('moves middle item down one slot', () => {
        expect(applyReorder(['a', 'b', 'c'], 'b', 'c')).toEqual(['a', 'c', 'b']);
    });
});
