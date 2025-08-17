
import { NextResponse } from 'next/server';

const API_KEY = '0GYtUV6tIhQ3a9rED9XUqiEQIbFhFktW';
const BASE_PRODUCT = 'https://api.morrisons.com/product/v1/items';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const sku = searchParams.get('sku');
  const bearerToken = request.headers.get('Authorization');

  if (!sku) {
    return NextResponse.json({ error: 'SKU is required' }, { status: 400 });
  }

  const url = `${BASE_PRODUCT}/${encodeURIComponent(sku)}?apikey=${encodeURIComponent(API_KEY)}`;

  try {
    const headers = new Headers({ 'Accept': 'application/json' });
    if (bearerToken) {
        headers.set('Authorization', bearerToken);
    }
      
    const res = await fetch(url, { headers });

    if (!res.ok) {
        const errorBody = await res.text();
        console.error(`Morrisons API Error (${res.status}) for SKU ${sku}:`, errorBody);
        return NextResponse.json({ error: `Failed to fetch product data from Morrisons API: ${res.statusText}`, details: errorBody }, { status: res.status });
    }

    const data = await res.json();
    return NextResponse.json(data);

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
    console.error(`Internal Server Error for SKU ${sku}:`, errorMessage);
    return NextResponse.json({ error: 'Internal Server Error', details: errorMessage }, { status: 500 });
  }
}
