'use server';
/**
 * @fileOverview An AI flow for validating price tickets against system data.
 *
 * - validatePriceTicket - Captures data from a price ticket image and validates it against the Morrisons API.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';
import { fetchMorrisonsData, type FetchMorrisonsDataOutput } from '@/lib/morrisons-api';
import { PriceTicketValidationInputSchema, PriceTicketValidationOutputSchema, OcrDataSchema, type PriceTicketValidationInput, type PriceTicketValidationOutput } from './price-validator-types';


const priceTicketPrompt = ai.definePrompt({
  name: 'priceTicketOcrPrompt',
  input: { schema: z.object({ imageDataUri: z.string() }) },
  output: { schema: OcrDataSchema },
  prompt: `You are an expert at reading UK supermarket price tickets. Analyze the following image of a Morrisons price ticket.

Extract the following information:
- The full product name.
- The main price, including any multi-buy offer (e.g., "2 for £5.00").
- The EAN (13 digits) or internal SKU (7-10 digits). The SKU is usually a shorter number near the barcode/QR code.

Image: {{media url=imageDataUri}}`,
});

export async function validatePriceTicket(input: PriceTicketValidationInput): Promise<PriceTicketValidationOutput> {
  const { imageDataUri, locationId, bearerToken, debugMode } = input;

  // 1. OCR the image
  const { output: ocrData } = await priceTicketPrompt({ imageDataUri });
  if (!ocrData || !ocrData.eanOrSku) {
    return {
      isCorrect: false,
      mismatchReason: "Could not read a valid EAN or SKU from the ticket.",
      ocrData: ocrData,
      product: null,
    };
  }

  // 2. Fetch product data from API
  let productData: FetchMorrisonsDataOutput[0] | null = null;
  try {
    const apiResult = await fetchMorrisonsData({
      skus: [ocrData.eanOrSku],
      locationId,
      bearerToken,
      debugMode,
    });
    if (apiResult && apiResult.length > 0) {
      productData = apiResult[0];
    } else {
        return {
          isCorrect: false,
          mismatchReason: `Product with EAN/SKU ${ocrData.eanOrSku} not found in the system.`,
          ocrData,
          product: null,
        };
    }
  } catch (e) {
    const error = e instanceof Error ? e.message : String(e);
    return {
      isCorrect: false,
      mismatchReason: `API Error: ${error}`,
      ocrData,
      product: null,
    };
  }

  // 3. Compare prices
  const ticketPrice = ocrData.price;
  const systemPrice = productData.price.regular ? `£${productData.price.regular.toFixed(2)}` : null;
  const systemPromo = productData.price.promotional;
  
  // Normalize prices for comparison (remove currency symbols, whitespace)
  const normalize = (p: string | null | undefined) => p?.replace(/[£\s]/g, '').toLowerCase();

  const normalizedTicketPrice = normalize(ticketPrice);
  const normalizedSystemPrice = normalize(systemPrice);
  const normalizedSystemPromo = normalize(systemPromo);

  if (normalizedSystemPromo) {
    // If there's a promotion, the ticket should match the promotional price
    if (normalizedTicketPrice === normalizedSystemPromo) {
      return { isCorrect: true, mismatchReason: null, ocrData, product: productData };
    } else {
      return {
        isCorrect: false,
        mismatchReason: `Ticket price "${ticketPrice}" does not match promo price "${systemPromo}".`,
        ocrData,
        product: productData,
      };
    }
  } else {
    // If no promotion, ticket should match the regular price
    if (normalizedTicketPrice === normalizedSystemPrice) {
      return { isCorrect: true, mismatchReason: null, ocrData, product: productData };
    } else {
      return {
        isCorrect: false,
        mismatchReason: `Ticket price "${ticketPrice}" does not match system price "${systemPrice}".`,
        ocrData,
        product: productData,
      };
    }
  }
}
