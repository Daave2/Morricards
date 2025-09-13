
'use server';
/**
 * @fileOverview An AI flow for validating a shelf's layout against a planogram.
 *
 * - planogramFlow - A function that takes two images and returns the differences.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';

const PlanogramInputSchema = z.object({
  planogramImageDataUri: z
    .string()
    .describe(
      "An image of the planogram document, as a data URI."
    ),
  shelfImageDataUri: z
    .string()
    .describe(
      "A photo of the physical shelf, as a data URI."
    ),
});
export type PlanogramInput = z.infer<typeof PlanogramInputSchema>;

const ProductOnPlan = z.object({
    sku: z.string().nullable(),
    productName: z.string(),
    shelf: z.number().describe("The shelf number, counting from the top (1 is the top shelf)."),
    position: z.number().describe("The position on the shelf, from left to right (1 is leftmost)."),
});

const PlanogramOutputSchema = z.object({
  planogramProducts: z.array(ProductOnPlan).describe("List of products as they should appear on the planogram."),
  shelfProducts: z.array(ProductOnPlan).describe("List of products as they are currently on the shelf."),
});
export type PlanogramOutput = z.infer<typeof PlanogramOutputSchema>;

const planogramPrompt = ai.definePrompt({
    name: 'planogramPrompt',
    input: { schema: PlanogramInputSchema },
    output: { schema: PlanogramOutputSchema },
    prompt: `You are an expert at retail planogram compliance. You will be given two images:
1.  The official planogram showing what *should* be on the shelf.
2.  A photo of the actual shelf.

Your tasks are:
1.  **Analyze the Planogram**: Identify every product on the planogram. For each, extract its name, SKU (if visible), which shelf it's on (1 is the top shelf), and its position from the left (1 is the leftmost). Create a list for 'planogramProducts'.
2.  **Analyze the Shelf Photo**: Identify every product on the physical shelf. For each, extract its name, SKU, which shelf it's on, and its position. Create a list for 'shelfProducts'.
3.  Return both lists.

Planogram Image:
{{media url=planogramImageDataUri}}

Shelf Image:
{{media url=shelfImageDataUri}}
`,
});


export async function planogramFlow(input: PlanogramInput): Promise<PlanogramOutput> {
  // In a real implementation, we would call the prompt:
  // const { output } = await planogramPrompt(input);
  // return output!;

  // For now, return mock data to simulate the AI's response.
  await new Promise(resolve => setTimeout(resolve, 2000));
  
  return {
    planogramProducts: [
      { sku: '12345', productName: 'Example Product A (Plan)', shelf: 1, position: 1 },
      { sku: '67890', productName: 'Example Product B (Plan)', shelf: 1, position: 2 },
      { sku: '11223', productName: 'Example Product C (Plan)', shelf: 2, position: 1 },
    ],
    shelfProducts: [
      { sku: '12345', productName: 'Example Product A (Shelf)', shelf: 1, position: 1 },
      { sku: '99999', productName: 'WRONG Product D (Shelf)', shelf: 1, position: 2 },
      { sku: '11223', productName: 'Example Product C (Shelf)', shelf: 2, position: 2 }, // Wrong position
    ],
  };
}
