
/**
 * @fileOverview Shared types and schemas for the product chat flow.
 */
import { z } from 'genkit';
import type { FetchMorrisonsDataOutput } from '@/lib/morrisons-api';

export const ChatMessageSchema = z.object({
    role: z.enum(['user', 'model']),
    content: z.string(),
});
export type ChatMessage = z.infer<typeof ChatMessageSchema>;

export const ProductChatInputSchema = z.object({
  productData: z.custom<FetchMorrisonsDataOutput[0]>(),
  messages: z.array(ChatMessageSchema),
  locationId: z.string().optional(),
});
export type ProductChatInput = z.infer<typeof ProductChatInputSchema>;


export const ProductChatOutputSchema = z.object({
  response: z.string(),
});
export type ProductChatOutput = z.infer<typeof ProductChatOutputSchema>;
