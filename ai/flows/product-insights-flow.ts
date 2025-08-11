
'use server';
/**
 * @fileOverview Generates sales and marketing insights for a given product.
 *
 * - productInsightsFlow - A function that takes product data and returns AI-generated insights.
 * - ProductInsightsInput - The input type for the flow.
 * - ProductInsightsOutput - The return type for the flow.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';

const ProductInsightsInputSchema = z.object({
  productData: z.any().describe('The raw JSON data of the product from the Morrisons API.'),
});
export type ProductInsightsInput = z.infer<typeof ProductInsightsInputSchema>;

const ProductInsightsOutputSchema = z.object({
  sellingPoints: z.array(z.string()).describe('Three key, concise selling points for the product. Highlight benefits, not just features.'),
  customerProfile: z.string().describe('A brief description of the ideal customer for this product.'),
  crossSell: z.array(z.string()).describe('Two logical product categories or specific items that would be good to cross-sell with this item.'),
  placementNotes: z.string().describe('A short suggestion on where this item could be placed in-store for maximum visibility or to encourage impulse buys, beyond its standard location.'),
});
export type ProductInsightsOutput = z.infer<typeof ProductInsightsOutputSchema>;

export async function productInsightsFlow(input: ProductInsightsInput): Promise<ProductInsightsOutput> {
  const prompt = ai.definePrompt({
    name: 'productInsightsPrompt',
    input: { schema: ProductInsightsInputSchema },
    output: { schema: ProductInsightsOutputSchema },
    prompt: `You are a retail marketing expert for Morrisons supermarket. 
Analyze the following product JSON data and generate actionable insights for a store employee. 
The insights should be brief, practical, and easy to understand.

Focus on what makes the product appealing and how to sell it effectively to the average shopper.
Avoid just repeating facts from the data; provide genuine marketing and sales advice.

Product Data:
\`\`\`json
{{{json productData}}}
\`\`\`
`,
  });

  const { output } = await prompt(input);
  return output!;
}
