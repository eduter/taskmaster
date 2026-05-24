import { db } from "../db/database.ts";
import {
  clearTokens,
  getDropboxClient,
  getDropboxErrorMessage,
  getDropboxErrorStatus,
  isAuthenticated,
  persistTokensFromClient,
  tryRefreshAccessToken,
} from "./dropboxAuth.ts";
import {
  beginPush,
  beginSync,
  endOperation,
  hydrateLastSyncedAt,
  lastResult,
  markNeedsReauth,
  recordError,
  recordSuccess,
  refreshAuthState,
  setPendingPushScheduled,
} from "../stores/syncStore.ts";
import type { Task, Generator, SyncMeta } from "../db/types.ts";

const SYNC_FILE = "/taskmaster/data.json";
const DEBOUNCE_MS = 2000;

interface SyncPayload {
  version: 1;
  lastModifiedAt: number;
  tasks: Task[];
  generators: Generator[];
}

type SyncOutcome = {
  pulled: boolean;
  pushed: boolean;
  dataChanged: boolean;
};

let debounceTimer: ReturnType<typeof setTimeout> | null = null;

async function getSyncMeta(): Promise<SyncMeta> {
  const meta = await db.syncMeta.get("primary");
  return meta ?? { key: "primary", lastSyncedAt: 0, lastModifiedAt: 0 };
}

async function updateSyncMeta(changes: Partial<SyncMeta>): Promise<void> {
  const existing = await getSyncMeta();
  await db.syncMeta.put({ ...existing, ...changes });
}

async function markLocalChange(): Promise<void> {
  await updateSyncMeta({ lastModifiedAt: Date.now() });
}

async function buildPayload(): Promise<SyncPayload> {
  const [tasks, generators, meta] = await Promise.all([
    db.tasks.toArray(),
    db.generators.toArray(),
    getSyncMeta(),
  ]);
  return { version: 1, lastModifiedAt: meta.lastModifiedAt, tasks, generators };
}

async function applyPayload(payload: SyncPayload): Promise<void> {
  await db.transaction("rw", [db.tasks, db.generators, db.syncMeta], async () => {
    await db.tasks.clear();
    await db.generators.clear();
    await db.tasks.bulkAdd(payload.tasks);
    await db.generators.bulkAdd(payload.generators);
    await updateSyncMeta({
      lastSyncedAt: Date.now(),
      lastModifiedAt: payload.lastModifiedAt,
    });
  });
}

async function handleAuthFailure(err: unknown, context: string): Promise<never> {
  const status = getDropboxErrorStatus(err);
  const detail = getDropboxErrorMessage(err);

  if (status === 401) {
    const refreshed = await tryRefreshAccessToken();
    if (!refreshed) {
      clearTokens();
      markNeedsReauth("Dropbox session expired. Connect again to sync.");
      throw new Error(`${context}: authentication expired (401)`);
    }
    refreshAuthState();
    throw new Error(`${context}: authentication expired (401), retry`);
  }

  recordError(`${context}: ${detail}`);
  throw err instanceof Error ? err : new Error(detail);
}

async function pushToDropbox(): Promise<boolean> {
  const dbx = getDropboxClient();
  if (!dbx) return false;

  const payload = await buildPayload();
  const contents = JSON.stringify(payload);

  try {
    await dbx.filesUpload({
      path: SYNC_FILE,
      contents,
      mode: { ".tag": "overwrite" },
      mute: true,
    });
    persistTokensFromClient(dbx);
    const syncedAt = Date.now();
    await updateSyncMeta({ lastSyncedAt: syncedAt });
    recordSuccess("pushed", "Uploaded local changes to Dropbox", syncedAt);
    return true;
  } catch (err: unknown) {
    const status = getDropboxErrorStatus(err);
    if (status === 401) {
      try {
        await handleAuthFailure(err, "Upload failed");
      } catch (retryErr) {
        if (retryErr instanceof Error && retryErr.message.includes("retry")) {
          return pushToDropbox();
        }
        return false;
      }
    }
    console.error("Dropbox push failed:", err);
    recordError(`Upload failed: ${getDropboxErrorMessage(err)}`);
    return false;
  }
}

async function pullFromDropbox(): Promise<boolean> {
  const dbx = getDropboxClient();
  if (!dbx) return false;

  try {
    const response = await dbx.filesDownload({ path: SYNC_FILE });
    persistTokensFromClient(dbx);
    const blob = (response.result as unknown as { fileBlob: Blob }).fileBlob;
    const text = await blob.text();
    const remote: SyncPayload = JSON.parse(text);

    const meta = await getSyncMeta();
    if (remote.lastModifiedAt > meta.lastModifiedAt) {
      await applyPayload(remote);
      const syncedAt = Date.now();
      recordSuccess("pulled", "Downloaded newer data from Dropbox", syncedAt);
      return true;
    }
    return false;
  } catch (err: unknown) {
    const status = getDropboxErrorStatus(err);
    if (status === 409) {
      return false;
    }
    if (status === 401) {
      try {
        await handleAuthFailure(err, "Download failed");
      } catch (retryErr) {
        if (retryErr instanceof Error && retryErr.message.includes("retry")) {
          return pullFromDropbox();
        }
        return false;
      }
    }
    console.error("Dropbox pull failed:", err);
    recordError(`Download failed: ${getDropboxErrorMessage(err)}`);
    return false;
  }
}

async function sync(): Promise<SyncOutcome> {
  if (!isAuthenticated()) {
    recordError("Not connected to Dropbox");
    return { pulled: false, pushed: false, dataChanged: false };
  }

  beginSync();
  try {
    const pulled = await pullFromDropbox();
    if (pulled) {
      return { pulled: true, pushed: false, dataChanged: true };
    }

    const pushed = await pushToDropbox();
    if (pushed) {
      return { pulled: false, pushed: true, dataChanged: true };
    }

    if (lastResult() !== "error") {
      recordSuccess("up_to_date", "Already up to date with Dropbox");
    }
    return { pulled: false, pushed: false, dataChanged: false };
  } finally {
    endOperation();
  }
}

function schedulePush(): void {
  if (!isAuthenticated()) return;
  if (debounceTimer) clearTimeout(debounceTimer);
  setPendingPushScheduled(true);
  debounceTimer = setTimeout(async () => {
    debounceTimer = null;
    beginPush();
    try {
      await markLocalChange();
      await pushToDropbox();
    } finally {
      endOperation();
      setPendingPushScheduled(false);
    }
  }, DEBOUNCE_MS);
}

async function loadSyncMetaIntoStore(): Promise<void> {
  const meta = await getSyncMeta();
  hydrateLastSyncedAt(meta.lastSyncedAt);
}

export {
  sync,
  pushToDropbox,
  pullFromDropbox,
  schedulePush,
  markLocalChange,
  getSyncMeta,
  loadSyncMetaIntoStore,
};
export type { SyncPayload, SyncOutcome };
