
'use server';
/**
 * @fileOverview Generates a diagnostic summary for a picker trying to find a product.
 *
 * - pickerDiagnosisFlow - A function that takes product data and returns a helpful summary.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';
import type { FetchMorrisonsDataOutput } from '@/lib/morrisons-api';

type Product = FetchMorrisonsDataOutput[0];

const PickerDiagnosisInputSchema = z.object({
  productData: z.custom<Product>().describe('The raw JSON data of the product from the Morrisons API, including price, stock, delivery, and location information.'),
});

const pickerDiagnosisPrompt = ai.definePrompt({
    name: 'pickerDiagnosisPrompt',
    input: { schema: PickerDiagnosisInputSchema },
    output: { schema: z.string() },
    prompt: `You are an expert stock controller and store detective, helping a picker who can't find an item on the shelf.
Your task is to analyze the provided product data and create a short, actionable summary to help the picker understand the situation and what to do next.

Analyze these key data points:
- **stockQuantity**: The current system stock.
- **deliveryInfo**: When the last/next delivery was/is.
- **lastStockChange**: The last recorded stock movement.
- **location**: Where the product *should* be (standard and promotional).

Synthesize this data into a helpful diagnosis.

**Example Scenarios:**
1.  **Low stock, recent delivery:** If stock is 2, and the last delivery was "yesterday" with 12 units, you might say: "System shows 2 in stock. It was delivered yesterday, so it could be in the warehouse or a misplaced case. Check the promo locations too."
2.  **Zero stock, no delivery:** If stock is 0 and there's no upcoming delivery, you might say: "This item is out of stock with no delivery scheduled. It's a genuine gap."
3.  **High stock, not on shelf:** If stock is 30, but the picker can't see it, you might say: "System shows 30 in stock. Check the main location carefully and also look for it on promotional displays at [promo location]."
4.  **Negative Stock:** If stock is -5, say: "Stock is negative (-5), indicating a system error. It's likely out of stock but the system needs correcting. Advise your manager."

Keep the tone direct and helpful for a store colleague. Focus on what the data implies and suggest the next logical step.

Product Data:
\`\`\`json
{{{json productData}}}
\`\`\`
`,
});

export async function pickerDiagnosisFlow(input: z.infer<typeof PickerDiagnosisInputSchema>): Promise<string> {
  const { output } = await pickerDiagnosisPrompt(input);
  if (!output) {
      throw new Error("Failed to generate diagnosis from the AI model.");
  }
  return JSON.parse(JSON.stringify(output));
}
