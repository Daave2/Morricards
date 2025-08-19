
import { 
    addAvailabilityCapture as dbAddAvailability, 
    addProductFetch as dbAddProduct,
    listUnsyncedAvailability, 
    markAvailabilitySynced,
    listUnsyncedProducts,
    markProductsSynced,
    type AvailabilityCapturePayload,
    type ProductFetchPayload
} from './idb';
import { getProductData } from '@/app/actions';
import type { FetchMorrisonsDataOutput } from './morrisons-api';

export type SyncedProduct = FetchMorrisonsDataOutput[0];

export async function queueAvailabilityCapture(payload: AvailabilityCapturePayload) {
  await dbAddAvailability(payload);
  console.log('Queued availability capture for SKU:', payload.sku);
}

export async function queueProductFetch(payload: ProductFetchPayload): Promise<any> {
    await dbAddProduct(payload);
    console.log('Queued product fetch for SKU:', payload.sku);
    // Return a placeholder structure for immediate UI feedback
    return {
        sku: payload.sku,
        scannedSku: payload.sku,
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
        if (!locationGroups[item.payload.locationId]) {
            locationGroups[item.payload.locationId] = [];
        }
        locationGroups[item.payload.locationId].push(item.payload.sku);
    }
    
    const fetchedProducts: SyncedProduct[] = [];
    let syncedCount = 0;

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
                    .filter(item => item.payload.locationId === locationId && fetchedSkus.has(item.payload.sku))
                    .map(item => item.id);
                
                if (idsForThisBatch.length > 0) {
                  await markProductsSynced(idsForThisBatch);
                  syncedCount += idsForThisBatch.length;
                }
            }
        } catch (e) {
            console.error(`Unhandled error fetching products for location ${locationId}:`, e);
        }
    }

    if (syncedCount > 0) {
        console.log(`Sync flush: Successfully fetched and synced ${syncedCount} products.`);
    }

    return { products: fetchedProducts, syncedCount };
}
