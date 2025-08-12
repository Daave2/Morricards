
import { openDB, type DBSchema, type IDBPDatabase, type IDBPCursor, type IDBDatabase } from 'idb';

const DB_NAME = 'smu';
const DB_VERSION = 2; 

export const STORES = {
  AVAILABILITY: 'availability-captures',
  PRODUCTS: 'product-fetches',
} as const;

type StoreName = typeof STORES[keyof typeof STORES];
type IndexName<T extends StoreName> = Extract<keyof SMU_DB[T]['indexes'], string>;

export type AvailabilityReason = 'No Stock' | 'Low Stock' | 'Early Sellout' | 'Too Much Stock' | 'Other';

export interface AvailabilityCapturePayload {
  sku: string;
  locationId: string;
  reason: AvailabilityReason;
  comment?: string;
}

export interface AvailabilityCapture {
  id: string;
  ts: number;
  payload: AvailabilityCapturePayload
  synced: boolean,
};

export interface ProductFetchPayload {
    sku: string;
    locationId: string;
}

export interface ProductFetch {
  id: string;
  ts: number;
  payload: ProductFetchPayload
  synced: boolean,
};

interface SMU_DB extends DBSchema {
    [STORES.AVAILABILITY]: {
        key: string;
        value: AvailabilityCapture;
        indexes: { 'synced': number, 'ts': number };
    };
    [STORES.PRODUCTS]: {
        key: string;
        value: ProductFetch;
        indexes: { 'synced': number, 'ts': number };
    }
}

let db: IDBPDatabase<SMU_DB> | null = null;

function getDb(): IDBPDatabase<SMU_DB> {
  if (typeof window === 'undefined') {
    // Return a mock DB object for server-side rendering
    return {
      put: async () => {},
      getAllFromIndex: async () => [],
      get: async () => undefined,
      delete: async () => {},
      clear: async () => {},
      transaction: () => ({
        store: {
          get: async () => undefined,
          put: async () => {},
          openCursor: async () => null,
        },
        done: Promise.resolve(),
      }),
    } as any as IDBPDatabase<SMU_DB>;
  }
  if (!db) {
    db = openDB<SMU_DB>(DB_NAME, DB_VERSION, {
      upgrade(db, oldVersion, newVersion, transaction) {
        // Escape hatch: use the raw IDB types ONLY for legacy ops.
        const rawDb = (db as unknown) as IDBDatabase;

        if (oldVersion < 2) {
            if (rawDb.objectStoreNames.contains('captures')) {
                rawDb.deleteObjectStore('captures');
            }

            if (!rawDb.objectStoreNames.contains(STORES.AVAILABILITY)) {
                const s = db.createObjectStore(STORES.AVAILABILITY, { keyPath: 'id' });
                s.createIndex('synced', 'synced');
                s.createIndex('ts', 'ts');
            }

            if (!rawDb.objectStoreNames.contains(STORES.PRODUCTS)) {
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


async function putRecord<T extends StoreName>(storeName: T, record: SMU_DB[T]['value']) {
  return (await getDb()).put(storeName, record);
}

async function getAllRecords<T extends StoreName>(storeName: T, indexName: IndexName<T>, query: IDBValidKey | IDBKeyRange) {
    return (await getDb()).getAllFromIndex(storeName, indexName, query);
}

async function deleteRecord<T extends StoreName>(storeName: T, key: string) {
    return (await getDb()).delete(storeName, key);
}

export async function clearStore(storeName: StoreName) {
    return (await getDb()).clear(storeName);
}

async function markSynced<T extends StoreName>(storeName: T, ids: string[]) {
  const d = await getDb();
  const tx = d.transaction(storeName, 'readwrite');
  for (const id of ids) {
    const rec = await tx.store.get(id);
    if (rec) { 
        (rec as any).synced = true; 
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

// Functions moved from offlineQueue.ts to break circular dependency
export async function addAvailabilityCapture(payload: AvailabilityCapturePayload) {
  const full: AvailabilityCapture = {
    id: crypto.randomUUID(),
    ts: Date.now(),
    payload,
    synced: false,
  };
  await putRecord(STORES.AVAILABILITY, full);
}

export async function addProductFetch(payload: ProductFetchPayload) {
    const full: ProductFetch = {
      id: payload.sku, // Use SKU as ID to prevent duplicate queueing
      ts: Date.now(),
      payload,
      synced: false,
    };
    await putRecord(STORES.PRODUCTS, full);
}

export async function listUnsyncedAvailability(): Promise<AvailabilityCapture[]> {
    return getAllRecords(STORES.AVAILABILITY, 'synced', 0);
}

export async function listUnsyncedProducts(): Promise<ProductFetch[]> {
    return getAllRecords(STORES.PRODUCTS, 'synced', 0);
}

export async function markAvailabilitySynced(ids: string[]) {
    await markSynced(STORES.AVAILABILITY, ids);
}

export async function markProductsSynced(ids: string[]) {
    await markSynced(STORES.PRODUCTS, ids);
}

