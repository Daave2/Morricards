
'use server';
/**
 * @fileOverview An AI flow for matching a product category to the most relevant store aisle.
 *
 * - findAisleForProduct - A function that takes a product category and a list of aisle names, and returns the best match.
 * - AisleFinderInput - The input type for the findAisleForProduct function.
 * - AisleFinderOutput - The return type for the findAisleForProduct function.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';

const AisleFinderInputSchema = z.object({
  productCategory: z
    .string()
    .describe('The category of the product to be located, e.g., "Chilled Foods" or "Confectionery, Snacks & Biscuits".'),
  aisleNames: z
    .array(z.string())
    .describe('A list of all available aisle and zone names in the store.'),
});
export type AisleFinderInput = z.infer<typeof AisleFinderInputSchema>;

const AisleFinderOutputSchema = z.object({
  bestAisleName: z
    .string()
    .nullable()
    .describe('The single best matching aisle name from the provided list, or null if no logical match is found.'),
});
export type AisleFinderOutput = z.infer<typeof AisleFinderOutputSchema>;


export async function findAisleForProduct(input: AisleFinderInput): Promise<AisleFinderOutput> {
  const prompt = ai.definePrompt({
    name: 'aisleFinderPrompt',
    input: { schema: AisleFinderInputSchema },
    output: { schema: AisleFinderOutputSchema },
    prompt: `You are an expert store layout planner. Your task is to find the single best location for a product based on its category.

Analyze the product category and the list of available store aisle names. Return only the single most logical aisle name from the list.

For example, if the product category is 'Chilled Foods' and the aisle list contains 'Cheese', 'Dairy', and 'Butter', you might determine 'Cheese' is the most specific and best fit, so you would return "Cheese".
If the product category is 'Confectionery, Snacks & Biscuits', and the list contains 'Sweets', 'Biscuits', 'Crisps', you might return "Sweets" or "Biscuits".

Product Category:
{{productCategory}}

Available Aisle Names:
{{{json aisleNames}}}
`,
  });

  const { output } = await prompt(input);
  return output!;
}
