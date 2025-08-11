

import { openDB, DBSchema } from 'idb';

const DB_NAME = 'smu';
const DB_VERSION = 2; // Bump version for schema change

export type AvailabilityCapture = {
  id: string; // uuid
  sku: string;
  locationId: string;
  reason: 'No Stock' | 'Low Stock' | 'Early Sellout' | 'Too Much Stock' | 'Other';
  comment?: string;
  capturedAt: number; // Date.now()
  synced?: boolean;
};

export type ProductFetch = {
    id: string; // uuid - can be the SKU for simplicity if unique fetches are needed
    sku: string;
    locationId: string;
    capturedAt: number;
    synced?: boolean;
}

interface SMU_DB extends DBSchema {
    'availability-captures': {
        key: string;
        value: AvailabilityCapture;
        indexes: { 'synced': number, 'capturedAt': number };
    };
    'product-fetches': {
        key: string;
        value: ProductFetch;
        indexes: { 'synced': number, 'capturedAt': number };
    }
}


export async function db() {
  return openDB<SMU_DB>(DB_NAME, DB_VERSION, {
    upgrade(db, oldVersion, newVersion, transaction) {
      if (oldVersion < 1) {
        if (!db.objectStoreNames.contains('availability-captures')) {
            const availabilityStore = db.createObjectStore('availability-captures', { keyPath: 'id' });
            availabilityStore.createIndex('synced', 'synced');
            availabilityStore.createIndex('capturedAt', 'capturedAt');
        }
      }
      if (oldVersion < 2) {
          // Handle migration from 'captures' to 'availability-captures'
          if (db.objectStoreNames.contains('captures')) {
              db.deleteObjectStore('captures');
          }
           if (!db.objectStoreNames.contains('availability-captures')) {
              const availabilityStore = db.createObjectStore('availability-captures', { keyPath: 'id' });
              availabilityStore.createIndex('synced', 'synced');
              availabilityStore.createIndex('capturedAt', 'capturedAt');
           }

          if (!db.objectStoreNames.contains('product-fetches')) {
            const productStore = db.createObjectStore('product-fetches', { keyPath: 'id'});
            productStore.createIndex('synced', 'synced');
            productStore.createIndex('capturedAt', 'capturedAt');
          }
      }
    }
  });
}

// Availability Captures
export async function addAvailabilityCapture(c: AvailabilityCapture) {
  return (await db()).put('availability-captures', c);
}

export async function listUnsyncedAvailability() {
  return (await db()).getAllFromIndex('availability-captures', 'synced', 0);
}

export async function markAvailabilitySynced(ids: string[]) {
  const d = await db();
  const tx = d.transaction('availability-captures', 'readwrite');
  for (const id of ids) {
    const rec = await tx.store.get(id);
    if (rec) { rec.synced = true; await tx.store.put(rec); }
  }
  await tx.done;
}

// Product Fetches
export async function addProductFetch(p: ProductFetch) {
    return (await db()).put('product-fetches', p);
}

export async function getProductFetch(id: string) {
    return (await db()).get('product-fetches', id);
}

export async function listUnsyncedProducts() {
    return (await db()).getAllFromIndex('product-fetches', 'synced', 0);
}

export async function markProductsSynced(ids: string[]) {
    const d = await db();
    const tx = d.transaction('product-fetches', 'readwrite');
    for (const id of ids) {
        const rec = await tx.store.get(id);
        if (rec) {
            rec.synced = true;
            await tx.store.put(rec);
        }
    }
    await tx.done;
}


export async function clearOld(days = 14) {
  const cutoff = Date.now() - days * 86400000;
  const d = await db();
  
  const tx1 = d.transaction('availability-captures', 'readwrite');
  let cursor1 = await tx1.store.openCursor();
  while (cursor1) {
    if (cursor1.value.capturedAt < cutoff) await cursor1.delete();
    cursor1 = await cursor1.continue();
  }
  await tx1.done;

  const tx2 = d.transaction('product-fetches', 'readwrite');
  let cursor2 = await tx2.store.openCursor();
  while(cursor2) {
      if (cursor2.value.capturedAt < cutoff) await cursor2.delete();
      cursor2 = await cursor2.continue();
  }
  await tx2.done;
}
