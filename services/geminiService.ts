
import { GoogleGenAI, Type } from "@google/genai";
import { BudgetResult, CURRENCIES, LANGUAGES, SearchFilters, HousingType } from "../types";

// Always initialize a new GoogleGenAI instance right before the call
const getAI = () => {
  // El "as any" le dice a TypeScript que no se queje por el .env
  const apiKey = (import.meta as any).env.VITE_GEMINI_API_KEY;
  return new GoogleGenAI({ apiKey });
};

export class ServiceError extends Error {
  constructor(public message: string, public type: string, public rawError?: any) {
    super(message);
    this.name = 'ServiceError';
  }
}

export const fetchCitySuggestions = async (
  input: string, 
  filters?: SearchFilters,
  langCode: string = 'es'
): Promise<string[]> => {
  if (!input && !filters?.country && !filters?.region) return [];

  const ai = getAI();
  const lang = LANGUAGES.find(l => l.code === langCode) || LANGUAGES[0];
  
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: `Suggest 5 real city names matching "${input}". Filters: Country=${filters?.country}, Region=${filters?.region}, Size=${filters?.population}. Return a JSON array of strings in ${lang.name}.`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: { type: Type.STRING }
        }
      }
    });
    return JSON.parse(response.text || "[]");
  } catch (e) {
    console.error(e);
    if (e instanceof Error && e.message.includes("API Key")) throw e;
    return [];
  }
};

export const fetchCityBudgetData = async (
  city: string, 
  selectedIds: string[], 
  currencyCode: string,
  langCode: string = 'es',
  housingType: HousingType = 'shared'
): Promise<BudgetResult> => {
  const ai = getAI();
  const currencyInfo = CURRENCIES.find(c => c.code === currencyCode) || CURRENCIES[0];
  const langInfo = LANGUAGES.find(l => l.code === langCode) || LANGUAGES[0];

  const categoriesPrompt = selectedIds.join(', ');
  const mode = housingType === 'shared' ? 'Room in shared flat (frugal)' : 'Small house/apartment (standard)';

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: `Provide the ABSOLUTE MINIMUM monthly cost of living in ${city} for a single person.
        Categories to include: ${categoriesPrompt}.
        Housing mode: ${mode}.
        
        Rules:
        1. All amounts in ${currencyInfo.label} (${currencyCode}).
        2. Descriptions and tips in ${langInfo.name}.
        3. Use real-time data for the cheapest options (e.g., student housing, local markets).
        4. Total Monthly MUST be the sum of included items.
        5. Include 3-4 "savingTips" that are hyper-local hacks for this specific city.

        Format: JSON
        {
          "city": "${city}",
          "currencySymbol": "${currencyInfo.symbol}",
          "totalMonthly": number,
          "summary": "String",
          "items": [{"category": "String", "amount": number, "description": "String", "explanation": "String"}],
          "savingTips": [{"category": "String", "tip": "String", "icon": "Emoji"}],
          "coordinates": {"lat": number, "lng": number}
        }`,
      config: {
        tools: [{ googleSearch: {} }],
      },
    });

    const text = response.text || "";
    let cleanJson = text;
    
    if (text.includes('```json')) {
      cleanJson = text.split('```json')[1].split('```')[0].trim();
    } else if (text.includes('{')) {
      const start = text.indexOf('{');
      const end = text.lastIndexOf('}');
      if (start !== -1 && end !== -1) {
        cleanJson = text.substring(start, end + 1);
      }
    }
    
    const parsed = JSON.parse(cleanJson);
    const chunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks || [];
    const sources = chunks.map((c: any) => ({
      title: c.web?.title || "Market Data",
      uri: c.web?.uri || "#"
    }));

    return {
      ...parsed,
      sources: sources.slice(0, 5),
      currency: currencyCode,
      currencySymbol: currencyInfo.symbol,
      savingTips: parsed.savingTips || []
    };
  } catch (e: any) {
    throw new ServiceError(e.message, 'api', e);
  }
};
