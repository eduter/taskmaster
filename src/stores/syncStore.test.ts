import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../sync/dropboxAuth.ts', () => ({
    isAuthenticated: () => false,
}));

describe('syncStore issue helpers', () => {
    beforeEach(async () => {
        vi.resetModules();
        const { markDisconnected } = await import('./syncStore.ts');
        markDisconnected();
    });

    afterEach(() => {
        vi.resetModules();
    });

    it('treats disconnected as not configured but not a sync failure', async () => {
        const { hasSyncFailure, hasSyncIssue, isSyncNotConfigured } = await import('./syncStore.ts');

        expect(isSyncNotConfigured()).toBe(true);
        expect(hasSyncIssue()).toBe(true);
        expect(hasSyncFailure()).toBe(false);
    });

    it('treats recorded errors as sync failures', async () => {
        const { hasSyncFailure, hasSyncIssue, isSyncNotConfigured, recordError } = await import('./syncStore.ts');

        recordError('Download failed: network error');

        expect(isSyncNotConfigured()).toBe(true);
        expect(hasSyncFailure()).toBe(true);
        expect(hasSyncIssue()).toBe(true);
    });

    it('treats needs_reauth as a sync failure', async () => {
        const { hasSyncFailure, hasSyncIssue, isSyncNotConfigured, markNeedsReauth } = await import('./syncStore.ts');

        markNeedsReauth('Dropbox session expired. Connect again to sync.');

        expect(isSyncNotConfigured()).toBe(false);
        expect(hasSyncFailure()).toBe(true);
        expect(hasSyncIssue()).toBe(true);
    });
});
