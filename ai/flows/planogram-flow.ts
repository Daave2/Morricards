// 'use server';
import { PlanogramInputSchema, PlanogramOutputSchema, type PlanogramInput, type PlanogramOutput } from './planogram-types';

export async function planogramFlow(input: PlanogramInput): Promise<PlanogramOutput> {
    console.log('Mock planogramFlow called');
    await new Promise(resolve => setTimeout(resolve, 2000));

    return {
        comparisonResults: [
            {
                status: 'Correct',
                productName: 'Mock Correct Item',
                sku: '111111',
                ean: '111111',
                expectedShelf: 1,
                expectedPosition: 1,
                actualShelf: 1,
                actualPosition: 1,
            },
            {
                status: 'Missing',
                productName: 'Mock Missing Item',
                sku: '222222',
                ean: '222222',
                expectedShelf: 1,
                expectedPosition: 2,
                actualShelf: null,
                actualPosition: null,
            }
        ]
    };
}
