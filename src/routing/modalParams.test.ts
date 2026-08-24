import { describe, expect, it } from 'vitest';
import { hasLabelsModal, hasOverlayModal, hasPostponeModal, hasSyncModal } from './modalParams.ts';

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

describe('hasPostponeModal', () => {
    it('is false without modal=postpone', () => {
        expect(hasPostponeModal('')).toBe(false);
        expect(hasPostponeModal('?modal=labels')).toBe(false);
    });

    it('is true when modal=postpone', () => {
        expect(hasPostponeModal('?modal=postpone')).toBe(true);
        expect(hasPostponeModal('?foo=1&modal=postpone')).toBe(true);
    });
});

describe('hasOverlayModal', () => {
    it('is true for route-preserved overlays', () => {
        expect(hasOverlayModal('?modal=sync')).toBe(true);
        expect(hasOverlayModal('?modal=labels')).toBe(true);
        expect(hasOverlayModal('?modal=postpone')).toBe(true);
    });

    it('is false without a route-preserved overlay', () => {
        expect(hasOverlayModal('')).toBe(false);
        expect(hasOverlayModal('?modal=about')).toBe(false);
    });
});
