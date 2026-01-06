// 'use server';
import { z } from 'zod';
import { PriceTicketValidationOutputSchema, OcrDataSchema, type PriceTicketValidationOutput } from './price-validator-types';

export const priceTicketOcrPrompt = async (input: { imageDataUri: string }) => {
  console.log('priceTicketOcrPrompt called (Disabled)');
  // Disabled: return empty result
  return {
    output: []
  };
};

export async function priceTicketOcrFlow(input: { imageDataUri: string }): Promise<z.infer<typeof OcrDataSchema>[]> {
  const { output } = await priceTicketOcrPrompt(input);
  return output || [];
}

const SingleTicketValidationInputSchema = z.object({
  ocrData: OcrDataSchema,
  locationId: z.string(),
  bearerToken: z.string().optional(),
  debugMode: z.boolean().optional(),
});

export async function validatePriceTicket(input: z.infer<typeof SingleTicketValidationInputSchema>): Promise<PriceTicketValidationOutput> {
  console.log('validatePriceTicket called (Disabled)');
  const { ocrData } = input;

  return {
    isCorrect: false,
    mismatchReason: "Validation is disabled in this static demo.",
    ocrData,
    product: null,
  };
}
