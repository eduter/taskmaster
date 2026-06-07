import { getLogicalDay } from '../utils/logicalDay.ts';
import { getDropboxClient, getDropboxErrorStatus, persistTokensFromClient } from './dropboxAuth.ts';
import type { SyncPayload } from './syncEngine.ts';

const SYNC_FILE = '/taskmaster/data.json';
const BACKUP_DIR = '/taskmaster/backups';

function backupPathForDay(day: string): string {
    return `${BACKUP_DIR}/data-${day}.json`;
}

/**
 * Copies the remote data file to a dated backup when it is from a prior
 * logical day. Skips if the backup path already exists. Backup failure blocks
 * the overwrite.
 */
async function ensureBackupBeforeOverwrite(
    remote: SyncPayload
): Promise<{ ok: true; day: string | null } | { ok: false }> {
    const dbx = getDropboxClient();
    if (!dbx) {
        return { ok: false };
    }

    const remoteDay = getLogicalDay(new Date(remote.lastModifiedAt));
    const today = getLogicalDay();
    if (remoteDay >= today) {
        return { ok: true, day: null };
    }

    const backupPath = backupPathForDay(remoteDay);

    try {
        await dbx.filesGetMetadata({ path: backupPath });
        persistTokensFromClient(dbx);
        return { ok: true, day: remoteDay };
    } catch (err: unknown) {
        const status = getDropboxErrorStatus(err);
        if (status !== 409) {
            return { ok: false };
        }
    }

    try {
        await dbx.filesCopyV2({
            from_path: SYNC_FILE,
            to_path: backupPath,
        });
        persistTokensFromClient(dbx);
        return { ok: true, day: remoteDay };
    } catch {
        return { ok: false };
    }
}

export { backupPathForDay, ensureBackupBeforeOverwrite };
