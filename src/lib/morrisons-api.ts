/**
 * @fileOverview Browser-safe Morrisons API client:
 * - Uses Price Integrity for product details (browser OK).
 * - Uses Stock + Stock History as before.
 * - Optionally calls Product via your own server proxy (set productProxyUrl).
 */

import type { components } from '../morrisons-types';

const API_KEY = "0GYtUV6tIhQ3a9rED9XUqiEQIbFhFktW";

const BASE_STOCK = "https://api.morrisons.com/stock/v2/locations";
const BASE_LOCN = "https://api.morrisons.com/priceintegrity/v1/locations";
const BASE_STOCK_HISTORY = "https://api.morrisons.com/storemobileapp/v1/stores";

export interface FetchMorrisonsDataInput {
  locationId: string;
  skus: string[];
  bearerToken?: string;          // helps PI & stock history when needed
  debugMode?: boolean;
  productProxyUrl?: string;      // e.g. "/api/morrisons/product?sku=" (server-side proxy)
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
}[];

// ───────────────────────────────── helpers ─────────────────────────────────
async function fetchJson<T>(
  url: string,
  {
    debug = false,
    bearer,
    forceNoAuth = false,
    allowRetryWithoutBearer = true,
  }: {
    debug?: boolean;
    bearer?: string;
    forceNoAuth?: boolean;
    allowRetryWithoutBearer?: boolean;
  } = {}
): Promise<T | null> {
  const baseHeaders: Record<string, string> = { Accept: "application/json", "X-No-Auth": "1" };

  async function once(withBearer: boolean) {
    const headers = new Headers(baseHeaders);
    if (withBearer && bearer && !forceNoAuth) headers.set("Authorization", `Bearer ${bearer}`);
    return fetch(url, {
      method: "GET",
      headers,
      credentials: "omit",
      mode: "cors",
      cache: "no-store",
      redirect: "follow",
      referrerPolicy: "no-referrer",
    });
  }

  let res = await once(true);
  if (res.status === 404) return null;

  if ((res.status === 401 || res.status === 403) && allowRetryWithoutBearer && bearer && !forceNoAuth) {
    if (debug) console.warn(`[fetchJson] ${url} → ${res.status}. Retrying WITHOUT Authorization…`);
    res = await once(false);
  }

  if (!res.ok) {
    const responseHeaders: Record<string, string> = {};
    res.headers.forEach((value, key) => {
        responseHeaders[key] = value;
    });
    const body = debug ? await res.text().catch(() => "") : "";
    const intendedHeaders = { ...baseHeaders, ...(bearer && !forceNoAuth ? { Authorization: `Bearer ${bearer}` } : {}) };
    throw new Error(`HTTP error! status: ${res.status}\nURL: ${url}\nIntended headers: ${JSON.stringify(intendedHeaders, null, 2)}\nResponse Headers: ${JSON.stringify(responseHeaders, null, 2)}\nResponse: \n${body}`);
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

// Browser-safe: DO NOT call the product endpoint directly.
// Instead, try to derive product info from PI. Optionally, use a server proxy for product.
async function getProductViaProxy(sku: string, productProxyUrl?: string, debug?: boolean): Promise<Product | null> {
  if (!productProxyUrl) return null;
  const url = `${productProxyUrl}${encodeURIComponent(sku)}`;
  // This is same-origin → you control CORS. No bearer sent.
  return fetchJson<Product>(url, { debug, forceNoAuth: true, allowRetryWithoutBearer: false });
}

async function getPI(locationId: string, sku: string, bearer?: string, debug?: boolean): Promise<PriceIntegrity | null> {
  const url = `${BASE_LOCN}/${encodeURIComponent(locationId)}/items/${encodeURIComponent(sku)}?apikey=${encodeURIComponent(API_KEY)}`;
  // PI often works without bearer, but bearer can help. If 401 with bearer, we retry without it.
  return fetchJson<PriceIntegrity>(url, { debug, bearer, forceNoAuth: !bearer, allowRetryWithoutBearer: true });
}

async function getStock(locationId: string, sku: string, bearer?: string, debug?: boolean): Promise<StockPayload | null> {
  const url = `${BASE_STOCK}/${encodeURIComponent(locationId)}/items/${encodeURIComponent(sku)}?apikey=${encodeURIComponent(API_KEY)}`;
  return fetchJson<StockPayload>(url, { debug, bearer, forceNoAuth: !bearer, allowRetryWithoutBearer: true });
}

async function getStockHistory(locationId: string, sku: string, bearer?: string, debug?: boolean): Promise<StockHistory | null> {
  const url = `${BASE_STOCK_HISTORY}/${encodeURIComponent(locationId)}/items/${encodeURIComponent(sku)}?apikey=${encodeURIComponent(API_KEY)}`;
  return fetchJson<StockHistory>(url, { debug, bearer, forceNoAuth: !bearer, allowRetryWithoutBearer: true });
}

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
  if (aisle) parts.push(AISLE_NAME_MAP[aisle] ?? `Aisle ${aisle}`);
  if (side) parts.push(`${side} bay ${bay}`); else if (bay) parts.push(`Bay ${bay}`);
  if (shelf) parts.push(`shelf ${shelf}`);
  return parts.join(', ');
}

function simplifyLocations(lst?: components['schemas']['Location'][]): string[] {
  if (!lst?.length) return [];
  return lst.map(niceLoc);
}

function extractLocationBits(pi: PriceIntegrity | null): { std: string; secondary?: string; promo: string; walk: string } {
  if (!pi?.space) return { std: "", promo: "", walk: "" };
  const stdLocs = pi.space.standardSpace?.locations;
  const [std, ...secondary] = simplifyLocations(stdLocs);
  const promoLocs = pi.space.promotionalSpace?.locations;
  const [promo] = simplifyLocations(promoLocs);
  const walk = stdLocs?.[0]?.storeWalkSequence ? String(stdLocs[0].storeWalkSequence) : "";
  return { std: std || "", secondary: secondary.join('; ') || undefined, promo: promo || "", walk };
}

// ───────────────────────────── main ─────────────────────────────
export async function fetchMorrisonsData(input: FetchMorrisonsDataInput): Promise<FetchMorrisonsDataOutput> {
  const { locationId, skus, bearerToken, debugMode, productProxyUrl } = input;

  const rows = await Promise.all(
    skus.map(async (scannedSku) => {
      try {
        // 1) Try PI first (browser-friendly) to identify the internal SKU and prices.
        const pi = await getPI(locationId, scannedSku, bearerToken, debugMode);

        // If PI didn’t resolve on the scanned SKU, you can optionally skip or try scannedSku as-is for stock.
        const piProduct = (pi as any)?.product as Product | undefined;

        // If we still want rich product info (e.g., packComponents), try server proxy to Product API.
        let product: Product | null = null;
        if (productProxyUrl && scannedSku) {
          try {
            product = await getProductViaProxy(scannedSku, productProxyUrl, debugMode);
          } catch (e) {
            if (debugMode) console.warn(`Product via proxy failed for ${scannedSku}:`, e);
          }
        }

        // Decide the “internal” SKU we’ll use for stock/PI fallback.
        const internalSku =
          product?.itemNumber?.toString() ||
          piProduct?.itemNumber?.toString() ||
          scannedSku;

        // 2) Stock — try on the internalSku only (packComponents need Product; skip in browser).
        const stockPayload = await getStock(locationId, internalSku, bearerToken, debugMode);
        const stockPosition = stockPayload?.stockPosition?.[0];

        // (If you *did* get Product via proxy and want to try pack components, you can add that loop here.)

        // 3) If PI wasn’t already fetched for internalSku (because scanned ≠ internal), fetch again to align.
        const piAligned = internalSku === scannedSku ? pi : await getPI(locationId, internalSku, bearerToken, debugMode);
        const { std: stdLoc, secondary: secondaryLoc, promo: promoLoc, walk } = extractLocationBits(piAligned);

        // 4) Stock history
        const stockHistory = await getStockHistory(locationId, internalSku, bearerToken, debugMode);

        // 5) Prices/promos & product fields — prefer Product (proxy) then PI’s product
        const prices = (piAligned?.prices ?? []) as any[];
        const promos = (piAligned?.promotions ?? []) as any[];

        const chosenProduct = product ?? piProduct ?? ({} as Product);

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
