

import { openDB, DBSchema, IDBPDatabase } from 'idb';

const DB_NAME = 'smu';
const DB_VERSION = 2; 

export const STORES = {
  AVAILABILITY: 'availability-captures',
  PRODUCTS: 'product-fetches',
} as const;

type StoreName = typeof STORES[keyof typeof STORES];


export interface AvailabilityCapturePayload {
  sku: string;
  locationId: string;
  reason: 'No Stock' | 'Low Stock' | 'Early Sellout' | 'Too Much Stock' | 'Other';
  comment?: string;
}

export interface ProductFetchPayload {
    sku: string;
    locationId: string;
}

interface SMU_DB extends DBSchema {
    [STORES.AVAILABILITY]: {
        key: string;
        value: {
          id: string,
          ts: number,
          payload: AvailabilityCapturePayload,
          synced: boolean,
        };
        indexes: { 'synced': number, 'ts': number };
    };
    [STORES.PRODUCTS]: {
        key: string;
        value: {
          id: string,
          ts: number,
          payload: ProductFetchPayload
          synced: boolean,
        };
        indexes: { 'synced': number, 'ts': number };
    }
}

let db: Promise<IDBPDatabase<SMU_DB>> | null = null;

function getDb() {
  if (typeof window === 'undefined') {
    // Return a dummy object for server-side rendering
    return {
      put: async () => {},
      getAllFromIndex: async () => [],
      get: async () => undefined,
      delete: async () => {},
      clear: async () => {},
    } as any;
  }
  if (!db) {
    db = openDB<SMU_DB>(DB_NAME, DB_VERSION, {
      upgrade(db, oldVersion, newVersion, transaction) {
        if (oldVersion < 2) {
            // Handle migration from 'captures' to 'availability-captures'
            // Use an untyped handle to check for the legacy store.
            const storeNames = Array.from(db.objectStoreNames);
            if (storeNames.includes('captures')) {
                db.deleteObjectStore('captures');
            }
             if (!storeNames.includes(STORES.AVAILABILITY)) {
                const s = db.createObjectStore(STORES.AVAILABILITY, { keyPath: 'id' });
                s.createIndex('synced', 'synced');
                s.createIndex('ts', 'ts');
             }

            if (!storeNames.includes(STORES.PRODUCTS)) {
              const s = db.createObjectStore(STORES.PRODUCTS, { keyPath: 'id'});
              s.createIndex('synced', 'synced');
              s.createIndex('ts', 'ts');
            }
        }
      }
    });
  }
  return db;
}


export async function putRecord<T extends StoreName>(storeName: T, record: SMU_DB[T]['value']) {
  return (await getDb()).put(storeName, record);
}

export async function getAllRecords<T extends StoreName>(storeName: T, indexName: keyof SMU_DB[T]['indexes'], query: IDBValidKey | IDBKeyRange) {
    return (await getDb()).getAllFromIndex(storeName, indexName as string, query);
}

export async function deleteRecord<T extends StoreName>(storeName: T, key: string) {
    return (await getDb()).delete(storeName, key);
}

export async function clearStore(storeName: StoreName) {
    return (await getDb()).clear(storeName);
}

export async function markSynced<T extends StoreName>(storeName: T, ids: string[]) {
  const d = await getDb();
  const tx = d.transaction(storeName, 'readwrite');
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
  const d = await getDb();
  
  for (const storeName of Object.values(STORES)) {
      const tx = d.transaction(storeName, 'readwrite');
      let cursor = await tx.store.index('ts').openCursor(IDBKeyRange.upperBound(cutoff));
      while (cursor) {
        await cursor.delete();
        cursor = await cursor.continue();
      }
      await tx.done;
  }
}
