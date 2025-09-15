
'use server';
/**
 * @fileOverview A single orchestrating flow for the Amazon Picker Assistant.
 *
 * This flow handles the entire process of analyzing a picking list image:
 * 1. OCR to extract SKUs.
 * 2. Fetches data for each SKU.
 * 3. Returns a single, clean payload to the client.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';
import { ocrPrompt } from '@/ai/flows/picking-analysis-flow';
import { fetchMorrisonsData, type FetchMorrisonsDataOutput } from '@/lib/morrisons-api';

const AmazonAnalysisInputSchema = z.object({
  imageDataUri: z
    .string()
    .describe(
      "An image of the picking list, as a data URI."
    ),
  locationId: z.string(),
  bearerToken: z.string().optional(),
  debugMode: z.boolean().optional(),
});
export type AmazonAnalysisInput = z.infer<typeof AmazonAnalysisInputSchema>;


const EnrichedAnalysisSchema = z.object({
  product: z.custom<FetchMorrisonsDataOutput[0]>(),
  error: z.string().nullable(),
});
export type EnrichedAnalysis = z.infer<typeof EnrichedAnalysisSchema>;

const AmazonAnalysisOutputSchema = z.array(EnrichedAnalysisSchema);
export type AmazonAnalysisOutput = z.infer<typeof AmazonAnalysisOutputSchema>;


export async function amazonAnalysisFlow(input: AmazonAnalysisInput): Promise<AmazonAnalysisOutput> {
  // Step 1: AI extracts SKUs from the image.
  const ocrResult = await ocrPrompt({ imageDataUri: input.imageDataUri });
  const skus = ocrResult.output?.skus || [];

  if (skus.length === 0) {
    // Return an empty array if no SKUs are found, client will handle the message.
    return [];
  }

  // Step 2: Fetch detailed product data for all SKUs at once.
  const productsData = await fetchMorrisonsData({
    locationId: input.locationId,
    skus,
    bearerToken: input.bearerToken,
    debugMode: input.debugMode,
  });
  
  const results = skus.map(sku => {
      const product = productsData.find(p => p.scannedSku === sku);
      if (product) {
          return { product, error: product.proxyError || null };
      } else {
          return {
              product: { sku, name: `Product not found for SKU ${sku}` } as any,
              error: `Could not fetch data for SKU ${sku}.`,
          };
      }
  });

  // **CRUCIAL FINAL SANITIZATION ON SERVER**
  // This guarantees that only plain objects are returned from the flow.
  return JSON.parse(JSON.stringify(results));
}
