
'use server';
/**
 * @fileOverview A single orchestrating flow for the Amazon Picker Assistant.
 *
 * This flow handles the entire process of analyzing a picking list image:
 * 1. OCR to extract SKUs.
 * 2. Fetches data for each SKU.
 * 3. Generates a diagnostic summary for the picker.
 * 4. Returns a single, clean payload to the client.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';
import { ocrPrompt } from '@/ai/flows/picking-analysis-flow';
import { fetchMorrisonsData, type FetchMorrisonsDataOutput } from '@/lib/morrisons-api';

type Product = FetchMorrisonsDataOutput[0];

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
  diagnosticSummary: z.string().nullable(),
  error: z.string().nullable(),
});
export type EnrichedAnalysis = z.infer<typeof EnrichedAnalysisSchema>;

const AmazonAnalysisOutputSchema = z.array(EnrichedAnalysisSchema);
export type AmazonAnalysisOutput = z.infer<typeof AmazonAnalysisOutputSchema>;


// Define the picker diagnosis prompt directly in this flow
const pickerDiagnosisPrompt = ai.definePrompt({
    name: 'pickerDiagnosisPrompt',
    input: { schema: z.object({ productData: z.custom<Product>() }) },
    output: { schema: z.string() },
    prompt: `You are an expert stock controller and store detective, helping a picker who can't find an item on the shelf.
Your task is to analyze the provided product data and create a short, actionable summary to help the picker understand the situation and what to do next.

Analyze these key data points:
- **stockQuantity**: The current system stock.
- **deliveryInfo**: When the last/next delivery was/is.
- **lastStockChange**: The last recorded stock movement.
- **location**: Where the product *should* be (standard and promotional).

Synthesize this data into a helpful diagnosis.

**Example Scenarios:**
1.  **Low stock, recent delivery:** If stock is 2, and the last delivery was "yesterday" with 12 units, you might say: "System shows 2 in stock. It was delivered yesterday, so it could be in the warehouse or a misplaced case. Check the promo locations too."
2.  **Zero stock, no delivery:** If stock is 0 and there's no upcoming delivery, you might say: "This item is out of stock with no delivery scheduled. It's a genuine gap."
3.  **High stock, not on shelf:** If stock is 30, but the picker can't see it, you might say: "System shows 30 in stock. Check the main location carefully and also look for it on promotional displays at [promo location]."
4.  **Negative Stock:** If stock is -5, say: "Stock is negative (-5), indicating a system error. It's likely out of stock but the system needs correcting. Advise your manager."

Keep the tone direct and helpful for a store colleague. Focus on what the data implies and suggest the next logical step.

Product Data:
\`\`\`json
{{{json productData}}}
\`\`\`
`,
});


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
  
  // Step 3: For each found product, generate a diagnostic summary.
  const analysisPromises = skus.map(async (sku) => {
      const product = productsData.find(p => p.scannedSku === sku);
      if (product) {
          try {
            // Call the prompt directly and handle the response correctly
            const diagnosticSummaryResult = await pickerDiagnosisPrompt({ productData: product });
            
            if (!diagnosticSummaryResult || !diagnosticSummaryResult.output) {
                throw new Error("AI failed to generate a diagnosis summary.");
            }

            return { product, diagnosticSummary: diagnosticSummaryResult.output, error: product.proxyError || null };

          } catch(e) {
            const error = e instanceof Error ? e.message : String(e);
            return { product, diagnosticSummary: null, error: `Failed to generate AI diagnosis: ${error}` };
          }
      } else {
          return {
              product: null,
              diagnosticSummary: null,
              error: `Could not fetch data for SKU ${sku}.`,
          };
      }
  });

  const results = await Promise.all(analysisPromises);

  // **CRUCIAL FINAL SANITIZATION ON SERVER**
  // This guarantees that only plain objects are returned from the flow.
  return JSON.parse(JSON.stringify(results));
}
