
import { NextResponse } from 'next/server';
import { getProductDirectly } from '@/lib/morrisons-api';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const sku = searchParams.get('sku');
  const bearerToken = request.headers.get('Authorization')?.replace('Bearer ', '');

  if (!sku) {
    return NextResponse.json({ error: 'SKU is required' }, { status: 400 });
  }

  const { product, error } = await getProductDirectly(sku, bearerToken);

  if (error) {
    // Log the full error on the server for debugging
    console.error(`Product API Error for SKU ${sku}:`, error);
    // Return a generic error to the client
    return NextResponse.json({ error: 'Failed to fetch product data from Morrisons API.', details: error }, { status: 500 });
  }

  if (!product) {
      return NextResponse.json({ error: `Product not found for SKU ${sku}`}, { status: 404 });
  }

  return NextResponse.json(product);
}
