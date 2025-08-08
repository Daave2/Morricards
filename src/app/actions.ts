'use server';

import { fetchMorrisonsData, type FetchMorrisonsDataOutput } from '@/lib/morrisons-api';
import { z } from 'zod';

const FormSchema = z.object({
  skus: z.union([z.string(), z.array(z.string())]),
  locationId: z.string(),
  bearerToken: z.string().optional(),
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
  
  const { skus, locationId, bearerToken } = validatedFields.data;
  
  const skuList = (Array.isArray(skus) ? skus : skus.split(/[\s,]+/))
    .map(s => s.trim())
    .filter(Boolean);
  
  if (skuList.length === 0) {
    return { data: null, error: 'No valid SKUs provided. Please enter some SKUs.' };
  }
  
  const uniqueSkuList = [...new Set(skuList)];

  try {
    const data = await fetchMorrisonsData({
      locationId,
      skus: uniqueSkuList,
      bearerToken: bearerToken,
    });
    return { data, error: null };
  } catch (e) {
    console.error('Failed to fetch Morrisons data:', e);
    return { data: null, error: 'Failed to fetch product data. Please check your inputs and try again.' };
  }
}
