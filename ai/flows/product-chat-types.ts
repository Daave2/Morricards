
/**
 * @fileOverview Shared types for the product chat flow.
 */
import { z } from 'genkit';
import type { components } from '@/morrisons-types';

type Product = components['schemas']['Product'];

export const ProductChatInputSchema = z.object({
  productData: z.custom<Product>().describe('The raw JSON data of the product from the Morrisons API.'),
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

    