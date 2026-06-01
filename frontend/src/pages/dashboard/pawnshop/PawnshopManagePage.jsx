// frontend/src/pages/dashboard/pawnshop/PawnshopManagePage.jsx

import React, { useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";
import { Plus, Save, Trash2, Settings, ArrowLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";

import { usePermissions } from "@/contexts/PermissionsContext.jsx";
import Spinner from "@/components/ui/Spinner";
import ConfirmationModal from "@/components/ui/ConfirmationModal";

import {
    listProducts,
    createProduct,
    updateProduct,
    deleteProduct,
    listPartners,
    createPartner,
    updatePartner,
    deletePartner,
    getPartnerPrices,
    putPartnerPrices,
} from "@/services/pawnshopService.js";

/* =========================
   UI helpers (same glass)
========================= */
function GlassCard({ title, subtitle, right, children, className = "" }) {
    return (
        <div
            className={[
                "relative overflow-hidden rounded-3xl p-6",
                "bg-cca-surface/30 border border-cca-border/40 backdrop-blur-2xl shadow-2xl shadow-black/30",
                className,
            ].join(" ")}
        >
            <div
                className={[
                    "pointer-events-none absolute inset-0 opacity-25 mix-blend-soft-light",
                    "[background:",
                    "radial-gradient(circle_at_top_left,rgba(99,102,241,0.15),transparent_55%),",
                    "radial-gradient(circle_at_bottom_right,rgba(8,47,73,0.40),transparent_55%)",
                    "]",
                ].join(" ")}
            />
            {(title || right) && (
                <div className="relative flex items-start justify-between gap-4 mb-4">
                    <div>
                        {title && <div className="text-xl font-bold text-cca-textPrimary">{title}</div>}
                        {subtitle && <div className="text-sm text-cca-textSecondary/60 mt-1">{subtitle}</div>}
                    </div>
                    {right ? <div className="shrink-0">{right}</div> : null}
                </div>
            )}
            <div className="relative">{children}</div>
        </div>
    );
}

function GlassButton({ children, className = "", ...props }) {
    return (
        <button
            className={[
                "px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest inline-flex items-center gap-2",
                "bg-cca-base/40 hover:bg-cca-base/60",
                "border border-cca-border/40 backdrop-blur-xl",
                "transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed",
                className,
            ].join(" ")}
            {...props}
        >
            {children}
        </button>
    );
}

function GlassInput({ className = "", ...props }) {
    return (
        <input
            className={[
                "w-full px-4 py-2 rounded-xl text-sm",
                "bg-cca-base/40 border border-cca-border/40",
                "text-cca-textPrimary placeholder:text-cca-textSecondary/40 shadow-inner",
                "focus:outline-none focus:ring-2 focus:ring-brand-primary/20 transition-all",
                className,
            ].join(" ")}
            {...props}
        />
    );
}

function GlassSelect({ className = "", children, ...props }) {
    return (
        <select
            className={[
                "w-full px-4 py-2 rounded-xl text-sm",
                "bg-cca-base/40 border border-cca-border/40",
                "text-cca-textPrimary shadow-inner",
                "focus:outline-none focus:ring-2 focus:ring-brand-primary/20 transition-all",
                className,
            ].join(" ")}
            {...props}
        >
            {children}
        </select>
    );
}

function fmtNumber(v) {
    if (v === null || v === undefined || v === "") return "";
    const n = Number(String(v).replace(",", "."));
    return Number.isFinite(n) ? String(n) : "";
}

/* =========================
   Page
========================= */
export default function PawnshopManagePage() {
    const navigate = useNavigate();
    const { has, isReady } = usePermissions();

    const canAccess = has("PAWNSHOP.ACCESS");
    const canProductsView = has("PAWNSHOP.PRODUCTS.VIEW") || has("PAWNSHOP.PRODUCTS.MANAGE");
    const canProductsManage = has("PAWNSHOP.PRODUCTS.MANAGE");

    const canPartnersView = has("PAWNSHOP.PARTNERS.VIEW") || has("PAWNSHOP.PARTNERS.MANAGE");
    const canPartnersManage = has("PAWNSHOP.PARTNERS.MANAGE");

    const canPartnerPricesView = has("PAWNSHOP.PARTNER_PRICES.VIEW") || has("PAWNSHOP.PARTNER_PRICES.MANAGE");
    const canPartnerPricesManage = has("PAWNSHOP.PARTNER_PRICES.MANAGE");

    const [tab, setTab] = useState("products"); // products | partners | prices
    const [confirmModal, setConfirmModal] = useState({ isOpen: false, message: '', onConfirm: null });

    const [loading, setLoading] = useState(false);

    // Products
    const [products, setProducts] = useState([]);
    const [newProd, setNewProd] = useState({ name: "", buyPrice: "", resalePrice: "", isActive: true, inventoryOwner: "" });

    // Partners
    const [partners, setPartners] = useState([]);
    const [newPartner, setNewPartner] = useState({ name: "", notes: "", isActive: true });

    // Partner prices
    const [selectedPartnerId, setSelectedPartnerId] = useState("");
    const [partnerPricesMap, setPartnerPricesMap] = useState(new Map()); // productId -> buyPrice number
    const [savingPrices, setSavingPrices] = useState(false);

    const _productById = useMemo(() => new Map(products.map((p) => [p.id, p])), [products]);

    async function refreshAll() {
        setLoading(true);
        try {
            const [prod, part] = await Promise.all([
                canProductsView ? listProducts({ includeInactive: true }) : Promise.resolve({ items: [] }),
                canPartnersView ? listPartners({ includeInactive: true }) : Promise.resolve({ items: [] }),
            ]);

            const prodItems = Array.isArray(prod?.items) ? prod.items : Array.isArray(prod) ? prod : [];
            const partItems = Array.isArray(part?.items) ? part.items : Array.isArray(part) ? part : [];

            setProducts(prodItems);
            setPartners(partItems);
        } catch (e) {
            console.error(e);
            toast.error("Chargement impossible.");
        } finally {
            setLoading(false);
        }
    }

    useEffect(() => {
        if (!isReady) return;
        if (!canAccess) return;
        refreshAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isReady, canAccess]);

    async function onCreateProduct() {
        const name = (newProd.name || "").trim();
        if (!name) return toast.error("Nom requis.");

        const buyPrice = Number(String(newProd.buyPrice).replace(",", "."));
        const resalePrice = Number(String(newProd.resalePrice).replace(",", "."));
        if (!Number.isFinite(buyPrice) || buyPrice < 0) return toast.error("buyPrice invalide.");
        if (!Number.isFinite(resalePrice) || resalePrice < 0) return toast.error("resalePrice invalide.");

        try {
            await createProduct({
                name,
                buyPrice,
                resalePrice,
                isActive: !!newProd.isActive,
                inventoryOwner: newProd.inventoryOwner?.trim() || null,
            });
            toast.success("Produit créé.");
            setNewProd({ name: "", buyPrice: "", resalePrice: "", isActive: true, inventoryOwner: "" });
            await refreshAll();
        } catch (e) {
            console.error(e);
            toast.error(e?.response?.data?.message || "Création impossible.");
        }
    }

    async function onUpdateProduct(p) {
        try {
            await updateProduct(p.id, {
                name: p.name,
                buyPrice: Number(String(p.buyPrice).replace(",", ".")),
                resalePrice: Number(String(p.resalePrice).replace(",", ".")),
                isActive: !!p.isActive,
                inventoryOwner: p.inventoryOwner?.trim() || null,
            });
            toast.success("Produit mis à jour.");
            await refreshAll();
        } catch (e) {
            console.error(e);
            toast.error(e?.response?.data?.message || "Update impossible.");
        }
    }

    function onDeleteProduct(id) {
        setConfirmModal({
            isOpen: true,
            message: "Supprimer ce produit ?",
            onConfirm: async () => {
                setConfirmModal(p => ({ ...p, isOpen: false }));
                try {
                    await deleteProduct(id);
                    toast.success("Produit supprimé.");
                    await refreshAll();
                } catch (e) {
                    console.error(e);
                    toast.error(e?.response?.data?.message || "Suppression impossible.");
                }
            },
        });
    }

    async function onCreatePartner() {
        const name = (newPartner.name || "").trim();
        if (!name) return toast.error("Nom requis.");
        try {
            await createPartner({
                name,
                notes: (newPartner.notes || "").trim() || null,
                isActive: !!newPartner.isActive,
            });
            toast.success("Partenaire créé.");
            setNewPartner({ name: "", notes: "", isActive: true });
            await refreshAll();
        } catch (e) {
            console.error(e);
            toast.error(e?.response?.data?.message || "Création impossible.");
        }
    }

    async function onUpdatePartner(p) {
        try {
            await updatePartner(p.id, {
                name: p.name,
                notes: p.notes || null,
                isActive: !!p.isActive,
            });
            toast.success("Partenaire mis à jour.");
            await refreshAll();
        } catch (e) {
            console.error(e);
            toast.error(e?.response?.data?.message || "Update impossible.");
        }
    }

    function onDeletePartner(id) {
        setConfirmModal({
            isOpen: true,
            message: "Supprimer ce partenaire ?",
            onConfirm: async () => {
                setConfirmModal(p => ({ ...p, isOpen: false }));
                try {
                    await deletePartner(id);
                    toast.success("Partenaire supprimé.");
                    await refreshAll();
                } catch (e) {
                    console.error(e);
                    toast.error(e?.response?.data?.message || "Suppression impossible.");
                }
            },
        });
    }

    async function loadPartnerPrices(pid) {
        if (!pid) return;
        try {
            const data = await getPartnerPrices(pid);
            // attendu: items: [{productId, buyPrice}] ou array direct
            const arr = Array.isArray(data?.items) ? data.items : Array.isArray(data) ? data : [];
            const map = new Map();
            for (const it of arr) {
                if (!it?.productId) continue;
                map.set(it.productId, it.buyPrice);
            }
            setPartnerPricesMap(map);
        } catch (e) {
            console.error(e);
            toast.error(e?.response?.data?.message || "Chargement des prix impossible.");
            setPartnerPricesMap(new Map());
        }
    }

    async function savePartnerPrices() {
        const pid = Number(selectedPartnerId);
        if (!Number.isFinite(pid) || pid <= 0) return toast.error("Partenaire invalide.");

        const items = [];
        for (const p of products) {
            const v = partnerPricesMap.get(p.id);
            if (v === undefined || v === null || v === "") continue;
            const n = Number(String(v).replace(",", "."));
            if (!Number.isFinite(n) || n < 0) return toast.error(`Prix invalide pour produit #${p.id}`);
            items.push({ productId: p.id, buyPrice: n });
        }

        setSavingPrices(true);
        try {
            await putPartnerPrices(pid, items);
            toast.success("Prix enregistrés.");
            await loadPartnerPrices(pid);
        } catch (e) {
            console.error(e);
            toast.error(e?.response?.data?.message || "Enregistrement impossible.");
        } finally {
            setSavingPrices(false);
        }
    }

    if (!isReady) return <div className="p-6 text-cca-textPrimary">Chargement…</div>;
    if (!canAccess) return <div className="p-6 text-cca-textPrimary">Accès refusé (PAWNSHOP.ACCESS).</div>;

    return (
        <div className="space-y-6 text-cca-textPrimary">
            {/* Header */}
            <div className="flex items-start justify-between gap-4">
                <div>
                    <h1 className="text-3xl sm:text-5xl font-black tracking-tight text-cca-textPrimary font-heading">Pawnshop — Administration</h1>
                    <p className="text-[10px] font-black uppercase tracking-[0.4em] text-brand-primary/80 mt-1">Catalogue produits & Accords Partenaires</p>
                </div>
                <div className="flex gap-3">
                    <GlassButton 
                        onClick={() => navigate("/dashboard/company/pawnshop")} 
                        type="button"
                        className="h-[52px] px-6 rounded-2xl bg-cca-surface/40 hover:bg-cca-surface border-cca-border"
                    >
                        <ArrowLeft size={16} />
                        Retour achats
                    </GlassButton>
                </div>
            </div>

            {/* Tabs */}
            <div className="flex gap-2">
                <GlassButton
                    onClick={() => setTab("products")}
                    className={tab === "products" ? "ring-2 ring-indigo-500/25" : ""}
                >
                    Produits
                </GlassButton>
                <GlassButton
                    onClick={() => setTab("partners")}
                    className={tab === "partners" ? "ring-2 ring-indigo-500/25" : ""}
                >
                    Partenaires
                </GlassButton>
                <GlassButton
                    onClick={() => setTab("prices")}
                    className={tab === "prices" ? "ring-2 ring-indigo-500/25" : ""}
                >
                    Prix partenaires
                </GlassButton>
            </div>

            {loading ? (
                <div className="flex justify-center py-12">
                    <Spinner />
                </div>
            ) : null}

            {/* PRODUCTS */}
            {tab === "products" && (
                <GlassCard
                    title="Produits"
                    subtitle="Prix d'achat / prix de revente (sert au calcul des commissions)."
                    right={
                        !canProductsManage ? (
                            <div className="text-xs text-slate-400">Lecture seule (MANAGE requis pour modifier)</div>
                        ) : null
                    }
                >
                    {!canProductsView ? (
                        <div className="text-slate-400">Permission manquante (PAWNSHOP.PRODUCTS.VIEW).</div>
                    ) : (
                        <div className="space-y-4">
                            {canProductsManage && (
                                <div className="grid grid-cols-1 md:grid-cols-4 gap-3 items-end">
                                    <div className="md:col-span-2">
                                        <div className="text-xs text-slate-400 mb-1">Nom</div>
                                        <GlassInput value={newProd.name} onChange={(e) => setNewProd((s) => ({ ...s, name: e.target.value }))} />
                                    </div>
                                    <div>
                                        <div className="text-xs text-slate-400 mb-1">Achat</div>
                                        <GlassInput value={newProd.buyPrice} onChange={(e) => setNewProd((s) => ({ ...s, buyPrice: e.target.value }))} />
                                    </div>
                                    <div>
                                        <div className="text-xs text-slate-400 mb-1">Revente</div>
                                        <GlassInput value={newProd.resalePrice} onChange={(e) => setNewProd((s) => ({ ...s, resalePrice: e.target.value }))} />
                                    </div>
                                    <div className="md:col-span-4">
                                        <div className="text-xs text-slate-400 mb-1">Objet inventory (owner FiveM, ex: action-73-0-2)</div>
                                        <GlassInput value={newProd.inventoryOwner} placeholder="Laisser vide pour entrée unique par achat" onChange={(e) => setNewProd((s) => ({ ...s, inventoryOwner: e.target.value }))} />
                                    </div>
                                    <div className="md:col-span-4 flex justify-end">
                                        <GlassButton onClick={onCreateProduct} type="button">
                                            <Plus size={16} /> Ajouter
                                        </GlassButton>
                                    </div>
                                </div>
                            )}

                            <div className="overflow-x-auto min-h-[400px] mt-6 rounded-2xl border border-cca-border/30 bg-cca-base/10">
                                <table className="min-w-full text-sm text-cca-textPrimary border-separate border-spacing-0">
                                    <thead className="bg-cca-base/80 backdrop-blur-md sticky top-0 z-10">
                                    <tr>
                                        <th className="py-4 px-4 text-left text-[9px] font-black uppercase tracking-[0.2em] text-cca-textSecondary/60 border-b border-cca-border/30">Nom du Produit</th>
                                        <th className="py-4 px-4 text-left text-[9px] font-black uppercase tracking-[0.2em] text-cca-textSecondary/60 border-b border-cca-border/30">Inventory (owner)</th>
                                        <th className="py-4 px-4 text-right text-[9px] font-black uppercase tracking-[0.2em] text-cca-textSecondary/60 border-b border-cca-border/30 w-32">Prix Achat</th>
                                        <th className="py-4 px-4 text-right text-[9px] font-black uppercase tracking-[0.2em] text-cca-textSecondary/60 border-b border-cca-border/30 w-32">Prix Revente</th>
                                        <th className="py-4 px-4 text-center text-[9px] font-black uppercase tracking-[0.2em] text-cca-textSecondary/60 border-b border-cca-border/30 w-24">Statut</th>
                                        <th className="py-4 px-4 text-right text-[9px] font-black uppercase tracking-[0.2em] text-cca-textSecondary/60 border-b border-cca-border/30">Actions</th>
                                    </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-700/40">
                                    {products.map((p) => (
                                        <tr key={p.id} className="hover:bg-slate-800/30">
                                            <td className="py-2 px-3">
                                                <GlassInput
                                                    disabled={!canProductsManage}
                                                    value={p.name ?? ""}
                                                    onChange={(e) =>
                                                        setProducts((arr) => arr.map((x) => (x.id === p.id ? { ...x, name: e.target.value } : x)))
                                                    }
                                                />
                                            </td>
                                            <td className="py-2 px-3">
                                                <GlassInput
                                                    disabled={!canProductsManage}
                                                    value={p.inventoryOwner ?? ""}
                                                    placeholder="—"
                                                    className="font-mono text-xs"
                                                    onChange={(e) =>
                                                        setProducts((arr) => arr.map((x) => (x.id === p.id ? { ...x, inventoryOwner: e.target.value } : x)))
                                                    }
                                                />
                                            </td>
                                            <td className="py-2 px-3 text-right">
                                                <GlassInput
                                                    disabled={!canProductsManage}
                                                    className="text-right font-mono"
                                                    value={fmtNumber(p.buyPrice)}
                                                    onChange={(e) =>
                                                        setProducts((arr) => arr.map((x) => (x.id === p.id ? { ...x, buyPrice: e.target.value } : x)))
                                                    }
                                                />
                                            </td>
                                            <td className="py-2 px-3 text-right">
                                                <GlassInput
                                                    disabled={!canProductsManage}
                                                    className="text-right font-mono"
                                                    value={fmtNumber(p.resalePrice)}
                                                    onChange={(e) =>
                                                        setProducts((arr) =>
                                                            arr.map((x) => (x.id === p.id ? { ...x, resalePrice: e.target.value } : x))
                                                        )
                                                    }
                                                />
                                            </td>
                                            <td className="py-2 px-3 text-center">
                                                <input
                                                    type="checkbox"
                                                    disabled={!canProductsManage}
                                                    checked={!!p.isActive}
                                                    onChange={(e) =>
                                                        setProducts((arr) => arr.map((x) => (x.id === p.id ? { ...x, isActive: e.target.checked } : x)))
                                                    }
                                                />
                                            </td>
                                            <td className="py-2 px-3 text-right">
                                                {canProductsManage ? (
                                                    <div className="flex justify-end gap-2">
                                                        <GlassButton onClick={() => onUpdateProduct(p)} type="button" className="px-3 py-2">
                                                            <Save size={16} /> Sauver
                                                        </GlassButton>
                                                        <GlassButton onClick={() => onDeleteProduct(p.id)} type="button" className="px-3 py-2">
                                                            <Trash2 size={16} /> Suppr.
                                                        </GlassButton>
                                                    </div>
                                                ) : (
                                                    <span className="text-xs text-slate-500">—</span>
                                                )}
                                            </td>
                                        </tr>
                                    ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}
                </GlassCard>
            )}

            {/* PARTNERS */}
            {tab === "partners" && (
                <GlassCard title="Partenaires" subtitle="Partenaires + notes + activation">
                    {!canPartnersView ? (
                        <div className="text-slate-400">Permission manquante (PAWNSHOP.PARTNERS.VIEW).</div>
                    ) : (
                        <div className="space-y-4">
                            {canPartnersManage && (
                                <div className="grid grid-cols-1 md:grid-cols-4 gap-3 items-end">
                                    <div className="md:col-span-2">
                                        <div className="text-xs text-slate-400 mb-1">Nom</div>
                                        <GlassInput value={newPartner.name} onChange={(e) => setNewPartner((s) => ({ ...s, name: e.target.value }))} />
                                    </div>
                                    <div className="md:col-span-2">
                                        <div className="text-xs text-slate-400 mb-1">Notes</div>
                                        <GlassInput value={newPartner.notes} onChange={(e) => setNewPartner((s) => ({ ...s, notes: e.target.value }))} />
                                    </div>
                                    <div className="md:col-span-4 flex justify-end">
                                        <GlassButton onClick={onCreatePartner} type="button">
                                            <Plus size={16} /> Ajouter
                                        </GlassButton>
                                    </div>
                                </div>
                            )}

                            <div className="space-y-4">
                                {partners.map((p) => (
                                    <div key={p.id} className="rounded-2xl p-6 bg-cca-base/20 border border-cca-border/40 shadow-inner group hover:bg-brand-primary/5 transition-all">
                                        <div className="grid grid-cols-1 md:grid-cols-6 gap-4 items-center">
                                            <div className="md:col-span-2">
                                                <div className="text-[10px] font-black uppercase tracking-widest text-cca-textSecondary/40 mb-1">Nom du Partenaire</div>
                                                <GlassInput
                                                    disabled={!canPartnersManage}
                                                    value={p.name ?? ""}
                                                    onChange={(e) => setPartners((arr) => arr.map((x) => (x.id === p.id ? { ...x, name: e.target.value } : x)))}
                                                />
                                            </div>
                                            <div className="md:col-span-3">
                                                <div className="text-[10px] font-black uppercase tracking-widest text-cca-textSecondary/40 mb-1">Notes Internes</div>
                                                <GlassInput
                                                    disabled={!canPartnersManage}
                                                    value={p.notes ?? ""}
                                                    onChange={(e) => setPartners((arr) => arr.map((x) => (x.id === p.id ? { ...x, notes: e.target.value } : x)))}
                                                />
                                            </div>
                                            <div className="md:col-span-1 flex items-center justify-between gap-4">
                                                <label className="text-[10px] font-black uppercase tracking-widest text-cca-textSecondary/60 inline-flex items-center gap-2 cursor-pointer">
                                                    <input
                                                        type="checkbox"
                                                        className="w-4 h-4 rounded border-cca-border/40 bg-cca-base/40 text-brand-primary focus:ring-brand-primary/20"
                                                        disabled={!canPartnersManage}
                                                        checked={!!p.isActive}
                                                        onChange={(e) => setPartners((arr) => arr.map((x) => (x.id === p.id ? { ...x, isActive: e.target.checked } : x)))}
                                                    />
                                                    Actif
                                                </label>

                                                {canPartnersManage && (
                                                    <div className="flex gap-2">
                                                        <GlassButton 
                                                            onClick={() => onUpdatePartner(p)} 
                                                            type="button" 
                                                            className="px-3 h-10 bg-brand-primary text-white border-brand-light/20 shadow-lg shadow-brand-primary/10"
                                                        >
                                                            <Save size={16} />
                                                        </GlassButton>
                                                        <GlassButton 
                                                            onClick={() => onDeletePartner(p.id)} 
                                                            type="button" 
                                                            className="px-3 h-10 bg-rose-500/20 text-rose-400 border-rose-500/30 hover:bg-rose-500/30"
                                                        >
                                                            <Trash2 size={16} />
                                                        </GlassButton>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </GlassCard>
            )}

            {/* PARTNER PRICES */}
            {tab === "prices" && (
                <GlassCard
                    title="Prix d’achat personnalisés (partenaire)"
                    subtitle="Override du buyPrice produit pour un partenaire donné."
                    right={
                        canPartnerPricesManage ? (
                            <GlassButton onClick={savePartnerPrices} disabled={!selectedPartnerId || savingPrices} type="button">
                                <Save size={16} /> {savingPrices ? "Enregistrement…" : "Enregistrer"}
                            </GlassButton>
                        ) : (
                            <div className="text-xs text-slate-400">Lecture seule (MANAGE requis)</div>
                        )
                    }
                >
                    {!canPartnerPricesView ? (
                        <div className="text-slate-400">Permission manquante (PAWNSHOP.PARTNER_PRICES.VIEW).</div>
                    ) : (
                        <div className="space-y-4">
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 items-end">
                                <div className="md:col-span-2">
                                    <div className="text-xs text-slate-400 mb-1">Partenaire</div>
                                    <GlassSelect
                                        value={selectedPartnerId}
                                        onChange={async (e) => {
                                            const v = e.target.value;
                                            setSelectedPartnerId(v);
                                            setPartnerPricesMap(new Map());
                                            if (v) await loadPartnerPrices(v);
                                        }}
                                    >
                                        <option value="">— Sélectionner —</option>
                                        {partners.map((p) => (
                                            <option key={p.id} value={p.id}>
                                                #{p.id} — {p.name}
                                            </option>
                                        ))}
                                    </GlassSelect>
                                </div>
                                <div className="text-xs text-slate-400">
                                    Le buyPrice du produit reste la valeur par défaut si l’override est vide.
                                </div>
                            </div>

                            {selectedPartnerId ? (
                                <div className="overflow-x-auto min-h-[400px] mt-6 rounded-2xl border border-cca-border/30 bg-cca-base/10">
                                    <table className="min-w-full text-sm text-cca-textPrimary border-separate border-spacing-0">
                                        <thead className="bg-cca-base/80 backdrop-blur-md sticky top-0 z-10">
                                        <tr>
                                            <th className="py-4 px-4 text-left text-[9px] font-black uppercase tracking-[0.2em] text-cca-textSecondary/60 border-b border-cca-border/30">Produit</th>
                                            <th className="py-4 px-4 text-right text-[9px] font-black uppercase tracking-[0.2em] text-cca-textSecondary/60 border-b border-cca-border/30 w-32">Achat Défaut</th>
                                            <th className="py-4 px-4 text-right text-[9px] font-black uppercase tracking-[0.2em] text-cca-textSecondary/60 border-b border-cca-border/30 w-48">Override Achat</th>
                                        </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-700/40">
                                        {products.map((p) => {
                                            const cur = partnerPricesMap.get(p.id);
                                            return (
                                                <tr key={p.id} className="hover:bg-slate-800/30">
                                                    <td className="py-2 px-3 font-medium">{p.name}</td>
                                                    <td className="py-2 px-3 text-right font-mono">{fmtNumber(p.buyPrice)}</td>
                                                    <td className="py-2 px-3 text-right">
                                                        <GlassInput
                                                            disabled={!canPartnerPricesManage}
                                                            className="text-right font-mono"
                                                            value={cur ?? ""}
                                                            placeholder="(vide = défaut)"
                                                            onChange={(e) => {
                                                                const v = e.target.value;
                                                                setPartnerPricesMap((old) => {
                                                                    const n = new Map(old);
                                                                    if (v === "") n.delete(p.id);
                                                                    else n.set(p.id, v);
                                                                    return n;
                                                                });
                                                            }}
                                                        />
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                        </tbody>
                                    </table>
                                </div>
                            ) : (
                                <div className="text-slate-400">Choisis un partenaire pour éditer ses prix.</div>
                            )}
                        </div>
                    )}
                </GlassCard>
            )}
            <ConfirmationModal
                isOpen={confirmModal.isOpen}
                onClose={() => setConfirmModal(p => ({ ...p, isOpen: false }))}
                onConfirm={confirmModal.onConfirm}
                message={confirmModal.message}
            />
        </div>
    );
}
