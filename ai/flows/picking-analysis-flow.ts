
'use server';
/**
 * @fileOverview An AI flow for analyzing a screenshot of a picking list.
 *
 * This flow takes an image of a picking app, identifies the products,
 * and provides a judgment and next steps for a picker who can't find an item.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';
import type { FetchMorrisonsDataOutput } from '@/lib/morrisons-api';

// 1. Define the input schema for the entire flow
const PickingAnalysisInputSchema = z.object({
  imageDataUri: z
    .string()
    .describe("An image of the picking app screen, as a data URI."),
});
export type PickingAnalysisInput = z.infer<typeof PickingAnalysisInputSchema>;


// 2. Define the output schema for a single analyzed product
export const AnalyzedProductSchema = z.object({
    productName: z.string().nullable().describe("The name of the product identified in the list."),
    sku: z.string().nullable().describe("The SKU or EAN of the product identified."),
    judgement: z.string().describe("A concise, one-sentence judgment on the most likely reason the item cannot be found, based on its data. E.g., 'Likely out of stock due to recent sell-out.' or 'Item may be in a secondary promotional location.'"),
    nextSteps: z.array(z.string()).describe("A short, ordered list of 2-3 actionable steps for the picker. E.g., ['Check the back stock room system for recent deliveries.', 'Look for a promotional end-cap display for this brand.']")
});
export type AnalyzedProduct = z.infer<typeof AnalyzedProductSchema>;

// 3. Define the final output schema for the flow
const PickingAnalysisOutputSchema = z.object({
  products: z.array(AnalyzedProductSchema).describe("An array of all products analyzed from the screenshot."),
});
export type PickingAnalysisOutput = z.infer<typeof PickingAnalysisOutputSchema>;


// 4. Define the main prompt that orchestrates the analysis
const pickingAnalysisPrompt = ai.definePrompt({
    name: 'pickingAnalysisPrompt',
    // The prompt now takes the image AND the fetched data for all products
    input: { schema: z.object({
        imageDataUri: z.string(),
        productsData: z.custom<FetchMorrisonsDataOutput>()
    })},
    output: { schema: PickingAnalysisOutputSchema },
    prompt: `You are an expert retail assistant specializing in troubleshooting for grocery pickers. You will be given a screenshot of a picker's app and the corresponding product data for the items on that list.

Your task is to analyze each product and provide a helpful 'judgment' and 'nextSteps' to help the picker find it.

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


// 5. The exported flow function
export async function pickingAnalysisFlow(input: PickingAnalysisInput): Promise<PickingAnalysisOutput> {

  // Step 1: A simple OCR flow to get the SKUs from the image.
  // This is a simplified preliminary step. In a real scenario, we might use a more robust OCR model.
  const ocrPrompt = ai.definePrompt({
    name: 'pickingListOcr',
    input: { schema: z.object({ imageDataUri: z.string() }) },
    output: { schema: z.object({ skus: z.array(z.string()).describe("An array of all the SKUs found in the image.") }) },
    prompt: `Analyze the provided image of a shopping list app. Identify every product SKU visible and return them as an array of strings.

Image: {{media url=imageDataUri}}`
  });
  
  const ocrResult = await ocrPrompt({ imageDataUri: input.imageDataUri });
  const skus = ocrResult.output?.skus || [];

  if (skus.length === 0) {
      return { products: [] };
  }

  // Step 2: Fetch the product data using the extracted SKUs.
  // This part happens on the client in the real app, but we simulate it here.
  // In the real implementation, the client will call this flow with the data already fetched.
  // For this flow to be self-contained for testing, we'd call `getProductData` here.
  // However, to integrate with the client, we'll assume the data is passed in.
  // The prompt is now designed to receive this data directly.

  // For the purpose of this file, we can't actually fetch data. The client will do that.
  // So, the `productsData` for the main prompt will be fetched on the client and passed.
  // Let's create a dummy call to the main prompt assuming the data is empty,
  // as the client will be the one making the real call with full data.
  const { output } = await pickingAnalysisPrompt({
      imageDataUri: input.imageDataUri,
      productsData: [] // The client will provide the actual data here.
  });

  return output || { products: [] };
}
