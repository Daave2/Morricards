
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

Your goal is to be helpful and conversational.

- When asked about stock or deliveries, use the 'stockQuantity' and 'deliveryInfo' fields to give a precise answer. Format dates in a friendly way.
- When asked for alternatives, use the 'commercialHierarchy' (like 'className' or 'subclassName') to suggest looking for other products in the same category. For example, "You could look for other types of mustard in the same aisle."
- If the user asks for health or dietary advice that is not explicitly in the 'ingredients' or 'allergenInfo' fields, you MUST state that you cannot provide medical advice and recommend they consult a professional or check the packaging.
- For any other questions, if the answer is not in the product data, it is better to say you don't have that information than to make something up.

Be concise and helpful in your tone.

Product Data:
\`\`\`json
{{{json productData}}}
\`\`\`

Conversation History:
{{#each history}}
{{role}}: {{{content}}}
{{/each}}
`,
  });

  const { output } = await prompt(input);
  return { response: output?.response || "I'm sorry, I couldn't generate a response." };
}
