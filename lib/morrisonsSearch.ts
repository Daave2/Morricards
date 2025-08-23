// lib/morrisonsSearch.ts
export type SearchHit = {
  groupType: string | null;
  productId: string | null;
  retailerProductId: string | null; // <-- use this when the user clicks
  title: string; // name
  brand: string | null;
  packSize: string | null;
  price: number | null;        // Number(price.amount)
  available: boolean | null;
  rating: number | null;       // Number(overallRating)
  ratingCount: number | null;
  image: string | null;        // image.src or images[0].src
  categoryPath: string[];
};

export type SearchResult = {
  hits: SearchHit[];
  raw: any;
};

const BASE_URL =
  "https://groceries.morrisons.com/api/webproductpagews/v6/product-pages/search";

function buildUrl(q: string, maxPageSize = 60, maxProductsToDecorate = 30) {
  const url = new URL(BASE_URL);
  url.searchParams.set("q", q);
  url.searchParams.set("includeAdditionalPageInfo", "true");
  url.searchParams.set("maxPageSize", String(maxPageSize));
  url.searchParams.set("maxProductsToDecorate", String(maxProductsToDecorate));
  url.searchParams.set("tag", "web");
  return url.toString();
}

function pickImage(p: any): string | null {
  return (
    p?.image?.src ||
    (Array.isArray(p?.images) && p.images[0]?.src) ||
    null
  );
}

export async function morrisonsSearch(
  q: string,
  opts?: { maxPageSize?: number; maxProductsToDecorate?: number; cookie?: string }
): Promise<SearchResult> {
  const maxPageSize = opts?.maxPageSize ?? 60;
  const maxProductsToDecorate = opts?.maxProductsToDecorate ?? 30;
  const url = buildUrl(q, maxPageSize, maxProductsToDecorate);

  const headers: Record<string, string> = {
    Accept: "application/json; charset=utf-8",
    "User-Agent": "Mozilla/5.0; MyApp/1.0",
    Referer: `https://groceries.morrisons.com/search?q=${encodeURIComponent(q)}`,
  };

  const cookie = opts?.cookie || process.env.MORRISONS_COOKIE;
  if (cookie) headers.Cookie = cookie;

  const resp = await fetch(url, { headers, redirect: "follow", cache: "no-store" });
  const text = await resp.text();

  if (!resp.ok) {
    throw new Error(
      `Morrisons API HTTP ${resp.status}\nURL: ${url}\nBody: ${text.slice(0, 1000)}`
    );
  }

  let json: any;
  try {
    json = JSON.parse(text);
  } catch {
    throw new Error("Morrisons API returned non-JSON");
  }

  const groups = Array.isArray(json?.productGroups) ? json.productGroups : [];
  const hits: SearchHit[] = [];

  for (const g of groups) {
    const gtype = g?.type ?? null;
    const products = Array.isArray(g?.decoratedProducts) ? g.decoratedProducts : [];
    for (const p of products) {
      const priceNum = p?.price?.amount != null ? Number(p.price.amount) : null;
      const ratingNum =
        p?.ratingSummary?.overallRating != null
          ? Number(p.ratingSummary.overallRating)
          : null;
      const ratingCount =
        p?.ratingSummary?.count != null ? Number(p.ratingSummary.count) : null;

      hits.push({
        groupType: gtype,
        productId: p?.productId ?? null,
        retailerProductId: p?.retailerProductId ?? null,
        title: p?.name ?? "",
        brand: p?.brand ?? null,
        packSize: p?.packSizeDescription ?? null,
        price: Number.isFinite(priceNum as number) ? (priceNum as number) : null,
        available: typeof p?.available === "boolean" ? p.available : null,
        rating: Number.isFinite(ratingNum as number) ? (ratingNum as number) : null,
        ratingCount: Number.isFinite(ratingCount as number)
          ? (ratingCount as number)
          : null,
        image: pickImage(p),
        categoryPath: Array.isArray(p?.categoryPath) ? p.categoryPath : [],
      });
    }
  }

  return { hits, raw: json };
}
