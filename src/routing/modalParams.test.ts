import { describe, expect, it } from 'vitest';
import { hasLabelsModal, hasSyncModal } from './modalParams.ts';

describe('hasSyncModal', () => {
    it('is false without modal=sync', () => {
        expect(hasSyncModal('')).toBe(false);
        expect(hasSyncModal('?modal=about')).toBe(false);
        expect(hasSyncModal('?other=1')).toBe(false);
    });

    it('is true when modal=sync', () => {
        expect(hasSyncModal('?modal=sync')).toBe(true);
        expect(hasSyncModal('?foo=1&modal=sync')).toBe(true);
    });
});

describe('hasLabelsModal', () => {
    it('is false without modal=labels', () => {
        expect(hasLabelsModal('')).toBe(false);
        expect(hasLabelsModal('?modal=sync')).toBe(false);
    });

    it('is true when modal=labels', () => {
        expect(hasLabelsModal('?modal=labels')).toBe(true);
        expect(hasLabelsModal('?foo=1&modal=labels')).toBe(true);
    });
});
