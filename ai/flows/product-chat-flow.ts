
'use server';
/**
 * @fileOverview A conversational AI flow for asking follow-up questions about a product.
 *
 * - productChatFlow - A function that takes product data and conversation history to generate a response.
 */

import { ai } from '@/ai/genkit';
import { ProductChatInputSchema, ProductChatOutputSchema, type ProductChatInput, type ProductChatOutput } from './product-chat-types';


export async function productChatFlow(input: ProductChatInput): Promise<ProductChatOutput> {
  const prompt = ai.definePrompt({
    name: 'productChatPrompt',
    input: { schema: ProductChatInputSchema },
    output: { schema: ProductChatOutputSchema },
    prompt: `You are a helpful and knowledgeable Morrisons AI shopping assistant.
You are in a conversation with a user about a specific product.
Use the provided product JSON data and the conversation history to answer the user's latest question.

Be concise and helpful. Your answers should be directly related to the user's question and the product data.
Do not invent information. If the answer is not in the product data, say that you don't have that information.

Product Data:
\`\`\`json
{{{json productData}}}
\`\`\`
`,
  });

  const { output } = await prompt(input);
  return { response: output?.response || "I'm sorry, I couldn't generate a response." };
}

    