import React, { useState, useEffect, useRef } from 'react';
import { fetchCityBudgetData, fetchCitySuggestions, ServiceError } from './services/geminiService';
import { BudgetResult, BUDGET_CATEGORIES, CURRENCIES, LANGUAGES, SearchFilters } from './types';
import CategoryFilter from './components/CategoryFilter';
import BudgetChart from './components/BudgetChart';
import CityMap from './components/CityMap';
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
  const [userLocation, setUserLocation] = useState<{lat: number, lng: number} | undefined>();
  const [userLogo, setUserLogo] = useState<string | null>(() => localStorage.getItem('urbancost_logo'));
  
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [filters, setFilters] = useState<SearchFilters>({ country: '', region: '', population: '' });
  const [currencyCode, setCurrencyCode] = useState('USD');
  const [selectedIds, setSelectedIds] = useState<string[]>(['housing', 'groceries', 'transport', 'utilities', 'leisure', 'health', 'medical_insurance', 'education', 'clothing', 'personal_care']);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<BudgetResult | null>(null);
  const [error, setError] = useState<ServiceError | null>(null);
  
  const [expandedIdx, setExpandedIdx] = useState<number | null>(null);
  const [showLangMenu, setShowLangMenu] = useState(false);
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [showShareMenu, setShowShareMenu] = useState(false);
  const [showCopiedTooltip, setShowCopiedTooltip] = useState(false);
  const [favorites, setFavorites] = useState<string[]>([]);
  const [showFavorites, setShowFavorites] = useState(false);
  
  const suggestionsRef = useRef<HTMLDivElement>(null);
  const favoritesRef = useRef<HTMLDivElement>(null);
  const langMenuRef = useRef<HTMLDivElement>(null);
  const exportMenuRef = useRef<HTMLDivElement>(null);
  const shareMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const cityParam = params.get('city');
    if (cityParam) { handleSearch(cityParam); }
  }, []);

  useEffect(() => {
    const saved = localStorage.getItem('urbancost_favorites');
    if (saved) { try { setFavorites(JSON.parse(saved)); } catch (e) {} }
  }, []);

  useEffect(() => { localStorage.setItem('urbancost_favorites', JSON.stringify(favorites)); }, [favorites]);
  useEffect(() => { localStorage.setItem('urbancost_lang', lang); }, [lang]);

  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => setUserLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
        () => console.log("Geolocation access denied")
      );
    }
  }, []);

  useEffect(() => {
    if (result && result.city && !loading) {
      handleSearch(result.city);
    }
  }, [lang, currencyCode]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (suggestionsRef.current && !suggestionsRef.current.contains(event.target as Node)) setShowSuggestions(false);
      if (favoritesRef.current && !favoritesRef.current.contains(event.target as Node)) setShowFavorites(false);
      if (langMenuRef.current && !langMenuRef.current.contains(event.target as Node)) setShowLangMenu(false);
      if (exportMenuRef.current && !exportMenuRef.current.contains(event.target as Node)) setShowExportMenu(false);
      if (shareMenuRef.current && !shareMenuRef.current.contains(event.target as Node)) setShowShareMenu(false);
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    if (city.length < 2 && !filters.country && !filters.region) {
      setSuggestions([]);
      return;
    }
    const timer = setTimeout(async () => {
      const results = await fetchCitySuggestions(city, userLocation, filters, lang);
      setSuggestions(results);
      setShowSuggestions(results.length > 0);
    }, 400);
    return () => clearTimeout(timer);
  }, [city, userLocation, filters, lang]);

  const handleSearch = async (targetCity?: string, e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const finalCity = targetCity || city;
    if (!finalCity.trim()) return;

    setCity(finalCity);
    setShowSuggestions(false);
    setShowFavorites(false);
    setShowLangMenu(false);
    setShowShareMenu(false);
    
    const newUrl = new URL(window.location.href);
    newUrl.searchParams.set('city', finalCity);
    window.history.pushState({}, '', newUrl);

    setLoading(true);
    setError(null);
    setExpandedIdx(null);
    try {
      const data = await fetchCityBudgetData(finalCity, selectedIds, currencyCode, lang);
      setResult(data);
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

  const exportCSV = () => {
    if (!result) return;
    const headers = ['Category', 'Amount', 'Description', 'Context'];
    const rows = result.items.map(item => [item.category, `${result.currencySymbol}${item.amount}`, item.description, item.explanation || '']);
    let csv = "data:text/csv;charset=utf-8," + [headers, ...rows].map(e => e.join(",")).join("\n");
    const link = document.createElement("a");
    link.setAttribute("href", encodeURI(csv));
    link.setAttribute("download", `Volare_${result.city.replace(/\s/g, '_')}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setShowExportMenu(false);
  };

  const copyLinkToClipboard = () => {
    const url = window.location.href;
    navigator.clipboard.writeText(url);
    setShowCopiedTooltip(true);
    setTimeout(() => setShowCopiedTooltip(false), 2000);
    setShowShareMenu(false);
  };

  const getShareText = () => {
    if (!result) return "";
    return t('share_text', lang)
      .replace('{city}', result.city)
      .replace('{total}', `${result.currencySymbol}${result.totalMonthly.toLocaleString()}`)
      .replace('{currency}', result.currency);
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
      <div className="print-only w-full border-b-2 border-amber-600 mb-8 pb-4">
        <div className="flex justify-between items-end">
          <div>
            <h1 className="text-3xl font-black text-slate-900">Volare</h1>
            <p className="text-slate-500 text-sm font-medium">Global Living Cost Report</p>
          </div>
          <div className="text-right text-xs text-slate-400 font-bold uppercase tracking-widest">
            Generated on {new Date().toLocaleDateString()}
          </div>
        </div>
      </div>

      <header className="bg-white border-b border-slate-200 sticky top-0 z-30 shadow-sm no-print">
        <div className="max-w-6xl mx-auto px-4 h-16 flex items-center gap-4">
          <div className="flex items-center shrink-0">
            <label className="cursor-pointer group relative flex items-center gap-2">
              <input type="file" className="hidden" accept="image/*" onChange={handleLogoUpload} />
              {userLogo ? (
                <div className="relative group/logo">
                  <img src={userLogo} alt="Logo" className="h-10 w-auto max-w-[120px] object-contain transition-transform group-hover:scale-105" />
                  <button onClick={removeLogo} className="absolute -top-2 -right-2 bg-slate-800 text-white p-1 rounded-full opacity-0 group-hover/logo:opacity-100 transition-opacity">
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" /></svg>
                  </button>
                </div>
              ) : (
                <div className="flex flex-col -space-y-1 group transition-all cursor-pointer" onClick={() => {setResult(null); setCity(''); window.history.pushState({}, '', window.location.pathname);}}>
                  <h1 className="text-3xl font-black text-blue-900 tracking-tighter uppercase leading-none group-hover:text-amber-600 transition-colors">Volare</h1>
                </div>
              )}
            </label>
          </div>
          
          <div className="flex-1 max-w-lg relative ml-2" ref={suggestionsRef}>
            <div className="flex items-center gap-2">
              <form onSubmit={(e) => handleSearch(undefined, e)} className="flex-1 relative">
                <input
                  type="text" value={city} onFocus={() => suggestions.length > 0 && setShowSuggestions(true)}
                  onChange={(e) => setCity(e.target.value)} placeholder={t('search_placeholder', lang)}
                  className="w-full pl-10 pr-4 py-2 bg-slate-100 border-none rounded-full text-sm focus:ring-2 focus:ring-amber-500 transition-all outline-none"
                />
                <svg className={`absolute ${currentLang.dir === 'rtl' ? 'right-3' : 'left-3'} top-2.5 w-4 h-4 text-slate-400`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </form>
            </div>

            {showSuggestions && suggestions.length > 0 && (
              <div className="absolute top-full left-0 right-0 mt-2 bg-white rounded-2xl shadow-xl border border-slate-200 overflow-hidden z-40 animate-in fade-in slide-in-from-top-2 duration-200">
                <div className="p-2">
                  <p className="px-3 py-1 text-[10px] font-bold text-slate-400 uppercase tracking-widest">{t('suggestions', lang)}</p>
                  {suggestions.map((s, idx) => (
                    <button key={idx} onClick={() => onSelectSuggestion(s)} className="w-full text-left px-4 py-2.5 hover:bg-amber-50 rounded-xl flex items-center gap-3 transition-colors group">
                      <span className="text-sm font-medium text-slate-700 group-hover:text-amber-800">{s}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="flex items-center gap-3">
            <div className="relative" ref={langMenuRef}>
              <button onClick={() => setShowLangMenu(!showLangMenu)} className="bg-slate-100 hover:bg-slate-200 border-none rounded-xl text-xs font-bold px-3 py-2.5 transition-all flex items-center gap-2 shadow-sm hidden sm:flex">
                <span className="text-base leading-none">{currentLang.flag}</span>
                <span className="text-slate-700">{currentLang.name}</span>
              </button>
              {showLangMenu && (
                <div className="absolute top-full right-0 mt-3 w-48 bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden z-50">
                  <div className="p-2 grid grid-cols-1 gap-1">
                    {LANGUAGES.map((l) => (
                      <button key={l.code} onClick={() => { setLang(l.code); setShowLangMenu(false); }} className={`flex items-center gap-3 w-full text-left px-3 py-2 rounded-xl text-sm font-semibold transition-all ${lang === l.code ? 'bg-amber-50 text-amber-700' : 'text-slate-600 hover:bg-slate-50'}`}>
                        <span>{l.flag}</span><span>{l.name}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="relative" ref={favoritesRef}>
              <button onClick={() => setShowFavorites(!showFavorites)} className={`p-2 rounded-full transition-colors ${favorites.length > 0 ? 'text-rose-500 hover:bg-rose-50' : 'text-slate-400 hover:bg-slate-100'}`}>
                <svg className={`w-6 h-6 ${favorites.length > 0 ? 'fill-current' : 'fill-none'}`} stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" /></svg>
              </button>
              {showFavorites && (
                <div className="absolute top-full right-0 mt-3 w-72 bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden z-30">
                  <div className="p-4 border-b border-slate-100 flex justify-between bg-slate-50/50"><h3 className="text-sm font-bold">{t('saved_cities', lang)}</h3></div>
                  <div className="max-h-72 overflow-y-auto p-2">
                    {favorites.length === 0 ? <div className="py-10 text-center"><p className="text-xs text-slate-400">{t('no_saved', lang)}</p></div> : favorites.map((fav, idx) => (
                      <button key={idx} onClick={() => handleSearch(fav)} className="w-full text-left px-3 py-2.5 hover:bg-amber-50 rounded-xl text-sm font-semibold">{fav}</button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <select value={currencyCode} onChange={(e) => setCurrencyCode(e.target.value)} className="bg-slate-100 border-none rounded-lg text-sm font-semibold px-3 py-2 outline-none cursor-pointer">
              {CURRENCIES.map(curr => <option key={curr.code} value={curr.code}>{curr.symbol} {curr.code}</option>)}
            </select>
            <button onClick={() => handleSearch()} disabled={loading || !city} className="bg-amber-600 hover:bg-amber-700 text-white px-6 py-2 rounded-full text-sm font-bold shadow-md transition-all active:scale-95 disabled:opacity-50">{loading ? '...' : t('go', lang)}</button>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-8">
        <div className="mb-8 no-print category-filter-section">
          <h2 className="text-2xl font-bold text-slate-800 mb-2">{t('configure_title', lang)}</h2>
          <p className="text-slate-500 mb-4">{t('configure_desc', lang)}</p>
          <CategoryFilter selectedIds={selectedIds} onChange={setSelectedIds} lang={lang} />
        </div>

        {loading && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 animate-in fade-in duration-500 no-print">
            <div className="lg:col-span-2 space-y-8">
              <div className="bg-white p-8 rounded-3xl shadow-sm border border-slate-100 overflow-hidden">
                <div className="flex flex-col sm:flex-row justify-between items-start mb-10 gap-4">
                  <div className="space-y-3"><div className="h-10 w-48 bg-slate-200 rounded-2xl animate-pulse"></div><div className="h-4 w-32 bg-slate-100 rounded-lg animate-pulse"></div></div>
                </div>
              </div>
              <div className="bg-white p-8 rounded-3xl shadow-sm border border-slate-100 overflow-hidden"><SkeletonRow /><SkeletonRow /></div>
            </div>
          </div>
        )}

        <ErrorDisplay error={error} lang={lang} onRetry={() => handleSearch()} />

        {!loading && result && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 animate-in fade-in duration-500 budget-result-card">
            <div className="lg:col-span-2 space-y-8">
              <div className="bg-white p-8 rounded-3xl shadow-sm border border-slate-100 relative group overflow-hidden">
                <div className={`absolute top-6 ${currentLang.dir === 'rtl' ? 'left-6' : 'right-6'} flex gap-2 no-print`}>
                  <div className="relative" ref={shareMenuRef}>
                    <button onClick={() => setShowShareMenu(!showShareMenu)} className="p-3 bg-white border border-slate-100 rounded-2xl shadow-sm text-slate-500 hover:text-amber-600 transition-all">
                      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" /></svg>
                    </button>
                    {showShareMenu && (
                      <div className="absolute top-full right-0 mt-2 w-56 bg-white rounded-2xl shadow-2xl border border-slate-200 z-50 p-2 space-y-1">
                        <button onClick={copyLinkToClipboard} className="w-full flex items-center gap-3 px-4 py-2.5 text-sm font-semibold hover:bg-amber-50 rounded-xl">{t('copy_link', lang)}</button>
                        <button onClick={shareTwitter} className="w-full flex items-center gap-3 px-4 py-2.5 text-sm font-semibold hover:bg-amber-50 rounded-xl">X (Twitter)</button>
                      </div>
                    )}
                  </div>
                  <div className="relative" ref={exportMenuRef}>
                    <button onClick={() => setShowExportMenu(!showExportMenu)} className="p-3 bg-white border border-slate-100 rounded-2xl shadow-sm text-slate-500 hover:text-amber-600 transition-all">
                      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a2 2 0 002 2h12a2 2 0 002-2v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                    </button>
                    {showExportMenu && (
                      <div className="absolute top-full right-0 mt-2 w-48 bg-white rounded-2xl shadow-2xl border border-slate-200 z-50 p-2">
                        <button onClick={exportCSV} className="w-full text-left px-4 py-2.5 text-sm font-semibold hover:bg-amber-50 rounded-xl">{t('export_csv', lang)}</button>
                      </div>
                    )}
                  </div>
                  <button onClick={() => toggleFavorite(result.city)} className={`p-3 rounded-2xl shadow-sm border transition-all ${isFavorite ? 'bg-rose-50 border-rose-100 text-rose-500' : 'bg-white border-slate-100 text-slate-300'}`}>
                    <svg className={`w-6 h-6 ${isFavorite ? 'fill-current' : 'fill-none'}`} stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" /></svg>
                  </button>
                </div>
                <div className="flex flex-col sm:flex-row justify-between items-start mb-6 gap-4">
                  <div><h3 className="text-3xl font-extrabold text-slate-900 tracking-tight">{result.city}</h3><p className="text-slate-500 font-medium">{t('est_budget', lang)}</p></div>
                  <div className="text-left"><div className="text-4xl font-extrabold text-amber-600 tabular-nums">{result.currencySymbol}{result.totalMonthly.toLocaleString()}</div><span className="text-xs text-slate-400 font-bold uppercase tracking-widest">{result.currency} / MONTH</span></div>
                </div>
                <div className="prose prose-slate max-w-none text-slate-600 font-medium mb-6"><p>{result.summary}</p></div>
              </div>
              <div className="bg-white p-8 rounded-3xl shadow-sm border border-slate-100 overflow-hidden">
                <h4 className="text-lg font-bold text-slate-900 mb-6">{t('itemized_budget', lang)}</h4>
                <div className="divide-y divide-slate-100">
                  {result.items.map((item, idx) => (
                    <div key={idx} className="item-row">
                      <div className="py-6 flex flex-col sm:flex-row justify-between gap-4 px-4 -mx-4 rounded-2xl hover:bg-slate-50 transition-all">
                        <div className="flex-1 space-y-2">
                          <span className="text-[10px] font-black uppercase tracking-widest px-2.5 py-1 bg-amber-100 text-amber-800 rounded-lg">{item.category}</span>
                          <p className="text-sm text-slate-900 font-bold">{item.description}</p>
                        </div>
                        <div className="text-right shrink-0"><span className="text-2xl font-black text-slate-900 tabular-nums">{result.currencySymbol}{item.amount.toLocaleString()}</span></div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
            <div className="space-y-8">
              <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100">
                <h4 className="text-lg font-bold text-slate-900 mb-4">{t('location_context', lang)}</h4>
                <div className="h-[250px] mb-4"><CityMap lat={result.coordinates.lat} lng={result.coordinates.lng} cityName={result.city} /></div>
              </div>
              <div className="bg-white p-8 rounded-3xl shadow-sm border border-slate-100"><BudgetChart items={result.items} currencySymbol={result.currencySymbol} lang={lang} /></div>
            </div>
          </div>
        )}

        {!loading && !result && !error && (
          <div className="text-center py-24 bg-white rounded-3xl border-2 border-dashed border-slate-200 shadow-inner no-print">
            <h3 className="text-2xl font-extrabold text-slate-900 mb-3 tracking-tight">{t('ready_explore', lang)}</h3>
            <p className="text-slate-500 font-medium leading-relaxed">{t('ready_explore_desc', lang)}</p>
          </div>
        )}
      </main>

      <footer className="max-w-6xl mx-auto px-4 py-12 border-t border-slate-200 text-center text-slate-400 text-sm no-print">
        <p>© 2026 Volare Presupuesto. Data powered by Gemini AI with Live Search Grounding.</p>
      </footer>
    </div>
  );
};

export default App;