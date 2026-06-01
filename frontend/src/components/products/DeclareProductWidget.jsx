// /frontend/src/components/products/DeclareProductWidget.jsx

import React, { useEffect, useState } from 'react';
import { useCompany } from '@/contexts/CompanyContext';
import * as productsService from '@/services/productsService';

/**
 * Widget : Déclaration de production produit
 * - L'utilisateur choisit un produit (filtré selon son rang par l'API de widget si dispo)
 * - Saisit une quantité produite
 * - Le backend calcule la rémunération
 *
 * Points de robustesse :
 * - Supporte plusieurs variantes de services :
 *   - productsService.fetchWidgetDataDeclareProduct(companyId) -> { products }
 *   - productsService.fetchDeclareWidget(companyId) -> { products }
 *   - (fallback) productsService.fetchProducts(companyId, { activeOnly: true }) -> { products }
 * - Garde-fous pour Array.isArray, .length, .find, .toFixed, etc.
 * - Affiche "Aucun produit à sélectionner" sans crasher quand products est vide/indéfini.
 */

export default function DeclareProductWidget({ className = '' }) {
    const { activeCompanyId } = useCompany();
    const companyId = Number(activeCompanyId);

    const [loading, setLoading] = useState(true);
    const [products, setProducts] = useState([]);               // toujours un tableau
    const [declarations, setDeclarations] = useState([]);       // toujours un tableau
    const [selectedProductId, setSelectedProductId] = useState(null);
    const [quantity, setQuantity] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState(null);
    const [successMsg, setSuccessMsg] = useState(null);

    // Styles locaux
    const baseInput =
        'w-full bg-cca-base/40 text-cca-textPrimary font-bold placeholder:text-cca-textSecondary/30 border border-cca-border/20 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-1 focus:ring-brand-primary/50 transition-all';
    const selectClass = baseInput + ' appearance-none relative';

    // Trouve le produit sélectionné en toute sécurité
    const selectedProduct =
        Array.isArray(products) && products.length > 0 && selectedProductId != null
            ? products.find((p) => Number(p.id) === Number(selectedProductId)) || null
            : null;

    // Chargement initial
    useEffect(() => {
        let cancelled = false;

        async function loadData() {
            if (!companyId) {
                setLoading(false);
                return;
            }
            setLoading(true);
            setError(null);

            try {
                // --- 1) Récupération des produits visibles pour le rang (si API widget dispo), sinon fallback sur produits actifs ---
                let prods = [];
                try {
                    if (typeof productsService.fetchWidgetDataDeclareProduct === 'function') {
                        const res = await productsService.fetchWidgetDataDeclareProduct(companyId);
                        prods = Array.isArray(res?.products) ? res.products : Array.isArray(res) ? res : [];
                    } else if (typeof productsService.fetchDeclareWidget === 'function') {
                        const res = await productsService.fetchDeclareWidget(companyId);
                        prods = Array.isArray(res?.products) ? res.products : Array.isArray(res) ? res : [];
                    } else if (typeof productsService.fetchProducts === 'function') {
                        const res = await productsService.fetchProducts(companyId, { activeOnly: true });
                        prods = Array.isArray(res?.products) ? res.products : Array.isArray(res) ? res : [];
                    } else {
                        prods = [];
                    }
                } catch (_e) {
                    // Si l'API widget renvoie 200 avec data:{} ou échoue → on garde []
                    prods = [];
                }

                if (!cancelled) {
                    setProducts(prods);
                    if (Array.isArray(prods) && prods.length > 0) {
                        setSelectedProductId((prev) => (prev != null ? prev : prods[0].id));
                    } else {
                        setSelectedProductId(null);
                    }
                }

                // --- 2) Récupération des 5 dernières déclarations ---
                try {
                    let decls = [];
                    if (typeof productsService.fetchDeclarations === 'function') {
                        const dres = await productsService.fetchDeclarations(companyId, { page: 1, pageSize: 5 });
                        decls =
                            Array.isArray(dres?.items)
                                ? dres.items
                                : Array.isArray(dres?.declarations)
                                    ? dres.declarations
                                    : Array.isArray(dres)
                                        ? dres
                                        : [];
                    }
                    if (!cancelled) setDeclarations(decls);
                } catch {
                    if (!cancelled) setDeclarations([]);
                }
            } catch (err) {
                if (!cancelled) setError(err?.message || 'Erreur de chargement');
            } finally {
                if (!cancelled) setLoading(false);
            }
        }

        loadData();
        return () => {
            cancelled = true;
        };
    }, [companyId]);

    // Déclarer la production
    const handleDeclare = async () => {
        setError(null);
        setSuccessMsg(null);

        if (!companyId) {
            setError("Aucune entreprise sélectionnée.");
            return;
        }
        if (!selectedProductId) {
            setError("Sélectionnez un produit.");
            return;
        }

        const q = Number.parseFloat(quantity);
        if (!Number.isFinite(q) || q <= 0) {
            setError("Entrez une quantité valide (> 0).");
            return;
        }

        if (typeof productsService.declareProduct !== 'function') {
            setError("Fonction 'declareProduct' non disponible.");
            return;
        }

        try {
            setSubmitting(true);
            await productsService.declareProduct(companyId, selectedProductId, { quantity: q });
            setSuccessMsg('Production déclarée avec succès.');
            setQuantity('');

            // rafraîchir les dernières déclarations
            try {
                const dres = await productsService.fetchDeclarations(companyId, { page: 1, pageSize: 5 });
                const decls =
                    Array.isArray(dres?.items)
                        ? dres.items
                        : Array.isArray(dres?.declarations)
                            ? dres.declarations
                            : Array.isArray(dres)
                                ? dres
                                : [];
                setDeclarations(decls);
            } catch {
                // pas bloquant
            }
        } catch (err) {
            setError(err?.message || 'Erreur lors de la déclaration.');
        } finally {
            setSubmitting(false);
            setTimeout(() => setSuccessMsg(null), 3000);
        }
    };

    if (!companyId) return <div className="p-10 text-center text-cca-textSecondary/60 italic uppercase tracking-widest text-[10px]">Sélectionnez une entreprise</div>;
    if (loading) return <div className="p-10 text-center text-cca-textSecondary/60 italic uppercase tracking-widest text-[10px]">Chargement…</div>;

    // Valeurs unitaires de rémunération (sécurisées)
    const unitFixed = selectedProduct?.preset?.fixed ?? 0;
    const unitPercent = selectedProduct?.preset?.percent ?? 0;
    const unitPrice = Number(selectedProduct?.price ?? 0);
    const unitPercentValue =
        Number.isFinite(unitPrice) && Number.isFinite(unitPercent) ? (unitPrice * unitPercent) / 100 : 0;
    const unitTotal = Number(unitFixed) + Number(unitPercentValue);

    return (
        <div className={`${className} h-full flex flex-col`}>
            <h3 className="text-[10px] font-black uppercase tracking-[0.3em] text-cca-textSecondary/40 mb-6 border-b border-cca-border/20 pb-4 flex-shrink-0">
                Déclaration de Production
            </h3>

            {error && <div className="text-[10px] font-black uppercase text-rose-400 mb-4 bg-rose-400/10 p-2 rounded-lg border border-rose-400/20">{String(error)}</div>}
            {successMsg && <div className="text-[10px] font-black uppercase text-emerald-400 mb-4 bg-emerald-400/10 p-2 rounded-lg border border-emerald-400/20">{successMsg}</div>}

            {/* Produit */}
            <div className="mb-4">
                <label className="block text-[10px] font-black uppercase tracking-widest text-cca-textSecondary/40 mb-2 ml-1">Référence Produit</label>

                {!Array.isArray(products) || products.length === 0 ? (
                    <div className="text-cca-textSecondary/40 text-[10px] font-black uppercase italic p-4 bg-cca-base/20 rounded-xl border border-cca-border/10">Aucun produit à sélectionner.</div>
                ) : (
                    <div className="relative">
                        <select
                            value={selectedProductId ?? ''}
                            onChange={(e) => setSelectedProductId(Number(e.target.value))}
                            className={selectClass}
                        >
                            {products.map((p) => {
                                const price = Number(p?.price ?? 0);
                                const priceText = Number.isFinite(price) ? `${price.toFixed(2)} $` : '';
                                return (
                                    <option key={p.id} value={p.id} className="bg-cca-surface text-cca-textPrimary">
                                        {p.name} {priceText ? `— ${priceText}` : ''}
                                    </option>
                                );
                            })}
                        </select>
                        <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-cca-textSecondary/40">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" /></svg>
                        </div>
                    </div>
                )}
            </div>

            {/* Info rémunération unitaire */}
            {selectedProduct && (
                <div className="text-[10px] font-bold text-cca-textSecondary/60 mb-4 px-2 py-2 bg-cca-base/20 rounded-lg border-l-2 border-brand-primary">
                    Indemnité unitaire : <span className="text-cca-textPrimary">{Number(unitFixed).toFixed(2)} $</span> + <span className="text-brand-primary">{Number(unitPercent).toFixed(2)}%</span> (Total: <span className="text-emerald-400">{Number(unitTotal).toFixed(2)} $</span>)
                </div>
            )}

            {/* Quantité */}
            <div className="mb-6">
                <label className="block text-[10px] font-black uppercase tracking-widest text-cca-textSecondary/40 mb-2 ml-1">Volume de Production</label>
                <input
                    type="number"
                    min="0"
                    step="1"
                    value={quantity}
                    onChange={(e) => setQuantity(e.target.value)}
                    placeholder="Saisissez la quantité (ex: 125)"
                    className={baseInput}
                    disabled={!Array.isArray(products) || products.length === 0}
                />
            </div>

            {/* Bouton */}
            <button
                onClick={handleDeclare}
                disabled={submitting || !selectedProductId || !Array.isArray(products) || products.length === 0}
                className="w-full py-4 bg-brand-primary text-white font-black text-xs uppercase tracking-[0.2em] rounded-xl shadow-xl shadow-brand-primary/20 hover:bg-brand-primary/80 transition-all active:scale-[0.98] disabled:opacity-50 disabled:grayscale disabled:cursor-not-allowed"
            >
                {submitting ? 'ENREGISTREMENT...' : 'TRANSMETTRE LA DÉCLARATION'}
            </button>

            {/* Historique */}
            <h5 className="text-[10px] font-black uppercase tracking-[0.2em] text-cca-textSecondary/40 mt-10 mb-4 border-b border-cca-border/20 pb-4">Historique des Flux (5 derniers)</h5>

            {!Array.isArray(declarations) || declarations.length === 0 ? (
                <div className="text-[10px] font-black uppercase text-cca-textSecondary/30 italic text-center py-6">Registre vierge</div>
            ) : (
                <ul className="space-y-2 pb-4">
                    {declarations.map((d) => {
                        const qty = Number(d?.quantity ?? 0);
                        const amt = Number(d?.amount ?? 0);
                        return (
                            <li key={d.id} className="p-3 border border-cca-border/10 bg-cca-base/20 rounded-xl hover:bg-cca-surface/10 transition-colors group">
                                <div className="flex justify-between items-center">
                                    <div>
                                        <div className="text-xs font-black text-cca-textPrimary group-hover:text-brand-primary transition-colors">{d?.product?.name ?? 'PRODUIT'}</div>
                                        <div className="text-[9px] font-bold text-cca-textSecondary/60 mt-0.5">
                                            {Number.isFinite(qty) ? `${qty} UNITÉS` : '—'} —{' '}
                                            <span className="text-emerald-400">{Number.isFinite(amt) ? `${amt.toFixed(2)} $` : '—'}</span>
                                        </div>
                                    </div>
                                    <div className="text-[8px] font-black text-cca-textSecondary/30 uppercase text-right">
                                        {d?.createdAt ? new Date(d.createdAt).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' }) : ''}
                                    </div>
                                </div>
                            </li>
                        );
                    })}
                </ul>
            )}
        </div>
    );
}
