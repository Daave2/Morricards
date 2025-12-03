
'use server';

import { fetchMorrisonsData, type FetchMorrisonsDataOutput } from '@/lib/morrisons-api';
import { z } from 'zod';

const FormSchema = z.object({
  skus: z.union([z.string(), z.array(z.string())]),
  locationId: z.string(),
  bearerToken: z.string().optional(),
  debugMode: z.boolean().optional(),
});

// The error message can now be a detailed string from the API layer
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
  
  // This logic robustly handles a single string, a comma-separated string, or an array of strings.
  const skuList = (Array.isArray(skus) ? skus : [skus])
    .flatMap(s => s.split(/[\s,]+/))
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
    
    if (!data || data.length === 0) {
      return { data: null, error: `No products found for the provided SKUs.` };
    }

    // Attempt to serialize and deserialize to ensure it's a plain object.
    // This will throw an error if the data is not serializable, which we can catch.
    try {
      const serializableData = JSON.parse(JSON.stringify(data));
      return { data: serializableData, error: null };
    } catch (serializationError) {
        console.error('Serialization Error in getProductData:', serializationError);
        // Ensure the returned error is a simple string.
        const error = serializationError instanceof Error ? serializationError.message : String(serializationError);
        return { data: null, error: `Failed to serialize product data: ${error}` };
    }

  } catch (e) {
    const errorMessage = e instanceof Error ? e.message : String(e);
    console.error('Failed to fetch Morrisons data:', e);
    return { data: null, error: `Failed to fetch product data. ${errorMessage}` };
  }
}
