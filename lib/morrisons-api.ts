

/**
 * Browser-safe Morrisons API client:
 * - Uses Price Integrity (PI) for product details (browser OK).
 * - Uses Stock and Stock History; now sends Bearer if provided.
 * - Optional Product via your own server proxy (to get packComponents, etc).
 */

import type { components, Order } from '../morrisons-types';
import type { StockOrder } from '../morrisons-types';

const API_KEY = '0GYtUV6tIhQ3a9rED9XUqiEQIbFhFktW';

const BASE_STOCK = 'https://api.morrisons.com/stock/v2/locations';
const BASE_LOCN = 'https://api.morrisons.com/priceintegrity/v1/locations';
const BASE_STOCK_HISTORY = 'https://api.morrisons.com/storemobileapp/v1/stores';
const BASE_STOCK_ORDER = 'https://api.morrisons.com/stockorder/v1/customers/morrisons/orders';
const PRODUCT_PROXY_URL = '/api/morrisons/product?sku=';

export interface FetchMorrisonsDataInput {
  locationId: string;
  skus: string[];
  bearerToken?: string;      // If available, send it for Stock/PI/History
  debugMode?: boolean;
}

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

export type FetchMorrisonsDataOutput = {
  sku: string;
  scannedSku: string;
  name: string;
  price: { regular?: number; promotional?: string };
  stockQuantity: number;
  stockUnit?: string;
  location: { standard?: string; secondary?: string; promotional?: string };
  temperature?: string;
  weight?: number;
  status?: string;
  stockSkuUsed?: string;
  imageUrl?: string;
  walkSequence?: string;
  productDetails: Product;
  lastStockChange?: StockHistory;
  deliveryInfo?: DeliveryInfo | null;
  allOrders?: Order[] | null;
}[];

// ─────────────────────────── core fetch helper ────────────────────────────
async function fetchJson<T>(
  url: string,
  {
    debug = false,
    bearer,
    preferBearer = !!bearer,     // if true, try with bearer first then without
  }: {
    debug?: boolean;
    bearer?: string;
    preferBearer?: boolean;
  } = {}
): Promise<T | null> {
  const baseHeaders: Record<string, string> = {
    Accept: 'application/json',
    'X-No-Auth': '1', // hint for any SW to *not* inject auth
  };

  async function once(withBearer: boolean) {
    const headers = new Headers(baseHeaders);
    if (withBearer && bearer) headers.set('Authorization', `Bearer ${bearer}`);
    return fetch(url, {
      method: 'GET',
      headers,
      credentials: 'omit',
      mode: 'cors',
      cache: 'no-store',
      redirect: 'follow',
      referrerPolicy: 'no-referrer',
    });
  }

  // Decide order: bearer→no-bearer or no-bearer→bearer
  const attempts: boolean[] = preferBearer ? [true, false] : [false, true];

  let lastRes: Response | undefined;
  for (const withBearer of attempts) {
    const res = await once(withBearer);
    lastRes = res;
    if (res.status === 404) return null;
    if (res.ok) return (await res.json()) as T;
    if (res.status !== 401 && res.status !== 403) {
      // Hard fail for other statuses
      const body = debug ? await res.text().catch(() => '') : '';
      const intendedHeaders = {
        ...baseHeaders,
        ...(withBearer && bearer ? { Authorization: 'Bearer <redacted>' } : {}),
      };
      throw new Error(
        `HTTP error! status: ${res.status}\nURL: ${url}\nIntended headers: ${JSON.stringify(
          intendedHeaders,
          null,
          2
        )}\nResponse: ${body}`
      );
    }
    // else 401/403 → fall through to next attempt
    if (debug) {
      console.warn(
        `[fetchJson] ${url} → ${res.status} with ${withBearer ? 'bearer' : 'no bearer'}; trying ${
          withBearer ? 'without' : 'with'
        } bearer…`
      );
    }
  }

  // If we exhausted attempts, throw with the last response body (if debug)
  if (lastRes) {
    const body = debug ? await lastRes.text().catch(() => '') : '';
    const intendedHeaders = {
      ...baseHeaders,
      ...(preferBearer && bearer ? { Authorization: 'Bearer <redacted>' } : {}),
    };
    throw new Error(
      `HTTP error! status: ${lastRes.status}\nURL: ${url}\nIntended headers: ${JSON.stringify(
        intendedHeaders,
        null,
        2
      )}\nResponse: ${body}`
    );
  }
  throw new Error(`Request failed for ${url} (no response)`);
}

// ─────────────────────────── endpoint wrappers ────────────────────────────
// Product: do NOT hit from browser; use server proxy if you need rich details.
async function getProductViaProxy(
  sku: string,
  debug?: boolean
): Promise<Product | null> {
  const url = `${PRODUCT_PROXY_URL}${encodeURIComponent(sku)}`;
  return fetchJson<Product>(url, { debug, bearer: undefined, preferBearer: false });
}

// Price Integrity: allow bearer if you have one; fallback without.
async function getPI(locationId: string, sku: string, bearer?: string, debug?: boolean) {
  const url = `${BASE_LOCN}/${encodeURIComponent(locationId)}/items/${encodeURIComponent(
    sku
  )}?apikey=${encodeURIComponent(API_KEY)}`;
  return fetchJson<PriceIntegrity>(url, { debug, bearer, preferBearer: !!bearer });
}

// Stock: **FIXED** → send bearer when provided; fallback without.
async function getStock(locationId: string, sku: string, bearer?: string, debug?: boolean) {
  const url = `${BASE_STOCK}/${encodeURIComponent(locationId)}/items/${encodeURIComponent(
    sku
  )}?apikey=${encodeURIComponent(API_KEY)}`;
  return fetchJson<StockPayload>(url, { debug, bearer, preferBearer: !!bearer });
}

// Stock History: try with bearer then without (like the official app behavior).
async function getStockHistory(locationId: string, sku: string, bearer?: string, debug?: boolean) {
  const url = `${BASE_STOCK_HISTORY}/${encodeURIComponent(locationId)}/items/${encodeURIComponent(
    sku
  )}?apikey=${encodeURIComponent(API_KEY)}`;
  return fetchJson<StockHistory>(url, { debug, bearer, preferBearer: !!bearer });
}

async function getOrderInfo(locationId: string, sku: string, bearer?: string, debug?: boolean) {
    const url = `${BASE_STOCK_ORDER}?location=${encodeURIComponent(locationId)}&type=StoreStandard&item=${encodeURIComponent(sku)}&orders=[last,next,current]&apikey=${encodeURIComponent(API_KEY)}`;
    return fetchJson<StockOrder>(url, { debug, bearer, preferBearer: !!bearer });
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
        // 1) PI first (browser-safe) to anchor product & price.
        const pi = await getPI(locationId, scannedSku, bearerToken, debugMode);
        const piProduct = (pi as any)?.product as Product | undefined;

        // 2) Optional richer Product via proxy
        let product: Product | null = null;
        try {
          product = await getProductViaProxy(scannedSku, debugMode);
        } catch (e) {
          if (debugMode) console.warn(`Product via proxy failed for ${scannedSku}:`, e);
        }

        // internal SKU we’ll use for stock/PI alignment
        const internalSku =
          product?.itemNumber?.toString() ||
          piProduct?.itemNumber?.toString() ||
          scannedSku;

        // 3) Stock — now tries WITH bearer first (if provided), then without
        const stockPayload = await getStock(locationId, internalSku, bearerToken, debugMode);
        const stockPosition = stockPayload?.stockPosition?.[0];

        // 4) Align PI to internalSku if needed
        const piAligned = internalSku === scannedSku ? pi : await getPI(locationId, internalSku, bearerToken, debugMode);
        const { std: stdLoc, secondary: secondaryLoc, promo: promoLoc, walk } = extractLocationBits(piAligned);

        // 5) Stock history and Order info
        const stockHistory = await getStockHistory(locationId, internalSku, bearerToken, debugMode);
        const orderInfo = await getOrderInfo(locationId, internalSku, bearerToken, debugMode);
        
        const chosenProduct = product ?? piProduct ?? ({} as Product);
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
                  chosenProduct.packs?.[0]?.packQuantity ??
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


        // 6) Prices/promos & product preference
        const prices = (piAligned?.prices ?? []) as any[];
        const promos = (piAligned?.promotions ?? []) as any[];


        return {
          sku: internalSku,
          scannedSku,
          name:
            chosenProduct.customerFriendlyDescription ||
            chosenProduct.tillDescription ||
            chosenProduct.itemDescription ||
            'Unknown Product',
          price: {
            regular: prices?.[0]?.regularPrice,
            promotional: promos?.[0]?.marketingAttributes?.offerValue,
          },
          stockQuantity: stockPosition?.qty ?? 0,
          stockUnit: stockPosition?.unitofMeasure || chosenProduct.standardUnitOfMeasure,
          location: { standard: stdLoc, secondary: secondaryLoc, promotional: promoLoc },
          temperature: chosenProduct.temperatureRegime,
          weight: chosenProduct.dimensions?.weight,
          status: chosenProduct.status,
          stockSkuUsed: undefined,
          imageUrl: (chosenProduct as any).imageUrl?.[0]?.url,
          walkSequence: walk,
          productDetails: chosenProduct,
          lastStockChange: stockHistory || undefined,
          deliveryInfo: deliveryInfo,
          allOrders: allOrders ?? null,
        };
      } catch (err) {
        console.error(`Failed to process SKU ${scannedSku}:`, err);
        if (debugMode) throw err;
        return null;
      }
    })
  );

  return rows.filter((r): r is NonNullable<typeof r> => !!r);
}








    