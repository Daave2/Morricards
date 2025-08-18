
import { NextResponse } from 'next/server';
import { getProductDirectly as fetchProductFromUpstream } from '@/lib/morrisons-api';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const sku = searchParams.get('sku');
  const bearerToken = request.headers.get('Authorization')?.replace('Bearer ', '');

  if (!sku) {
    return NextResponse.json({ error: 'SKU is required' }, { status: 400 });
  }

  // This internal API route should call the *upstream* Morrisons API.
  // We rename the imported function to avoid confusion.
  // The function `getProductDirectly` in morrisons-api.ts now calls *this* endpoint,
  // creating a clean separation.
  const url = `https://api.morrisons.com/product/v1/items/${encodeURIComponent(sku)}?apikey=0GYtUV6tIhQ3a9rED9XUqiEQIbFhFktW`;
  
  try {
      const res = await fetch(url, { headers: { 'Authorization': `Bearer ${bearerToken || ''}` } });
      if (!res.ok) {
          const errorData = await res.text();
          console.error(`Upstream API Error for SKU ${sku}:`, res.status, errorData);
          return NextResponse.json({ error: `Failed to fetch product data from Morrisons API. Status: ${res.status}`, details: errorData }, { status: res.status });
      }
      const product = await res.json();
      return NextResponse.json(product);
  } catch (e) {
      const error = e instanceof Error ? e.message : String(e);
      console.error(`Product API Error for SKU ${sku}:`, error);
      return NextResponse.json({ error: 'Failed to fetch product data from Morrisons API.', details: error }, { status: 500 });
  }
}
