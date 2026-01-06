
/**
 * @fileOverview Shared types and schemas for the price validator flow.
 */

import { z } from 'zod';
import type { FetchMorrisonsDataOutput } from '@/lib/morrisons-api';


export const OcrDataSchema = z.object({
  productName: z.string().nullable().describe("The main name of the product as seen on the ticket."),
  productSubName: z.string().nullable().describe("The secondary description of the product, often indicating size or quantity (e.g., '12X100G')."),
  mainPrice: z.string().nullable().describe("The main, standard price on the ticket, formatted with a currency symbol e.g., £4.70."),
  promotionalOffer: z.string().nullable().describe("The promotional offer text, if visible (e.g., '2 for £5.00')."),
  unitPrice: z.string().nullable().describe("The price per unit, if visible (e.g., '£3.92 per kg')."),
  eanOrSku: z.string().nullable().describe("The EAN (13 digits) or SKU (7-10 digits) found on the ticket. Should be one of the numbers near the QR code."),
});
export type OcrData = z.infer<typeof OcrDataSchema>;


export const PriceTicketValidationInputSchema = z.object({
  imageDataUri: z.string().describe("An image of a price ticket, as a data URI."),
  locationId: z.string().describe("The ID of the store location."),
  bearerToken: z.string().optional().describe("Optional bearer token for API calls."),
  debugMode: z.boolean().optional().describe("Optional debug mode flag."),
});
export type PriceTicketValidationInput = z.infer<typeof PriceTicketValidationInputSchema>;

export const PriceTicketValidationOutputSchema = z.object({
  isCorrect: z.boolean().describe("Whether the ticket price matches the system price."),
  mismatchReason: z.string().nullable().describe("The reason for the price mismatch, if any."),
  ocrData: OcrDataSchema.nullable().describe("The data extracted from the ticket via OCR."),
  product: z.any().nullable().describe("The product data fetched from the Morrisons API."),
});

export type PriceTicketValidationOutput = z.infer<typeof PriceTicketValidationOutputSchema>;
