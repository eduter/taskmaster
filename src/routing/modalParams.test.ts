import { describe, expect, it } from 'vitest';
import { hasSyncModal } from './modalParams.ts';

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
