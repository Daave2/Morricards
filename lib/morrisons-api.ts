

/**
 * Browser-safe Morrisons API client:
 * - Uses Price Integrity (PI) for product details (browser OK).
 * - Uses Stock and Stock History; now sends Bearer if provided.
 * - Optional Product via your own server proxy (to get packComponents, etc).
 */

import type { components } from '../morrisons-types';
import type { StockOrder, Order as MorrisonsOrder, SpaceInfo } from '../morrisons-types';

const API_KEY = '0GYtUV6tIhQ3a9rED9XUqiEQIbFhFktW';

const BASE_STOCK = 'https://api.morrisons.com/stock/v2/locations';
const BASE_LOCN = 'https://api.morrisons.com/priceintegrity/v1/locations';
const BASE_STOCK_HISTORY = 'https://api.morrisons.com/storemobileapp/v1/stores';
const BASE_STOCK_ORDER = 'https://api.morrisons.com/stockorder/v1/customers/morrisons/orders';
const BASE_SPACE = 'https://api.morrisons.com/space/v1/locations';
const BASE_PRODUCT_PROXY = '/api/morrisons/product'; // Use the Next.js proxy

export type Order = MorrisonsOrder;

type Product = components['schemas']['Product'];
type PriceIntegrity = components['schemas']['PriceIntegrity'];
type StockPayload = components['schemas']['StockPayload'];

type StockHistory = {
  lastCountDateTime?: string;
  inventoryAction?: string;
  qty?: number;
  createdBy?: string;
};

export type DeliveryInfo = {
    expectedDate: string;
    quantity: number;
    totalUnits: number;
    quantityType: string;
    orderPosition: 'next' | 'last';
}

export type FetchMorrisonsDataInput = {
  locationId: string;
  skus: string[];
  bearerToken?: string;
  debugMode?: boolean;
};

export type FetchMorrisonsDataOutput = {
  sku: string;
  scannedSku: string;
  primaryEan13?: string | null;
  name: string;
  price: { regular?: number; promotional?: string };
  stockQuantity: number;
  stockUnit?: string;
  location: { standard?: string; secondary?: string; promotional?: string };
  temperature?: string;
  weight?: number;
  status?: string;
  stockSkuUsed?: string;
  productDetails: Product;
  lastStockChange?: StockHistory;
  deliveryInfo?: DeliveryInfo | null;
  allOrders?: Order[] | null;
  spaceInfo?: SpaceInfo | null;
  proxyError?: string | null;
}[];

// ─────────────────────────── core fetch helper ────────────────────────────
async function fetchJson<T>(
  url: string,
  {
    debug = false,
    bearer,
  }: {
    debug?: boolean;
    bearer?: string;
  } = {}
): Promise<T | null> {
  const headers = new Headers({
    Accept: 'application/json',
  });

  if (bearer) {
    headers.set('Authorization', `Bearer ${bearer}`);
  }

  const res = await fetch(url, {
    method: 'GET',
    headers,
    credentials: 'omit',
    mode: 'cors',
    cache: 'no-store',
  });

  if (res.status === 404) return null;
  
  if (!res.ok) {
    const body = debug ? await res.text().catch(() => '') : '';
    const intendedHeaders = {
      Accept: 'application/json',
      ...(bearer ? { Authorization: 'Bearer <redacted>' } : {}),
    };
    throw new Error(
      `HTTP error! status: ${res.status} for ${res.url}\nIntended headers: ${JSON.stringify(
        intendedHeaders,
        null,
        2
      )}\nResponse: ${body}`
    );
  }
  
  return (await res.json()) as T;
}


// ─────────────────────────── endpoint wrappers ────────────────────────────
// NEW: Uses our Next.js proxy to avoid CORS issues and hide the API key.
export async function fetchProductFromUpstream(
  sku: string,
  bearerToken?: string,
): Promise<{ product: Product | null; error: string | null }> {
  if (!sku) return { product: null, error: 'No SKU provided.' };
  
  const url = `${BASE_PRODUCT_PROXY}?sku=${encodeURIComponent(sku)}`;
  
  try {
    const res = await fetch(url, {
        headers: {
            ...(bearerToken ? { 'Authorization': `Bearer ${bearerToken}` } : {})
        },
        cache: 'no-store',
    });

    if (!res.ok) {
        const errData = await res.json().catch(() => ({ error: 'Failed to parse error response' }));
        return { product: null, error: `Product API Error ${res.status}: ${errData.error || errData.details || res.statusText}` };
    }

    const product = await res.json();
    if (!product) {
       return { product: null, error: `Product not found for SKU ${sku} via Product API.` };
    }
    return { product, error: null };

  } catch (error) {
    const errorMessage = `Error in fetchProductFromUpstream for SKU ${sku}: ${error instanceof Error ? error.message : String(error)}`;
    return { product: null, error: errorMessage };
  }
}

// Price Integrity: can work without a bearer token
async function getPI(locationId: string, sku: string, bearer?: string, debug?: boolean) {
  const url = `${BASE_LOCN}/${encodeURIComponent(locationId)}/items/${encodeURIComponent(
    sku
  )}?apikey=${encodeURIComponent(API_KEY)}`;
  return fetchJson<PriceIntegrity>(url, { debug, bearer });
}

// Stock: Requires a bearer token.
async function getStock(locationId: string, sku: string, bearer?: string, debug?: boolean) {
  if (!bearer) return null; // Don't even try without a token
  const url = `${BASE_STOCK}/${encodeURIComponent(locationId)}/items/${encodeURIComponent(
    sku
  )}?apikey=${encodeURIComponent(API_KEY)}`;
  return fetchJson<StockPayload>(url, { debug, bearer });
}

// Stock History: Requires a bearer token.
async function getStockHistory(locationId: string, sku: string, bearer?: string, debug?: boolean) {
  if (!bearer) return null;
  const url = `${BASE_STOCK_HISTORY}/${encodeURIComponent(locationId)}/items/${encodeURIComponent(
    sku
  )}?apikey=${encodeURIComponent(API_KEY)}`;
  return fetchJson<StockHistory>(url, { debug, bearer });
}

// Order Info: Requires a bearer token.
async function getOrderInfo(locationId: string, sku: string, bearer?: string, debug?: boolean) {
    if (!bearer) return null;
    const url = `${BASE_STOCK_ORDER}?location=${encodeURIComponent(locationId)}&type=StoreStandard&item=${encodeURIComponent(sku)}&orders=[last,next,current]&apikey=${encodeURIComponent(API_KEY)}`;
    return fetchJson<StockOrder>(url, { debug, bearer });
}

// Space Info: Requires a bearer token.
async function getSpaceInfo(locationId: string, sku: string, bearer?: string, debug?: boolean) {
    if (!bearer) return null;
    const url = `${BASE_SPACE}/${locationId}/items/${sku}?apikey=${API_KEY}`;
    return fetchJson<SpaceInfo>(url, { debug, bearer });
}

// ─────────────────────── location formatting helpers ──────────────────────
function niceLoc(raw: components['schemas']['Location']): string {
  const sideRe = /^([LR])(\d+)$/i;
  const aisle = raw.aisle || '';
  let bay = raw.bayNumber || '';
  const shelf = raw.shelfNumber || '';
  let side = '';

  const m = bay.match(sideRe);
  if (m) {
    side = m[1].toUpperCase() === 'L' ? 'Left' : 'Right';
    bay = m[2];
  }

  const parts: string[] = [];
  if (aisle) parts.push(`Aisle ${aisle}`); // Use raw aisle number
  if (side) parts.push(`${side} bay ${bay}`);
  else if (bay) parts.push(`Bay ${bay}`);
  if (shelf) parts.push(`shelf ${shelf}`);
  return parts.join(', ');
}

function simplifyLocations(lst?: components['schemas']['Location'][]): string[] {
  if (!lst?.length) return [];
  return lst.map(niceLoc);
}

function extractLocationBits(pi: PriceIntegrity | null): { std: string; secondary?: string; promo: string; walk: string } {
  if (!pi?.space) return { std: '', promo: '', walk: '' };
  const stdLocs = pi.space.standardSpace?.locations;
  const [std, ...secondary] = simplifyLocations(stdLocs);
  const promoLocs = pi.space.promotionalSpace?.locations;
  const [promo] = simplifyLocations(promoLocs);
  const walk = stdLocs?.[0]?.storeWalkSequence ? String(stdLocs[0].storeWalkSequence) : '';
  return { std: std || '', secondary: secondary.join('; ') || undefined, promo: promo || '', walk };
}

// ───────────────────────────── main API ─────────────────────────────
export async function fetchMorrisonsData(input: FetchMorrisonsDataInput): Promise<FetchMorrisonsDataOutput> {
  const { locationId, skus, bearerToken, debugMode } = input;

  const rows = await Promise.all(
    skus.map(async (scannedSku) => {
        try {
            // 1. Fetch from Price Integrity first. This is our baseline.
            const pi = await getPI(locationId, scannedSku, bearerToken, debugMode);
            const piProduct = pi?.product;
            
            // 2. Determine the "main" SKU. It might be the scanned one, or a parent pack.
            const mainSku = piProduct?.itemNumber?.toString() || scannedSku;
            
            // 3. Fetch the full, rich product data from our Next.js proxy.
            const { product: mainProduct, error: productError } = await fetchProductFromUpstream(mainSku, bearerToken);
            
            // 4. If PI gave us a different SKU (pack vs each), and fetching the main SKU failed, try again with the original scanned SKU.
            let fallbackProduct: Product | null = null;
            if (productError && mainSku !== scannedSku) {
                const { product } = await fetchProductFromUpstream(scannedSku, bearerToken);
                fallbackProduct = product;
            }
            
            const finalProductDetails: Product = {
                ...piProduct,
                ...(fallbackProduct || {}), // Apply fallback first
                ...(mainProduct || {}),   // Main product data takes precedence
            };

            if (Object.keys(finalProductDetails).length === 0) {
              throw new Error(`Could not retrieve any product details for SKU ${scannedSku}. Upstream error: ${productError}`);
            }

            // The SKU for stock/order lookups should be the one from the final details if available
            const stockAndOrderSku = finalProductDetails.itemNumber || mainSku;

            // 5. Fetch stock, order, and space info in parallel.
            const [stockPayload, stockHistory, orderInfo, spaceInfo] = await Promise.all([
                getStock(locationId, stockAndOrderSku, bearerToken, debugMode),
                getStockHistory(locationId, stockAndOrderSku, bearerToken, debugMode),
                getOrderInfo(locationId, stockAndOrderSku, bearerToken, debugMode),
                getSpaceInfo(locationId, stockAndOrderSku, bearerToken, debugMode),
            ]);

            // 6. Assemble the final, merged object
            const stockPosition = stockPayload?.stockPosition?.[0];
            const { std: stdLoc, secondary: secondaryLoc, promo: promoLoc } = extractLocationBits(pi);
            
            let deliveryInfo: DeliveryInfo | null = null;
            const allOrders = orderInfo?.orders;
            const relevantOrder = allOrders?.find(o => o.orderPosition === 'next') || allOrders?.find(o => o.orderPosition === 'last');
            
            if (relevantOrder) {
              const ordered = relevantOrder.lines?.status?.[0]?.ordered;
              const expectedDate = relevantOrder.delivery?.dateDeliveryExpected || ordered?.date?.split('T')[0];

              if (ordered && expectedDate) {
                  const packSize = 
                      ordered.packSize ?? 
                      relevantOrder.lines?.packSize ?? 
                      finalProductDetails?.packs?.[0]?.packQuantity ??
                      1;

                  const quantity = ordered.quantity || 0;
                  deliveryInfo = {
                      expectedDate: expectedDate,
                      quantity: quantity,
                      totalUnits: quantity * packSize,
                      quantityType: relevantOrder.lines?.quantityType ?? 'N/A',
                      orderPosition: relevantOrder.orderPosition as 'next' | 'last'
                  }
              }
            }

            const prices = (pi?.prices ?? []) as any[];
            const promos = (pi?.promotions ?? []) as any[];
            
            const name = finalProductDetails?.customerFriendlyDescription || piProduct?.customerFriendlyDescription || 'Unknown Product';
            const primaryEan13 = finalProductDetails?.gtins?.find(g => g.type === 'EAN13' && g.additionalProperties?.isPrimaryBarcode)?.id;

            return {
              sku: stockAndOrderSku,
              scannedSku,
              primaryEan13,
              name: name!,
              price: {
                regular: prices?.[0]?.regularPrice,
                promotional: promos?.[0]?.marketingAttributes?.offerValue,
              },
              stockQuantity: stockPosition?.qty ?? 0,
              stockUnit: stockPosition?.unitofMeasure || finalProductDetails?.standardUnitOfMeasure,
              location: { standard: stdLoc, secondary: secondaryLoc, promotional: promoLoc },
              temperature: finalProductDetails?.temperatureRegime,
              weight: finalProductDetails?.dimensions?.weight,
              status: finalProductDetails?.status,
              stockSkuUsed: undefined,
              productDetails: finalProductDetails,
              lastStockChange: stockHistory || undefined,
              deliveryInfo: deliveryInfo,
              allOrders: allOrders ?? null,
              spaceInfo: spaceInfo ?? null,
              proxyError: debugMode && productError ? `Product Proxy Error: ${productError}` : null,
            };
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : String(err);
            if (debugMode) console.error(`Failed to process SKU ${scannedSku}:`, errorMessage);
            return {
              sku: scannedSku,
              scannedSku,
              name: `Error fetching ${scannedSku}`,
              price: {},
              stockQuantity: 0,
              location: {},
              productDetails: {} as Product,
              proxyError: errorMessage,
            };
        }
    })
  );

  return rows.filter((r): r is Exclude<typeof r, { name: string; proxyError: string }> => 'name' in r && !r.name.startsWith('Error'));
}

    