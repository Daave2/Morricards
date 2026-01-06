// 'use server';
import { z } from 'zod';

export async function ocrFlow(input: { imageDataUri: string }) {
  console.log('ocrFlow called (Disabled)');
  return { eanOrSku: null };
}
