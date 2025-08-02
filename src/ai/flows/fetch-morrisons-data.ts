'use server';
/**
 * @fileOverview Fetches and filters Morrisons product data based on a list of SKUs.
 *
 * - fetchMorrisonsData - A function that fetches and filters product information for given SKUs.
 * - FetchMorrisonsDataInput - The input type for the fetchMorrisonsData function.
 * - FetchMorrisonsDataOutput - The return type for the fetchMorrisonsData function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const FetchMorrisonsDataInputSchema = z.object({
  locationId: z.string().describe('The ID of the Morrisons store location.'),
  skus: z.array(z.string()).describe('An array of Morrisons product SKUs.'),
});
export type FetchMorrisonsDataInput = z.infer<typeof FetchMorrisonsDataInputSchema>;

const FetchMorrisonsDataOutputSchema = z.array(
  z.object({
    sku: z.string().describe('The Morrisons product SKU.'),
    name: z.string().describe('The name of the product.'),
    price: z.number().describe('The current price of the product.'),
    stockQuantity: z.number().describe('The stock quantity of the product.'),
    location: z.string().describe('The location of the product in the store.'),
    promotion: z.string().optional().describe('Any available promotional information.'),
  })
);
export type FetchMorrisonsDataOutput = z.infer<typeof FetchMorrisonsDataOutputSchema>;

export async function fetchMorrisonsData(input: FetchMorrisonsDataInput): Promise<FetchMorrisonsDataOutput> {
  return fetchMorrisonsDataFlow(input);
}

const getProductInfo = ai.defineTool({
  name: 'getProductInfo',
  description: 'Retrieves product information, stock levels, and location details for a given SKU from the Morrisons API.',
  inputSchema: z.object({
    locationId: z.string().describe('The ID of the Morrisons store location.'),
    sku: z.string().describe('The Morrisons product SKU.'),
  }),
  outputSchema: z.object({
    sku: z.string().describe('The Morrisons product SKU.'),
    name: z.string().describe('The name of the product.'),
    price: z.number().describe('The current price of the product.'),
    stockQuantity: z.number().describe('The stock quantity of the product.'),
    location: z.string().describe('The location of the product in the store.'),
    promotion: z.string().optional().describe('Any available promotional information.'),
  }),
}, async (input) => {
  // TODO: Implement the actual API call to Morrisons here.
  // This is a placeholder implementation.
  console.log(`Fetching data for SKU: ${input.sku} at location: ${input.locationId}`);
  return {
    sku: input.sku,
    name: `Product ${input.sku}`,
    price: 2.99,
    stockQuantity: 100,
    location: 'Aisle 5',
    promotion: '2 for 1 offer',
  };
});

const prompt = ai.definePrompt({
  name: 'filterProductDataPrompt',
  tools: [getProductInfo],
  input: {schema: FetchMorrisonsDataInputSchema},
  output: {schema: FetchMorrisonsDataOutputSchema},
  prompt: `You are an AI assistant helping to fetch product information from Morrisons stores.
For the given list of SKUs, use the getProductInfo tool to retrieve the product information, stock levels, and location details from the Morrisons API.

Only include the following details in your response:
- Product name
- Stock quantity
- Location in store
- Price
- Any available promotional information

Do not include any other details.

Input SKUs: {{{skus}}}
Location ID: {{{locationId}}}`,
});

const fetchMorrisonsDataFlow = ai.defineFlow(
  {
    name: 'fetchMorrisonsDataFlow',
    inputSchema: FetchMorrisonsDataInputSchema,
    outputSchema: FetchMorrisonsDataOutputSchema,
  },
  async input => {
    const productData = await Promise.all(
      input.skus.map(async sku => {
        return await getProductInfo({
          sku: sku,
          locationId: input.locationId,
        });
      })
    );

    return productData;
  }
);

