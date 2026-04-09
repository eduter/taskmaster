import { db } from "../db/database.ts";
import { getDropboxClient, isAuthenticated } from "./dropboxAuth.ts";
import type { Task, Generator, SyncMeta } from "../db/types.ts";

const SYNC_FILE = "/taskmaster/data.json";
const DEBOUNCE_MS = 2000;

interface SyncPayload {
  version: 1;
  lastModifiedAt: number;
  tasks: Task[];
  generators: Generator[];
}

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
    if (payload.tasks.length) await db.tasks.bulkAdd(payload.tasks);
    if (payload.generators.length) await db.generators.bulkAdd(payload.generators);
    await updateSyncMeta({
      lastSyncedAt: Date.now(),
      lastModifiedAt: payload.lastModifiedAt,
    });
  });
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
    await updateSyncMeta({ lastSyncedAt: Date.now() });
    return true;
  } catch (err) {
    console.error("Dropbox push failed:", err);
    return false;
  }
}

async function pullFromDropbox(): Promise<boolean> {
  const dbx = getDropboxClient();
  if (!dbx) return false;

  try {
    const response = await dbx.filesDownload({ path: SYNC_FILE });
    const blob = (response.result as unknown as { fileBlob: Blob }).fileBlob;
    const text = await blob.text();
    const remote: SyncPayload = JSON.parse(text);

    const meta = await getSyncMeta();
    if (remote.lastModifiedAt > meta.lastModifiedAt) {
      await applyPayload(remote);
      return true;
    }
    return false;
  } catch (err: unknown) {
    const dropboxError = err as { status?: number };
    if (dropboxError.status === 409) {
      return false;
    }
    console.error("Dropbox pull failed:", err);
    return false;
  }
}

async function sync(): Promise<boolean> {
  if (!isAuthenticated()) return false;

  const pulled = await pullFromDropbox();
  if (!pulled) {
    await pushToDropbox();
  }
  return pulled;
}

function schedulePush(): void {
  if (!isAuthenticated()) return;
  if (debounceTimer) clearTimeout(debounceTimer);
  debounceTimer = setTimeout(async () => {
    await markLocalChange();
    await pushToDropbox();
  }, DEBOUNCE_MS);
}

export {
  sync,
  pushToDropbox,
  pullFromDropbox,
  schedulePush,
  markLocalChange,
  getSyncMeta,
};
export type { SyncPayload };
