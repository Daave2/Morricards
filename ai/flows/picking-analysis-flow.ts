
'use server';
/**
 * @fileOverview An AI flow for analyzing a screenshot of a picking list.
 *
 * This flow takes an image of a picking app, identifies the products,
 * and provides a judgment and next steps for a picker who can't find an item.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';
import { PickingAnalysisInputSchema, type PickingAnalysisInput, type PickingAnalysisOutput, PickingAnalysisOutputSchema } from './picking-analysis-types';

const pickingAnalysisPrompt = ai.definePrompt({
  name: 'pickingAnalysisPrompt',
  // The prompt now takes the image AND the fetched data for all products
  input: {
    schema: PickingAnalysisInputSchema
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
export const ocrPrompt = ai.definePrompt({
    name: 'pickingListOcr',
    input: { schema: z.object({ imageDataUri: z.string() }) },
    output: { schema: z.object({ skus: z.array(z.string()).describe("An array of all the SKUs found in the image.") }) },
    prompt: `Analyze the provided image of a shopping list app. Identify every product SKU visible and return them as an array of strings.

Image: {{media url=imageDataUri}}`
  });


// The main exported flow now orchestrates the entire process.
export async function pickingAnalysisFlow(input: PickingAnalysisInput): Promise<PickingAnalysisOutput> {
  
  // The client now orchestrates fetching. This flow just does the final analysis.
  const { output } = await pickingAnalysisPrompt(input);

  return output || { products: [] };
}

    
