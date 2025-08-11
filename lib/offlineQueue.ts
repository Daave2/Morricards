

import { addAvailabilityCapture, listUnsyncedAvailability, markAvailabilitySynced, addProductFetch, listUnsyncedProducts, markProductsSynced, type AvailabilityCapture } from './idb';
import { getProductData } from '@/app/actions';
import type { FetchMorrisonsDataOutput } from './morrisons-api';

export type SyncedProduct = FetchMorrisonsDataOutput[0];

export async function queueAvailabilityCapture(c: Omit<AvailabilityCapture, 'id' | 'capturedAt' | 'synced'>) {
  const id = crypto.randomUUID();
  await addAvailabilityCapture({ id, capturedAt: Date.now(), synced: false, ...c });
  console.log('Queued availability capture:', id);
  return id;
}

export async function queueProductFetch(c: { sku: string, locationId: string }): Promise<any> {
    const id = c.sku; // Use SKU as ID to prevent duplicate queueing
    await addProductFetch({ ...c, id, capturedAt: Date.now(), synced: false });
    console.log('Queued product fetch:', id);
    // Return a placeholder structure
    return {
        sku: c.sku,
        scannedSku: c.sku,
        name: 'Offline Item',
        price: {},
        stockQuantity: 0,
        location: {},
        productDetails: {},
        isOffline: true,
    }
}


export async function flushAvailabilityQueue() {
  const items = await listUnsyncedAvailability();
  if (!items.length) {
    return { synced: 0 };
  }
  
  console.log(`Sync flush: Attempting to sync ${items.length} availability reports.`);
  
  // In a real app, this would POST to a server endpoint.
  // For this demo, we'll just simulate a successful sync by checking health.
  const res = await fetch('/api/health');

  if (!res.ok) {
    console.error('Sync flush: Health check failed, aborting availability sync.');
    throw new Error('sync-failed');
  }

  const acceptedIds = items.map(item => item.id);
  await markAvailabilitySynced(acceptedIds);
  console.log(`Sync flush: Successfully synced ${acceptedIds.length} availability reports.`);
  
  return { synced: acceptedIds.length };
}


export async function flushProductQueue({ bearerToken, debugMode }: { bearerToken?: string, debugMode?: boolean }): Promise<{ products: SyncedProduct[], syncedCount: number }> {
    const itemsToFetch = await listUnsyncedProducts();
    if (!itemsToFetch.length) {
        return { products: [], syncedCount: 0 };
    }

    console.log(`Sync flush: Attempting to fetch ${itemsToFetch.length} products.`);

    const locationGroups: Record<string, string[]> = {};
    for (const item of itemsToFetch) {
        if (!locationGroups[item.locationId]) {
            locationGroups[item.locationId] = [];
        }
        locationGroups[item.locationId].push(item.sku);
    }
    
    const fetchedProducts: SyncedProduct[] = [];
    const syncedIds: string[] = [];

    for (const locationId in locationGroups) {
        const skus = locationGroups[locationId];
        try {
            const { data, error } = await getProductData({
                locationId,
                skus,
                bearerToken,
                debugMode
            });
            if (error) {
                console.error(`Failed to fetch products for location ${locationId}:`, error);
                continue; // Try next location group
            }
            if (data) {
                fetchedProducts.push(...data);
                const fetchedSkus = new Set(data.map(p => p.sku));
                const idsForThisBatch = itemsToFetch
                    .filter(item => item.locationId === locationId && fetchedSkus.has(item.sku))
                    .map(item => item.id);
                syncedIds.push(...idsForThisBatch);
            }
        } catch (e) {
            console.error(`Unhandled error fetching products for location ${locationId}:`, e);
        }
    }

    if (syncedIds.length > 0) {
        await markProductsSynced(syncedIds);
        console.log(`Sync flush: Successfully fetched and synced ${syncedIds.length} products.`);
    }

    return { products: fetchedProducts, syncedCount: syncedIds.length };
}
