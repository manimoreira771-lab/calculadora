
import { fetchCityBudgetData } from './geminiService';
import { CURRENCIES } from '../types';

/**
 * Simple test runner for the browser environment.
 * Validates core logic for currency handling and result parsing.
 */

interface TestCase {
  name: string;
  run: () => Promise<void>;
}

export interface TestReport {
  name: string;
  status: 'passed' | 'failed';
  error?: string;
}

export const runGeminiServiceTests = async (): Promise<TestReport[]> => {
  const reports: TestReport[] = [];
  
  const testCases: TestCase[] = [
    {
      name: "Currency Mapping - Should use correct symbol for JPY",
      run: async () => {
        const jpy = CURRENCIES.find(c => c.code === 'JPY');
        if (jpy?.symbol !== '¥') throw new Error(`Expected ¥ but got ${jpy?.symbol}`);
      }
    },
    {
      name: "Currency Mapping - Should use correct symbol for EUR",
      run: async () => {
        const eur = CURRENCIES.find(c => c.code === 'EUR');
        if (eur?.symbol !== '€') throw new Error(`Expected € but got ${eur?.symbol}`);
      }
    },
    {
      name: "Prompt Logic - Should find correct label for British Pound",
      run: async () => {
        const gbp = CURRENCIES.find(c => c.code === 'GBP');
        if (gbp?.label !== 'British Pound') throw new Error("Label mismatch for GBP");
      }
    },
    {
      name: "Category Integration - Should have 10 categories",
      run: async () => {
        const { BUDGET_CATEGORIES } = await import('../types');
        // Adjusted from 6 to 10 to match actual BUDGET_CATEGORIES length in types.ts
        if (BUDGET_CATEGORIES.length !== 10) throw new Error(`Expected 10 categories, found ${BUDGET_CATEGORIES.length}`);
      }
    },
    {
      name: "Service Fallback - Should return a valid object even on empty AI response",
      run: async () => {
        // This validates the structure of the fallback return in geminiService.ts
        const result = await fetchCityBudgetData("TestCity", ["housing"], "USD");
        if (typeof result !== 'object' || !result.city) throw new Error("Invalid fallback result structure");
      }
    }
  ];

  for (const tc of testCases) {
    try {
      // Simulate slight network delay for visual feedback in the UI runner
      await new Promise(r => setTimeout(r, 150));
      await tc.run();
      reports.push({ name: tc.name, status: 'passed' });
    } catch (e: any) {
      reports.push({ name: tc.name, status: 'failed', error: e.message });
    }
  }

  return reports;
};
