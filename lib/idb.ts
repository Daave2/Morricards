
import {
  openDB,
  type DBSchema,
  type IDBPDatabase,
  type StoreNames,
  type IndexNames,
  type IndexKey,
} from 'idb';

const DB_NAME = 'smu';
const DB_VERSION = 2;

export const STORES = {
  AVAILABILITY: 'availability-captures',
  PRODUCTS: 'product-fetches',
} as const;

export type AvailabilityReason =
  | 'No Stock'
  | 'Low Stock'
  | 'Early Sellout'
  | 'Too Much Stock'
  | 'Other';

export interface AvailabilityCapturePayload {
  sku: string;
  locationId: string;
  reason: AvailabilityReason;
  comment?: string;
}

export interface AvailabilityCapture {
  id: string;
  ts: number;
  payload: AvailabilityCapturePayload;
  // numeric flag so it’s an IDBValidKey
  synced: 0 | 1;
}

export interface ProductFetchPayload {
  sku: string;
  locationId: string;
}

export interface ProductFetch {
  id: string;
  ts: number;
  payload: ProductFetchPayload;
  // numeric flag so it’s an IDBValidKey
  synced: 0 | 1;
}

/**
 * IMPORTANT: Use literal store names as keys.
 * DBSchema requires each key to be the exact object store name string.
 */
interface SMU_DB extends DBSchema {
  'availability-captures': {
    key: string;
    value: AvailabilityCapture;
    indexes: { synced: number; ts: number };
  };
  'product-fetches': {
    key: string;
    value: ProductFetch;
    indexes: { synced: number; ts: number };
  };
}

// Types derived from idb helpers (always correct for your schema)
type StoreName = StoreNames<SMU_DB>;
type IndexName<S extends StoreName> = IndexNames<SMU_DB, S>;

// Hold the promise so we only open once
let dbPromise: Promise<IDBPDatabase<SMU_DB>> | null = null;

async function getDb(): Promise<IDBPDatabase<SMU_DB>> {
  // SSR-safe mock
  if (typeof window === 'undefined') {
    const mock = {
      put: async () => undefined,
      getAllFromIndex: async () => [] as any[],
      get: async () => undefined,
      delete: async () => undefined,
      clear: async () => undefined,
      transaction: () =>
        ({
          store: {
            get: async () => undefined,
            put: async () => undefined,
            index: (_: string) =>
              ({
                openCursor: async () => null,
              } as any),
          },
          done: Promise.resolve(),
        } as any),
    } as unknown as IDBPDatabase<SMU_DB>;
    return mock;
  }

  if (!dbPromise) {
    dbPromise = openDB<SMU_DB>(DB_NAME, DB_VERSION, {
      upgrade(db) {
        const names: string[] = Array.from(
          ((db as any).objectStoreNames ?? []) as DOMStringList | string[]
        ) as string[];

        const contains = (n: string) =>
          typeof (db as any).objectStoreNames?.contains === 'function'
            ? (db as any).objectStoreNames.contains(n)
            : names.includes(n);

        // Remove legacy store if present
        if (contains('captures')) {
          (db as any).deleteObjectStore?.('captures');
        }

        if (!contains(STORES.AVAILABILITY)) {
          const s = db.createObjectStore(STORES.AVAILABILITY, { keyPath: 'id' });
          s.createIndex('synced', 'synced');
          s.createIndex('ts', 'ts');
        }

        if (!contains(STORES.PRODUCTS)) {
          const s = db.createObjectStore(STORES.PRODUCTS, { keyPath: 'id' });
          s.createIndex('synced', 'synced');
          s.createIndex('ts', 'ts');
        }
      },
    });
  }

  return dbPromise;
}

async function putRecord<S extends StoreName>(
  storeName: S,
  record: SMU_DB[S]['value']
) {
  return (await getDb()).put(storeName, record);
}

/**
 * getAllRecords with types bound to the specific index's key type.
 * IndexKey<DB, Store, Index> is exported by `idb` and exactly matches what
 * IDBPDatabase.getAllFromIndex expects, so no more assignment errors.
 */
async function getAllRecords<S extends StoreName, I extends IndexName<S>>(
  storeName: S,
  indexName: I,
  query: IndexKey<SMU_DB, S, I> | IDBKeyRange
) {
  return (await getDb()).getAllFromIndex(storeName, indexName, query);
}

async function deleteRecord<S extends StoreName>(storeName: S, key: string) {
  return (await getDb()).delete(storeName, key);
}

export async function clearStore(storeName: StoreName) {
  return (await getDb()).clear(storeName);
}

async function markSynced<S extends StoreName>(storeName: S, ids: string[]) {
  const d = await getDb();
  const tx = d.transaction(storeName, 'readwrite');
  for (const id of ids) {
    const rec = await tx.store.get(id);
    if (rec) {
      (rec as any).synced = 1 as const;
      await tx.store.put(rec);
    }
  }
  await tx.done;
}

export async function clearOld(days = 14) {
  const cutoff = Date.now() - days * 86_400_000;
  const d = await getDb();

  for (const storeName of Object.values(STORES)) {
    const tx = d.transaction(storeName, 'readwrite');
    const idx = tx.store.index('ts');
    let cursor = await idx.openCursor(IDBKeyRange.upperBound(cutoff));
    while (cursor) {
      await cursor.delete();
      cursor = await cursor.continue();
    }
    await tx.done;
  }
}

// ---- Public helpers ---------------------------------------------------------

export async function addAvailabilityCapture(payload: AvailabilityCapturePayload) {
  const full: AvailabilityCapture = {
    id: crypto.randomUUID(),
    ts: Date.now(),
    payload,
    synced: 0,
  };
  await putRecord(STORES.AVAILABILITY, full);
}

export async function addProductFetch(payload: ProductFetchPayload) {
  const full: ProductFetch = {
    id: crypto.randomUUID(),
    ts: Date.now(),
    payload,
    synced: 0,
  };
  await putRecord(STORES.PRODUCTS, full);
}

export async function listUnsyncedAvailability(): Promise<AvailabilityCapture[]> {
  return getAllRecords(
    STORES.AVAILABILITY,
    'synced',
    0 // matches index key type (number)
  );
}

export async function listUnsyncedProducts(): Promise<ProductFetch[]> {
  return getAllRecords(
    STORES.PRODUCTS,
    'synced',
    0 // matches index key type (number)
  );
}

export async function markAvailabilitySynced(ids: string[]) {
  await markSynced(STORES.AVAILABILITY, ids);
}

export async function markProductsSynced(ids: string[]) {
  await markSynced(STORES.PRODUCTS, ids);
}
