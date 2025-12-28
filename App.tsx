
import React, { useState, useEffect, useRef } from 'react';
import { fetchCityBudgetData, fetchCitySuggestions, ServiceError } from './services/geminiService';
import { BudgetResult, CURRENCIES, SearchFilters, HousingType } from './types';
import CategoryFilter from './components/CategoryFilter';
import BudgetChart from './components/BudgetChart';
import CityMap from './components/CityMap';
import TestPanel from './components/TestPanel';
import { t } from './services/i18n';

// The AIStudio and window.aistudio types are already provided by the environment.
// Redefining them here causes "Duplicate identifier" and "identical modifiers" errors.

const App: React.FC = () => {
  const [lang, setLang] = useState(() => localStorage.getItem('urbancost_lang') || 'es');
  const [city, setCity] = useState('');
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [filters, setFilters] = useState<SearchFilters>({ country: '', region: '', population: '' });
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>(['housing', 'groceries', 'transport', 'utilities']);
  const [housingType, setHousingType] = useState<HousingType>('shared');
  const [currencyCode, setCurrencyCode] = useState('USD');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<BudgetResult | null>(null);
  const [error, setError] = useState<ServiceError | null>(null);
  
  // hasKey: null (cargando), false (necesita conectar), true (listo)
  const [hasKey, setHasKey] = useState<boolean | null>(null);

  const isEmbedded = new URLSearchParams(window.location.search).get('embed') === 'true';
  const suggestionsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    localStorage.setItem('urbancost_lang', lang);
    document.documentElement.lang = lang;
  }, [lang]);

  // Lógica robusta de verificación de API Key
  useEffect(() => {
    const checkKey = async () => {
      // 1. Si process.env.API_KEY existe (inyectado por el entorno), estamos listos
      if (process.env.API_KEY && process.env.API_KEY !== "") {
        setHasKey(true);
        return;
      }

      // 2. Si no hay env var, verificamos el diálogo de AI Studio (Wix/Preview)
      try {
        // @ts-ignore - aistudio is globally available in the AI Studio environment
        if (window.aistudio) {
          // @ts-ignore
          const selected = await window.aistudio.hasSelectedApiKey();
          setHasKey(selected);
        } else {
          // Si no hay env var ni aistudio, estamos en un problema de configuración
          setHasKey(false);
        }
      } catch (e) {
        setHasKey(false);
      }
    };
    checkKey();
  }, []);

  // Solo buscar sugerencias si tenemos una clave activa
  useEffect(() => {
    if (!hasKey || (city.length < 2 && !filters.country && !filters.region)) {
      setSuggestions([]);
      return;
    }
    const timer = setTimeout(async () => {
      try {
        const results = await fetchCitySuggestions(city, filters, lang);
        setSuggestions(results);
        setShowSuggestions(results.length > 0);
      } catch (e: any) { 
        if (e.message?.includes("API Key")) setHasKey(false);
        console.error(e); 
      }
    }, 400);
    return () => clearTimeout(timer);
  }, [city, filters, lang, hasKey]);

  const handleSearch = async (targetCity?: string) => {
    const finalCity = targetCity || city;
    if (!finalCity.trim() || !hasKey) return;
    
    setCity(finalCity);
    setShowSuggestions(false);
    setShowAdvancedFilters(false);
    setLoading(true);
    setError(null);

    try {
      const data = await fetchCityBudgetData(finalCity, selectedIds, currencyCode, lang, housingType);
      setResult(data);
    } catch (err: any) {
      // Si el error indica falta de clave o entidad no encontrada, resetear estado de clave
      if (err.message?.includes("API Key") || err.message?.includes("Requested entity was not found")) {
        setHasKey(false);
      }
      setError(err instanceof ServiceError ? err : new ServiceError(err.message, 'generic'));
    } finally { setLoading(false); }
  };

  const handleConnectKey = async () => {
    // @ts-ignore
    if (window.aistudio) {
      // @ts-ignore
      await window.aistudio.openSelectKey();
      // Assume success after triggering the dialog to avoid race conditions
      setHasKey(true);
    } else {
      // En entorno local/Vercel sin Wix, informar que falta la variable
      alert("Error: process.env.API_KEY no detectada. Por favor, revisa la configuración de Vercel.");
    }
  };

  const toggleLanguage = () => {
    setLang(prev => (prev === 'es' ? 'en' : 'es'));
  };

  // 1. Estado de carga inicial
  if (hasKey === null) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <div className="flex flex-col items-center gap-4">
          <div className="w-10 h-10 border-4 border-blue-600/20 border-t-blue-600 rounded-full animate-spin"></div>
          <p className="text-xs font-black text-slate-400 uppercase tracking-widest">Iniciando Volare...</p>
        </div>
      </div>
    );
  }

  // 2. Pantalla de conexión (Si falta la clave)
  if (hasKey === false) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 p-6">
        <div className="max-w-md w-full bg-white rounded-[2.5rem] p-10 shadow-2xl shadow-blue-100 border border-slate-100 text-center animate-in fade-in zoom-in-95 duration-500">
          <div className="w-20 h-20 bg-blue-600 rounded-3xl flex items-center justify-center mx-auto mb-8 shadow-lg shadow-blue-200 rotate-3">
            <span className="text-white text-4xl font-black">V</span>
          </div>
          <h1 className="text-3xl font-black text-slate-900 tracking-tighter mb-4">CONECTAR API</h1>
          <p className="text-slate-500 font-medium mb-8 leading-relaxed">
            {lang === 'es' 
              ? 'Para realizar cálculos y búsquedas en tiempo real, Volare necesita conectarse a tu proyecto de Google Cloud.' 
              : 'To perform real-time calculations and searches, Volare needs to connect to your Google Cloud project.'}
          </p>
          
          <button 
            onClick={handleConnectKey}
            className="w-full bg-blue-600 text-white py-4 rounded-2xl font-black text-lg shadow-xl shadow-blue-100 hover:bg-blue-700 hover:-translate-y-1 transition-all active:scale-95 mb-6"
          >
            {lang === 'es' ? 'Seleccionar API Key' : 'Select API Key'}
          </button>

          <div className="space-y-2">
            <a 
              href="https://ai.google.dev/gemini-api/docs/billing" 
              target="_blank" 
              rel="noopener noreferrer"
              className="block text-xs font-bold text-slate-400 hover:text-blue-600 underline underline-offset-4 transition-colors"
            >
              {lang === 'es' ? 'Documentación de facturación' : 'Billing Documentation'}
            </a>
            <p className="text-[10px] text-slate-300 px-4">
                {lang === 'es' 
                    ? 'Si ya configuraste la clave en Vercel, asegúrate de que esté inyectada correctamente en el entorno de producción.' 
                    : 'If you already configured the key in Vercel, ensure it is properly injected into the production environment.'}
            </p>
          </div>
        </div>
      </div>
    );
  }

  // 3. Aplicación Principal
  return (
    <div className={`min-h-screen ${isEmbedded ? 'pb-10' : 'pb-20'}`}>
      {!isEmbedded && (
        <header className="bg-white/80 backdrop-blur-md sticky top-0 z-40 border-b border-slate-200 no-print">
          <div className="max-w-5xl mx-auto px-4 h-16 flex items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <h1 className="text-xl font-black tracking-tighter text-blue-600">VOLARE</h1>
              <button onClick={toggleLanguage} className="bg-slate-100 hover:bg-slate-200 px-3 py-1 rounded-full text-xs font-bold border border-slate-200">
                {lang === 'es' ? '🇺🇸 EN' : '🇪🇸 ES'}
              </button>
            </div>
            
            <div className="flex-1 max-w-lg relative" ref={suggestionsRef}>
              <div className="flex items-center bg-slate-100 rounded-full px-4 py-1.5 border-2 border-transparent focus-within:border-blue-400 focus-within:bg-white transition-all">
                <input 
                  type="text" 
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  onFocus={() => setShowSuggestions(suggestions.length > 0)}
                  placeholder={t('search_placeholder', lang)}
                  className="bg-transparent flex-1 outline-none text-sm font-medium py-1"
                />
                <button onClick={() => setShowAdvancedFilters(!showAdvancedFilters)} className={`p-1 rounded-md ${showAdvancedFilters ? 'text-blue-600' : 'text-slate-400'}`}>
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" /></svg>
                </button>
              </div>

              {showSuggestions && (
                <div className="absolute top-full left-0 right-0 mt-2 bg-white rounded-2xl shadow-xl border border-slate-200 overflow-hidden z-50">
                  {suggestions.map((s, idx) => (
                    <button key={idx} onClick={() => handleSearch(s)} className="w-full text-left px-4 py-3 hover:bg-slate-50 text-sm font-semibold border-b border-slate-50 last:border-none">{s}</button>
                  ))}
                </div>
              )}
            </div>

            <button 
              onClick={() => handleSearch()}
              disabled={loading || !city}
              className="bg-blue-600 text-white px-6 py-2 rounded-full text-sm font-bold shadow-lg shadow-blue-200 hover:bg-blue-700 active:scale-95 transition-all disabled:opacity-50"
            >
              {loading ? '...' : t('go', lang)}
            </button>
          </div>
        </header>
      )}

      {isEmbedded && (
        <div className="max-w-5xl mx-auto px-4 py-6 no-print">
            <div className="flex gap-2">
                <div className="flex-1 relative" ref={suggestionsRef}>
                    <div className="flex items-center bg-white rounded-full px-4 py-2.5 shadow-sm border border-slate-200 focus-within:border-blue-400 transition-all">
                        <input 
                            type="text" 
                            value={city}
                            onChange={(e) => setCity(e.target.value)}
                            onFocus={() => setShowSuggestions(suggestions.length > 0)}
                            placeholder={t('search_placeholder', lang)}
                            className="bg-transparent flex-1 outline-none text-sm font-medium"
                        />
                        <button onClick={toggleLanguage} className="mx-2 text-[10px] font-bold text-slate-400">
                            {lang === 'es' ? 'EN' : 'ES'}
                        </button>
                        <button onClick={() => setShowAdvancedFilters(!showAdvancedFilters)} className={`p-1 rounded-md ${showAdvancedFilters ? 'text-blue-600' : 'text-slate-400'}`}>
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" /></svg>
                        </button>
                    </div>
                    {showSuggestions && (
                        <div className="absolute top-full left-0 right-0 mt-2 bg-white rounded-2xl shadow-xl border border-slate-200 overflow-hidden z-50">
                            {suggestions.map((s, idx) => (
                                <button key={idx} onClick={() => handleSearch(s)} className="w-full text-left px-4 py-3 hover:bg-slate-50 text-sm font-semibold border-b border-slate-50 last:border-none">{s}</button>
                            ))}
                        </div>
                    )}
                </div>
                <button 
                    onClick={() => handleSearch()}
                    disabled={loading || !city}
                    className="bg-blue-600 text-white px-6 py-2 rounded-full text-sm font-bold shadow-lg shadow-blue-100 hover:bg-blue-700 disabled:opacity-50"
                >
                    {loading ? '...' : t('go', lang)}
                </button>
            </div>
        </div>
      )}

      {showAdvancedFilters && (
        <div className="bg-white border-b border-slate-200 p-4 animate-in slide-in-from-top duration-300 no-print">
          <div className="max-w-5xl mx-auto grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{t('country', lang)}</label>
              <input type="text" value={filters.country} onChange={(e) => setFilters({...filters, country: e.target.value})} className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 text-xs outline-none" placeholder="e.g. Italy" />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{t('region', lang)}</label>
              <input type="text" value={filters.region} onChange={(e) => setFilters({...filters, region: e.target.value})} className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 text-xs outline-none" placeholder="e.g. Tuscany" />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{t('city_size', lang)}</label>
              <select value={filters.population} onChange={(e) => setFilters({...filters, population: e.target.value})} className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 text-xs outline-none">
                <option value="">{t('any_size', lang)}</option>
                <option value="small">{t('small', lang)} (&lt; 100k)</option>
                <option value="medium">{t('medium', lang)} (100k - 1M)</option>
                <option value="large">{t('large', lang)} (&gt; 1M)</option>
              </select>
            </div>
          </div>
        </div>
      )}

      <main className="max-w-5xl mx-auto px-4 py-8">
        <section className="mb-12 no-print">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-8 h-8 rounded-full bg-blue-600 text-white flex items-center justify-center font-black text-sm">1</div>
            <h2 className="text-xl font-extrabold tracking-tight text-slate-800">{t('configure_title', lang)}</h2>
          </div>
          <CategoryFilter selectedIds={selectedIds} onChange={setSelectedIds} lang={lang} />
          
          <div className="flex items-center gap-4 mt-4">
            <div className="flex bg-slate-100 p-1 rounded-xl">
              <button onClick={() => setHousingType('shared')} className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${housingType === 'shared' ? 'bg-white shadow-sm text-blue-600' : 'text-slate-500'}`}>{t('shared_apartment', lang)}</button>
              <button onClick={() => setHousingType('house')} className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${housingType === 'house' ? 'bg-white shadow-sm text-blue-600' : 'text-slate-500'}`}>{t('house', lang)}</button>
            </div>
            <select value={currencyCode} onChange={(e) => setCurrencyCode(e.target.value)} className="bg-white border border-slate-200 rounded-xl px-3 py-1.5 text-xs font-bold outline-none">
              {CURRENCIES.map(c => <option key={c.code} value={c.code}>{c.code} ({c.symbol})</option>)}
            </select>
          </div>
        </section>

        {loading ? (
          <div className="py-20 text-center space-y-4">
            <div className="w-12 h-12 border-4 border-blue-600/20 border-t-blue-600 rounded-full animate-spin mx-auto"></div>
            <p className="text-sm font-bold text-slate-500 animate-pulse">{t('fetching_data', lang)}</p>
          </div>
        ) : error ? (
          <div className="bg-rose-50 border border-rose-100 rounded-3xl p-8 text-center space-y-4">
            <p className="text-rose-600 font-bold">{error.message}</p>
            <button onClick={() => handleSearch()} className="bg-rose-600 text-white px-6 py-2 rounded-xl text-sm font-bold">Try Again</button>
          </div>
        ) : result ? (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="lg:col-span-2 space-y-8">
              <div className="bg-white rounded-[2.5rem] p-8 shadow-xl shadow-slate-200/50 border border-slate-100">
                <div className="flex flex-col sm:flex-row justify-between items-start gap-4 mb-8">
                  <div>
                    <h2 className="text-4xl font-black text-slate-900 tracking-tighter">{result.city}</h2>
                    <p className="text-slate-500 font-medium mt-1 max-w-md">{result.summary}</p>
                  </div>
                  <div className="bg-blue-600 text-white px-8 py-4 rounded-3xl text-center shadow-lg shadow-blue-200">
                    <p className="text-[10px] font-black uppercase tracking-widest opacity-80">{t('est_budget', lang)}</p>
                    <p className="text-4xl font-black">{result.currencySymbol}{result.totalMonthly.toLocaleString()}</p>
                  </div>
                </div>
                <BudgetChart items={result.items} currencySymbol={result.currencySymbol} lang={lang} />
              </div>

              <div className="bg-white rounded-[2.5rem] shadow-xl shadow-slate-200/50 border border-slate-100 overflow-hidden">
                <div className="p-6 border-b border-slate-100 bg-slate-50/50">
                  <h3 className="text-sm font-black text-slate-900 uppercase tracking-widest">{t('itemized_budget', lang)}</h3>
                </div>
                <div className="divide-y divide-slate-100">
                  {result.items.map((item, idx) => (
                    <div key={idx} className="p-6 hover:bg-slate-50 transition-colors">
                      <div className="flex justify-between items-start gap-4">
                        <div className="flex-1">
                          <p className="text-[10px] font-black text-blue-600 uppercase tracking-widest mb-1">{item.category}</p>
                          <p className="text-sm font-bold text-slate-800">{item.description}</p>
                          <p className="text-xs text-slate-500 mt-1">{item.explanation}</p>
                        </div>
                        <div className="text-xl font-black text-slate-900">{result.currencySymbol}{item.amount.toLocaleString()}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="space-y-8">
              <div className="h-72 bg-white rounded-[2.5rem] overflow-hidden shadow-xl border border-slate-100">
                <CityMap lat={result.coordinates.lat} lng={result.coordinates.lng} cityName={result.city} />
              </div>

              <div className="bg-white rounded-[2.5rem] p-6 shadow-xl border border-slate-100">
                <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-4">{t('data_sources', lang)}</h3>
                <div className="space-y-3">
                  {result.sources.map((s, i) => (
                    <a key={i} href={s.uri} target="_blank" rel="noopener noreferrer" className="block p-3 bg-slate-50 rounded-2xl hover:bg-blue-50 transition-colors group">
                      <p className="text-xs font-bold text-slate-800 group-hover:text-blue-700 truncate">{s.title}</p>
                      <p className="text-[9px] text-slate-400 mt-0.5 truncate">{s.uri}</p>
                    </a>
                  ))}
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="py-32 text-center">
            <div className="w-20 h-20 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-6 text-3xl">🌍</div>
            <h2 className="text-2xl font-black text-slate-800 tracking-tight">{t('ready_explore', lang)}</h2>
            <p className="text-slate-400 text-sm mt-2">{t('ready_explore_desc', lang)}</p>
          </div>
        )}
      </main>

      {!isEmbedded && <TestPanel />}
    </div>
  );
};

export default App;
