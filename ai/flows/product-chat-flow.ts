// 'use server';
import { z } from 'zod';

export async function productChatFlow(input: any) {
  console.log('productChatFlow called (Disabled)');
  // Simulate unavailability
  return {
    response: "Chat features are disabled in this static demo.",
  };
}
