
'use server';
/**
 * @fileOverview An AI flow for analyzing a screenshot of a picking list.
 *
 * This flow takes an image of a picking app and identifies the product SKUs.
 * It is intended to be the first step in a client-side orchestration.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';

// This is the simplified OCR-only prompt.
export const ocrPrompt = ai.definePrompt({
    name: 'pickingListOcr',
    input: { schema: z.object({ imageDataUri: z.string() }) },
    output: { schema: z.object({ skus: z.array(z.string()).describe("An array of all the SKUs found in the image.") }) },
    prompt: `Analyze the provided image of a shopping list app. Identify every product SKU visible and return them as an array of strings.

Image: {{media url=imageDataUri}}`
  });
