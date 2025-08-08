import { openDB } from 'idb';

const DB_NAME = 'smu';
const DB_VERSION = 1;

export type Capture = {
  id: string; // uuid
  sku: string;
  locationId: string;
  reason: 'No Stock' | 'Low Stock' | 'Early Sellout' | 'Too Much Stock' | 'Other';
  comment?: string;
  capturedAt: number; // Date.now()
  synced?: boolean;
};

export async function db() {
  return openDB(DB_NAME, DB_VERSION, {
    upgrade(db) {
      if (!db.objectStoreNames.contains('captures')) {
        const s = db.createObjectStore('captures', { keyPath: 'id' });
        s.createIndex('synced', 'synced');
        s.createIndex('capturedAt', 'capturedAt');
      }
    }
  });
}

export async function addCapture(c: Capture) {
  return (await db()).put('captures', c);
}

export async function listUnsynced() {
  return (await db()).getAllFromIndex('captures', 'synced', 0);
}

export async function markSynced(ids: string[]) {
  const d = await db();
  const tx = d.transaction('captures', 'readwrite');
  for (const id of ids) {
    const rec = await tx.store.get(id);
    if (rec) { rec.synced = true; await tx.store.put(rec); }
  }
  await tx.done;
}

export async function clearOld(days = 14) {
  const cutoff = Date.now() - days * 86400000;
  const d = await db();
  let cursor = await d.transaction('captures').store.openCursor();
  while (cursor) {
    if (cursor.value.capturedAt < cutoff) await cursor.delete();
    cursor = await cursor.continue();
  }
}
