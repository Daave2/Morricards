'use server';

import { fetchMorrisonsData, type FetchMorrisonsDataOutput } from '@/ai/flows/fetch-morrisons-data';
import { z } from 'zod';

const FormSchema = z.object({
  skus: z.string(),
  locationId: z.string(),
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
  
  const { skus, locationId } = validatedFields.data;
  
  const skuList = skus
    .split(/[\s,]+/)
    .map(s => s.trim())
    .filter(Boolean);
  
  if (skuList.length === 0) {
    return { data: null, error: 'No valid SKUs provided. Please enter some SKUs.' };
  }
  
  try {
    const data = await fetchMorrisonsData({
      locationId,
      skus: skuList,
    });
    return { data, error: null };
  } catch (e) {
    console.error('Failed to fetch Morrisons data:', e);
    return { data: null, error: 'Failed to fetch product data. Please check your inputs and try again.' };
  }
}
