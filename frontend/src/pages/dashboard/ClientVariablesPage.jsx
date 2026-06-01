// frontend/src/pages/dashboard/ClientVariablesPage.jsx
import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { usePermissions } from '@/contexts/PermissionsContext';
import { useCompany } from '@/contexts/CompanyContext';
import {
    listClientVariables, createClientVariable, updateClientVariable,
    deleteClientVariable, updateClientVariableAccess, getVariableRanks
} from '@/services/clientsService';
import toast from 'react-hot-toast';
import Spinner from '@/components/ui/Spinner';
import { ArrowLeft, Plus, Settings2, Trash2, Shield, ToggleLeft, Type, Palette, Check, X, Star, Upload, Image as ImageIcon } from 'lucide-react';
import { uploadClientVariableIcon } from '@/services/clientsService';
import ConfirmationModal from '@/components/ui/ConfirmationModal';

// ── Helpers ────────────────────────────────────────────────────────────────────
const TYPE_LABELS = { BOOLEAN: 'Booléen (Oui/Non)', TEXT: 'Texte libre' };

// ── Variable Card ──────────────────────────────────────────────────────────────
const VariableCard = ({ variable, onEdit, onDelete, onAccess }) => {
    const cfg = variable.config || {};
    const hasAccess = (variable.accesses || []).length > 0;

    return (
        <div className="group relative rounded-2xl bg-cca-surface/30 border border-cca-border backdrop-blur-xl overflow-hidden transition-all duration-300 hover:border-brand-primary/30 hover:shadow-xl hover:shadow-brand-primary/5">
            {/* Couleur de prévisualisation */}
            {(cfg.rowBg || cfg.rowBorder) && (
                <div className="h-1 w-full" style={{ background: cfg.rowBg || 'transparent', borderTop: cfg.rowBorder ? `2px solid ${cfg.rowBorder}` : undefined }} />
            )}

            <div className="p-5 space-y-4">
                <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-xl bg-brand-primary/10 border border-brand-primary/20 flex items-center justify-center text-brand-primary">
                            {variable.type === 'BOOLEAN' ? <ToggleLeft size={18} /> : <Type size={18} />}
                        </div>
                        <div>
                            <h3 className="font-black text-cca-textPrimary tracking-tight">{variable.label}</h3>
                            <p className="text-[10px] font-mono text-cca-textSecondary/40 uppercase">{variable.slug} · {TYPE_LABELS[variable.type]}</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button onClick={() => onAccess(variable)} title="Gérer les accès"
                            className="p-2 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 hover:bg-indigo-500 hover:text-white transition-all">
                            <Shield size={14} />
                        </button>
                        <button onClick={() => onEdit(variable)} title="Modifier"
                            className="p-2 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400 hover:bg-amber-500 hover:text-white transition-all">
                            <Settings2 size={14} />
                        </button>
                        <button onClick={() => onDelete(variable)} title="Supprimer"
                            className="p-2 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 hover:bg-rose-500 hover:text-white transition-all">
                            <Trash2 size={14} />
                        </button>
                    </div>
                </div>

                {/* Preview config */}
                <div className="flex flex-wrap gap-2 text-[10px]">
                    {variable.type === 'BOOLEAN' && (
                        <>
                            {cfg.trueLabel && <span className="px-2 py-0.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 font-bold uppercase tracking-wider">✓ {cfg.trueLabel}</span>}
                            {cfg.falseLabel && <span className="px-2 py-0.5 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-400 font-bold uppercase tracking-wider">✗ {cfg.falseLabel}</span>}
                            {cfg.trueIcon && <span className="px-2 py-0.5 rounded-lg bg-cca-surface border border-cca-border text-cca-textSecondary">Icône ON: {cfg.trueIcon}</span>}
                            {cfg.falseIcon && <span className="px-2 py-0.5 rounded-lg bg-cca-surface border border-cca-border text-cca-textSecondary">Icône OFF: {cfg.falseIcon}</span>}
                        </>
                    )}
                    <span className={`px-2 py-0.5 rounded-lg border font-bold uppercase tracking-wider ${hasAccess ? 'bg-indigo-500/10 border-indigo-500/20 text-indigo-400' : 'bg-cca-surface border-cca-border text-cca-textSecondary/40'}`}>
                        <Shield size={10} className="inline mr-1" />
                        {hasAccess ? `${(variable.accesses || []).length} accès` : 'Ouvert à tous'}
                    </span>
                </div>
            </div>
        </div>
    );
};

// ── Variable Form Modal ────────────────────────────────────────────────────────
const VariableFormModal = ({ variable, onClose, onSave }) => {
    const isEdit = Boolean(variable?.id);
    const [form, setForm] = useState({
        label: variable?.label || '',
        type: variable?.type || 'BOOLEAN',
        config: variable?.config || {},
        order: variable?.order ?? 0,
        showInPerks: variable?.showInPerks || false,
        showInCatalog: variable?.showInCatalog || false,
        perksDescription: variable?.perksDescription || '',
        perksPrice: variable?.perksPrice ?? '',
        perksPriceDuration: variable?.perksPriceDuration || '',
        perksIconUrl: variable?.perksIconUrl || null,
    });
    const [saving, setSaving] = useState(false);
    const [uploading, setUploading] = useState(false);

    const set = (key, val) => setForm(p => ({ ...p, [key]: val }));
    const setCfg = (key, val) => setForm(p => ({ ...p, config: { ...p.config, [key]: val } }));

    const handleIconUpload = async (e) => {
        const file = e.target.files[0];
        if (!file || !variable?.id) return;
        
        setUploading(true);
        try {
            const result = await uploadClientVariableIcon(variable.id, file);
            set('perksIconUrl', result.imageUrl);
            toast.success('Icône mise à jour.');
            // Note: we don't need to call onSave here if it only updates the URL on the server,
            // but we might want to refresh the list in the parent. Let's just update the local form state,
            // the user will see it when they save the rest or close.
        } catch (err) {
            toast.error(err.message || 'Erreur lors de l\'upload.');
        } finally {
            setUploading(false);
            e.target.value = ''; // reset file input
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setSaving(true);
        try {
            await onSave(form);
            toast.success(isEdit ? 'Variable modifiée.' : 'Variable créée.');
            onClose();
        } catch (err) {
            toast.error(err.message || 'Erreur.');
        } finally {
            setSaving(false);
        }
    };

    const inputCls = "w-full bg-cca-base/40 border border-cca-border rounded-xl px-4 py-3 text-sm text-white outline-none focus:border-brand-primary transition-all";
    const labelCls = "block text-[10px] font-black uppercase tracking-widest text-cca-textSecondary/60 mb-1";
    const colorInputCls = "h-9 w-16 rounded-lg border border-cca-border bg-cca-base/40 cursor-pointer";

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={onClose}>
            <div className="relative w-full max-w-lg rounded-3xl bg-cca-surface border border-cca-border shadow-2xl overflow-hidden" onClick={e => e.stopPropagation()}>
                <div className="p-6 border-b border-cca-border flex items-center justify-between">
                    <h2 className="font-black text-white text-lg">{isEdit ? 'Modifier la variable' : 'Nouvelle variable'}</h2>
                    <button onClick={onClose} className="p-2 rounded-xl hover:bg-cca-base/40 text-cca-textSecondary transition-all"><X size={18} /></button>
                </div>

                <form onSubmit={handleSubmit} className="p-6 space-y-5 max-h-[75vh] overflow-y-auto">
                    <div><label className={labelCls}>Libellé *</label>
                        <input className={inputCls} value={form.label} onChange={e => set('label', e.target.value)} placeholder="Ex: VIP, Blacklist, Niveau..." required />
                    </div>

                    <div><label className={labelCls}>Type</label>
                        <select className={inputCls} value={form.type} onChange={e => set('type', e.target.value)} disabled={isEdit}>
                            <option value="BOOLEAN">Booléen (Oui/Non)</option>
                            <option value="TEXT">Texte libre</option>
                        </select>
                        {isEdit && <p className="text-[10px] text-amber-400/60 mt-1">Le type ne peut pas être changé après création.</p>}
                    </div>

                    <div><label className={labelCls}>Ordre d'affichage</label>
                        <input type="number" className={inputCls} value={form.order} onChange={e => set('order', parseInt(e.target.value) || 0)} />
                    </div>

                    {form.type === 'BOOLEAN' && (
                        <div className="space-y-4 p-4 rounded-2xl bg-cca-base/30 border border-cca-border">
                            <p className="text-[10px] font-black uppercase tracking-widest text-cca-textSecondary/60">Configuration Booléen</p>
                            <div className="grid grid-cols-2 gap-4">
                                <div><label className={labelCls}>Libellé si VRAI</label>
                                    <input className={inputCls} value={form.config.trueLabel || ''} onChange={e => setCfg('trueLabel', e.target.value)} placeholder="Ex: VIP" />
                                </div>
                                <div><label className={labelCls}>Libellé si FAUX</label>
                                    <input className={inputCls} value={form.config.falseLabel || ''} onChange={e => setCfg('falseLabel', e.target.value)} placeholder="Ex: Standard" />
                                </div>
                                <div><label className={labelCls}>Icône si VRAI (emoji)</label>
                                    <input className={inputCls} value={form.config.trueIcon || ''} onChange={e => setCfg('trueIcon', e.target.value)} placeholder="⭐" />
                                </div>
                                <div><label className={labelCls}>Icône si FAUX (emoji)</label>
                                    <input className={inputCls} value={form.config.falseIcon || ''} onChange={e => setCfg('falseIcon', e.target.value)} placeholder="—" />
                                </div>
                            </div>
                        </div>
                    )}

                    <div className="space-y-4 p-4 rounded-2xl bg-cca-base/30 border border-cca-border">
                        <p className="text-[10px] font-black uppercase tracking-widest text-cca-textSecondary/60 flex items-center gap-2"><Palette size={12} /> Couleurs de ligne</p>
                        <div className="grid grid-cols-2 gap-4">
                            <div><label className={labelCls}>Fond de ligne</label>
                                <div className="flex items-center gap-2">
                                    <input type="color" className={colorInputCls} value={form.config.rowBg || '#000000'} onChange={e => setCfg('rowBg', e.target.value)} />
                                    <input className={`${inputCls} flex-1`} value={form.config.rowBg || ''} onChange={e => setCfg('rowBg', e.target.value)} placeholder="transparent" />
                                    {form.config.rowBg && <button type="button" onClick={() => setCfg('rowBg', '')} className="text-rose-400 hover:text-rose-300"><X size={14} /></button>}
                                </div>
                            </div>
                            <div><label className={labelCls}>Bordure de ligne</label>
                                <div className="flex items-center gap-2">
                                    <input type="color" className={colorInputCls} value={form.config.rowBorder || '#000000'} onChange={e => setCfg('rowBorder', e.target.value)} />
                                    <input className={`${inputCls} flex-1`} value={form.config.rowBorder || ''} onChange={e => setCfg('rowBorder', e.target.value)} placeholder="aucune" />
                                    {form.config.rowBorder && <button type="button" onClick={() => setCfg('rowBorder', '')} className="text-rose-400 hover:text-rose-300"><X size={14} /></button>}
                                </div>
                            </div>
                        </div>
                        <div>
                            <label className={labelCls}>Transparence du fond ({Math.round((form.config.rowOpacity ?? 1) * 100)}%)</label>
                            <input
                                type="range" min="0" max="1" step="0.05"
                                value={form.config.rowOpacity ?? 1}
                                onChange={e => setCfg('rowOpacity', parseFloat(e.target.value))}
                                className="w-full accent-brand-primary"
                            />
                            <div className="flex justify-between text-[9px] text-cca-textSecondary/30 mt-1">
                                <span>0% (invisible)</span><span>100% (opaque)</span>
                            </div>
                        </div>
                    </div>

                    <div className="space-y-4 p-4 rounded-2xl bg-cca-base/30 border border-cca-border">
                        <p className="text-[10px] font-black uppercase tracking-widest text-cca-textSecondary/60 flex items-center gap-2"><Star size={12} /> Avantages Clients (Perks)</p>
                        
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div className="flex items-center gap-3 bg-cca-base/20 p-3 rounded-xl border border-cca-border/50">
                                <input 
                                    type="checkbox" 
                                    id="showInPerks"
                                    checked={form.showInPerks} 
                                    onChange={e => set('showInPerks', e.target.checked)}
                                    className="w-5 h-5 accent-brand-primary cursor-pointer rounded"
                                />
                                <div className="flex flex-col">
                                    <label htmlFor="showInPerks" className="text-sm font-bold text-white cursor-pointer select-none">
                                        Afficher dans "Mes avantages"
                                    </label>
                                    <span className="text-[9px] text-cca-textSecondary/60 leading-tight">Visible seulement si le client possède cette variable.</span>
                                </div>
                            </div>

                            <div className="flex items-center gap-3 bg-cca-base/20 p-3 rounded-xl border border-cca-border/50">
                                <input 
                                    type="checkbox" 
                                    id="showInCatalog"
                                    checked={form.showInCatalog} 
                                    onChange={e => set('showInCatalog', e.target.checked)}
                                    className="w-5 h-5 accent-emerald-500 cursor-pointer rounded"
                                />
                                <div className="flex flex-col">
                                    <label htmlFor="showInCatalog" className="text-sm font-bold text-white cursor-pointer select-none">
                                        Afficher dans "Catalogue"
                                    </label>
                                    <span className="text-[9px] text-cca-textSecondary/60 leading-tight">Visible publiquement par tous dans le catalogue global.</span>
                                </div>
                            </div>
                        </div>
                        
                        {(form.showInPerks || form.showInCatalog) && (
                            <div className="mt-4 space-y-4 animate-in fade-in slide-in-from-top-2 duration-300">
                                
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className={labelCls}>Prix de l'avantage ($)</label>
                                        <input 
                                            type="number" 
                                            step="0.01"
                                            className={inputCls} 
                                            value={form.perksPrice} 
                                            onChange={e => set('perksPrice', e.target.value)} 
                                            placeholder="Ex: 5000" 
                                        />
                                    </div>
                                    <div>
                                        <label className={labelCls}>Récurrence (texte libre)</label>
                                        <input 
                                            className={inputCls} 
                                            value={form.perksPriceDuration} 
                                            onChange={e => set('perksPriceDuration', e.target.value)} 
                                            placeholder="Ex: À vie, Par semaine, etc." 
                                        />
                                    </div>
                                </div>

                                <div>
                                    <label className={labelCls}>Description de l'avantage (Markdown autorisé)</label>
                                    <textarea 
                                        className={`${inputCls} min-h-[100px] resize-y font-mono text-xs`} 
                                        value={form.perksDescription} 
                                        onChange={e => set('perksDescription', e.target.value)} 
                                        placeholder="Ex: En tant que VIP, bénéficiez de -10% sur toutes vos commandes..." 
                                    />
                                    <p className="text-[10px] text-cca-textSecondary/60 mt-1">
                                        Cette description sera affichée au client selon les options de visibilité choisies ci-dessus.
                                    </p>
                                </div>
                                
                                {isEdit ? (
                                    <div className="pt-2 border-t border-cca-border/50">
                                        <label className={labelCls}>Icône personnalisée (Optionnelle, max 256x256)</label>
                                        <div className="flex items-center gap-4 mt-2">
                                            <div className="w-16 h-16 rounded-xl bg-cca-base border border-cca-border flex items-center justify-center overflow-hidden shrink-0">
                                                {form.perksIconUrl ? (
                                                    <img src={form.perksIconUrl} alt="Icon" className="w-full h-full object-contain" />
                                                ) : (
                                                    <ImageIcon className="text-cca-textSecondary/40" size={24} />
                                                )}
                                            </div>
                                            <div className="flex-1">
                                                <label className="relative inline-flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white text-xs font-semibold rounded-lg cursor-pointer transition-colors border border-slate-700">
                                                    {uploading ? <Spinner size={14} /> : <Upload size={14} />}
                                                    <span>{uploading ? 'Upload en cours...' : 'Choisir une image'}</span>
                                                    <input 
                                                        type="file" 
                                                        accept="image/png, image/jpeg, image/webp" 
                                                        className="hidden" 
                                                        onChange={handleIconUpload}
                                                        disabled={uploading}
                                                    />
                                                </label>
                                                <p className="text-[10px] text-cca-textSecondary/60 mt-1.5">
                                                    Format WebP, PNG ou JPG. L'image sera automatiquement redimensionnée et convertie en WebP. Les GIFs sont refusés.
                                                </p>
                                            </div>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="pt-2 border-t border-cca-border/50">
                                        <p className="text-[10px] text-amber-400/80 italic">
                                            Pour uploader une icône personnalisée, veuillez d'abord créer cette variable.
                                        </p>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>

                    <button type="submit" disabled={saving}
                        className="w-full py-3.5 rounded-2xl bg-brand-primary text-white font-black text-[10px] uppercase tracking-widest shadow-xl shadow-brand-primary/20 hover:brightness-110 active:scale-95 transition-all disabled:opacity-50">
                        {saving ? 'Sauvegarde...' : isEdit ? 'Enregistrer les modifications' : 'Créer la variable'}
                    </button>
                </form>
            </div>
        </div>
    );
};

// ── Access Modal ───────────────────────────────────────────────────────────────
const AccessModal = ({ variable, ranks, onClose, onSave }) => {
    const currentUserIds = (variable.accesses || []).filter(a => a.kind === 'USER').map(a => a.userId);
    const currentRankIds = (variable.accesses || []).filter(a => a.kind === 'RANK').map(a => a.rankId);
    const [selectedRanks, setSelectedRanks] = useState(new Set(currentRankIds));
    const [saving, setSaving] = useState(false);

    const toggle = (id) => setSelectedRanks(prev => {
        const next = new Set(prev);
        next.has(id) ? next.delete(id) : next.add(id);
        return next;
    });

    const handleSave = async () => {
        setSaving(true);
        try {
            await onSave(variable.id, { rankIds: Array.from(selectedRanks), userIds: currentUserIds });
            toast.success('Accès mis à jour.');
            onClose();
        } catch (err) {
            toast.error(err.message || 'Erreur.');
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={onClose}>
            <div className="relative w-full max-w-md rounded-3xl bg-cca-surface border border-cca-border shadow-2xl overflow-hidden" onClick={e => e.stopPropagation()}>
                <div className="p-6 border-b border-cca-border flex items-center justify-between">
                    <div>
                        <h2 className="font-black text-white">Accès — {variable.label}</h2>
                        <p className="text-[10px] text-cca-textSecondary/40 mt-0.5">Qui peut modifier cette variable</p>
                    </div>
                    <button onClick={onClose} className="p-2 rounded-xl hover:bg-cca-base/40 text-cca-textSecondary transition-all"><X size={18} /></button>
                </div>

                <div className="p-6 space-y-3 max-h-[60vh] overflow-y-auto">
                    {!ranks.length && <p className="text-cca-textSecondary/40 text-sm text-center py-4">Aucun rang disponible</p>}
                    {ranks.map(rank => (
                        <button key={rank.id} onClick={() => toggle(rank.id)} className={`w-full flex items-center justify-between px-4 py-3 rounded-xl border transition-all ${selectedRanks.has(rank.id) ? 'bg-brand-primary/10 border-brand-primary/30 text-brand-primary' : 'bg-cca-base/30 border-cca-border text-cca-textPrimary hover:border-cca-border/80'}`}>
                            <span className="font-bold text-sm">{rank.name}</span>
                            {selectedRanks.has(rank.id) && <Check size={16} />}
                        </button>
                    ))}
                    {selectedRanks.size === 0 && (
                        <p className="text-[10px] text-amber-400/70 text-center">⚠ Aucun rang sélectionné = tous les utilisateurs avec CLIENTS_VIEW peuvent modifier</p>
                    )}
                </div>

                <div className="p-4 border-t border-cca-border">
                    <button onClick={handleSave} disabled={saving}
                        className="w-full py-3 rounded-2xl bg-brand-primary text-white font-black text-[10px] uppercase tracking-widest hover:brightness-110 active:scale-95 transition-all disabled:opacity-50">
                        {saving ? 'Sauvegarde...' : 'Enregistrer les accès'}
                    </button>
                </div>
            </div>
        </div>
    );
};

// ── Page Principale ────────────────────────────────────────────────────────────
const ClientVariablesPage = () => {
    const { has } = usePermissions();
    const { activeCompanyId } = useCompany();
    const [variables, setVariables] = useState([]);
    const [ranks, setRanks] = useState([]);
    const [loading, setLoading] = useState(true);
    const [editModal, setEditModal] = useState(null); // null | variable object | {}
    const [accessModal, setAccessModal] = useState(null);
    const [confirmModal, setConfirmModal] = useState({ isOpen: false, message: '', onConfirm: null });

    const load = useCallback(async () => {
        setLoading(true);
        try {
            const [vars] = await Promise.all([listClientVariables()]);
            setVariables(vars);
        } catch {
            toast.error('Erreur de chargement.');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { load(); }, [load]);

    // Charger les rangs pour l'ACL
    useEffect(() => {
        getVariableRanks()
            .then(r => {
                const list = Array.isArray(r) ? r : [];
                setRanks(list);
            })
            .catch(() => {});
    }, [activeCompanyId]);

    const handleSave = async (form) => {
        if (editModal?.id) {
            const updated = await updateClientVariable(editModal.id, form);
            setVariables(prev => prev.map(v => v.id === updated.id ? updated : v));
        } else {
            const created = await createClientVariable(form);
            setVariables(prev => [...prev, created]);
        }
    };

    const handleDelete = (variable) => {
        setConfirmModal({
            isOpen: true,
            message: `Supprimer la variable "${variable.label}" ? Toutes les valeurs associées seront perdues.`,
            onConfirm: async () => {
                setConfirmModal(p => ({ ...p, isOpen: false }));
                try {
                    await deleteClientVariable(variable.id);
                    setVariables(prev => prev.filter(v => v.id !== variable.id));
                    toast.success('Variable supprimée.');
                } catch (e) {
                    toast.error(e.message || 'Erreur.');
                }
            },
        });
    };

    const handleAccessSave = async (variableId, access) => {
        const updated = await updateClientVariableAccess(variableId, access);
        setVariables(prev => prev.map(v => v.id === updated.id ? updated : v));
    };

    if (!has('clients.variables.manage')) {
        return (
            <div className="flex flex-col items-center justify-center py-24 text-center space-y-4">
                <Shield size={48} className="text-rose-500/40" />
                <p className="text-rose-500 font-black uppercase tracking-widest">Permission refusée</p>
                <Link to="/dashboard/company/clients" className="text-xs font-bold text-brand-primary hover:underline">← Retour aux clients</Link>
            </div>
        );
    }

    return (
        <div className="max-w-[1200px] mx-auto space-y-8 pb-12 animate-in fade-in duration-700">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
                <div className="space-y-2">
                    <Link to="/dashboard/company/clients" className="group inline-flex items-center gap-2 text-cca-textSecondary/60 hover:text-brand-primary text-[10px] font-black uppercase tracking-widest transition-all">
                        <ArrowLeft size={14} /> Retour aux clients
                    </Link>
                    <p className="text-[10px] font-black uppercase tracking-[0.4em] text-brand-primary opacity-70">Gestion Avancée</p>
                    <h1 className="text-4xl font-black tracking-tighter text-cca-textPrimary font-heading">
                        Variables <span className="text-brand-primary">Clients</span>
                    </h1>
                    <p className="text-sm text-cca-textSecondary/50">Personnalisez l'affichage des clients avec des paramètres custom par entreprise.</p>
                </div>
                <button onClick={() => setEditModal({})}
                    className="inline-flex items-center gap-2 px-6 py-3.5 rounded-2xl bg-brand-primary text-white font-black text-[10px] uppercase tracking-widest shadow-xl shadow-brand-primary/20 hover:brightness-110 active:scale-95 transition-all">
                    <Plus size={16} /> Nouvelle variable
                </button>
            </div>

            {/* Content */}
            <div className="rounded-3xl bg-cca-surface/20 border border-cca-border backdrop-blur-3xl shadow-2xl p-8 space-y-6">
                {loading ? (
                    <div className="flex justify-center py-16"><Spinner /></div>
                ) : variables.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-20 text-center space-y-4 opacity-40">
                        <Settings2 size={48} />
                        <p className="font-black uppercase tracking-widest text-sm">Aucune variable configurée</p>
                        <p className="text-xs text-cca-textSecondary">Créez votre première variable pour enrichir les fiches clients.</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                        {variables.map(v => (
                            <VariableCard key={v.id} variable={v}
                                onEdit={setEditModal}
                                onDelete={handleDelete}
                                onAccess={setAccessModal}
                            />
                        ))}
                    </div>
                )}
            </div>

            {/* Modals */}
            {editModal !== null && (
                <VariableFormModal variable={editModal} onClose={() => setEditModal(null)} onSave={handleSave} />
            )}
            {accessModal !== null && (
                <AccessModal variable={accessModal} ranks={ranks} onClose={() => setAccessModal(null)} onSave={handleAccessSave} />
            )}
            <ConfirmationModal
                isOpen={confirmModal.isOpen}
                onClose={() => setConfirmModal(p => ({ ...p, isOpen: false }))}
                onConfirm={confirmModal.onConfirm}
                message={confirmModal.message}
            />
        </div>
    );
};

export default ClientVariablesPage;
