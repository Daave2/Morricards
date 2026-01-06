// 'use server'; // Disabled for static export
import { type FetchMorrisonsDataOutput } from '@/lib/morrisons-api';
// import { fetchMorrisonsData } from '@/lib/morrisons-api'; // Disabled for static export
import { z } from 'zod';

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

// MOCK DATA for Static Export
const MOCK_PRODUCT: FetchMorrisonsDataOutput = [{
  sku: '123456',
  scannedSku: '123456',
  name: 'Morrisons Savers British Semi Skimmed Milk 4 Pints',
  price: { regular: 1.45 },
  stockQuantity: 42,
  stockUnit: 'ea',
  location: { standard: 'Aisle 10', secondary: 'End 10 (Left)' },
  status: 'Active',
  productDetails: {
    itemNumber: '123456',
    customerFriendlyDescription: 'Morrisons Savers British Semi Skimmed Milk 4 Pints',
    gtins: [{ id: '1234567890123', type: 'EAN13' }]
  } as any,
  proxyError: null,
}];

export async function getProductData(values: z.infer<typeof FormSchema>): Promise<ActionResponse> {
  console.log('Mock getProductData called with:', values);

  // Simulate network delay
  await new Promise(resolve => setTimeout(resolve, 800));

  const validatedFields = FormSchema.safeParse(values);

  if (!validatedFields.success) {
    return { data: null, error: 'Invalid form data.' };
  }

  // Return mock data
  return { data: MOCK_PRODUCT, error: null };
}
