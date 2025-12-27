
import { GoogleGenAI, Type } from "@google/genai";
import { BudgetResult, CURRENCIES, LANGUAGES, SearchFilters } from "../types";
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
  langCode: string = 'es'
): Promise<BudgetResult> => {
  const ai = getAI();
  const currencyInfo = CURRENCIES.find(c => c.code === currencyCode) || CURRENCIES[0];
  const langInfo = LANGUAGES.find(l => l.code === langCode) || LANGUAGES[0];
  
  const corrections = getRelevantCorrections(city, langCode);
  const correctionContext = formatCorrectionsForPrompt(corrections);

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: `Provide a detailed minimum monthly cost of living breakdown for a single person in ${city}.
        Filter and focus on these categories: ${selectedIds.join(', ')}.
        
        CRITICAL: All prices MUST be in ${currencyInfo.label} (${currencyCode}).
        CRITICAL: All text (summary, item names, descriptions, and explanations) MUST be in ${langInfo.name}.
        
        INSTRUCTIONS FOR DESCRIPTIONS:
        - 'description': Must be extremely concise (under 60 characters).
        - 'explanation': Provide local context in ${city}.
        - Ensure all items reflect current 2024/2025 market for ${city}.
        
        ${correctionContext}

        You MUST provide the data in a clear format. 
        Include a JSON block at the end of your response inside \`\`\`json ... \`\`\` tags that follows this structure:
        {
          "city": "${city}",
          "currency": "${currencyCode}",
          "currencySymbol": "${currencyInfo.symbol}",
          "items": [
            {
              "category": "Translated Category", 
              "amount": 1234.56, 
              "description": "Short desc",
              "explanation": "Context",
              "subItems": [{"name": "Subitem", "amount": 100.0}]
            }
          ],
          "totalMonthly": 0,
          "summary": "2-sentence summary in ${langInfo.name}.",
          "coordinates": { "lat": 0, "lng": 0 },
          "source_snippets": { "Source": "Snippet" }
        }
        
        IMPORTANT: Correct lat/lng for ${city}.
        Use Google Search for verification.`,
      config: {
        tools: [{ googleSearch: {} }],
      },
    });

    const text = response.text || "";
    const chunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks || [];
    
    let parsedJson: any = null;
    try {
      const jsonMatch = text.match(/```json\s*([\s\S]*?)\s*```/);
      if (jsonMatch && jsonMatch[1]) {
        parsedJson = JSON.parse(jsonMatch[1]);
      }
    } catch (e) {
      throw new ServiceError("Failed to parse AI response data", "parsing", e);
    }

    const sources = chunks.map((chunk: any) => ({
      title: chunk.web?.title || "Source",
      uri: chunk.web?.uri || "#",
      snippet: parsedJson?.source_snippets?.[chunk.web?.title] || "Verified market data."
    }));

    if (parsedJson) {
      return {
        ...parsedJson,
        sources,
        currency: currencyCode,
        currencySymbol: currencyInfo.symbol
      };
    }

    throw new ServiceError("No valid data received from model", "empty");
  } catch (e: any) {
    const errorMsg = e.message || "";
    if (errorMsg.includes("429") || errorMsg.toLowerCase().includes("quota")) {
      throw new ServiceError("Quota exceeded", "quota", e);
    }
    if (errorMsg.toLowerCase().includes("safety")) {
      throw new ServiceError("Safety filter blocked request", "safety", e);
    }
    if (errorMsg.includes("Requested entity was not found")) {
      throw new ServiceError("Entity not found", "not_found", e);
    }
    if (!navigator.onLine) {
      throw new ServiceError("No internet connection", "network", e);
    }
    throw new ServiceError(e.message || "Unknown API error", "generic", e);
  }
};
