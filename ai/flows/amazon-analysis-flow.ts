// 'use server'; // Disabled for static export
import { z } from 'zod';
import type { FetchMorrisonsDataOutput } from '@/lib/morrisons-api';

const AmazonAnalysisInputSchema = z.object({
  imageDataUri: z.string().optional(),
  skus: z.array(z.string()).optional(),
  locationId: z.string(),
  bearerToken: z.string().optional(),
  debugMode: z.boolean().optional(),
});
export type AmazonAnalysisInput = z.infer<typeof AmazonAnalysisInputSchema>;

const EnrichedAnalysisSchema = z.object({
  product: z.custom<FetchMorrisonsDataOutput[0]>().nullable(),
  error: z.string().nullable(),
  diagnosticSummary: z.string().nullable(),
});
export type EnrichedAnalysis = z.infer<typeof EnrichedAnalysisSchema>;

const AmazonAnalysisOutputSchema = z.array(EnrichedAnalysisSchema);
export type AmazonAnalysisOutput = z.infer<typeof AmazonAnalysisOutputSchema>;


export async function amazonAnalysisFlow(input: AmazonAnalysisInput): Promise<AmazonAnalysisOutput> {
  console.log('Mock amazonAnalysisFlow called');
  await new Promise(resolve => setTimeout(resolve, 1500));

  // Determine SKUs (mock logic)
  let skus: string[] = [];
  if (input.skus && input.skus.length > 0) {
    skus = input.skus;
  } else if (input.imageDataUri) {
    skus = ['123456']; // Mock extracted SKU
  }

  if (skus.length === 0) return [];

  // Return mock results
  return skus.map(sku => ({
    product: {
      sku: sku,
      scannedSku: sku,
      name: "Mock Product " + sku,
      price: { regular: 1.00 },
      stockQuantity: 10,
      location: { standard: "Aisle 1" },
      status: "Active",
      productDetails: {} as any,
      proxyError: null,
    },
    error: null,
    diagnosticSummary: "Stock is fine, check the shelf again.",
  }));
}
