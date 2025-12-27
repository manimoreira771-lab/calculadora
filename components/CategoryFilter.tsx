
import React from 'react';
import { BUDGET_CATEGORIES } from '../types';
import { t } from '../services/i18n';

interface CategoryFilterProps {
  selectedIds: string[];
  onChange: (ids: string[]) => void;
  lang: string;
}

const CategoryFilter: React.FC<CategoryFilterProps> = ({ selectedIds, onChange, lang }) => {
  const toggleCategory = (id: string) => {
    if (selectedIds.includes(id)) {
      if (selectedIds.length > 1) {
        onChange(selectedIds.filter(i => i !== id));
      }
    } else {
      onChange([...selectedIds, id]);
    }
  };

  return (
    <div className="flex flex-wrap gap-2 mb-6">
      {BUDGET_CATEGORIES.map((cat) => {
        const isActive = selectedIds.includes(cat.id);
        return (
          <button
            key={cat.id}
            onClick={() => toggleCategory(cat.id)}
            className={`px-4 py-2 rounded-full border transition-all flex items-center gap-2 ${
              isActive 
                ? 'bg-amber-600 border-amber-600 text-white shadow-md' 
                : 'bg-white border-slate-200 text-slate-600 hover:border-amber-300'
            }`}
          >
            <span>{cat.icon}</span>
            <span className="text-sm font-medium">{t(cat.id, lang)}</span>
          </button>
        );
      })}
    </div>
  );
};

export default CategoryFilter;
