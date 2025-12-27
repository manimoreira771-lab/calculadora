
import React, { useState, useEffect, useRef } from 'react';
import { fetchCityBudgetData, fetchCitySuggestions, ServiceError } from './services/geminiService';
import { BudgetResult, BUDGET_CATEGORIES, CURRENCIES, LANGUAGES, SearchFilters, HousingType } from './types';
import CategoryFilter from './components/CategoryFilter';
import BudgetChart from './components/BudgetChart';
import CityMap from './components/CityMap';
import TestPanel from './components/TestPanel';
import { t } from './services/i18n';

// Component for showing loading placeholders
const SkeletonRow = () => (
  <div className="py-6 flex flex-col sm:flex-row sm:items-start justify-between gap-4 px-4 -mx-4">
    <div className="flex-1 space-y-3">
      <div className="h-4 w-24 bg-slate-200 rounded-lg animate-pulse"></div>
      <div className="h-3 w-full bg-slate-100 rounded-lg animate-pulse"></div>
      <div className="h-3 w-3/4 bg-slate-100 rounded-lg animate-pulse"></div>
    </div>
    <div className="flex flex-col items-start sm:items-end shrink-0 gap-2">
      <div className="h-8 w-32 bg-slate-200 rounded-xl animate-pulse"></div>
      <div className="h-3 w-20 bg-slate-100 rounded-lg animate-pulse"></div>
    </div>
  </div>
);

// Component to display API errors and provide retry/key-selection options
const ErrorDisplay: React.FC<{ error: ServiceError | null, lang: string, onRetry: () => void }> = ({ error, lang, onRetry }) => {
  if (!error) return null;

  const handleSelectKey = async () => {
    const aiStudio = (window as any).aistudio;
    if (aiStudio) {
      await aiStudio.openSelectKey();
      onRetry();
    }
  };

  let title = t('error_generic', lang);
  let fix = t('fix_guide_network', lang);
  let showKeyBtn = false;

  switch (error.type) {
    case 'quota':
      title = t('error_quota', lang);
      fix = t('fix_guide_quota', lang);
      break;
    case 'safety':
      title = t('error_safety', lang);
      fix = t('fix_guide_safety', lang);
      break;
    case 'network':
      title = t('error_network', lang);
      fix = t('fix_guide_network', lang);
      break;
    case 'not_found':
      title = t('error_not_found', lang);
      showKeyBtn = true;
      break;
  }

  return (
    <div className="bg-white border-l-4 border-rose-500 p-8 rounded-3xl shadow-xl mb-8 animate-in fade-in zoom-in-95 no-print">
      <div className="flex flex-col md:flex-row gap-6 items-start">
        <div className="bg-rose-50 p-4 rounded-2xl">
          <svg className="w-8 h-8 text-rose-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
        </div>
        <div className="flex-1 space-y-4">
          <h3 className="text-xl font-bold text-slate-900">{title}</h3>
          <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">{t('fix_guide_title', lang)}</p>
            <p className="text-sm text-slate-600 font-medium">{fix}</p>
          </div>
          <div className="flex flex-wrap gap-3">
            <button 
              onClick={onRetry}
              className="bg-slate-900 text-white px-6 py-2.5 rounded-xl text-sm font-bold shadow-md hover:bg-slate-800 transition-all active:scale-95 flex items-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              {t('retry_btn', lang)}
            </button>
            {showKeyBtn && (
              <button 
                onClick={handleSelectKey}
                className="bg-amber-100 text-amber-800 px-6 py-2.5 rounded-xl text-sm font-bold shadow-sm hover:bg-amber-200 transition-all active:scale-95 flex items-center gap-2"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
                </svg>
                {t('select_key_btn', lang)}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

const App: React.FC = () => {
  const [lang, setLang] = useState(() => localStorage.getItem('urbancost_lang') || 'es');
  const [city, setCity] = useState('');
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [isSuggestionsLoading, setIsSuggestionsLoading] = useState(false);
  const [userLocation, setUserLocation] = useState<{lat: number, lng: number} | undefined>();
  const [userLogo, setUserLogo] = useState<string | null>(() => localStorage.getItem('urbancost_logo'));
  
  const [filters] = useState<SearchFilters>({ country: '', region: '', population: '' });
  const [currencyCode, setCurrencyCode] = useState('USD');
  const [selectedIds, setSelectedIds] = useState<string[]>(['housing', 'groceries', 'transport', 'utilities', 'leisure', 'health', 'medical_insurance', 'education', 'clothing', 'personal_care']);
  const [housingType, setHousingType] = useState<HousingType>('shared');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<BudgetResult | null>(null);
  const [error, setError] = useState<ServiceError | null>(null);
  const [showSuccessToast, setShowSuccessToast] = useState(false);
  
  const [showLangMenu, setShowLangMenu] = useState(false);
  const [showShareMenu, setShowShareMenu] = useState(false);
  const [showCopiedTooltip, setShowCopiedTooltip] = useState(false);
  const [favorites, setFavorites] = useState<string[]>([]);
  const [showFavorites, setShowFavorites] = useState(false);
  
  const suggestionsRef = useRef<HTMLDivElement>(null);
  const favoritesRef = useRef<HTMLDivElement>(null);
  const langMenuRef = useRef<HTMLDivElement>(null);
  const shareMenuRef = useRef<HTMLDivElement>(null);

  // Initialize from URL params
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const cityParam = params.get('city');
    if (cityParam) { handleSearch(cityParam); }
  }, []);

  // Persist favorites to local storage
  useEffect(() => {
    const saved = localStorage.getItem('urbancost_favorites');
    if (saved) { try { setFavorites(JSON.parse(saved)); } catch (e) {} }
  }, []);

  useEffect(() => { localStorage.setItem('urbancost_favorites', JSON.stringify(favorites)); }, [favorites]);
  useEffect(() => { localStorage.setItem('urbancost_lang', lang); }, [lang]);

  // Try to get user location for better suggestions
  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => setUserLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
        () => console.log("Geolocation access denied")
      );
    }
  }, []);

  // Update results when global filters change
  useEffect(() => {
    if (result && result.city && !loading) {
      handleSearch(result.city);
    }
  }, [lang, currencyCode, housingType]);

  // Click outside handling for menus
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (suggestionsRef.current && !suggestionsRef.current.contains(event.target as Node)) setShowSuggestions(false);
      if (favoritesRef.current && !favoritesRef.current.contains(event.target as Node)) setShowFavorites(false);
      if (langMenuRef.current && !langMenuRef.current.contains(event.target as Node)) setShowLangMenu(false);
      if (shareMenuRef.current && !shareMenuRef.current.contains(event.target as Node)) setShowShareMenu(false);
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Autocomplete logic
  useEffect(() => {
    if (city.length < 1 && !filters.country && !filters.region) {
      setSuggestions([]);
      return;
    }
    
    setIsSuggestionsLoading(true);
    const timer = setTimeout(async () => {
      try {
        const results = await fetchCitySuggestions(city, userLocation, filters, lang);
        setSuggestions(results);
        setShowSuggestions(results.length > 0);
      } catch (e) {
        console.error("Autocomplete fetch error", e);
      } finally {
        setIsSuggestionsLoading(false);
      }
    }, 250); 
    return () => clearTimeout(timer);
  }, [city, userLocation, filters, lang]);

  // Main search/calculate trigger
  const handleSearch = async (targetCity?: string, e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const finalCity = targetCity || city;
    if (!finalCity.trim()) return;

    setCity(finalCity);
    setShowSuggestions(false);
    setShowFavorites(false);
    setShowLangMenu(false);
    setShowShareMenu(false);
    setShowSuccessToast(false);
    
    try {
      const newUrl = new URL(window.location.href);
      newUrl.searchParams.set('city', finalCity);
      window.history.pushState({}, '', newUrl.toString());
    } catch (e) {
      console.warn("History pushState restricted in this environment:", e);
    }

    setLoading(true);
    setError(null);
    try {
      const data = await fetchCityBudgetData(finalCity, selectedIds, currencyCode, lang, housingType);
      setResult(data);
      setShowSuccessToast(true);
      setTimeout(() => setShowSuccessToast(false), 3000);
    } catch (err: any) {
      if (err instanceof ServiceError) {
        setError(err);
      } else {
        setError(new ServiceError(err.message || 'Unknown error', 'generic', err));
      }
    } finally {
      setLoading(false);
    }
  };

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        const base = reader.result as string;
        setUserLogo(base);
        localStorage.setItem('urbancost_logo', base);
      };
      reader.readAsDataURL(file);
    }
  };

  const removeLogo = (e: React.MouseEvent) => {
    e.preventDefault(); e.stopPropagation();
    setUserLogo(null);
    localStorage.removeItem('urbancost_logo');
  };

  const onSelectSuggestion = (suggestion: string) => {
    setCity(suggestion);
    setShowSuggestions(false);
    handleSearch(suggestion);
  };

  const toggleFavorite = (cityName: string) => {
    setFavorites(prev => prev.includes(cityName) ? prev.filter(c => c !== cityName) : [cityName, ...prev]);
  };

  const getShareText = () => {
    if (!result) return "";
    return t('share_text', lang)
      .replace('{city}', result.city)
      .replace('{total}', `${result.currencySymbol}${result.totalMonthly.toLocaleString()}`)
      .replace('{currency}', result.currency);
  };

  const copyLinkToClipboard = () => {
    const url = window.location.href;
    navigator.clipboard.writeText(url).then(() => {
      setShowCopiedTooltip(true);
      setTimeout(() => setShowCopiedTooltip(false), 2000);
    });
    setShowShareMenu(false);
  };

  const shareTwitter = () => {
    const text = encodeURIComponent(getShareText());
    const url = encodeURIComponent(window.location.href);
    window.open(`https://twitter.com/intent/tweet?text=${text}&url=${url}`, '_blank');
    setShowShareMenu(false);
  };

  const shareLinkedIn = () => {
    const url = encodeURIComponent(window.location.href);
    window.open(`https://www.linkedin.com/sharing/share-offsite/?url=${url}`, '_blank');
    setShowShareMenu(false);
  };

  const isFavorite = result ? favorites.includes(result.city) : false;
  const currentLang = LANGUAGES.find(l => l.code === lang) || LANGUAGES[0];

  return (
    <div className={`min-h-screen bg-slate-50 relative selection:bg-amber-100 selection:text-amber-900 ${currentLang.dir === 'rtl' ? 'rtl' : 'ltr'}`}>
      <header className="bg-white border-b border-slate-200 sticky top-0 z-30 shadow-sm no-print">
        <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between gap-1 sm:gap-4">
          <div className="flex items-center shrink-0">
            <label className="cursor-pointer group relative flex items-center gap-2">
              <input type="file" className="hidden" accept="image/*" onChange={handleLogoUpload} />
              {userLogo ? (
                <div className="relative group/logo">
                  <img src={userLogo} alt="Logo" className="h-7 sm:h-10 w-auto max-w-[60px] sm:max-w-[120px] object-contain transition-transform group-hover:scale-105" />
                  <button onClick={removeLogo} className="absolute -top-2 -right-2 bg-slate-800 text-white p-1 rounded-full opacity-0 group-hover/logo:opacity-100 transition-opacity">
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" /></svg>
                  </button>
                </div>
              ) : (
                <div className="flex flex-col -space-y-1 group transition-all cursor-pointer" onClick={() => {
                  setResult(null); 
                  setCity(''); 
                  window.history.pushState({}, '', window.location.pathname);
                }}>
                  <h1 className="text-lg sm:text-3xl font-black text-blue-900 tracking-tighter uppercase leading-none group-hover:text-amber-600 transition-colors">Volare</h1>
                </div>
              )}
            </label>
          </div>
          
          <div className="flex-1 max-w-none md:max-w-xl relative mx-1 sm:mx-4" ref={suggestionsRef}>
            <div className="flex items-center gap-2">
              <form onSubmit={(e) => handleSearch(undefined, e)} className="flex-1 relative group">
                <input
                  type="text" value={city} 
                  onFocus={() => setShowSuggestions(suggestions.length > 0)}
                  onChange={(e) => setCity(e.target.value)} placeholder={t('search_placeholder', lang)}
                  className="w-full pl-8 sm:pl-10 pr-3 sm:pr-4 py-2 sm:py-2.5 bg-slate-100 border-2 border-transparent rounded-full text-xs sm:text-sm font-medium focus:bg-white focus:border-amber-400 focus:ring-4 focus:ring-amber-50 transition-all outline-none placeholder:text-slate-400 shadow-inner group-focus-within:shadow-none"
                />
                <div className={`absolute ${currentLang.dir === 'rtl' ? 'right-2.5 sm:right-3' : 'left-2.5 sm:left-3'} top-1/2 -translate-y-1/2 flex items-center justify-center pointer-events-none`}>
                  {isSuggestionsLoading ? (
                    <svg className="animate-spin h-3.5 w-3.5 sm:h-4 sm:w-4 text-amber-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                  ) : (
                    <svg className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-slate-400 group-focus-within:text-amber-500 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                  )}
                </div>
              </form>
            </div>

            {showSuggestions && suggestions.length > 0 && (
              <div className="absolute top-full left-0 right-0 mt-2 bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden z-40 animate-in fade-in slide-in-from-top-2 duration-200">
                <div className="p-1.5 sm:p-2">
                  <p className="px-3 py-1.5 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">{t('suggestions', lang)}</p>
                  <div className="max-h-[60vh] overflow-y-auto overflow-x-hidden">
                    {suggestions.map((s, idx) => (
                      <button key={idx} onClick={() => onSelectSuggestion(s)} className="w-full text-left px-3 sm:px-4 py-2.5 sm:py-3 hover:bg-amber-50 rounded-xl flex items-center gap-3 transition-all group active:scale-[0.98]">
                        <div className="w-6 h-6 rounded-lg bg-slate-100 flex items-center justify-center text-slate-400 group-hover:bg-amber-100 group-hover:text-amber-600 transition-colors">
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"/><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"/></svg>
                        </div>
                        <span className="text-xs sm:text-sm font-bold text-slate-700 group-hover:text-amber-900 line-clamp-1">{s}</span>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="flex items-center gap-0.5 sm:gap-2 shrink-0">
            <div className="relative" ref={langMenuRef}>
              <button onClick={() => setShowLangMenu(!showLangMenu)} className="bg-slate-100 hover:bg-slate-200 border-none rounded-xl text-xs font-bold p-1.5 sm:px-3 sm:py-2.5 transition-all flex items-center gap-1.5 shadow-sm active:scale-95">
                <span className="text-base leading-none">{currentLang.flag}</span>
                <span className="text-slate-700 hidden lg:inline">{currentLang.name}</span>
              </button>
              {showLangMenu && (
                <div className="absolute top-full right-0 mt-3 w-48 bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden z-50 animate-in fade-in slide-in-from-top-2">
                  <div className="p-1.5 grid grid-cols-1 gap-0.5">
                    {LANGUAGES.map((l) => (
                      <button key={l.code} onClick={() => { setLang(l.code); setShowLangMenu(false); }} className={`flex items-center gap-3 w-full text-left px-3 py-2.5 rounded-xl text-xs font-bold transition-all ${lang === l.code ? 'bg-amber-50 text-amber-700' : 'text-slate-600 hover:bg-slate-50'}`}>
                        <span className="text-lg">{l.flag}</span><span>{l.name}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="relative hidden sm:block" ref={favoritesRef}>
              <button onClick={() => setShowFavorites(!showFavorites)} className={`p-2 rounded-xl transition-all active:scale-95 ${favorites.length > 0 ? 'text-rose-500 hover:bg-rose-50' : 'text-slate-400 hover:bg-slate-100'}`}>
                <svg className={`w-5 h-5 ${favorites.length > 0 ? 'fill-current' : 'fill-none'}`} stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" /></svg>
              </button>
              {showFavorites && (
                <div className="absolute top-full right-0 mt-3 w-72 bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden z-30 animate-in fade-in slide-in-from-top-2">
                  <div className="p-4 border-b border-slate-100 flex justify-between bg-slate-50/50 items-center"><h3 className="text-xs font-black uppercase tracking-widest text-slate-500">{t('saved_cities', lang)}</h3></div>
                  <div className="max-h-72 overflow-y-auto p-1.5">
                    {favorites.length === 0 ? <div className="py-10 text-center"><p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{t('no_saved', lang)}</p></div> : favorites.map((fav, idx) => (
                      <button key={idx} onClick={() => handleSearch(fav)} className="w-full text-left px-3 py-3 hover:bg-amber-50 rounded-xl text-xs font-bold transition-colors line-clamp-1">{fav}</button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <select value={currencyCode} onChange={(e) => setCurrencyCode(e.target.value)} className="bg-slate-100 hover:bg-slate-200 border-none rounded-xl text-[10px] font-black px-2 py-2 sm:px-3 sm:py-2.5 outline-none cursor-pointer hidden md:block transition-all shadow-sm">
              {CURRENCIES.map(curr => <option key={curr.code} value={curr.code}>{curr.symbol} {curr.code}</option>)}
            </select>
            
            <button onClick={() => handleSearch()} disabled={loading || !city} className="bg-amber-600 hover:bg-amber-700 text-white px-3 py-2 sm:px-6 sm:py-2.5 rounded-xl sm:rounded-full text-xs sm:text-sm font-black shadow-md transition-all active:scale-95 disabled:opacity-50 flex items-center gap-2">
              {loading ? (
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
              ) : (
                <>
                  <span className="hidden sm:inline uppercase tracking-widest">{t('go', lang)}</span>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M14 5l7 7m0 0l-7 7m7-7H3" /></svg>
                </>
              )}
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-8">
        <div className="mb-8 no-print category-filter-section space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
            <div className="flex-1">
              <h2 className="text-xl sm:text-2xl font-black text-slate-800 mb-2 tracking-tight">{t('configure_title', lang)}</h2>
              <p className="text-sm text-slate-500 font-medium">{t('configure_desc', lang)}</p>
            </div>
            
            <div className="flex flex-col gap-2">
              <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">{t('housing_type', lang)}</span>
              <div className="flex bg-slate-100 p-1 rounded-xl w-fit border border-slate-200">
                <button 
                  onClick={() => setHousingType('house')}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all ${housingType === 'house' ? 'bg-white text-amber-600 shadow-sm border border-amber-100' : 'text-slate-500 hover:text-slate-700'}`}
                >
                  <span>🏠</span>
                  {t('house', lang)}
                </button>
                <button 
                  onClick={() => setHousingType('shared')}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all ${housingType === 'shared' ? 'bg-white text-amber-600 shadow-sm border border-amber-100' : 'text-slate-500 hover:text-slate-700'}`}
                >
                  <span>🏢</span>
                  {t('shared_apartment', lang)}
                </button>
              </div>
            </div>
          </div>
          
          <CategoryFilter selectedIds={selectedIds} onChange={setSelectedIds} lang={lang} />
        </div>

        {loading && (
          <div className="space-y-4 animate-in fade-in duration-300">
            <div className="flex items-center gap-3 mb-8">
              <div className="w-5 h-5 border-2 border-amber-500 border-t-transparent rounded-full animate-spin"></div>
              <p className="text-sm font-bold text-slate-600">{t('fetching_data', lang)}</p>
            </div>
            {[1, 2, 3, 4].map(i => <SkeletonRow key={i} />)}
          </div>
        )}

        {error && <ErrorDisplay error={error} lang={lang} onRetry={() => handleSearch()} />}

        {!loading && !error && !result && (
          <div className="py-20 text-center space-y-6 animate-in fade-in slide-in-from-bottom-8">
            <div className="w-24 h-24 bg-amber-100 text-amber-600 rounded-full flex items-center justify-center mx-auto text-4xl shadow-inner border-8 border-amber-50">🌍</div>
            <div className="max-w-md mx-auto">
              <h2 className="text-3xl font-black text-slate-900 mb-2 tracking-tighter">{t('ready_explore', lang)}</h2>
              <p className="text-slate-500 font-medium">{t('ready_explore_desc', lang)}</p>
            </div>
          </div>
        )}

        {result && !loading && (
          <div className="space-y-8 animate-in fade-in duration-500">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
              <div className="lg:col-span-2 space-y-8">
                <div className="bg-white rounded-3xl p-6 sm:p-8 shadow-xl border border-slate-100 relative group overflow-visible">
                  {/* Share and Favorite Buttons */}
                  <div className="absolute top-6 sm:top-8 right-6 sm:right-8 flex items-center gap-2 no-print">
                    <div className="relative" ref={shareMenuRef}>
                      <button 
                        onClick={() => setShowShareMenu(!showShareMenu)}
                        className="p-3 bg-slate-50 text-slate-500 hover:text-amber-600 hover:bg-amber-50 rounded-2xl transition-all shadow-sm border border-slate-100 active:scale-95"
                      >
                        <svg className="w-5 h-5 sm:w-6 sm:h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
                        </svg>
                      </button>
                      
                      {showShareMenu && (
                        <div className="absolute top-full right-0 mt-3 w-56 bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden z-50 animate-in fade-in slide-in-from-top-2">
                          <div className="p-2 space-y-1">
                            <button onClick={copyLinkToClipboard} className="w-full text-left px-4 py-3 hover:bg-amber-50 rounded-xl flex items-center gap-3 transition-colors group">
                              <svg className="w-4 h-4 text-slate-400 group-hover:text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" /></svg>
                              <span className="text-sm font-semibold text-slate-700">{t('copy_link', lang)}</span>
                            </button>
                            <button onClick={shareTwitter} className="w-full text-left px-4 py-3 hover:bg-amber-50 rounded-xl flex items-center gap-3 transition-colors group">
                              <svg className="w-4 h-4 text-slate-400 group-hover:text-sky-500" fill="currentColor" viewBox="0 0 24 24"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>
                              <span className="text-sm font-semibold text-slate-700">{t('share_twitter', lang)}</span>
                            </button>
                            <button onClick={shareLinkedIn} className="w-full text-left px-4 py-3 hover:bg-amber-50 rounded-xl flex items-center gap-3 transition-colors group">
                              <svg className="w-4 h-4 text-slate-400 group-hover:text-blue-700" fill="currentColor" viewBox="0 0 24 24"><path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/></svg>
                              <span className="text-sm font-semibold text-slate-700">{t('share_linkedin', lang)}</span>
                            </button>
                          </div>
                        </div>
                      )}
                    </div>

                    <button 
                      onClick={() => toggleFavorite(result.city)}
                      className={`p-3 rounded-2xl transition-all shadow-sm shrink-0 border active:scale-95 ${isFavorite ? 'bg-rose-50 border-rose-100 text-rose-500' : 'bg-slate-50 border-slate-100 text-slate-400'}`}
                    >
                      <svg className={`w-5 h-5 sm:w-6 sm:h-6 ${isFavorite ? 'fill-current' : 'fill-none'}`} stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                      </svg>
                    </button>
                  </div>

                  {/* Result Header */}
                  <div className="flex justify-between items-start mb-6">
                    <div className="flex-1 pr-32">
                      <h2 className="text-2xl sm:text-4xl font-black text-slate-900 mb-2 tracking-tighter">{result.city}</h2>
                      <p className="text-sm sm:text-base text-slate-500 font-medium leading-relaxed max-w-2xl">{result.summary}</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-6 border-t border-slate-50">
                    <div className="bg-amber-50 rounded-2xl p-6 border border-amber-100 shadow-inner">
                      <p className="text-[10px] font-black uppercase tracking-[0.2em] text-amber-600 mb-1">{t('est_budget', lang)}</p>
                      <div className="flex items-baseline gap-2">
                        <span className="text-3xl sm:text-4xl font-black text-amber-900">{result.currencySymbol}{result.totalMonthly.toLocaleString()}</span>
                        <span className="text-xs sm:text-sm font-bold text-amber-600">/ {t('monthly_estimate', lang)}</span>
                      </div>
                    </div>
                    <div className="bg-slate-50 rounded-2xl p-6 border border-slate-100">
                      <BudgetChart items={result.items} currencySymbol={result.currencySymbol} lang={lang} />
                    </div>
                  </div>
                </div>

                <div className="bg-white rounded-3xl shadow-xl border border-slate-100 overflow-hidden">
                  <div className="p-6 border-b border-slate-50 flex justify-between items-center bg-slate-50/50">
                    <h3 className="text-base sm:text-lg font-black text-slate-900 uppercase tracking-tight">{t('itemized_budget', lang)}</h3>
                  </div>
                  <div className="divide-y divide-slate-50">
                    {result.items.map((item, idx) => (
                      <div key={idx} className="p-6 hover:bg-slate-50/50 transition-colors">
                        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                          <div className="flex-1 space-y-1">
                            <div className="flex items-center gap-2">
                              <span className="text-[10px] font-black text-amber-600 uppercase tracking-[0.2em]">{item.category}</span>
                            </div>
                            <p className="text-sm font-bold text-slate-800">{item.description}</p>
                            <p className="text-xs text-slate-500 font-medium leading-relaxed max-w-xl">{item.explanation}</p>
                          </div>
                          <div className="flex flex-col items-start sm:items-end gap-1 shrink-0">
                            <div className="text-lg sm:text-xl font-black text-slate-900">{result.currencySymbol}{item.amount.toLocaleString()}</div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="space-y-8">
                <div className="bg-white rounded-3xl p-6 shadow-xl border border-slate-100 h-80 relative overflow-hidden">
                  <div className="flex items-center justify-between mb-4 relative z-10">
                    <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">{t('location_context', lang)}</h3>
                    <a 
                      href={`https://www.google.com/maps/search/?api=1&query=${result.coordinates.lat},${result.coordinates.lng}`} 
                      target="_blank" rel="noopener noreferrer"
                      className="text-[10px] font-black uppercase text-amber-600 hover:text-amber-700 tracking-[0.2em] bg-white/80 px-2 py-1 rounded-md shadow-sm"
                    >
                      {t('open_maps', lang)}
                    </a>
                  </div>
                  <div className="absolute inset-0 z-0">
                    <CityMap lat={result.coordinates.lat} lng={result.coordinates.lng} cityName={result.city} />
                  </div>
                </div>

                <div className="bg-white rounded-3xl p-6 shadow-xl border border-slate-100">
                  <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 mb-4">{t('data_sources', lang)}</h3>
                  <div className="space-y-4">
                    {result.sources.map((source, idx) => (
                      <a key={idx} href={source.uri} target="_blank" rel="noopener noreferrer" className="block group">
                        <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-100 group-hover:border-amber-200 group-hover:bg-amber-50 transition-all">
                          <div className="flex items-center gap-2 mb-1.5">
                            <div className="w-1.5 h-1.5 rounded-full bg-amber-400"></div>
                            <p className="text-xs font-black text-slate-800 group-hover:text-amber-900 line-clamp-1 uppercase tracking-tight">{source.title}</p>
                          </div>
                          <p className="text-[10px] text-slate-500 font-medium line-clamp-2 leading-relaxed">{source.snippet}</p>
                        </div>
                      </a>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* SAVING TIPS SECTION */}
            {result.savingTips && result.savingTips.length > 0 && (
              <div className="mt-12 bg-white rounded-[2rem] p-8 sm:p-12 shadow-2xl border border-amber-100 relative overflow-hidden group">
                <div className="absolute top-0 right-0 -mr-16 -mt-16 w-64 h-64 bg-amber-50 rounded-full blur-3xl opacity-50 group-hover:opacity-80 transition-opacity duration-700"></div>
                
                <div className="relative z-10 flex flex-col md:flex-row gap-8 items-start mb-12">
                  <div className="bg-amber-100/50 p-5 rounded-[1.5rem] shadow-inner text-4xl">
                    💡
                  </div>
                  <div className="flex-1 space-y-2">
                    <h3 className="text-3xl font-black text-slate-900 tracking-tighter leading-none">{t('saving_tips_title', lang)}</h3>
                    <p className="text-lg text-slate-500 font-semibold">{t('saving_tips_subtitle', lang)}</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6 relative z-10">
                  {result.savingTips.map((tip, idx) => (
                    <div 
                      key={idx} 
                      className="bg-white border border-slate-100 p-6 rounded-[2rem] shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300 animate-in fade-in slide-in-from-bottom-4"
                      style={{ animationDelay: `${idx * 150}ms`, animationFillMode: 'both' }}
                    >
                      <div className="w-14 h-14 bg-amber-50 rounded-2xl flex items-center justify-center text-3xl mb-6 shadow-inner ring-4 ring-white">
                        {tip.icon}
                      </div>
                      <p className="text-[10px] font-black uppercase tracking-[0.2em] text-amber-600 mb-3">{tip.category}</p>
                      <p className="text-sm text-slate-700 font-bold leading-relaxed">
                        {tip.tip}
                      </p>
                    </div>
                  ))}
                </div>

                <div className="mt-12 pt-8 border-t border-slate-50 flex items-center gap-2 opacity-40">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                  <span className="text-[10px] font-black uppercase tracking-[0.2em] italic">Market-validated benchmarks for ultra-frugal relocation planning.</span>
                </div>
              </div>
            )}
          </div>
        )}
      </main>

      {/* Success Toast */}
      {showSuccessToast && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 bg-emerald-600 text-white px-6 py-3 rounded-full text-xs font-black uppercase tracking-widest shadow-2xl z-50 animate-in fade-in slide-in-from-top-4 flex items-center gap-3">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7"/></svg>
          Calculated Successfully
        </div>
      )}

      {/* Copy Link Tooltip */}
      {showCopiedTooltip && (
        <div className="fixed bottom-8 left-1/2 -translate-x-1/2 bg-slate-900 text-white px-6 py-3 rounded-full text-xs font-black uppercase tracking-widest shadow-2xl z-50 animate-in fade-in slide-in-from-bottom-2">
          {t('link_copied', lang)}
        </div>
      )}

      <footer className="max-w-6xl mx-auto px-4 py-12 border-t border-slate-200 mt-20 no-print text-center">
        <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em]">Volare 2026 &bull; Global Frugality Engine</p>
      </footer>

      {/* Dev Tools - Accessible by clicking the logo 5 times quickly */}
      <TestPanel />
    </div>
  );
};

export default App;
