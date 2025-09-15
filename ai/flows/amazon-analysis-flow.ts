'use server';
/**
 * @fileOverview A single orchestrating flow for the Amazon Picker Assistant.
 *
 * This flow handles the entire process of analyzing a picking list image:
 * 1. OCR to extract SKUs.
 * 2. Fetches data for each SKU.
 * 3. Generates AI insights for each product.
 * 4. Returns a single, clean payload to the client.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';
import { ocrPrompt } from '@/ai/flows/picking-analysis-flow';
import { fetchMorrisonsData, type FetchMorrisonsDataOutput } from '@/lib/morrisons-api';
import { productInsightsFlow, type ProductInsightsOutput } from './product-insights-flow';

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
  insights: z.custom<ProductInsightsOutput>().nullable(),
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
  const { data: productsData, error: productError } = await fetchMorrisonsData({
    locationId: input.locationId,
    skus,
    bearerToken: input.bearerToken,
    debugMode: input.debugMode,
  });

  if (productError) {
    // If the entire data fetch fails, we can't proceed.
    throw new Error(`Failed to fetch product data: ${productError}`);
  }

  const productMap = new Map(productsData?.map((p) => [p.sku, p]));

  // Step 3: For each SKU, generate insights using the fetched data.
  const insightPromises = skus.map(async (sku) => {
    const product = productMap.get(sku);
    if (!product) {
      return {
        product: { sku, name: `Product not found for SKU ${sku}` } as any,
        insights: null,
        error: `Could not fetch data for SKU ${sku}`,
      };
    }
    try {
      const insights = await productInsightsFlow({ productData: product });
      return { product, insights, error: null };
    } catch (e) {
      const errorMessage = e instanceof Error ? e.message : String(e);
      console.error(`Insight generation failed for SKU ${sku}:`, errorMessage);
      return { product, insights: null, error: errorMessage };
    }
  });

  const results = await Promise.all(insightPromises);

  // **CRUCIAL FINAL SANITIZATION ON SERVER**
  // This guarantees that only plain objects are returned from the flow.
  return JSON.parse(JSON.stringify(results));
}
