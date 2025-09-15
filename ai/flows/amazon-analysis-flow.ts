
'use server';
/**
 * @fileOverview A single orchestrating flow for the Amazon Picker Assistant.
 *
 * This flow handles the entire process of analyzing a picking list image:
 * 1. OCR to extract SKUs.
 * 2. Fetches data for each SKU.
 * 3. Runs an AI diagnosis prompt to generate a helpful summary.
 * 4. Returns a single, clean payload to the client.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';
import { ocrPrompt } from '@/ai/flows/picking-analysis-flow';
import { fetchMorrisonsData, type FetchMorrisonsDataOutput } from '@/lib/morrisons-api';

const pickerDiagnosisPrompt = ai.definePrompt({
    name: 'pickerDiagnosisPrompt',
    input: { schema: z.object({ rawData: z.any() }) },
    output: { schema: z.string() },
    prompt: `You are an expert stock investigator for a UK supermarket. Your task is to analyze raw API data for a single product and provide a concise, helpful diagnosis for a store colleague who cannot find it on the shelf.

The user needs to understand *why* the item might be missing and *where to look next*.

You will be given a '_raw' object containing several nested API responses. Use all of this information to form your hypothesis.
- **priceIntegrity**: Contains the product name and location information (standard, promo).
- **stock**: Contains the current electronic stock quantity ('qty').
- **orderInfo**: Contains 'next' and 'last' delivery information, including dates and quantities.
- **stockHistory**: Shows the last stock movement (e.g., 'delivery receipt', 'inventory adjustment').
- **productProxy**: The full rich product details.

**Your diagnosis should be a single, helpful paragraph. For example:**
"The system shows 5 units in stock, but the last delivery of 12 units was only last night. Since no sales are recorded, the missing stock is likely in the warehouse, possibly on a delivery cage that hasn't been worked yet. Also, check promo end-aisle 97, as this item is on promotion."
"Stock is zero and the last delivery was over a week ago. This is a genuine out-of-stock. Check for a newer version of the product or a direct substitute."

Analyze this raw data and provide your diagnosis:
\`\`\`json
{{{json rawData}}}
\`\`\`
`,
});


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
  product: z.custom<FetchMorrisonsDataOutput[0]>().nullable(),
  error: z.string().nullable(),
  diagnosticSummary: z.string().nullable(),
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
  
  // Step 3: Map the fetched data, enrich with AI diagnosis, and format for the client.
  const results = await Promise.all(skus.map(async (sku) => {
      const product = productsData.find(p => p.scannedSku === sku);
      if (product) {
          try {
              if (!product._raw) {
                throw new Error("Product has no raw data for AI diagnosis.");
              }
              // Sanitize the raw data object before passing to the prompt.
              const sanitizedRawData = JSON.parse(JSON.stringify(product._raw));
              
              const diagnosticResult = await pickerDiagnosisPrompt({ rawData: sanitizedRawData });
              const diagnosticSummary = diagnosticResult.output;
              
              if (!diagnosticSummary) {
                throw new Error("AI failed to generate a diagnosis summary.");
              }

              return { product, error: product.proxyError || null, diagnosticSummary };
          } catch(e) {
              const error = e instanceof Error ? e.message : String(e);
              return { product, error: `Failed to generate AI diagnosis: ${error}`, diagnosticSummary: null };
          }
      } else {
          return {
              product: null,
              error: `Could not fetch data for SKU ${sku}.`,
              diagnosticSummary: null,
          };
      }
  }));
  
  // **CRUCIAL FINAL SANITIZATION ON SERVER**
  // This guarantees that only plain objects are returned from the flow.
  return JSON.parse(JSON.stringify(results));
}
