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
  output: {
    schema: z.object({
      skus: z
        .array(z.string())
        .describe('An array of all the SKUs found in the image.'),
    }),
  },
  prompt: `Analyze the provided image of a shopping list app. Identify every product SKU visible and return them as an array of strings.

Image: {{media url=imageDataUri}}`,
});

export const pickerDiagnosisPrompt = ai.definePrompt({
    name: 'pickerDiagnosisPrompt',
    input: { schema: z.object({ rawData: z.any() }) },
    output: { schema: z.object({ diagnosticSummary: z.string() }) },
    prompt: `You are an expert stock investigator for a UK supermarket. Your task is to analyze raw API data for a single product and provide a concise, helpful insight for a store colleague who cannot find it on the shelf.

The user needs a direct, actionable hypothesis. Your entire response should be a single, direct sentence.

Use the provided raw data:
- **stock**: Contains current stock quantity ('qty') and start of day quantity ('startOfDayQty').
- **orderInfo**: Contains 'next' and 'last' delivery information, including dates and quantities.
- **productDetails**: Contains the product's temperature type ('temperatureRegime') - Ambient, Chilled, or Frozen/Produce.
- **location**: Contains the product's standard and promotional locations.

**Here is the required logic and output format:**

1.  **If a delivery was recent (e.g., 'last' delivery was today or yesterday) and sales are low or zero (current stock matches start-of-day stock):**
    - Your entire response MUST be in this format: "X units were due last night and no sales have been recorded today so check for unworked delivery."

2.  **If stock is high, but there have been NO RECENT deliveries:**
    - If the product is 'Ambient', your response MUST be: "Stock records are high at X units but no delivery recently so check capping shelfs."
    - If the product is 'Chilled' or 'Frozen', your response MUST be: "High stock and no recent delivery; check the backup chiller/freezer."
    - If the product is 'Produce', your response MUST be: "High stock and no recent delivery; check under the tables in the produce section."

3.  **If the product has a promotional location (check the 'location.promotional' field):**
    - Your response MUST be in this format: "This item has high stock records and an additional location at {INSERT PROMOTIONAL LOCATION HERE}, so make sure promo locations have been checked."

**Do not be conversational. Provide only the single, actionable sentence.**

Analyze this raw data and provide your insight in the 'diagnosticSummary' field.
\`\`\`json
{{{json rawData}}}
\`\`\`
`,
});
