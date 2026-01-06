// 'use server'; (Disabled for static export)
import type { FetchMorrisonsDataOutput } from '@/lib/morrisons-api';

export type ActionResponse = {
  data?: FetchMorrisonsDataOutput;
  error?: string;
  debugLog?: any[];
};

export async function getProductData(values: any): Promise<ActionResponse> {
  console.log('getProductData called (Disabled)');
  return {
    data: [],
    error: "Product search is unavailable in this static demo.",
  };
}
