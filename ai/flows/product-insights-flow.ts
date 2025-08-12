
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
  productData: z.any().describe('The raw JSON data of the product from the Morrisons API, including location details.'),
});
export type ProductInsightsInput = z.infer<typeof ProductInsightsInputSchema>;

const ProductInsightsOutputSchema = z.object({
  customerFacingSummary: z.string().describe('A friendly, helpful summary for a customer. Include key features, benefits, and potential uses. Mention the price if available in the data.'),
  price: z.string().optional().describe('The promotional or regular price of the item, formatted with a pound sign e.g. £1.25.'),
  crossSell: z.array(z.string()).describe('Two logical product categories or specific items that would be good to cross-sell with this item.'),
  customerFriendlyLocation: z.string().describe("A customer-friendly description of where to find the product in the store based on its location data. For example, 'You can find this on Aisle 14, on your right-hand side.'"),
  recipeIdeas: z.array(z.string()).optional().describe("If the item is a food product, suggest one or two simple recipe ideas or serving suggestions. For non-food items, this can be omitted."),
  sellingPoints: z.array(z.string()).optional().describe('A list of 3-5 bullet points highlighting the key selling points of the product for a store colleague.'),
  customerProfile: z.string().optional().describe('A brief sentence describing the ideal customer for this product.'),
  placementNotes: z.string().optional().describe('A short note for a store colleague on ideal merchandising or placement for this product.'),
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
- Convert the structured location data into a friendly, easy-to-understand direction for a customer. For example, if the location is "Aisle 14, Right bay 2, shelf 3", you could say "You'll find this on Aisle 14, on your right about halfway down."
- If the item is a food product, provide one or two simple and appealing recipe ideas or serving suggestions.
- Provide a list of key selling points for a store colleague.
- Provide a brief profile of the ideal customer for this product.
- Provide a short note on ideal merchandising or placement.

Product Data:
\`\`\`json
{{{json productData}}}
\`\`\`
`,
  });

  const { output } = await prompt(input);
  return output!;
}
