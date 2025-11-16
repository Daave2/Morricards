
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
import { z } from 'zod';
import { ocrPrompt } from '@/ai/flows/picking-analysis-flow';
import { fetchMorrisonsData, type FetchMorrisonsDataOutput } from '@/lib/morrisons-api';

const pickerDiagnosisPrompt = ai.definePrompt({
    name: 'pickerDiagnosisPrompt',
    input: { schema: z.object({ rawData: z.any() }) },
    output: { schema: z.object({ diagnosticSummary: z.string() }) },
    prompt: `You are an expert stock investigator for a UK supermarket. Your task is to analyze raw API data for a single product and provide a concise, helpful insight for a store colleague who cannot find it on the shelf.

The user needs a direct, actionable hypothesis. Your entire response should be a single, direct sentence.

Use the provided raw data:
- **stock**: Contains current stock quantity ('qty') and start of day quantity ('startOfDayQty').
- **orderInfo**: Contains 'next' and 'last' delivery information, including dates and quantities.
- **productDetails**: Contains the product's temperature type ('temperatureRegime') - Ambient, Chilled, or Produce.
- **priceIntegrity**: Contains location information, including promotional locations.

**Here is the required logic and output format:**

1.  **If a delivery was recent (e.g., 'last' delivery was today or yesterday) and sales are low or zero (current stock matches start-of-day stock):**
    - Your entire response MUST be in this format: "X units were due last night and no sales have been recorded today so check for unworked delivery."

2.  **If stock is high, but there have been NO RECENT deliveries:**
    - If the product is 'Ambient', your response MUST be: "Stock records are high at X units but no delivery recently so check capping shelfs."
    - If the product is 'Chilled' or 'Frozen', your response MUST be: "High stock and no recent delivery; check the backup chiller/freezer."
    - If the product is 'Produce', your response MUST be: "High stock and no recent delivery; check under the tables in the produce section."

3.  **If the product has a promotional location:**
    - Your response MUST be in this format: "This item has high stock records and an additional location at {INSERT PROMOTIONAL LOCATION HERE}, so make sure promo locations have been checked."

**Do not be conversational. Provide only the single, actionable sentence.**

Analyze this raw data and provide your insight in the 'diagnosticSummary' field.
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
    debugMode: true, // Always enable debug mode for this flow to get _raw data
  });
  
  // Step 3: Map the fetched data, enrich with AI diagnosis, and format for the client.
  const results = await Promise.all(skus.map(async (sku) => {
      const product = productsData.find(p => p.scannedSku === sku);
      if (product) {
          try {
              if (!product._raw) {
                throw new Error("Product has no raw data for AI diagnosis.");
              }
              const sanitizedRawData = JSON.parse(JSON.stringify(product._raw));
              
              const diagnosticResult = await pickerDiagnosisPrompt({ rawData: sanitizedRawData });
              const diagnosticSummary = diagnosticResult.output?.diagnosticSummary;
              
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

    