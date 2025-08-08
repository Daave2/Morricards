/**
 * @fileOverview An API for fetching Morrisons product, stock, PI and stock history data (browser-safe).
 * Strategy:
 *  - Avoid Authorization on endpoints that don’t need it.
 *  - If a bearer is present and the server returns 401/403, retry *without* Authorization.
 *  - Force credentials: 'omit' and add an optional X-No-Auth header to help service workers skip auth injection.
 */

import type { components } from '../morrisons-types';

const API_KEY = "0GYtUV6tIhQ3a9rED9XUqiEQIbFhFktW";

const BASE_PRODUCT = "https://api.morrisons.com/product/v1/items";
const BASE_STOCK = "https://api.morrisons.com/stock/v2/locations";
const BASE_LOCN = "https://api.morrisons.com/priceintegrity/v1/locations";
const BASE_STOCK_HISTORY = "https://api.morrisons.com/storemobileapp/v1/stores";

export interface FetchMorrisonsDataInput {
  locationId: string;
  skus: string[];
  bearerToken?: string;   // Only *needed* for stock history; other endpoints should work without it.
  debugMode?: boolean;
}

type Product = components['schemas']['Product'];
type StockPayload = components['schemas']['StockPayload'];
type PriceIntegrity = components['schemas']['PriceIntegrity'];

type StockHistory = {
  lastCountDateTime?: string;
  inventoryAction?: string;
  qty?: number;
  createdBy?: string;
};

export type FetchMorrisonsDataOutput = {
  sku: string;
  scannedSku: string;
  name: string;
  price: {
    regular?: number;
    promotional?: string;
  };
  stockQuantity: number;
  stockUnit?: string;
  location: {
    standard?: string;
    secondary?: string;
    promotional?: string;
  };
  temperature?: string;
  weight?: number;
  status?: string;
  stockSkuUsed?: string;
  imageUrl?: string;
  walkSequence?: string;
  productDetails: Product;
  lastStockChange?: StockHistory;
}[];

/** Internal fetch with optional bearer and automatic retry-without-bearer on 401/403. */
async function fetchJson<T>(
  url: string,
  {
    debug = false,
    bearer,
    tryWithoutBearerOn401 = !!bearer,
    forceNoAuth = false, // set true for endpoints that must never send Authorization
  }: {
    debug?: boolean;
    bearer?: string;
    tryWithoutBearerOn401?: boolean;
    forceNoAuth?: boolean;
  } = {}
): Promise<T | null> {
  const baseHeaders: Record<string, string> = {
    Accept: "application/json",
    // Hint header that a service worker (if present) can use to *not* inject Authorization
    "X-No-Auth": "1",
  };

  async function once(withBearer: boolean): Promise<Response> {
    const headers = new Headers(baseHeaders);
    // Never send Authorization if forceNoAuth is true
    if (withBearer && bearer && !forceNoAuth) {
      headers.set("Authorization", `Bearer ${bearer}`);
    }
    const res = await fetch(url, {
      method: "GET",
      headers,
      credentials: "omit",  // ensure no ambient cookies get sent
      mode: "cors",
      cache: "no-store",
      redirect: "follow",
      referrerPolicy: "no-referrer",
    });
    return res;
  }

  let res = await once(true);
  if (res.status === 404) return null;

  // If unauthorized *and* we tried with bearer, try once more with no Authorization
  if ((res.status === 401 || res.status === 403) && tryWithoutBearerOn401) {
    if (debug) {
      console.warn(`[fetchJson] ${url} → ${res.status}. Retrying WITHOUT Authorization header…`);
    }
    res = await once(false);
  }

  if (!res.ok) {
    let errorText = `HTTP error! status: ${res.status}`;
    if (debug) {
      const responseBody = await res.text().catch(() => "");
      
      const intendedHeaders = {
        ...baseHeaders,
        ...(bearer && !forceNoAuth ? { Authorization: `Bearer ${bearer}` } : {}),
      };

      const responseHeaders: Record<string, string> = {};
      res.headers.forEach((value, key) => {
        responseHeaders[key] = value;
      });

      errorText += `\nURL: ${url}\nIntended headers: ${JSON.stringify(intendedHeaders, null, 2)}\nResponse Headers: ${JSON.stringify(responseHeaders, null, 2)}\nResponse: ${responseBody}`;
    }
    throw new Error(errorText);
  }

  try {
    return (await res.json()) as T;
  } catch (e) {
     if (debug) {
        console.error("Failed to parse JSON response for URL:", url);
     }
     throw new Error(`Failed to parse JSON response. Status: ${res.status}`);
  }
}

// ── Endpoint wrappers ──────────────────────────────────────────────────────
// These endpoints should *not* send Authorization (forceNoAuth: true).
function getProduct(sku: string, debug?: boolean): Promise<Product | null> {
  return fetchJson<Product>(`${BASE_PRODUCT}/${encodeURIComponent(sku)}?apikey=${encodeURIComponent(API_KEY)}`, {
    debug,
    forceNoAuth: true,
  });
}

function candidateStockSkus(prod: Product): string[] {
  const skus = new Set<string>();
  if (prod.itemNumber) skus.add(prod.itemNumber.toString());
  if (prod.packComponents) {
    for (const pc of prod.packComponents) {
      if (pc.itemNumber) skus.add(pc.itemNumber.toString());
    }
  }
  return Array.from(skus);
}

async function tryStock(loc: string, skus: string[], debug?: boolean): Promise<{ sku: string | null; payload: StockPayload | null }> {
  for (const s of skus) {
    const payload = await fetchJson<StockPayload>(`${BASE_STOCK}/${encodeURIComponent(loc)}/items/${encodeURIComponent(s)}?apikey=${encodeURIComponent(API_KEY)}`, {
      debug,
      forceNoAuth: true,
    });
    if (payload?.stockPosition?.length && payload.stockPosition[0].qty !== undefined) {
      return { sku: s, payload };
    }
  }
  return { sku: null, payload: null };
}

function getPi(loc: string, sku: string, debug?: boolean): Promise<PriceIntegrity | null> {
  return fetchJson<PriceIntegrity>(`${BASE_LOCN}/${encodeURIComponent(loc)}/items/${encodeURIComponent(sku)}?apikey=${encodeURIComponent(API_KEY)}`, {
    debug,
    forceNoAuth: true,
  });
}

// Stock history *may* require a bearer in some stores/apps.
// We try with bearer first (if provided) and fall back to no bearer on 401/403 like your Python does.
async function getStockHistory(
  loc: string,
  sku: string,
  bearerToken?: string,
  debug?: boolean
): Promise<StockHistory | null> {
  const url = `${BASE_STOCK_HISTORY}/${encodeURIComponent(loc)}/items/${encodeURIComponent(sku)}?apikey=${encodeURIComponent(API_KEY)}`;
  return fetchJson<StockHistory>(url, {
    debug,
    bearer: bearerToken,
    tryWithoutBearerOn401: !!bearerToken,
    forceNoAuth: !bearerToken, // if no bearer provided, ensure we never send Authorization
  });
}

// ── Location formatting helpers ────────────────────────────────────────────
const AISLE_NAME_MAP: Record<string, string> = {
  '70': 'Seasonal',
  '78': 'Food to order',
  '85': 'Market Street',
  '88': 'Deli',
  '91': 'Produce Area',
  '94': 'Produce',
  '95': 'Back Promos',
  '96': 'Middle Promos',
  '97': 'Checkouts',
};

function niceLoc(raw: components['schemas']['Location']): string {
  const sideRe = /^([LR])(\d+)$/i;
  const aisle = raw.aisle || "";
  let bay = raw.bayNumber || "";
  const shelf = raw.shelfNumber || "";
  let side = "";

  const m = bay.match(sideRe);
  if (m) {
    side = m[1].toUpperCase() === "L" ? "Left" : "Right";
    bay = m[2];
  }

  const parts: string[] = [];
  if (aisle) {
    parts.push(AISLE_NAME_MAP[aisle] ?? `Aisle ${aisle}`);
  }
  if (side) parts.push(`${side} bay ${bay}`);
  else if (bay) parts.push(`Bay ${bay}`);
  if (shelf) parts.push(`shelf ${shelf}`);

  return parts.join(', ');
}

function simplifyLocations(lst?: components['schemas']['Location'][]): string[] {
  if (!lst || lst.length === 0) return [];
  return lst.map(niceLoc);
}

function extractLocationBits(pi: PriceIntegrity | null): { std: string; secondary?: string; promo: string; walk: string } {
  if (!pi?.space) return { std: "", promo: "", walk: "" };

  const stdLocs = pi.space.standardSpace?.locations;
  const [std, ...secondary] = simplifyLocations(stdLocs);

  const promoLocs = pi.space.promotionalSpace?.locations;
  const [promo] = simplifyLocations(promoLocs);

  const walk =
    stdLocs && stdLocs.length > 0 && stdLocs[0].storeWalkSequence
      ? stdLocs[0].storeWalkSequence.toString()
      : "";

  return { std: std || "", secondary: secondary.join('; ') || undefined, promo: promo || "", walk };
}

// ── Public API ─────────────────────────────────────────────────────────────
export async function fetchMorrisonsData(input: FetchMorrisonsDataInput): Promise<FetchMorrisonsDataOutput> {
  console.log(`Fetching data for SKUs: ${input.skus.join(', ')} at location: ${input.locationId}`);

  const productPromises = input.skus.map(async (scannedSku) => {
    try {
      const product = await getProduct(scannedSku, input.debugMode);
      if (!product?.itemNumber) {
        console.warn(`Product not found for SKU: ${scannedSku}`);
        return null;
      }

      const internalSku = product.itemNumber.toString();

      const stockCandidates = candidateStockSkus(product);
      const { sku: stockSku, payload: stockPayload } = await tryStock(input.locationId, stockCandidates, input.debugMode);

      const finalSkuForPi = stockSku || internalSku;
      const [pi, stockHistory] = await Promise.all([
        getPi(input.locationId, finalSkuForPi, input.debugMode),
        getStockHistory(input.locationId, finalSkuForPi, input.bearerToken, input.debugMode),
      ]);

      const { std: stdLoc, secondary: secondaryLoc, promo: promoLoc, walk } = extractLocationBits(pi);

      const stockPosition = stockPayload?.stockPosition?.[0];
      const prices = pi?.prices;
      const promos = pi?.promotions;

      return {
        sku: internalSku,
        scannedSku,
        name: product.customerFriendlyDescription || product.tillDescription || product.itemDescription || 'Unknown Product',
        price: {
          regular: prices?.[0]?.regularPrice,
          promotional: promos?.[0]?.marketingAttributes?.offerValue,
        },
        stockQuantity: stockPosition?.qty ?? 0,
        stockUnit: stockPosition?.unitofMeasure || product.standardUnitOfMeasure,
        location: {
          standard: stdLoc,
          secondary: secondaryLoc,
          promotional: promoLoc,
        },
        temperature: product.temperatureRegime,
        weight: product.dimensions?.weight,
        status: product.status,
        stockSkuUsed: stockSku === internalSku ? undefined : stockSku || undefined,
        imageUrl: (product as any).imageUrl?.[0]?.url,
        walkSequence: walk,
        productDetails: product,
        lastStockChange: stockHistory || undefined,
      };
    } catch (error) {
      console.error(`Failed to process SKU ${scannedSku}:`, error);
      if (input.debugMode) throw error;
      return null;
    }
  });

  const results = await Promise.all(productPromises);
  return results.filter((r): r is NonNullable<typeof r> => r !== null);
}
