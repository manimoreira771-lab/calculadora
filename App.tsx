
import React, { useState, useEffect, useRef } from 'react';
import { fetchCityBudgetData, fetchCitySuggestions, ServiceError } from './services/geminiService';
import { BudgetResult, BUDGET_CATEGORIES, CURRENCIES, LANGUAGES, SearchFilters, HousingType } from './types';
import CategoryFilter from './components/CategoryFilter';
import BudgetChart from './components/BudgetChart';
import CityMap from './components/CityMap';
import TestPanel from './components/TestPanel';
import { t } from './services/i18n';

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

const ErrorDisplay: React.FC<{ error: ServiceError | null, lang: string, onRetry: () => void }> = ({ error, lang, onRetry }) => {
  if (!error) return null;
  const handleSelectKey = async () => {
    const aiStudio = (window as any).aistudio;
    if (aiStudio) { await aiStudio.openSelectKey(); onRetry(); }
  };
  let title = t('error_generic', lang);
  let fix = t('fix_guide_network', lang);
  let showKeyBtn = false;

  switch (error.type) {
    case 'quota': title = t('error_quota', lang); fix = t('fix_guide_quota', lang); break;
    case 'safety': title = t('error_safety', lang); fix = t('fix_guide_safety', lang); break;
    case 'network': title = t('error_network', lang); fix = t('fix_guide_network', lang); break;
    case 'not_found': title = t('error_not_found', lang); showKeyBtn = true; break;
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
            <button onClick={onRetry} className="bg-slate-900 text-white px-6 py-2.5 rounded-xl text-sm font-bold shadow-md hover:bg-slate-800 transition-all active:scale-95 flex items-center gap-2">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
              {t('retry_btn', lang)}
            </button>
            {showKeyBtn && (
              <button onClick={handleSelectKey} className="bg-amber-100 text-amber-800 px-6 py-2.5 rounded-xl text-sm font-bold shadow-sm hover:bg-amber-200 transition-all active:scale-95 flex items-center gap-2">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" /></svg>
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
  
  const [filters, setFilters] = useState<SearchFilters>({ country: '', region: '', population: '' });
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  const [currencyCode, setCurrencyCode] = useState('USD');
  const [selectedIds, setSelectedIds] = useState<string[]>(['housing', 'groceries', 'transport', 'utilities']);
  const [housingType, setHousingType] = useState<HousingType>('shared');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<BudgetResult | null>(null);
  const [error, setError] = useState<ServiceError | null>(null);
  const [showSuccessToast, setShowSuccessToast] = useState(false);
  
  const [showLangMenu, setShowLangMenu] = useState(false);
  const [showShareMenu, setShowShareMenu] = useState(false);
  const [favorites, setFavorites] = useState<string[]>([]);
  const [showFavorites, setShowFavorites] = useState(false);
  
  const suggestionsRef = useRef<HTMLDivElement>(null);
  const filtersRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const cityParam = params.get('city');
    if (cityParam) { handleSearch(cityParam); }
  }, []);

  useEffect(() => {
    const saved = localStorage.getItem('urbancost_favorites');
    if (saved) try { setFavorites(JSON.parse(saved)); } catch (e) {}
  }, []);

  useEffect(() => {
    if (city.length < 1 && !filters.country && !filters.region) {
      setSuggestions([]); return;
    }
    setIsSuggestionsLoading(true);
    const timer = setTimeout(async () => {
      try {
        const results = await fetchCitySuggestions(city, userLocation, filters, lang);
        setSuggestions(results);
        setShowSuggestions(results.length > 0);
      } catch (e) { console.error("Autocomplete fetch error", e); }
      finally { setIsSuggestionsLoading(false); }
    }, 300); 
    return () => clearTimeout(timer);
  }, [city, userLocation, filters, lang]);

  const handleSearch = async (targetCity?: string, e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const finalCity = targetCity || city;
    if (!finalCity.trim()) return;
    setCity(finalCity);
    setShowSuggestions(false);
    setShowAdvancedFilters(false);
    setLoading(true);
    setError(null);
    try {
      const data = await fetchCityBudgetData(finalCity, selectedIds, currencyCode, lang, housingType);
      setResult(data);
      setShowSuccessToast(true);
      setTimeout(() => setShowSuccessToast(false), 3000);
    } catch (err: any) {
      setError(err instanceof ServiceError ? err : new ServiceError(err.message, 'generic'));
    } finally { setLoading(false); }
  };

  const currentLang = LANGUAGES.find(l => l.code === lang) || LANGUAGES[0];

  return (
    <div className={`min-h-screen bg-slate-50 relative selection:bg-amber-100 selection:text-amber-900 ${currentLang.dir === 'rtl' ? 'rtl' : 'ltr'}`}>
      <header className="bg-white border-b border-slate-200 sticky top-0 z-30 shadow-sm no-print">
        <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between gap-4">
          <div className="flex items-center shrink-0">
             <h1 className="text-2xl font-black text-blue-900 tracking-tighter uppercase cursor-pointer" onClick={() => window.location.reload()}>Volare</h1>
          </div>
          
          <div className="flex-1 max-w-xl relative" ref={suggestionsRef}>
            <div className="flex items-center gap-2">
              <form onSubmit={(e) => handleSearch(undefined, e)} className="flex-1 relative group">
                <input
                  type="text" value={city} 
                  onFocus={() => setShowSuggestions(suggestions.length > 0)}
                  onChange={(e) => setCity(e.target.value)} placeholder={t('search_placeholder', lang)}
                  className="w-full pl-10 pr-12 py-2.5 bg-slate-100 border-2 border-transparent rounded-full text-sm font-medium focus:bg-white focus:border-amber-400 focus:ring-4 focus:ring-amber-50 transition-all outline-none"
                />
                <div className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none">
                  <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                </div>
                <button 
                  type="button"
                  onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
                  className={`absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded-md transition-colors ${showAdvancedFilters ? 'text-amber-600 bg-amber-50' : 'text-slate-400 hover:text-slate-600'}`}
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" /></svg>
                </button>
              </form>
            </div>

            {/* Advanced Filters Panel */}
            {showAdvancedFilters && (
              <div className="absolute top-full left-0 right-0 mt-2 bg-white rounded-2xl shadow-2xl border border-slate-200 p-4 z-50 animate-in fade-in slide-in-from-top-2" ref={filtersRef}>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="space-y-1">
                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">{t('country', lang)}</label>
                    <input 
                      type="text" placeholder="e.g. Spain" 
                      value={filters.country} onChange={(e) => setFilters({...filters, country: e.target.value})}
                      className="w-full text-xs p-2 bg-slate-50 border border-slate-200 rounded-lg outline-none focus:border-amber-400"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">{t('region', lang)}</label>
                    <input 
                      type="text" placeholder="e.g. Catalonia" 
                      value={filters.region} onChange={(e) => setFilters({...filters, region: e.target.value})}
                      className="w-full text-xs p-2 bg-slate-50 border border-slate-200 rounded-lg outline-none focus:border-amber-400"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">{t('city_size', lang)}</label>
                    <select 
                      value={filters.population} onChange={(e) => setFilters({...filters, population: e.target.value})}
                      className="w-full text-xs p-2 bg-slate-50 border border-slate-200 rounded-lg outline-none focus:border-amber-400"
                    >
                      <option value="">Any Size</option>
                      <option value="small">Small (< 100k)</option>
                      <option value="medium">Medium (100k - 1M)</option>
                      <option value="large">Large (> 1M)</option>
                    </select>
                  </div>
                </div>
              </div>
            )}

            {showSuggestions && suggestions.length > 0 && !showAdvancedFilters && (
              <div className="absolute top-full left-0 right-0 mt-2 bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden z-40">
                {suggestions.map((s, idx) => (
                  <button key={idx} onClick={() => { setCity(s); setShowSuggestions(false); handleSearch(s); }} className="w-full text-left px-4 py-3 hover:bg-amber-50 text-sm font-bold border-b border-slate-50 last:border-none transition-colors">{s}</button>
                ))}
              </div>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button onClick={() => setShowLangMenu(!showLangMenu)} className="bg-slate-100 p-2.5 rounded-xl hover:bg-slate-200 transition-colors">
              <span className="text-lg">{currentLang.flag}</span>
            </button>
            <button onClick={() => handleSearch()} disabled={loading || !city} className="bg-amber-600 text-white px-6 py-2.5 rounded-full text-sm font-black shadow-md hover:bg-amber-700 transition-all active:scale-95 disabled:opacity-50">
              {loading ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div> : t('go', lang)}
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-8">
        <div className="mb-8 category-filter-section space-y-4">
          <h2 className="text-xl font-black text-slate-800 tracking-tight">{t('configure_title', lang)}</h2>
          <CategoryFilter selectedIds={selectedIds} onChange={setSelectedIds} lang={lang} />
          <div className="flex gap-2">
            <button onClick={() => setHousingType('shared')} className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${housingType === 'shared' ? 'bg-slate-900 text-white' : 'bg-white border border-slate-200 text-slate-500'}`}>{t('shared_apartment', lang)}</button>
            <button onClick={() => setHousingType('house')} className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${housingType === 'house' ? 'bg-slate-900 text-white' : 'bg-white border border-slate-200 text-slate-500'}`}>{t('house', lang)}</button>
          </div>
        </div>

        {loading ? (
          <div className="space-y-4">
            <p className="text-sm font-bold text-amber-600 animate-pulse">{t('fetching_data', lang)}</p>
            {[1, 2, 3].map(i => <SkeletonRow key={i} />)}
          </div>
        ) : error ? (
          <ErrorDisplay error={error} lang={lang} onRetry={() => handleSearch()} />
        ) : result ? (
          <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
             <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
               <div className="lg:col-span-2 space-y-8">
                 <div className="bg-white rounded-3xl p-8 shadow-xl border border-slate-100">
                    <div className="flex justify-between items-start mb-6">
                      <div>
                        <h2 className="text-4xl font-black text-slate-900 tracking-tighter">{result.city}</h2>
                        <p className="text-slate-500 font-medium mt-1">{result.summary}</p>
                      </div>
                      <div className="bg-amber-50 px-6 py-3 rounded-2xl border border-amber-100 text-center">
                        <p className="text-[10px] font-black uppercase text-amber-600 tracking-widest">{t('est_budget', lang)}</p>
                        <p className="text-3xl font-black text-amber-900">{result.currencySymbol}{result.totalMonthly.toLocaleString()}</p>
                      </div>
                    </div>
                    <BudgetChart items={result.items} currencySymbol={result.currencySymbol} lang={lang} />
                 </div>

                 <div className="bg-white rounded-3xl shadow-xl border border-slate-100 overflow-hidden">
                    <div className="p-6 border-b border-slate-50 bg-slate-50/30">
                      <h3 className="text-lg font-black text-slate-900 uppercase tracking-tight">{t('itemized_budget', lang)}</h3>
                    </div>
                    <div className="divide-y divide-slate-50">
                      {result.items.map((item, idx) => (
                        <div key={idx} className="p-6 hover:bg-slate-50/20 transition-colors">
                          <div className="flex justify-between gap-4">
                            <div className="flex-1">
                              <p className="text-[10px] font-black text-amber-600 uppercase tracking-widest mb-1">{item.category}</p>
                              <p className="text-sm font-bold text-slate-800">{item.description}</p>
                              <p className="text-xs text-slate-500 mt-1 leading-relaxed">{item.explanation}</p>
                            </div>
                            <div className="text-xl font-black text-slate-900">{result.currencySymbol}{item.amount.toLocaleString()}</div>
                          </div>
                        </div>
                      ))}
                    </div>
                 </div>
               </div>

               <div className="space-y-8">
                  <div className="h-80 bg-white rounded-3xl shadow-xl border border-slate-100 overflow-hidden">
                    <CityMap lat={result.coordinates.lat} lng={result.coordinates.lng} cityName={result.city} />
                  </div>
                  <div className="bg-white rounded-3xl p-6 shadow-xl border border-slate-100">
                    <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-4">{t('data_sources', lang)}</h3>
                    <div className="space-y-3">
                      {result.sources.map((s, i) => (
                        <a key={i} href={s.uri} target="_blank" className="block p-3 bg-slate-50 rounded-xl hover:bg-amber-50 transition-colors border border-slate-100 hover:border-amber-200">
                          <p className="text-xs font-bold text-slate-800 line-clamp-1">{s.title}</p>
                          <p className="text-[10px] text-slate-500 mt-0.5 line-clamp-2">{s.snippet}</p>
                        </a>
                      ))}
                    </div>
                  </div>
               </div>
             </div>
          </div>
        ) : (
          <div className="py-32 text-center opacity-50">
            <p className="text-4xl mb-4">🌍</p>
            <h2 className="text-2xl font-black text-slate-400 uppercase tracking-tighter">{t('ready_explore', lang)}</h2>
          </div>
        )}
      </main>
      <TestPanel />
    </div>
  );
};

export default App;
