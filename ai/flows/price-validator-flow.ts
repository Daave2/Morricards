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
- The EAN (13 digits) or internal SKU (7-10 digits). The SKU is usually a shorter number near the QR code/barcode.

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
  const ticketPriceString = ocrData.price;
  const systemPriceString = productData.price.regular ? `£${productData.price.regular.toFixed(2)}` : null;
  const systemPromoString = productData.price.promotional;
  
  // Advanced normalization to handle numbers and multi-buy offers
  const normalizePrice = (price: string | null | undefined): string | number | null => {
      if (!price) return null;
      const cleaned = price.replace(/[£\s]/g, '').toLowerCase();
      // If it looks like "2for5.00", keep as string
      if (/^\d+for\d+(\.\d+)?$/.test(cleaned)) {
        return cleaned;
      }
      // Otherwise, treat as a number
      const num = parseFloat(cleaned);
      return isNaN(num) ? cleaned : num;
  };

  const normalizedTicketPrice = normalizePrice(ticketPriceString);
  const normalizedSystemPrice = normalizePrice(systemPriceString);
  const normalizedSystemPromo = normalizePrice(systemPromoString);

  if (normalizedSystemPromo) {
    // If there's a promotion, the ticket should match the promotional price
    if (normalizedTicketPrice === normalizedSystemPromo) {
      return { isCorrect: true, mismatchReason: null, ocrData, product: productData };
    } else {
      return {
        isCorrect: false,
        mismatchReason: `Ticket price "${ticketPriceString}" does not match promo price "${systemPromoString}".`,
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
        mismatchReason: `Ticket price "${ticketPriceString}" does not match system price "${systemPriceString}".`,
        ocrData,
        product: productData,
      };
    }
  }
}
