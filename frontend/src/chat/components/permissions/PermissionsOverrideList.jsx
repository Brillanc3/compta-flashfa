import React from 'react';
import { ChevronDown, Trash2 } from 'lucide-react';
import SearchableSelect from './SearchableSelect';
import PermissionsMatrix from './PermissionsMatrix';

export default function PermissionsOverrideList({
    overrides, expandedId, onToggle, onRemove, catalog, onChangePerm,
    idKey, nameKey, Icon,
    availableItems, onAdd, placeholder, labelKey, valueKey,
    scope,
}) {
    const entityLabel = idKey === 'rankId' ? 'rôle' : 'utilisateur';

    return (
        <div className="space-y-3">
            <div className="flex items-center justify-between mb-1">
                <h3 className="text-[10px] font-bold uppercase tracking-widest text-cca-textSecondary/70">
                    {idKey === 'rankId' ? 'Rôles avec overrides' : 'Utilisateurs avec overrides'}
                </h3>
                <SearchableSelect
                    options={availableItems}
                    placeholder={placeholder}
                    onSelect={(id) => onAdd(Number(id))}
                    labelKey={labelKey}
                    valueKey={valueKey}
                />
            </div>

            {overrides.length === 0 && (
                <div className="text-xs text-cca-textSecondary/60 italic p-4 bg-cca-base/30 rounded-xl border border-cca-border/50 text-center">
                    Aucun {entityLabel} spécifique configuré pour {scope === 'category' ? 'cette catégorie' : 'ce salon'}.
                </div>
            )}

            <div className="mt-2 space-y-2">
                {overrides.map((item) => {
                    const id = item[idKey];
                    return (
                        <div key={id} className="rounded-xl border border-cca-border bg-cca-surface/40 backdrop-blur-xl overflow-hidden shadow-sm">
                            <button type="button"
                                className="w-full flex items-center justify-between px-4 py-3 text-sm font-bold text-cca-textPrimary hover:bg-cca-surface transition-colors"
                                onClick={() => onToggle(id)}>
                                <div className="flex items-center gap-3">
                                    <div className="p-1.5 rounded-lg bg-cca-base border border-cca-border">
                                        <Icon className="w-3.5 h-3.5 text-brand-primary" />
                                    </div>
                                    <span>{item[nameKey]}</span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <button type="button"
                                        onClick={(e) => { e.stopPropagation(); onRemove(id); }}
                                        className="p-1.5 rounded-lg bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 transition-all active:scale-95">
                                        <Trash2 className="w-3.5 h-3.5 text-red-400" />
                                    </button>
                                    <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform ${expandedId === id ? 'rotate-180' : ''}`} />
                                </div>
                            </button>
                            {expandedId === id && (
                                <div className="px-3 pb-3">
                                    <PermissionsMatrix
                                        override={item}
                                        catalog={catalog}
                                        onChangePerm={(permKey, val) => onChangePerm(id, permKey, val)}
                                    />
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
