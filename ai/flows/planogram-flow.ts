'use server';
/**
 * @fileOverview An AI flow for validating a shelf's layout against a planogram.
 *
 * - planogramFlow - A function that takes two images and returns the differences.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';
import { PlanogramInputSchema, PlanogramOutputSchema, type PlanogramInput, type PlanogramOutput } from './planogram-types';


const planogramPrompt = ai.definePrompt({
    name: 'planogramPrompt',
    input: { schema: PlanogramInputSchema },
    output: { schema: PlanogramOutputSchema },
    prompt: `You are an expert at retail planogram compliance. You will be given two images:
1.  The official planogram showing what *should* be on the shelf.
2.  A photo of the actual shelf.

Your tasks are:
1.  **Analyze the Planogram**: Identify every product on the planogram. For each, extract its name, SKU (if visible), which shelf it's on (1 is the top shelf), and its position from the left (1 is the leftmost).

2.  **Analyze the Shelf Photo**: Identify every product on the shelf by reading their **shelf-edge price tickets**. For each ticket you identify, extract the product name and determine its shelf and position.

3.  **Compare and Consolidate**: Compare the list from the planogram to the list from the shelf. You must intelligently match products even if the names are slightly different (e.g., 'GU Hot Choc Puds 2x80G' on the planogram and 'GU Hot Chocolate Puddings' on the shelf are the same). The SKU is the best unique identifier if available. Generate a single 'comparisonResults' list with a status for each item:
    - **Correct**: The product is on the correct shelf and position.
    - **Misplaced**: The product is on the shelf, but on the wrong shelf or in the wrong position.
    - **Missing**: The product is on the planogram but cannot be found on the shelf.
    - **Extra**: The product is on the shelf but is not on the planogram.

4. For each item in your result, provide the product name, SKU, expected location (if any), and actual location (if any).

Planogram Image:
{{media url=planogramImageDataUri}}

Shelf Image:
{{media url=shelfImageDataUri}}
`,
});


export async function planogramFlow(input: PlanogramInput): Promise<PlanogramOutput> {
  const { output } = await planogramPrompt(input);
  return output!;
}
