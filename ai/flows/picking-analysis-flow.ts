
'use server';
/**
 * @fileOverview An AI flow for analyzing a screenshot of a picking list.
 *
 * This flow takes an image of a picking app, identifies the products,
 * and provides a judgment and next steps for a picker who can't find an item.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';
import { fetchMorrisonsData } from '@/lib/morrisons-api';
import type { FetchMorrisonsDataOutput } from '@/lib/morrisons-api';
import { type PickingAnalysisInput, type PickingAnalysisOutput, PickingAnalysisOutputSchema } from './picking-analysis-types';

const pickingAnalysisPrompt = ai.definePrompt({
  name: 'pickingAnalysisPrompt',
  // The prompt now takes the image AND the fetched data for all products
  input: {
    schema: z.object({
      imageDataUri: z.string(),
      productsData: z.custom<FetchMorrisonsDataOutput>(),
    }),
  },
  output: { schema: PickingAnalysisOutputSchema },
  prompt: `You are an expert retail assistant specializing in troubleshooting for grocery pickers. You will be given a screenshot of a picker's app and the corresponding product data for the items on that list.

Your task is to analyze each product and provide a helpful 'judgement' and 'nextSteps' to help the picker find it.

**Analysis Steps:**

1.  **Identify Products in Image**: First, look at the screenshot and identify all the distinct products listed. You will use this to correlate with the provided product data.

2.  **Analyze Each Product's Data**: For each product you identified, find its corresponding entry in the provided JSON data. Analyze the following fields to form your judgment:
    *   \`stockQuantity\`: If it's 0, the item is out of stock. If it's low (e.g., 1-5), it might be an 'Early Sellout'.
    *   \`deliveryInfo\`: If \`orderPosition\` is 'next' and the date is today or tomorrow, a delivery is imminent.
    *   \`location.secondary\` or \`location.promotional\`: If these exist, the item may be in a second location.
    *   \`lastStockChange\`: A recent 'invc' (inventory count) or sale can indicate rapid stock movement.

3.  **Formulate Judgment and Next Steps**: Based on your analysis, for each product:
    *   **Create a \`judgement\`**: A single, clear sentence summarizing the most likely scenario.
        *   *Example (low stock):* "This item is likely an early sellout due to very low stock count."
        *   *Example (promo location):* "The product is likely in a secondary promotional location."
        *   *Example (delivery due):* "Stock may be in the warehouse as a delivery is expected very soon."
        *   *Example (no clear reason):* "Stock and location data appear correct; a thorough search of the main shelf is needed."
    *   **Create \`nextSteps\`**: A short, bulleted list of 2-3 practical actions for the picker.
        *   *Example (low stock):* ["Check the store's back-of-house system for any recent sales.", "Look carefully behind other products on the shelf."]
        *   *Example (promo location):* ["Check promotional aisle ends and displays near the main aisle.", "Scan the shelf talker at the primary location to see if it mentions a promotion."]
        *   *Example (delivery due):* ["Ask a colleague to check the goods-in area for the recent delivery.", "Check the top shelf or overhead storage near the main location."]

Return a single JSON object containing a 'products' array with your analysis for every item found in the screenshot.

**Screenshot of Picking List:**
{{media url=imageDataUri}}

**Product Data JSON:**
\`\`\`json
{{{json productsData}}}
\`\`\`
`,
});

// This is the simplified OCR-only prompt for the first step.
const ocrPrompt = ai.definePrompt({
    name: 'pickingListOcr',
    input: { schema: z.object({ imageDataUri: z.string() }) },
    output: { schema: z.object({ skus: z.array(z.string()).describe("An array of all the SKUs found in the image.") }) },
    prompt: `Analyze the provided image of a shopping list app. Identify every product SKU visible and return them as an array of strings.

Image: {{media url=imageDataUri}}`
  });


// The main exported flow now orchestrates the entire process.
export async function pickingAnalysisFlow(input: PickingAnalysisInput): Promise<PickingAnalysisOutput> {

  // Step 1: AI extracts SKUs from the image.
  const ocrResult = await ocrPrompt({ imageDataUri: input.imageDataUri });
  const skus = ocrResult.output?.skus || [];

  if (skus.length === 0) {
      // Return a specific structure that the client can check for failure
      return { products: [] };
  }

  // Step 2: Fetch detailed product data using the extracted SKUs.
  // Note: We are doing this on the server. This has implications for API keys and CORS.
  // This assumes the server environment can make these calls.
  // The 'locationId' would need to be passed in or configured globally.
  // For now, we'll hardcode a default for demonstration.
  const productsData = await fetchMorrisonsData({
      locationId: '218', // This should ideally be passed in
      skus,
      // Bearer token would also be needed here if required by the API
  });
  
  if (!productsData || productsData.length === 0) {
      return { products: [] };
  }

  // Step 3: Call the main analysis prompt with the image AND the fetched data.
  const { output } = await pickingAnalysisPrompt({
      imageDataUri: input.imageDataUri,
      productsData: productsData
  });

  return output || { products: [] };
}

    