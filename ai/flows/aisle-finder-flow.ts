
'use server';
/**
 * @fileOverview An AI tool for matching a product category to the most relevant store aisle.
 *
 * - findAisleForProductTool - A Genkit tool that takes a product category and returns the best matching aisle ID.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';
import { storeLayout } from '@/lib/map-data';

const AisleFinderInputSchema = z.object({
  productCategory: z
    .string()
    .describe('The category or name of the product to be located, e.g., "Ketchup" or "Dog Food".'),
});

const AisleFinderOutputSchema = z.object({
  bestAisleId: z
    .string()
    .nullable()
    .describe('The single best matching aisle ID from the available aisles (e.g., "25"), or null if no logical match is found.'),
});

const aisleFinderPrompt = ai.definePrompt({
    name: 'aisleFinderPrompt',
    input: { schema: z.object({ productCategory: z.string(), allAisles: z.any() }) },
    output: { schema: AisleFinderOutputSchema },
    prompt: `You are an expert UK supermarket store layout planner. Your task is to find the single best aisle ID for a product based on its name or category.

Analyze the user's product query and the list of available store aisle names with their corresponding IDs. Return only the single most logical aisle *ID* from the list.

For example, if the user asks for 'Ketchup' and the aisle list contains {id: "25", name: "Canned food"}, you should determine that sauces are usually in the canned food aisle and return "25".
If the user asks for 'Dog Food', and the list contains {id: "12", name: "Dog"}, you should return "12".

User's Product Query:
"{{productCategory}}"

Available Aisles (ID and Name):
\`\`\`json
{{{json allAisles}}}
\`\`\`
`,
});


export const findAisleForProductTool = ai.defineTool(
  {
    name: 'findAisleForProduct',
    description: 'Find the most likely aisle ID for a given product category or name in the store.',
    inputSchema: AisleFinderInputSchema,
    outputSchema: AisleFinderOutputSchema,
  },
  async (input) => {
    const allAisles = storeLayout.aisles.map(a => ({ id: a.id, name: a.label }));
    const { output } = await aisleFinderPrompt({ ...input, allAisles });
    return output!;
  }
);
