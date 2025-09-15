
import { NextResponse } from 'next/server';

const API_KEY = '0GYtUV6tIhQ3a9rED9XUqiEQIbFhFktW';
const BASE_PRODUCT = 'https://api.morrisons.com/product/v1/items';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const sku = searchParams.get('sku');
  const bearerToken = request.headers.get('Authorization')?.replace('Bearer ', '');

  if (!sku) {
    return NextResponse.json({ error: 'SKU is required' }, { status: 400 });
  }
  
  const url = `${BASE_PRODUCT}/${encodeURIComponent(sku)}?apikey=${API_KEY}`;
  
  try {
      const headers = new Headers();
      if (bearerToken) {
        headers.set('Authorization', `Bearer ${bearerToken}`);
      }
      
      const upstreamResponse = await fetch(url, { headers });

      if (!upstreamResponse.ok) {
          const errorBody = await upstreamResponse.text();
          return NextResponse.json(
              { error: `Failed to fetch product data from Morrisons API. Status: ${upstreamResponse.status}`, details: errorBody }, 
              { status: upstreamResponse.status }
          );
      }

      const product = await upstreamResponse.json();
      return NextResponse.json(product);

  } catch (e) {
      const error = e instanceof Error ? e.message : String(e);
      console.error(`Product API Error for SKU ${sku}:`, error);
      return NextResponse.json({ error: 'Failed to fetch product data from Morrisons API.', details: error }, { status: 500 });
  }
}
