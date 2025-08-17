
'use server';

import { fetchMorrisonsData, type FetchMorrisonsDataOutput } from '@/lib/morrisons-api';
import { z } from 'zod';
import { cookies } from 'next/headers';

const FormSchema = z.object({
  skus: z.union([z.string(), z.array(z.string())]),
  locationId: z.string(),
  bearerToken: z.string().optional(),
  debugMode: z.boolean().optional(),
});

type ActionResponse = {
  data: FetchMorrisonsDataOutput | null;
  error: string | null;
};

export async function getProductData(values: z.infer<typeof FormSchema>): Promise<ActionResponse> {
  const validatedFields = FormSchema.safeParse(values);
  
  if (!validatedFields.success) {
    return { data: null, error: 'Invalid form data.' };
  }
  
  const { skus, locationId, bearerToken, debugMode } = validatedFields.data;
  
  const skuList = (Array.isArray(skus) ? skus : skus.split(/[\s,]+/))
    .map(s => s.trim())
    .filter(Boolean);
  
  if (skuList.length === 0) {
    return { data: null, error: 'No valid SKUs provided. Please enter some SKUs.' };
  }
  
  const uniqueSkuList = Array.from(new Set(skuList));

  try {
    const data = await fetchMorrisonsData({
      locationId,
      skus: uniqueSkuList,
      bearerToken: bearerToken,
      debugMode: debugMode,
    });
    return { data, error: null };
  } catch (e) {
    const errorMessage = e instanceof Error ? e.message : String(e);
    console.error('Failed to fetch Morrisons data:', e);
    return { data: null, error: `Failed to fetch product data. ${errorMessage}` };
  }
}

export async function clearTokenCookie() {
  cookies().delete('new-bearer-token');
}
