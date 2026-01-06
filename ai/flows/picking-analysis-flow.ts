// 'use server';
import { z } from 'zod';

export const ocrPrompt = async (input: { imageDataUri: string }) => {
  console.log('ocrPrompt called (Disabled)');
  return {
    output: {
      skus: []
    }
  };
};

export const pickerDiagnosisPrompt = async (input: { rawData: any }) => {
  console.log('pickerDiagnosisPrompt called (Disabled)');
  return {
    output: {
      diagnosticSummary: ""
    }
  };
};
