
import { z } from 'genkit';
import type { FetchMorrisonsDataOutput } from '@/lib/morrisons-api';


// 1. Define the input schema for the entire flow
export const PickingAnalysisInputSchema = z.object({
  imageDataUri: z
    .string()
    .describe("An image of the picking app screen, as a data URI."),
  productsData: z.custom<FetchMorrisonsDataOutput>(),
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
export const PickingAnalysisOutputSchema = z.object({
  products: z.array(AnalyzedProductSchema).describe("An array of all products analyzed from the screenshot."),
});
export type PickingAnalysisOutput = z.infer<typeof PickingAnalysisOutputSchema>;

    