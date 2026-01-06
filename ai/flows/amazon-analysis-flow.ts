// 'use server'; // Disabled for static export
import { z } from 'zod';
import type { FetchMorrisonsDataOutput } from '@/lib/morrisons-api';

const AmazonAnalysisInputSchema = z.object({
  imageDataUri: z.string().optional(),
  skus: z.array(z.string()).optional(),
  locationId: z.string(),
  bearerToken: z.string().optional(),
  debugMode: z.boolean().optional(),
});
export type AmazonAnalysisInput = z.infer<typeof AmazonAnalysisInputSchema>;

const EnrichedAnalysisSchema = z.object({
  product: z.custom<FetchMorrisonsDataOutput[0]>().nullable(),
  error: z.string().nullable(),
  diagnosticSummary: z.string().nullable(),
});
export type EnrichedAnalysis = z.infer<typeof EnrichedAnalysisSchema>;

const AmazonAnalysisOutputSchema = z.array(EnrichedAnalysisSchema);
export type AmazonAnalysisOutput = z.infer<typeof AmazonAnalysisOutputSchema>;


export async function amazonAnalysisFlow(input: AmazonAnalysisInput): Promise<AmazonAnalysisOutput> {
  console.log('amazonAnalysisFlow called (Disabled)');
  // Disabled state
  return [];
}
