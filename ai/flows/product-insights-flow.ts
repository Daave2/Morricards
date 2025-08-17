
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
  productData: z.object({
    sku: z.string(),
    name: z.string(),
    price: z.any().optional(),
    stockQuantity: z.number(),
    location: z.any(),
    productDetails: z.object({
      ingredients: z.array(z.string()).optional(),
      allergenInfo: z.array(z.object({ name: z.string(), value: z.string() })).optional(),
      nutritionalInfo: z.array(z.any()).optional(),
      commercialHierarchy: z.any().optional(),
      productLife: z.any().optional(),
      storage: z.array(z.string()).optional(),
      countryOfOrigin: z.string().nullable().optional(),
      brand: z.string().optional(),
      // Add other fields from the rich data as needed
    }).optional(),
  }).describe('The raw JSON data of the product from the Morrisons API, including location, price, stock, and detailed product attributes.'),
});
export type ProductInsightsInput = z.infer<typeof ProductInsightsInputSchema>;

const ProductInsightsOutputSchema = z.object({
  customerFacingSummary: z.string().describe('A friendly, helpful summary for a customer. Include key features, benefits, and potential uses. Mention the price if available in the data.'),
  price: z.string().optional().describe('The promotional or regular price of the item, formatted with a pound sign e.g. £1.25.'),
  crossSell: z.array(z.string()).describe('Two logical product categories or specific items that would be good to cross-sell with this item.'),
  customerFriendlyLocation: z.string().describe("A customer-friendly description of where to find the product in the store based on its location data. For example, 'You can find this on Aisle 14, on your right-hand side.'"),
  recipeIdeas: z.array(z.string()).optional().describe("If the item is a food product, suggest one or two simple recipe ideas or serving suggestions. For non-food items, this can be omitted."),
  sellingPoints: z.array(z.string()).optional().describe('A list of 3-5 bullet points highlighting the key selling points of the product for a store colleague. These should be derived from the detailed product data.'),
  customerProfile: z.string().optional().describe('A brief sentence describing the ideal customer for this product, based on its category, price, and other attributes.'),
  placementNotes: z.string().optional().describe('A short note for a store colleague on ideal merchandising or placement for this product, using the commercial hierarchy to suggest co-location with related products.'),
});
export type ProductInsightsOutput = z.infer<typeof ProductInsightsOutputSchema>;

export async function productInsightsFlow(input: ProductInsightsInput): Promise<ProductInsightsOutput> {
  const prompt = ai.definePrompt({
    name: 'productInsightsPrompt',
    input: { schema: ProductInsightsInputSchema },
    output: { schema: ProductInsightsOutputSchema },
    prompt: `You are a friendly and knowledgeable Morrisons AI shopping assistant.
A customer has just scanned an item and you need to give them some helpful information.
Analyze the following product JSON data and generate a helpful summary. The data contains the main product info, and a nested 'productDetails' object with richer information.

You must use the information in the 'productDetails' object to make your response as detailed and helpful as possible. Specifically:
- **For the customerFacingSummary**: Examine the 'ingredients' array and mention one or two key ingredients. Look at 'allergenInfo' and clearly state any allergens. If 'nutritionalInfo' is available, briefly summarize it. Mention the 'brand' and 'countryOfOrigin'. Use 'productLife' to give advice on shelf life and 'storage' for storage instructions.
- **For the sellingPoints**: Base your points on concrete data. Use the 'brand', 'countryOfOrigin', specific 'ingredients', or unique 'productFlags' to create compelling points. Do not be generic.
- **For the customerProfile**: Use the 'commercialHierarchy', 'price', and 'brand' to define the ideal customer. For example, a premium brand in the 'Organic' subclass might appeal to health-conscious shoppers.
- **For the placementNotes**: Use the `commercialHierarchy` (e.g., `departmentName`, `className`) to suggest placing the item near other products in the same category.
- **For the recipeIdeas**: If it's a food item, base the ideas on the listed 'ingredients'.
- **For the customerFriendlyLocation**: Convert the structured location data into a friendly, easy-to-understand direction for a customer. For example, if the location is "Aisle 14, Right bay 2, shelf 3", you could say "You'll find this on Aisle 14, on your right about halfway down."

Your tone should be helpful and engaging. Explicitly state the price using the data provided.

Product Data:
\`\`\`json
{{{json productData}}}
\`\`\`
`,
  });

  const { output } = await prompt(input);
  return output!;
}
