// 'use server';
import { z } from 'zod';
import { PriceTicketValidationOutputSchema, OcrDataSchema, type PriceTicketValidationOutput } from './price-validator-types';

export const priceTicketOcrPrompt = async (input: { imageDataUri: string }) => {
  console.log('Mock priceTicketOcrPrompt called');
  await new Promise(resolve => setTimeout(resolve, 1000));
  return {
    output: [
      {
        productName: "Mock Product",
        productSubName: "100g",
        mainPrice: "£1.00",
        promotionalOffer: null,
        unitPrice: "£1.00 per 100g",
        eanOrSku: "123456"
      }
    ]
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
  console.log('Mock validatePriceTicket called');
  await new Promise(resolve => setTimeout(resolve, 500));

  const { ocrData } = input;

  // Return a mock success response
  return {
    isCorrect: true,
    mismatchReason: null,
    ocrData,
    product: {
      sku: ocrData.eanOrSku || "123456",
      name: ocrData.productName || "Mock Product",
      price: { regular: 1.00 },
      // ... other mock fields as needed
    } as any,
  };
}
