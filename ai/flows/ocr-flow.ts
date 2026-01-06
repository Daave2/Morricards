// 'use server';
import { z } from 'zod';

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
  console.log('Mock ocrFlow called');
  // Return a dummy SKU
  return { eanOrSku: "123456" };
}
