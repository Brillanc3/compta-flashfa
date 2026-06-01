import React, { useEffect, useState } from 'react';
import { X, LayoutTemplate, Loader2, Zap } from 'lucide-react';
import automationService from '../../services/automationService';

/**
 * Catalogue de modèles de workflows prêts à l'emploi.
 * Affiche les modèles groupés par catégorie ; au clic, remonte le modèle choisi
 * via onSelect (le parent gère le chargement dans le workspace + confirmation).
 */
const TemplateCatalogModal = ({ isOpen, onClose, onSelect }) => {
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!isOpen) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    automationService.getTemplates()
      .then((data) => { if (!cancelled) setTemplates(data); })
      .catch(() => { if (!cancelled) setError('Impossible de charger le catalogue.'); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [isOpen]);

  if (!isOpen) return null;

  // Regroupe par catégorie en conservant l'ordre d'apparition.
  const byCategory = templates.reduce((acc, t) => {
    (acc[t.category] = acc[t.category] || []).push(t);
    return acc;
  }, {});

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="flex flex-col w-full max-w-3xl max-h-[85vh] bg-[#1e293b] rounded-2xl border border-slate-700 shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-slate-700">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-indigo-600 rounded-lg">
              <LayoutTemplate size={20} className="text-white" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white">Catalogue de modèles</h2>
              <p className="text-xs text-slate-400">Démarrez d'un workflow prêt à l'emploi</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 transition-colors rounded-lg hover:text-white hover:bg-slate-700/50"
          >
            <X size={20} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 p-5 overflow-y-auto">
          {loading && (
            <div className="flex items-center justify-center gap-2 py-16 text-slate-400">
              <Loader2 size={20} className="animate-spin" /> Chargement…
            </div>
          )}

          {error && !loading && (
            <div className="py-16 text-center text-red-400">{error}</div>
          )}

          {!loading && !error && templates.length === 0 && (
            <div className="py-16 text-center text-slate-400">Aucun modèle disponible.</div>
          )}

          {!loading && !error && Object.entries(byCategory).map(([category, items]) => (
            <div key={category} className="mb-6 last:mb-0">
              <h3 className="mb-3 text-xs font-bold tracking-wider uppercase text-slate-500">{category}</h3>
              <div className="grid gap-3 sm:grid-cols-2">
                {items.map((t) => (
                  <button
                    key={t.id}
                    onClick={() => onSelect(t)}
                    className="flex flex-col items-start gap-1 p-4 text-left transition-all border rounded-xl bg-slate-800/60 border-slate-700 hover:border-indigo-500 hover:bg-slate-800 active:scale-[0.98] group"
                  >
                    <div className="flex items-center w-full gap-2">
                      <span
                        className="inline-block w-2.5 h-2.5 rounded-full shrink-0"
                        style={{ backgroundColor: t.color || '#6366F1' }}
                      />
                      <span className="font-semibold text-white">{t.name}</span>
                      <Zap size={14} className="ml-auto text-slate-600 transition-colors group-hover:text-indigo-400" />
                    </div>
                    <p className="text-xs leading-relaxed text-slate-400">{t.description}</p>
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default TemplateCatalogModal;
