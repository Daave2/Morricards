'use server';
/**
 * @fileOverview An AI flow for performing Optical Character Recognition (OCR) on product labels.
 *
 * - ocrFlow - A function that takes an image data URI and extracts EAN or SKU numbers.
 * - OcrFlowInput - The input type for the ocrFlow function.
 * - OcrFlowOutput - The return type for the ocrFlow function.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';

const OcrFlowInputSchema = z.object({
  imageDataUri: z
    .string()
    .describe(
      "An image of a product label, as a data URI that must include a MIME type and use Base64 encoding. Expected format: 'data:<mimetype>;base64,<encoded_data>'."
    ),
});
export type OcrFlowInput = z.infer<typeof OcrFlowInputSchema>;

const OcrFlowOutputSchema = z.object({
  eanOrSku: z.string().nullable().describe('The most likely EAN (13 digits) or SKU (7-10 digits) found in the image, or null if none was found.'),
});
export type OcrFlowOutput = z.infer<typeof OcrFlowOutputSchema>;


export async function ocrFlow(input: OcrFlowInput): Promise<OcrFlowOutput> {
  const prompt = ai.definePrompt({
    name: 'ocrPrompt',
    input: { schema: OcrFlowInputSchema },
    output: { schema: OcrFlowOutputSchema },
    prompt: `You are an expert at reading product labels to find barcodes and product numbers. Analyze the following image.
Your task is to identify and extract any EAN (a 13-digit number) or an internal SKU (a 7 to 10-digit number).

Prioritize the 13-digit EAN if you find one. If not, look for a valid SKU. If you find multiple numbers, return only the most prominent and likely candidate.
If no plausible EAN or SKU is visible, return null for the 'eanOrSku' field.

Image: {{media url=imageDataUri}}`,
  });

  const { output } = await prompt(input);
  return output!;
}
