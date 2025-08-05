/**
 * @fileOverview An API for fetching Morrisons product data.
 */
import type {components} from '../morrisons-types';

const API_KEY = "0GYtUV6tIhQ3a9rED9XUqiEQIbFhFktW";
const BEARER_TOKEN_DEFAULT = "l5rXP77Vno9GxqP0RA8351v5iJt8";

const BASE_PRODUCT = "https://api.morrisons.com/product/v1/items";
const BASE_STOCK = "https://api.morrisons.com/stock/v2/locations";
const BASE_LOCN = "https://api.morrisons.com/priceintegrity/v1/locations";
const BASE_STOCK_HISTORY = "https://api.morrisons.com/storemobileapp/v1/stores";


const HEADERS_BASE = {
    "Accept": "application/json",
    "User-Agent": "Mozilla/5.0 (MorriCards Web)",
};

export interface FetchMorrisonsDataInput {
  locationId: string;
  skus: string[];
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

async function fetchJson<T>(url: string, bearer: string | null = BEARER_TOKEN_DEFAULT): Promise<T | null> {
    const headers = {...HEADERS_BASE} as any;
    if (bearer) {
        headers['Authorization'] = `Bearer ${bearer}`;
    }
    try {
        let r = await fetch(url, {headers});
        if ((r.status === 401 || r.status === 403) && bearer) {
            // Retry without bearer token
            const noBearerHeaders = {...HEADERS_BASE};
            r = await fetch(url, {headers: noBearerHeaders});
        }
        if (r.status === 404) {
            return null;
        }
        if (!r.ok) {
            throw new Error(`HTTP error! status: ${r.status}`);
        }
        return r.json() as Promise<T>;
    } catch (e) {
        console.error(`Failed to fetch ${url}`, e);
        return null;
    }
}


function getProduct(sku: string): Promise<Product | null> {
    return fetchJson<Product>(`${BASE_PRODUCT}/${sku}?apikey=${API_KEY}`);
}

function candidateStockSkus(prod: Product, primarySku: string): string[] {
    const skus = new Set<string>([primarySku]);
    if (prod.packComponents) {
        for (const pc of prod.packComponents) {
            if (pc.itemNumber) {
                skus.add(pc.itemNumber.toString());
            }
        }
    }
    return Array.from(skus);
}

async function tryStock(loc: string, skus: string[]): Promise<{ sku: string | null, payload: StockPayload | null }> {
    for (const s of skus) {
        const payload = await fetchJson<StockPayload>(`${BASE_STOCK}/${loc}/items/${s}?apikey=${API_KEY}`);
        if (payload?.stockPosition && payload.stockPosition.length > 0 && payload.stockPosition[0].qty !== undefined) {
            return { sku: s, payload };
        }
    }
    return { sku: null, payload: null };
}

function getPi(loc: string, sku: string): Promise<PriceIntegrity | null> {
    return fetchJson<PriceIntegrity>(`${BASE_LOCN}/${loc}/items/${sku}?apikey=${API_KEY}`);
}

function getStockHistory(loc: string, sku: string): Promise<StockHistory | null> {
    return fetchJson<StockHistory>(`${BASE_STOCK_HISTORY}/${loc}/items/${sku}?apikey=${API_KEY}`, null);
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
    if (aisle) {
        if (AISLE_NAME_MAP[aisle]) {
            parts.push(AISLE_NAME_MAP[aisle]);
        } else {
            parts.push(`Aisle ${aisle}`);
        }
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

function extractLocationBits(pi: PriceIntegrity | null): { std: string, secondary?: string, promo: string, walk: string } {
    if (!pi || !pi.space) return { std: "", promo: "", walk: "" };
    
    const stdLocs = pi.space.standardSpace?.locations;
    const [std, ...secondary] = simplifyLocations(stdLocs);

    const promoLocs = pi.space.promotionalSpace?.locations;
    const [promo] = simplifyLocations(promoLocs);
    
    const walk = stdLocs && stdLocs.length > 0 && stdLocs[0].storeWalkSequence ? stdLocs[0].storeWalkSequence.toString() : "";
    
    return { std: std || "", secondary: secondary.join('; ') || undefined, promo: promo || "", walk };
}


export async function fetchMorrisonsData(input: FetchMorrisonsDataInput): Promise<FetchMorrisonsDataOutput> {
  console.log(`Fetching data for SKUs: ${input.skus.join(', ')} at location: ${input.locationId}`);

  const results: FetchMorrisonsDataOutput = [];

  for (const sku of input.skus) {
    try {
        const product = await getProduct(sku);
        if (!product) {
            console.warn(`Product not found for SKU: ${sku}`);
            continue;
        }

        const stockCandidates = candidateStockSkus(product, sku);
        const { sku: stockSku, payload: stockPayload } = await tryStock(input.locationId, stockCandidates);

        const finalSku = stockSku || sku;
        const pi = await getPi(input.locationId, finalSku);
        const stockHistory = await getStockHistory(input.locationId, finalSku);

        const { std: stdLoc, secondary: secondaryLoc, promo: promoLoc, walk } = extractLocationBits(pi);

        const stockPosition = stockPayload?.stockPosition?.[0];

        const prices = pi?.prices;
        const promos = pi?.promotions;

        results.push({
            sku: product.itemNumber || sku,
            scannedSku: sku,
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
            stockSkuUsed: stockSku === sku ? undefined : stockSku || undefined,
            imageUrl: (product as any).imageUrl?.[0]?.url,
            walkSequence: walk,
            productDetails: product,
            lastStockChange: stockHistory || undefined,
        });

    } catch (error) {
        console.error(`Failed to process SKU ${sku}:`, error);
    }
  }

  return results;
}
