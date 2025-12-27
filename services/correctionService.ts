
export interface UserCorrection {
  city?: string;
  category: string;
  lang: string;
  reason: string;
  comment: string;
  suggestedTranslation?: string;
  timestamp: number;
}

const STORAGE_KEY = 'urbancost_user_corrections';

export const saveCorrection = (correction: UserCorrection) => {
  const existing = getCorrections();
  existing.push(correction);
  // Keep only the last 50 corrections to avoid localStorage bloat
  const limited = existing.slice(-50);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(limited));
};

export const getCorrections = (): UserCorrection[] => {
  try {
    const data = localStorage.getItem(STORAGE_KEY);
    return data ? JSON.parse(data) : [];
  } catch (e) {
    console.error("Failed to parse corrections", e);
    return [];
  }
};

export const getRelevantCorrections = (city: string, lang: string): UserCorrection[] => {
  const all = getCorrections();
  return all.filter(c => 
    (c.city?.toLowerCase() === city.toLowerCase() || !c.city) && 
    c.lang === lang
  );
};

export const formatCorrectionsForPrompt = (corrections: UserCorrection[]): string => {
  if (corrections.length === 0) return "";
  
  return `\n\nUSER FEEDBACK CONTEXT (Please refine your response based on these past user reports):
${corrections.map(c => `- For ${c.city || 'all cities'} in category "${c.category}": User reported "${c.reason}" ${c.suggestedTranslation ? `(Suggested translation: "${c.suggestedTranslation}")` : ''} ${c.comment ? `with comment: "${c.comment}"` : ''}`).join('\n')}
Please prioritize accuracy regarding these specific points in your new generated content.`;
};
