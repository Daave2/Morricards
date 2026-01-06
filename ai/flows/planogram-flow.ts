// 'use server';
import { PlanogramInputSchema, PlanogramOutputSchema, type PlanogramInput, type PlanogramOutput } from './planogram-types';

export async function planogramFlow(input: PlanogramInput): Promise<PlanogramOutput> {
    console.log('planogramFlow called (Disabled)');
    return {
        comparisonResults: []
    };
}
