import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { SyncPayload } from './syncEngine.ts';

const mockFilesGetMetadata = vi.fn();
const mockFilesCopyV2 = vi.fn();

vi.mock('./dropboxAuth.ts', async (importOriginal) => {
    const actual = await importOriginal<typeof import('./dropboxAuth.ts')>();
    return {
        ...actual,
        getDropboxClient: () => ({
            filesGetMetadata: mockFilesGetMetadata,
            filesCopyV2: mockFilesCopyV2,
            auth: { getAccessToken: () => 'test-token' },
        }),
    };
});

const { backupPathForDay, ensureBackupBeforeOverwrite } = await import('./backups.ts');

function makePayload(lastModifiedAt: number): SyncPayload {
    return { version: 2, lastModifiedAt, labels: [], tasks: [], generators: [] };
}

describe('backups', () => {
    beforeEach(() => {
        mockFilesGetMetadata.mockReset();
        mockFilesCopyV2.mockReset();
        mockFilesCopyV2.mockResolvedValue({});
    });

    it('backupPathForDay returns dated path under backups dir', () => {
        expect(backupPathForDay('2026-05-22')).toBe('/taskmaster/backups/data-2026-05-22.json');
    });

    it('skips backup when remote is from today', async () => {
        const todayTs = Date.now();
        const result = await ensureBackupBeforeOverwrite(makePayload(todayTs));

        expect(result).toEqual({ ok: true, day: null });
        expect(mockFilesGetMetadata).not.toHaveBeenCalled();
        expect(mockFilesCopyV2).not.toHaveBeenCalled();
    });

    it('copies remote file when backup does not exist', async () => {
        const priorDayTs = new Date('2026-05-22T12:00:00').getTime();
        mockFilesGetMetadata.mockRejectedValue({ status: 409 });

        const result = await ensureBackupBeforeOverwrite(makePayload(priorDayTs));

        expect(result).toEqual({ ok: true, day: '2026-05-22' });
        expect(mockFilesCopyV2).toHaveBeenCalledWith({
            from_path: '/taskmaster/data.json',
            to_path: '/taskmaster/backups/data-2026-05-22.json',
        });
    });

    it('skips copy when backup already exists', async () => {
        const priorDayTs = new Date('2026-05-22T12:00:00').getTime();
        mockFilesGetMetadata.mockResolvedValue({});

        const result = await ensureBackupBeforeOverwrite(makePayload(priorDayTs));

        expect(result).toEqual({ ok: true, day: '2026-05-22' });
        expect(mockFilesCopyV2).not.toHaveBeenCalled();
    });

    it('returns failure when metadata check errors other than not found', async () => {
        const priorDayTs = new Date('2026-05-22T12:00:00').getTime();
        mockFilesGetMetadata.mockRejectedValue({ status: 500 });

        const result = await ensureBackupBeforeOverwrite(makePayload(priorDayTs));

        expect(result).toEqual({ ok: false });
        expect(mockFilesCopyV2).not.toHaveBeenCalled();
    });

    it('returns failure when copy fails', async () => {
        const priorDayTs = new Date('2026-05-22T12:00:00').getTime();
        mockFilesGetMetadata.mockRejectedValue({ status: 409 });
        mockFilesCopyV2.mockRejectedValue(new Error('copy failed'));

        const result = await ensureBackupBeforeOverwrite(makePayload(priorDayTs));

        expect(result).toEqual({ ok: false });
    });
});
