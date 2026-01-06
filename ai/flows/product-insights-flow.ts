// 'use server'; // Disabled for static export
import { z } from 'zod';
import type { FetchMorrisonsDataOutput } from '@/lib/morrisons-api';

type Product = FetchMorrisonsDataOutput[0];

const ProductInsightsInputSchema = z.object({
  productData: z.custom<Product>().describe('The raw JSON data of the product from the Morrisons API, including price, stock, delivery, and detailed product attributes.'),
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
  placementNotes: z.string().optional().describe('A short note for a store colleague on ideal merchandising or placement for this product, using the commercialHierarchy to suggest co-location with related products.'),
  allergens: z.array(z.string()).optional().describe("A list of all allergens where the value is 'Contains'. If the 'productDetails.allergenInfo' field is missing, empty, or all items have a value other than 'Contains', you must explicitly return an array containing the single string 'None listed'."),
});
export type ProductInsightsOutput = z.infer<typeof ProductInsightsOutputSchema>;

// MOCK IMPLEMENTATION
export async function productInsightsFlow(input: ProductInsightsInput): Promise<ProductInsightsOutput> {
  console.log('Mock productInsightsFlow called');
  await new Promise(resolve => setTimeout(resolve, 1000)); // Simulate AI delay

  return {
    customerFacingSummary: "This is a great product with high nutritional value. Store in a cool, dry place.",
    price: "£1.45",
    crossSell: ["Cookies", "Tea Bags"],
    customerFriendlyLocation: "You'll find this on Aisle 10, bay 3, shelf 2.",
    recipeIdeas: ["Great with cereal", "Standard tea ingredient"],
    sellingPoints: ["Locally sourced", "Fresh every day", "Great value"],
    customerProfile: "Families and daily shoppers.",
    placementNotes: "Place near cereals and tea/coffee aisle.",
    allergens: ["Milk"],
  };
}
