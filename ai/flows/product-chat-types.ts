
/**
 * @fileOverview Shared types for the product chat flow.
 */
import { z } from 'genkit';
import type { FetchMorrisonsDataOutput } from '@/lib/morrisons-api';

type Product = FetchMorrisonsDataOutput[0];

export const ProductChatInputSchema = z.object({
  productData: z.custom<Product>().describe('The raw JSON data of the product from the Morrisons API, including price, stock, delivery, and productDetails.'),
  history: z.array(z.object({
    role: z.enum(['user', 'model']),
    content: z.string(),
  })).describe('The history of the conversation so far.'),
});
export type ProductChatInput = z.infer<typeof ProductChatInputSchema>;


export const ProductChatOutputSchema = z.object({
  response: z.string().describe('The AI model\'s response to the user\'s message.'),
});
export type ProductChatOutput = z.infer<typeof ProductChatOutputSchema>;
