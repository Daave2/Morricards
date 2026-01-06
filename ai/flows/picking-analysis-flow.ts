// 'use server';
import { z } from 'zod';

export const ocrPrompt = async (input: { imageDataUri: string }) => {
  console.log('Mock ocrPrompt called');
  await new Promise(resolve => setTimeout(resolve, 500));
  return {
    output: {
      skus: ['123456']
    }
  };
};

export const pickerDiagnosisPrompt = async (input: { rawData: any }) => {
  console.log('Mock pickerDiagnosisPrompt called');
  await new Promise(resolve => setTimeout(resolve, 500));
  return {
    output: {
      diagnosticSummary: "Stock is clear, delivery due tomorrow."
    }
  };
};
