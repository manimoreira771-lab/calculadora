
import React, { useState } from 'react';
import { t } from '../services/i18n';
import { saveCorrection } from '../services/correctionService';

interface ItemFeedbackProps {
  itemName: string;
  cityName: string;
  onClose: () => void;
  lang: string;
}

const ItemFeedback: React.FC<ItemFeedbackProps> = ({ itemName, cityName, onClose, lang }) => {
  const [submitted, setSubmitted] = useState(false);
  const [reason, setReason] = useState('');
  const [comment, setComment] = useState('');
  const [suggestedTranslation, setSuggestedTranslation] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!reason) return;
    
    // Save correction locally to refine future AI calls
    saveCorrection({
      city: cityName,
      category: itemName,
      lang: lang,
      reason: reason,
      comment: comment,
      suggestedTranslation: suggestedTranslation,
      timestamp: Date.now()
    });

    setSubmitted(true);
    setTimeout(onClose, 2000);
  };

  if (submitted) {
    return (
      <div className="p-6 text-center animate-in fade-in zoom-in-95 duration-300">
        <div className="w-12 h-12 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-3">
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <h4 className="font-bold text-slate-900 text-sm">{t('feedback_received', lang)}</h4>
        <p className="text-[10px] text-slate-500 mt-1 uppercase tracking-wider">{t('feedback_thanks', lang)}</p>
      </div>
    );
  }

  return (
    <div className="p-4 w-64 animate-in slide-in-from-top-2 duration-200">
      <div className="flex justify-between items-center mb-4">
        <h4 className="font-bold text-slate-900 text-xs uppercase tracking-tight">{t('report_inaccuracy', lang)}</h4>
        <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
      
      <form onSubmit={handleSubmit} className="space-y-3">
        <div className="space-y-1">
          <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{t('reason', lang)}</label>
          <select 
            required
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            className="w-full text-xs bg-slate-50 border border-slate-200 rounded-lg px-2 py-1.5 focus:ring-2 focus:ring-emerald-500 outline-none cursor-pointer"
          >
            <option value="">{t('reason_select', lang)}</option>
            <option value="too_high">{t('price_high', lang)}</option>
            <option value="too_low">{t('price_low', lang)}</option>
            <option value="outdated">{t('outdated', lang)}</option>
            <option value="incorrect">{t('incorrect', lang)}</option>
          </select>
        </div>

        <div className="space-y-1">
          <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{t('suggested_translation', lang)}</label>
          <input 
            type="text"
            value={suggestedTranslation}
            onChange={(e) => setSuggestedTranslation(e.target.value)}
            placeholder={t('suggested_translation_placeholder', lang)}
            className="w-full text-xs bg-slate-50 border border-slate-200 rounded-lg px-2 py-1.5 focus:ring-2 focus:ring-emerald-500 outline-none"
          />
        </div>

        <div className="space-y-1">
          <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{t('comment', lang)}</label>
          <textarea 
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder={t('comment_placeholder', lang)}
            className="w-full text-xs bg-slate-50 border border-slate-200 rounded-lg px-2 py-1.5 focus:ring-2 focus:ring-emerald-500 outline-none resize-none h-16"
          />
        </div>

        <button 
          type="submit"
          disabled={!reason}
          className="w-full bg-emerald-600 text-white py-2 rounded-lg text-xs font-bold hover:bg-emerald-700 transition-all disabled:opacity-50"
        >
          {t('submit_report', lang)}
        </button>
      </form>
    </div>
  );
};

export default ItemFeedback;
