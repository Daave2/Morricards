// 'use server';
import { z } from 'zod';

// Define the output schema/type expected by the client
export interface ProductInsightsOutput {
  customerFacingSummary: string;
  customerFriendlyLocation: string;
  sellingPoints: string[];
  recipeIdeas: string[];
  allergens: string; // or string[]? client treats as string or check includes
  customerProfile: string;
  placementNotes: string;
  crossSell: string[];
}

export async function productInsightsFlow(input: { productData: any }): Promise<ProductInsightsOutput | null> {
  console.log('productInsightsFlow called (Disabled)');
  // return null to indicate no insights
  return null;
}
