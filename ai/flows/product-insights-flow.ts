
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
  customerFacingSummary: z.string().describe('A friendly, helpful summary for a customer. Include key features, benefits, and potential uses. Mention the price if available in the data.'),
  price: z.string().optional().describe('The promotional or regular price of the item, formatted with a pound sign e.g. £1.25.'),
  crossSell: z.array(z.string()).describe('Two logical product categories or specific items that would be good to cross-sell with this item.'),
});
export type ProductInsightsOutput = z.infer<typeof ProductInsightsOutputSchema>;

export async function productInsightsFlow(input: ProductInsightsInput): Promise<ProductInsightsOutput> {
  const prompt = ai.definePrompt({
    name: 'productInsightsPrompt',
    input: { schema: ProductInsightsInputSchema },
    output: { schema: ProductInsightsOutputSchema },
    prompt: `You are a friendly and knowledgeable Morrisons AI shopping assistant.
A customer has just scanned an item and you need to give them some helpful information.
Analyze the following product JSON data and generate a helpful summary.

- Your tone should be helpful and engaging.
- The summary should highlight what the product is, its key benefits, and maybe a serving suggestion or use case.
- Explicitly state the price using the data provided.
- Suggest two other product categories they might be interested in.

Product Data:
\`\`\`json
{{{json productData}}}
\`\`\`
`,
  });

  const { output } = await prompt(input);
  return output!;
}

