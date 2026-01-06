// 'use server';
import type { ProductChatInput, ProductChatOutput } from './product-chat-types';
// import { findAisleForProductTool } from './aisle-finder-flow'; // Disabled

export async function productChatFlow(input: ProductChatInput): Promise<ProductChatOutput> {
  console.log('Mock productChatFlow called');
  await new Promise(resolve => setTimeout(resolve, 800));

  return {
    response: "I'm a mock AI assistant running in a static deployment. I can't process real data right now, but I hope you're having a great day!",
  };
}
