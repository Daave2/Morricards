
'use server';
/**
 * @fileOverview A conversational AI flow for answering questions about a product.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';
import type { ProductChatInput, ProductChatOutput, ChatMessage } from './product-chat-types';
import type { FetchMorrisonsDataOutput } from '@/lib/morrisons-api';

const systemPrompt = `You are a friendly and knowledgeable Morrisons AI shopping assistant.
Your goal is to answer questions from a store colleague about a specific product.
You have been provided with the product's full data in JSON format and the conversation history.

Use the provided product data as your primary source of truth. If the answer is not in the data, it's okay to say you don't know, but you can also use your general knowledge to provide helpful, related information (e.g., recipe ideas, common uses).

Keep your answers concise, helpful, and easy to understand.

Full Product Data:
\`\`\`json
{{{json productData}}}
\`\`\`
`;

export async function productChatFlow(input: ProductChatInput): Promise<ProductChatOutput> {
  const { productData, messages } = input;

  const prompt = ai.definePrompt({
    name: 'productChatPrompt',
    system: systemPrompt,
    input: {
      schema: z.object({
        productData: z.custom<FetchMorrisonsDataOutput[0]>(),
      }),
    },
    output: { schema: z.object({ response: z.string() }) },
    // Convert the simple chat history into the format Genkit expects.
    messages: [
      ...messages.map(msg => ({
        role: msg.role,
        content: [{ text: msg.content }],
      })),
    ]
  });

  const llmResponse = await prompt({
    productData,
  });
  
  const output = llmResponse.output || { response: "I'm sorry, I couldn't generate a response." };

  return {
    response: output.response,
  };
}
