// frontend/src/components/widgets/DeclarePartnerServiceWidget.jsx

import React, { useEffect, useState } from 'react';
import { useCompany } from '@/contexts/CompanyContext';
import { api } from '@/services/api';
import { Pencil, Trash2, Check, X } from 'lucide-react';

export default function DeclarePartnerServiceWidget({ className = '' }) {
    const { activeCompanyId } = useCompany();
    const companyId = activeCompanyId;

    const [loading, setLoading] = useState(true);
    const [partners, setPartners] = useState([]);
    const [services, setServices] = useState([]);

    const [selectedPartnerId, setSelectedPartnerId] = useState(null);
    const [selectedServiceId, setSelectedServiceId] = useState(null);

    const [quantity, setQuantity] = useState('');

    const [history, setHistory] = useState([]);

    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState(null);
    const [successMsg, setSuccessMsg] = useState(null);

    const [editRow, setEditRow] = useState(null); // id du service rendu en cours d'édition
    const [editQuantity, setEditQuantity] = useState('');

    const baseInput =
        'w-full bg-cca-base/40 text-cca-textPrimary font-bold placeholder:text-cca-textSecondary/30 border border-cca-border/20 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-1 focus:ring-brand-primary/50 transition-all';
    const selectClass = baseInput + ' appearance-none relative';

    /* =========================================================================
       CHARGEMENT DES PARTENAIRES + HISTORIQUE
       ========================================================================= */
    useEffect(() => {
        let cancelled = false;

        async function load() {
            if (!companyId) {
                setLoading(false);
                return;
            }

            setLoading(true);
            setError(null);

            try {
                // PARTENAIRES
                const resPartners = await api.get('/partenariat/wdg_list');
                const p = Array.isArray(resPartners.data) ? resPartners.data : [];
                if (!cancelled) {
                    setPartners(p);
                    setSelectedPartnerId(p.length > 0 ? p[0].id : null);
                }

                // HISTORIQUE (5 derniers)
                const resHistory = await api.get('/partenariat/services-rendered', {
                    params: { limit: 5 }
                });

                const h = Array.isArray(resHistory.data) ? resHistory.data : [];
                if (!cancelled) setHistory(h);

            } catch (err) {
                if (!cancelled) setError(err?.message || 'Erreur de chargement.');
            } finally {
                if (!cancelled) setLoading(false);
            }
        }

        load();
        return () => (cancelled = true);
    }, [companyId]);

    /* =========================================================================
       CHARGEMENT DES SERVICES du partenaire sélectionné
       ========================================================================= */
    useEffect(() => {
        if (!selectedPartnerId) {
            setServices([]);
            return;
        }

        let cancelled = false;

        async function loadServices() {
            try {
                const res = await api.get(`/partenariat/${selectedPartnerId}/services_widgets`);
                const s = Array.isArray(res.data) ? res.data : [];
                if (!cancelled) {
                    setServices(s);
                    setSelectedServiceId(s.length > 0 ? s[0].id : null);
                }
            } catch {
                if (!cancelled) setServices([]);
            }
        }

        loadServices();
        return () => (cancelled = true);
    }, [selectedPartnerId]);

    /* =========================================================================
       DÉCLARATION
       ========================================================================= */
    const handleDeclare = async () => {
        setError(null);
        setSuccessMsg(null);

        if (!companyId) return setError("Aucune entreprise sélectionnée.");
        if (!selectedPartnerId) return setError("Sélectionnez un partenaire.");
        if (!selectedServiceId) return setError("Sélectionnez un service.");

        const q = Number.parseInt(quantity);
        if (!Number.isFinite(q) || q <= 0) return setError("Quantité invalide.");

        try {
            setSubmitting(true);

            await api.post('/partenariat/services-rendered', {
                partnerId: selectedPartnerId,
                serviceTypeId: selectedServiceId,
                quantity: q,
            });

            setQuantity('');
            setSuccessMsg("Service déclaré !");
            setTimeout(() => setSuccessMsg(null), 2500);

            // Recharger l'historique
            const res = await api.get('/partenariat/services-rendered', { params: { limit: 5 } });
            setHistory(Array.isArray(res.data) ? res.data : []);

        } catch (err) {
            setError(err?.response?.data?.message || 'Erreur lors de la déclaration.');
        } finally {
            setSubmitting(false);
        }
    };

    /* =========================================================================
       SUPPRIMER une déclaration
       ========================================================================= */
    const handleDelete = async (id) => {
        try {
            await api.delete(`/partenariat/services-rendered/${id}`);
            setHistory((prev) => prev.filter((h) => h.id !== id));
        } catch (_err) {
            setError("Impossible de supprimer cette déclaration.");
        }
    };

    /* =========================================================================
       EDIT INLINE
       ========================================================================= */
    const startEdit = (row) => {
        setEditRow(row.id);
        setEditQuantity(row.quantity);
    };

    const cancelEdit = () => {
        setEditRow(null);
        setEditQuantity('');
    };

    const saveEdit = async (row) => {
        const q = Number.parseInt(editQuantity);
        if (!Number.isFinite(q) || q <= 0) {
            setError("Quantité invalide.");
            return;
        }

        try {
            await api.put(`/partenariat/services-rendered/${row.id}`, {
                quantity: q,
            });

            // mettre à jour localement
            setHistory((prev) =>
                prev.map((h) =>
                    h.id === row.id ? { ...h, quantity: q } : h
                )
            );

        } catch {
            setError("Erreur lors de la modification.");
        } finally {
            cancelEdit();
        }
    };

    /* =========================================================================
       RENDU
       ========================================================================= */

    if (!companyId) return <div className="p-10 text-center text-cca-textSecondary/60 italic uppercase tracking-widest text-[10px]">Sélectionnez une entreprise</div>;
    if (loading) return <div className="p-10 text-center text-cca-textSecondary/60 italic uppercase tracking-widest text-[10px]">Chargement…</div>;

    return (
        <div className={`${className} h-full flex flex-col`}>
            <h3 className="text-[10px] font-black uppercase tracking-[0.3em] text-cca-textSecondary/40 mb-6 border-b border-cca-border/20 pb-4 flex-shrink-0">
                Déclaration de Service Partenaire
            </h3>

            {error && <div className="text-[10px] font-black uppercase text-rose-400 mb-4 bg-rose-400/10 p-2 rounded-lg border border-rose-400/20">{String(error)}</div>}
            {successMsg && <div className="text-[10px] font-black uppercase text-emerald-400 mb-4 bg-emerald-400/10 p-2 rounded-lg border border-emerald-400/20">{String(successMsg)}</div>}

            {/* PARTENAIRE */}
            <div className="mb-4">
                <label className="block text-[10px] font-black uppercase tracking-widest text-cca-textSecondary/40 mb-2 ml-1">Entité Partenaire</label>
                <div className="relative">
                    <select
                        value={selectedPartnerId ?? ''}
                        onChange={(e) => setSelectedPartnerId(Number(e.target.value))}
                        className={selectClass}
                    >
                        {partners.map((p) => (
                            <option key={p.id} value={p.id} className="bg-cca-surface">
                                {p.name}
                            </option>
                        ))}
                    </select>
                    <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-cca-textSecondary/40">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" /></svg>
                    </div>
                </div>
            </div>

            {/* SERVICE */}
            <div className="mb-4">
                <label className="block text-[10px] font-black uppercase tracking-widest text-cca-textSecondary/40 mb-2 ml-1">Prestation Fournie</label>
                <div className="relative">
                    <select
                        value={selectedServiceId ?? ''}
                        onChange={(e) => setSelectedServiceId(Number(e.target.value))}
                        className={selectClass}
                        disabled={services.length === 0}
                    >
                        {services.length === 0 ? (
                            <option className="bg-cca-surface">Aucun service disponible</option>
                        ) : (
                            services.map((s) => (
                                <option key={s.id} value={s.id} className="bg-cca-surface">
                                    {s.name} — {s.partnerPrice} $
                                </option>
                            ))
                        )}
                    </select>
                    <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-cca-textSecondary/40">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" /></svg>
                    </div>
                </div>
            </div>

            {/* QUANTITÉ */}
            <div className="mb-6">
                <div className="flex justify-between items-center mb-2 ml-1">
                    <label className="block text-[10px] font-black uppercase tracking-widest text-cca-textSecondary/40">Volume d'Unités</label>
                    <code className="text-[9px] text-brand-primary opacity-60 uppercase font-black">Indice Quantité ≠ Prix</code>
                </div>
                <input
                    type="number"
                    min="1"
                    className={baseInput}
                    placeholder="Saisissez la quantité (ex: 1)"
                    value={quantity}
                    onChange={(e) => setQuantity(e.target.value)}
                />
            </div>

            <button
                onClick={handleDeclare}
                disabled={submitting || !selectedServiceId}
                className="w-full py-4 bg-brand-primary text-white font-black text-xs uppercase tracking-[0.2em] rounded-xl shadow-xl shadow-brand-primary/20 hover:bg-brand-primary/80 transition-all active:scale-[0.98] disabled:opacity-50 disabled:grayscale disabled:cursor-not-allowed"
            >
                {submitting ? 'ENREGISTREMENT...' : 'CONFIRMER LA PRESTATION'}
            </button>

            {/* HISTORIQUE */}
            <h5 className="text-[10px] font-black uppercase tracking-[0.2em] text-cca-textSecondary/40 mt-10 mb-4 border-b border-cca-border/20 pb-4">Historique de Collaboration (5 derniers)</h5>

            {history.length === 0 ? (
                <div className="text-[10px] font-black uppercase text-cca-textSecondary/30 italic text-center py-6">Aucune archive</div>
            ) : (
                <ul className="space-y-2 pb-4">
                    {history.map((h) => (
                        <li
                            key={h.id}
                            className="p-4 border border-cca-border/10 bg-cca-base/20 rounded-xl hover:bg-cca-surface/10 transition-colors group"
                        >
                            <div className="flex justify-between items-center">
                                <div className="min-w-0 flex-1 mr-4">
                                    <div className="text-xs font-black text-cca-textPrimary group-hover:text-brand-primary transition-colors truncate">
                                        {h.partner?.name ?? "PARTENAIRE INCONNU"}
                                    </div>
                                    <div className="text-[9px] font-bold text-cca-textSecondary/60 mt-0.5 uppercase tracking-tighter">
                                        {h.serviceType?.name} — <span className="text-emerald-400">{h.quantity} UNITÉS × {h.unitPrice} $</span>
                                    </div>
                                </div>

                                <div className="flex gap-2 flex-shrink-0">

                                    {/* EDIT MODE */}
                                    {editRow === h.id ? (
                                        <div className="flex items-center gap-1 bg-cca-surface/40 p-1 rounded-lg border border-cca-border/20 shadow-inner">
                                            <input
                                                type="number"
                                                min="1"
                                                className="bg-cca-base/40 border border-cca-border/20 rounded px-2 py-1 text-xs font-black w-14 outline-none focus:ring-1 focus:ring-brand-primary"
                                                value={editQuantity}
                                                onChange={(e) => setEditQuantity(e.target.value)}
                                            />

                                            <button
                                                className="p-1 text-emerald-400 hover:bg-emerald-400/10 rounded transition-colors"
                                                onClick={() => saveEdit(h)}
                                            >
                                                <Check size={16} />
                                            </button>

                                            <button
                                                className="p-1 text-rose-400 hover:bg-rose-400/10 rounded transition-colors"
                                                onClick={cancelEdit}
                                            >
                                                <X size={16} />
                                            </button>
                                        </div>
                                    ) : (
                                        <div className="flex items-center gap-1">
                                            <button
                                                className="p-2 text-cca-textSecondary/40 hover:text-brand-primary hover:bg-brand-primary/10 rounded-lg transition-all"
                                                onClick={() => startEdit(h)}
                                                title="Modifier la quantité"
                                            >
                                                <Pencil size={14} />
                                            </button>

                                            <button
                                                className="p-2 text-cca-textSecondary/40 hover:text-rose-400 hover:bg-rose-400/10 rounded-lg transition-all"
                                                onClick={() => handleDelete(h.id)}
                                                title="Supprimer la déclaration"
                                            >
                                                <Trash2 size={14} />
                                            </button>
                                        </div>
                                    )}

                                </div>
                            </div>
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
}
