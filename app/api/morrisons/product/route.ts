
import { NextResponse } from 'next/server';
import { fetchProductFromUpstream } from '@/lib/morrisons-api';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const sku = searchParams.get('sku');
  const bearerToken = request.headers.get('Authorization')?.replace('Bearer ', '');

  if (!sku) {
    return NextResponse.json({ error: 'SKU is required' }, { status: 400 });
  }
  
  try {
      const { product, error } = await fetchProductFromUpstream(sku, bearerToken);
      if (error || !product) {
          return NextResponse.json({ error: `Failed to fetch product data from Morrisons API.`, details: error }, { status: 500 });
      }
      return NextResponse.json(product);
  } catch (e) {
      const error = e instanceof Error ? e.message : String(e);
      console.error(`Product API Error for SKU ${sku}:`, error);
      return NextResponse.json({ error: 'Failed to fetch product data from Morrisons API.', details: error }, { status: 500 });
  }
}

// Export a function with a different name to avoid conflicts client-side, if needed
export { fetchProductFromUpstream as getProductDirectly };
