
export interface BudgetCategory {
  id: string;
  name: string;
  icon: string;
}

export interface CostItem {
  category: string;
  amount: number;
  description: string;
  explanation?: string;
  subItems?: { name: string; amount: number }[];
}

export interface BudgetResult {
  city: string;
  currency: string;
  currencySymbol: string;
  totalMonthly: number;
  items: CostItem[];
  sources: { title: string; uri: string; snippet?: string }[];
  summary: string;
  coordinates: {
    lat: number;
    lng: number;
  };
}

export interface CurrencyOption {
  code: string;
  symbol: string;
  label: string;
}

export interface LanguageOption {
  code: string;
  name: string;
  flag: string;
  dir?: 'ltr' | 'rtl';
}

export interface SearchFilters {
  country?: string;
  region?: string;
  population?: string;
}

export const LANGUAGES: LanguageOption[] = [
  { code: 'es', name: 'Español', flag: '🇪🇸' },
  { code: 'en', name: 'English', flag: '🇺🇸' },
  { code: 'fr', name: 'Français', flag: '🇫🇷' },
  { code: 'de', name: 'Deutsch', flag: '🇩🇪' },
  { code: 'zh', name: '中文', flag: '🇨🇳' },
  { code: 'ja', name: '日本語', flag: '🇯🇵' },
  { code: 'pt', name: 'Português', flag: '🇧🇷' },
  { code: 'it', name: 'Italiano', flag: '🇮🇹' },
  { code: 'hi', name: 'हिन्दी', flag: '🇮🇳' },
  { code: 'ar', name: 'العربية', flag: '🇸🇦', dir: 'rtl' }
];

export const CURRENCIES: CurrencyOption[] = [
  { code: 'USD', symbol: '$', label: 'US Dollar' },
  { code: 'EUR', symbol: '€', label: 'Euro' },
  { code: 'GBP', symbol: '£', label: 'British Pound' },
  { code: 'JPY', symbol: '¥', label: 'Japanese Yen' },
  { code: 'AUD', symbol: 'A$', label: 'Australian Dollar' },
  { code: 'CAD', symbol: 'C$', label: 'Canadian Dollar' },
  { code: 'CHF', symbol: 'Fr', label: 'Swiss Franc' },
  { code: 'INR', symbol: '₹', label: 'Indian Rupee' },
  { code: 'CNY', symbol: '¥', label: 'Chinese Yuan' },
  { code: 'BRL', symbol: 'R$', label: 'Brazilian Real' }
];

export const BUDGET_CATEGORIES: BudgetCategory[] = [
  { id: 'housing', name: 'Housing & Rent', icon: '🏠' },
  { id: 'groceries', name: 'Groceries & Food', icon: '🛒' },
  { id: 'transport', name: 'Transportation', icon: '🚗' },
  { id: 'utilities', name: 'Utilities & Bills', icon: '⚡' },
  { id: 'leisure', name: 'Dining & Leisure', icon: '☕' },
  { id: 'health', name: 'Health & Fitness', icon: '💪' },
  { id: 'medical_insurance', name: 'Medical Insurance', icon: '🏥' },
  { id: 'education', name: 'Education', icon: '🎓' },
  { id: 'clothing', name: 'Clothing', icon: '👕' },
  { id: 'personal_care', name: 'Personal Care', icon: '🧴' }
];
