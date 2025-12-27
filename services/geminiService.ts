
import { GoogleGenAI, Type } from "@google/genai";
import { BudgetResult, CURRENCIES, LANGUAGES, SearchFilters, HousingType } from "../types";
import { getRelevantCorrections, formatCorrectionsForPrompt } from "./correctionService";

// Helper to get a fresh AI instance using current env key
const getAI = () => new GoogleGenAI({ apiKey: process.env.API_KEY });

export class ServiceError extends Error {
  constructor(public message: string, public type: string, public rawError?: any) {
    super(message);
    this.name = 'ServiceError';
  }
}

export const fetchCitySuggestions = async (
  input: string, 
  location?: { lat: number, lng: number },
  filters?: SearchFilters,
  langCode: string = 'es'
): Promise<string[]> => {
  if (!input && !filters?.country && !filters?.region) return [];

  const ai = getAI();
  const lang = LANGUAGES.find(l => l.code === langCode) || LANGUAGES[0];
  const filterStrings = [];
  if (filters?.country) filterStrings.push(`in the country of ${filters.country}`);
  if (filters?.region) filterStrings.push(`in the region/state of ${filters.region}`);
  if (filters?.population) filterStrings.push(`with a population size of ${filters.population}`);

  const filterContext = filterStrings.length > 0 ? `Filtering criteria: ${filterStrings.join(", ")}.` : "";
  const locationContext = location ? `Prioritize cities near latitude ${location.lat}, longitude ${location.lng}.` : "";

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: `Suggest 5 real city names that match or are highly relevant to the input "${input}". 
      ${filterContext}
      ${locationContext}
      Always return the city name clearly (e.g., "Tokyo, Japan" or "Seattle, WA, USA").
      The response must be in ${lang.name}.
      Return only a JSON array of strings.`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: { type: Type.STRING }
        }
      }
    });

    const suggestions = JSON.parse(response.text || "[]");
    return Array.isArray(suggestions) ? suggestions : [];
  } catch (e: any) {
    console.error("Autocomplete error:", e);
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
  
  const corrections = getRelevantCorrections(city, langCode);
  const correctionContext = formatCorrectionsForPrompt(corrections);

  const housingContext = housingType === 'shared' 
    ? "Calculate for a SHARED APARTMENT / ROOM RENTAL (cheapest possible safe option for one person)."
    : "Calculate for a WHOLE HOUSE RENTAL (cheapest small house/townhouse available in safe outer suburbs).";

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: `Provide a detailed ABSOLUTE MINIMUM monthly cost of living breakdown for a single person in ${city}.
        Focus Categories: ${selectedIds.join(', ')}.
        Housing Mode: ${housingContext}

        CRITICAL SURVIVAL BENCHMARKING RULES:
        1. NO AVERAGES. Find real, current bottom-market prices for the most frugal lifestyle.
        2. FOOD: Price for budget grocery stores (e.g., Lidl, Aldi, Mercadona, etc.) and specific local open-air markets.
        3. TRANSPORT: Price of the cheapest unlimited monthly public transit pass.
        4. CURRENCY: All figures in ${currencyInfo.label} (${currencyCode}).
        5. LANGUAGE: All text descriptions and explanations in ${langInfo.name}.
        
        HYPER-LOCAL SAVING HACKS:
        Provide 4 city-specific tips. Include REAL local names (e.g., 'Shop at Central Market on Tuesdays' or 'Use the 99-cent express bus').
        
        ${correctionContext}

        OUTPUT JSON FORMAT:
        {
          "city": "${city}",
          "currency": "${currencyCode}",
          "currencySymbol": "${currencyInfo.symbol}",
          "items": [
            {
              "category": "Translated Category", 
              "amount": 1234.56, 
              "description": "Specific frugal item/service",
              "explanation": "Why this is the absolute minimum (e.g. 'Price for a 10sqm room in zone 3')",
              "subItems": []
            }
          ],
          "totalMonthly": 0,
          "summary": "Short 2-sentence summary of affordability.",
          "savingTips": [
            { "category": "Food/Transport/Etc", "tip": "The tip", "icon": "emoji" }
          ],
          "coordinates": { "lat": 0, "lng": 0 },
          "source_snippets": { "SourceTitle": "Data snippet" }
        }`,
      config: {
        tools: [{ googleSearch: {} }],
      },
    });

    const text = response.text || "";
    
    let parsedJson: any = null;
    try {
      const jsonMatch = text.match(/```json\s*([\s\S]*?)\s*```/);
      if (jsonMatch && jsonMatch[1]) {
        parsedJson = JSON.parse(jsonMatch[1]);
      } else {
        // Attempt a direct parse if block tags are missing
        parsedJson = JSON.parse(text);
      }
    } catch (e) {
      console.error("AI response text:", text);
      throw new ServiceError("Failed to parse AI response data", "parsing", e);
    }

    const chunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks || [];
    const sources = chunks.map((chunk: any) => ({
      title: chunk.web?.title || "Market Data",
      uri: chunk.web?.uri || "#",
      snippet: parsedJson?.source_snippets?.[chunk.web?.title] || "Verified real-time market quote."
    }));

    if (parsedJson) {
      return {
        ...parsedJson,
        sources: sources.slice(0, 5), // Keep top 5 sources
        currency: currencyCode,
        currencySymbol: currencyInfo.symbol
      };
    }

    throw new ServiceError("Empty response from AI", "empty");
  } catch (e: any) {
    const errorMsg = e.message || "";
    if (errorMsg.includes("429") || errorMsg.toLowerCase().includes("quota")) {
      throw new ServiceError("Quota exceeded", "quota", e);
    }
    if (errorMsg.toLowerCase().includes("safety")) {
      throw new ServiceError("Safety filter blocked request", "safety", e);
    }
    if (!navigator.onLine) {
      throw new ServiceError("No internet connection", "network", e);
    }
    throw new ServiceError(e.message || "Unknown API error", "generic", e);
  }
};
