/**
 * @fileOverview Shared types for the planogram validation flow.
 */

import { z } from 'genkit';

export const PlanogramInputSchema = z.object({
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

export const ProductOnPlanSchema = z.object({
    sku: z.string().nullable(),
    productName: z.string(),
    shelf: z.number().describe("The shelf number, counting from the top (1 is the top shelf)."),
    position: z.number().describe("The position on the shelf, from left to right (1 is a leftmost)."),
});
export type ProductOnPlan = z.infer<typeof ProductOnPlanSchema>;

export const ComparisonResultSchema = z.object({
    status: z.enum(['Correct', 'Misplaced', 'Missing', 'Extra']),
    productName: z.string(),
    sku: z.string().nullable(),
    expectedShelf: z.number().nullable(),
    expectedPosition: z.number().nullable(),
    actualShelf: z.number().nullable(),
    actualPosition: z.number().nullable(),
});
export type ComparisonResult = z.infer<typeof ComparisonResultSchema>;

export const PlanogramOutputSchema = z.object({
  comparisonResults: z.array(ComparisonResultSchema).describe("A consolidated list of all items with their compliance status."),
});
export type PlanogramOutput = z.infer<typeof PlanogramOutputSchema>;
