
'use server';
/**
 * @fileOverview An AI flow for validating multiple price tickets from a single image against system data.
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
  // The crucial change: output is now an array of OCR data objects.
  output: { schema: z.array(OcrDataSchema) },
  prompt: `You are an expert at reading UK supermarket price tickets from a single photograph, which may contain multiple tickets. Your task is to identify every distinct price ticket on the shelf.

For each ticket you find, extract the following information:
- The full product name (e.g., "Winalot Puppy Meaty Chunks In Gravy").
- The secondary product description (e.g., "12X100G").
- The main price (e.g., "£4.70"). This is the most prominent standard price on the ticket.
- The promotional offer, if present (e.g., "2 for £5.00", "3 for 2"). This is often in a different color or style.
- The unit price, if available (e.g., "£3.92 per kg").
- The EAN (13 digits) or internal SKU (7-10 digits). The SKU is usually a shorter number near the QR code/barcode.

Return an array, with a separate JSON object for each price ticket you identified in the image.

Image: {{media url=imageDataUri}}`,
});

// The flow now returns an array of validation results.
export async function validatePriceTicket(input: PriceTicketValidationInput): Promise<PriceTicketValidationOutput[]> {
  const { imageDataUri, locationId, bearerToken, debugMode } = input;

  // 1. OCR the image to get an array of ticket data
  const { output: ocrResults } = await priceTicketPrompt({ imageDataUri });
  
  if (!ocrResults || ocrResults.length === 0) {
    return [{
      isCorrect: false,
      mismatchReason: "Could not read any valid price tickets from the image.",
      ocrData: null,
      product: null,
    }];
  }

  // Helper function to validate a single OCR result against the API
  const validateSingleTicket = async (ocrData: z.infer<typeof OcrDataSchema>): Promise<PriceTicketValidationOutput> => {
      if (!ocrData || !ocrData.eanOrSku) {
        return {
          isCorrect: false,
          mismatchReason: "Could not read a valid EAN or SKU from this ticket.",
          ocrData: ocrData,
          product: null,
        };
      }
      
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
      
      const ticketPromoString = ocrData.promotionalOffer;
      const ticketRegularPriceString = ocrData.mainPrice;

      const systemPromoString = productData.price.promotional;
      const systemRegularPriceString = productData.price.regular ? `£${productData.price.regular.toFixed(2)}` : null;
      
      const normalize = (price: string | null | undefined): string | null => {
          if (!price) return null;
          // Standardize promo format, e.g., "2 for £5.00" -> "2for5.00"
          return price.replace(/\s*for\s*/, 'for').replace(/[£\s]/g, '').toLowerCase();
      };
      
      const normalizedTicketPromo = normalize(ticketPromoString);
      const normalizedSystemPromo = normalize(systemPromoString);

      if (normalizedTicketPromo && normalizedSystemPromo) {
        if (normalizedTicketPromo === normalizedSystemPromo) {
          return { isCorrect: true, mismatchReason: null, ocrData, product: productData };
        } else {
          return {
            isCorrect: false,
            mismatchReason: `Ticket promo "${ticketPromoString}" does not match system promo "${systemPromoString}".`,
            ocrData,
            product: productData,
          };
        }
      }

      if (normalizedTicketPromo && !normalizedSystemPromo) {
        return {
          isCorrect: false,
          mismatchReason: `Ticket shows promo "${ticketPromoString}" but system has no promo.`,
          ocrData,
          product: productData,
        };
      }

      if (!normalizedTicketPromo && normalizedSystemPromo) {
        return {
          isCorrect: false,
          mismatchReason: `System expects promo "${systemPromoString}" but ticket shows none.`,
          ocrData,
          product: productData,
        };
      }

      // If we are here, there are no promos involved. Check regular price.
      const normalizedTicketRegular = normalize(ticketRegularPriceString);
      const normalizedSystemRegular = normalize(systemRegularPriceString);

      if (normalizedTicketRegular === normalizedSystemRegular) {
        return { isCorrect: true, mismatchReason: null, ocrData, product: productData };
      }

      // Default mismatch for regular prices
      return {
        isCorrect: false,
        mismatchReason: `Ticket price "${ticketRegularPriceString}" does not match system price "${systemRegularPriceString}".`,
        ocrData,
        product: productData,
      };
  };

  // 2. Process all OCR results in parallel.
  const validationPromises = ocrResults.map(validateSingleTicket);
  const results = await Promise.all(validationPromises);
  
  return results;
}
