// frontend/src/pages/dashboard/pawnshop/PawnshopEstimationsPage.jsx

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import toast from "react-hot-toast";
import { useNavigate } from "react-router-dom";
import { Plus, X, Trash2, CheckCircle2, Ban, Settings, Search, Upload, IdCard, ExternalLink } from "lucide-react";

import { useCompany } from "@/contexts/CompanyContext.jsx";
import { usePermissions } from "@/contexts/PermissionsContext.jsx";
import Spinner from "@/components/ui/Spinner";
import { createPortal } from "react-dom";

import {
    listEstimations,
    createEstimation,
    getEstimation,
    updateEstimation,
    addEstimationItem,
    deleteEstimationItem,
    rejectEstimation,
    convertEstimation,
    listPurchaseCatalog,
    listPawnshopClients,
    uploadClientCni,
    deleteClientCni,
    getClientCniUrl,
} from "@/services/pawnshopService.js";

/* ---------- Utils ---------- */
function fmtMoney(v) {
    const n = Number(v ?? 0);
    return Number.isFinite(n) ? n.toLocaleString("fr-FR", { style: "currency", currency: "USD", maximumFractionDigits: 2 }) : "0,00 $US";
}
function safeText(v) { return (v ?? "").toString().trim(); }
function getClientLabel(c) {
    if (!c) return "";
    const name = safeText(c.name);
    return name ? `${name} (#${c.id})` : `Client #${c.id}`;
}

/* ---------- Glass UI ---------- */
function GlassCard({ title, subtitle, right, children, className = "" }) {
    return (
        <div className={["relative rounded-3xl p-6 overflow-hidden bg-cca-surface/30 border border-cca-border/40 backdrop-blur-2xl shadow-2xl shadow-black/30", className].join(" ")}>
            <div className="pointer-events-none absolute inset-0 opacity-25 mix-blend-soft-light [background:radial-gradient(circle_at_top_left,rgba(99,102,241,0.15),transparent_55%),radial-gradient(circle_at_bottom_right,rgba(8,47,73,0.40),transparent_55%)]" />
            {(title || right) && (
                <div className="relative flex items-start justify-between gap-4 mb-4">
                    <div>
                        {title && <div className="text-xl font-bold text-cca-textPrimary">{title}</div>}
                        {subtitle && <div className="text-sm text-cca-textSecondary/40 mt-1">{subtitle}</div>}
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
        <button className={["px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest inline-flex items-center gap-2 bg-cca-base/40 hover:bg-cca-base/60 border border-cca-border/40 backdrop-blur-xl transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed", className].join(" ")} {...props}>
            {children}
        </button>
    );
}

function GlassInput({ className = "", ...props }) {
    return (
        <input className={["w-full px-4 py-2 rounded-xl text-sm bg-cca-base/40 border border-cca-border/40 text-cca-textPrimary placeholder:text-cca-textSecondary/40 focus:outline-none focus:ring-2 focus:ring-brand-primary/20 disabled:opacity-60 transition-all", className].join(" ")} {...props} />
    );
}

function GlassSelect({ className = "", children, ...props }) {
    return (
        <select className={["w-full px-4 py-2 rounded-xl text-sm bg-cca-base/40 border border-cca-border/40 text-cca-textPrimary focus:outline-none focus:ring-2 focus:ring-brand-primary/20 disabled:opacity-60 transition-all", className].join(" ")} {...props}>
            {children}
        </select>
    );
}

function Modal({ open, title, onClose, children, footer, maxWidthClass = "max-w-xl" }) {
    if (!open) return null;
    return (
        <div className="fixed inset-0 z-[80] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/70" onClick={onClose} />
            <div className={["relative w-full overflow-hidden rounded-[2.5rem]", maxWidthClass, "bg-cca-surface/90 border border-cca-border/60 backdrop-blur-3xl shadow-[0_0_50px_rgba(0,0,0,0.8)]"].join(" ")}>
                <div className="pointer-events-none absolute inset-0 opacity-25 mix-blend-soft-light [background:radial-gradient(circle_at_top_left,rgba(99,102,241,0.15),transparent_55%)]" />
                <div className="relative p-5 border-b border-cca-border/50 flex items-center justify-between">
                    <div className="text-lg font-bold text-cca-textPrimary">{title}</div>
                    <button className="p-2 rounded-lg hover:bg-cca-base/40" onClick={onClose} type="button"><X size={18} /></button>
                </div>
                <div className="relative p-5">{children}</div>
                {footer ? <div className="relative p-5 border-t border-cca-border/50">{footer}</div> : null}
            </div>
        </div>
    );
}

/* ---------- Client select (portal) ---------- */
function ClientSearchSelect({ value, onChange }) {
    const anchorRef = useRef(null);
    const dropdownRef = useRef(null);
    const [open, setOpen] = useState(false);
    const [pos, setPos] = useState({ top: 0, left: 0, width: 0 });
    const [query, setQuery] = useState("");
    const [items, setItems] = useState([]);
    const [loading, setLoading] = useState(false);

    const recomputePosition = useCallback(() => {
        if (!anchorRef.current) return;
        const r = anchorRef.current.getBoundingClientRect();
        setPos({ top: r.bottom + 4, left: r.left, width: r.width });
    }, []);

    useEffect(() => {
        if (!open) return;
        recomputePosition();
        window.addEventListener("scroll", recomputePosition, true);
        window.addEventListener("resize", recomputePosition);
        return () => {
            window.removeEventListener("scroll", recomputePosition, true);
            window.removeEventListener("resize", recomputePosition);
        };
    }, [open, recomputePosition]);

    useEffect(() => {
        if (!open) return;
        let cancelled = false;
        (async () => {
            setLoading(true);
            try {
                const raw = await listPawnshopClients({ page: 1, limit: 50, search: query });
                let list = Array.isArray(raw) ? raw : raw?.items || raw?.clients || [];
                if (!cancelled) setItems(list.slice(0, 50));
            } catch { if (!cancelled) setItems([]); }
            finally { if (!cancelled) setLoading(false); }
        })();
        return () => { cancelled = true; };
    }, [open, query]);

    useEffect(() => {
        if (!open) return;
        function onDown(e) {
            if (!anchorRef.current?.contains(e.target) && !dropdownRef.current?.contains(e.target))
                setOpen(false);
        }
        document.addEventListener("pointerdown", onDown);
        return () => document.removeEventListener("pointerdown", onDown);
    }, [open]);

    const dropdown = open ? createPortal(
        <div ref={dropdownRef}
            style={{ position: "fixed", top: pos.top, left: pos.left, width: pos.width, zIndex: 9999 }}
            className="rounded-2xl bg-cca-surface/95 border border-cca-border backdrop-blur-3xl shadow-2xl overflow-hidden">
            <div className="p-2 border-b border-cca-border/30">
                <GlassInput value={query} onChange={e => setQuery(e.target.value)} placeholder="Rechercher…" autoFocus />
            </div>
            <div className="max-h-48 overflow-auto">
                {loading ? <div className="p-4 text-center"><Spinner /></div> :
                    items.length === 0 ? <div className="p-4 text-cca-textSecondary/40 text-center">Aucun résultat.</div> :
                        items.map(c => (
                            <button key={c.id} type="button" onClick={() => { onChange(c); setOpen(false); }}
                                className="w-full text-left px-4 py-2 hover:bg-brand-primary/10 text-sm text-cca-textPrimary border-b border-cca-border/10 last:border-0">
                                {getClientLabel(c)}
                                <div className="text-[10px] text-cca-textSecondary/50">Tel: {c.phoneNumber || "—"} · IBAN: {c.iban || "—"}</div>
                            </button>
                        ))
                }
            </div>
        </div>,
        document.body
    ) : null;

    return (
        <div ref={anchorRef} className="relative">
            <button type="button" onClick={() => setOpen(v => !v)}
                className="w-full px-4 py-2 rounded-xl text-sm text-left bg-cca-base/40 border border-cca-border/40 text-cca-textPrimary flex justify-between items-center">
                <span className={value ? "font-bold" : "text-cca-textSecondary/40"}>{value ? getClientLabel(value) : "Sélectionner un client…"}</span>
                <Search size={14} className="text-cca-textSecondary/40" />
            </button>
            {dropdown}
        </div>
    );
}

/* ---------- CNI Upload block ---------- */
async function uploadFileToClient(clientId, file) {
    return uploadClientCni(clientId, file);
}

async function pasteClipboardImage(clientId, onSuccess, onError) {
    try {
        const items = await navigator.clipboard.read();
        let found = false;
        for (const item of items) {
            const imageType = item.types.find(t => t.startsWith("image/"));
            if (imageType) {
                const blob = await item.getType(imageType);
                const file = new File([blob], `cni-clipboard.${imageType.split("/")[1] || "png"}`, { type: imageType });
                await uploadFileToClient(clientId, file);
                onSuccess?.();
                found = true;
                break;
            }
        }
        if (!found) onError?.("Aucune image dans le presse-papier.");
    } catch {
        onError?.("Impossible d'accéder au presse-papier (permission refusée ou aucune image).");
    }
}

function CniModal({ url, onClose }) {
    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4" onClick={onClose}>
            <div className="absolute inset-0 bg-black/80" />
            <div className="relative max-w-3xl w-full max-h-[90vh] flex flex-col items-center" onClick={e => e.stopPropagation()}>
                <button type="button" onClick={onClose}
                    className="absolute -top-10 right-0 p-2 rounded-lg bg-cca-base/40 border border-cca-border/40 hover:bg-cca-base/60 transition-all z-10">
                    <X size={18} />
                </button>
                <img src={url} alt="CNI" className="max-h-[85vh] max-w-full rounded-2xl shadow-2xl object-contain border border-cca-border/40" />
            </div>
        </div>
    );
}

function CniUploadBlock({ client, canUploadCni, onRefreshClient }) {
    const [uploading, setUploading] = useState(false);
    const [deleting, setDeleting] = useState(false);
    const [cniModalOpen, setCniModalOpen] = useState(false);
    const inputRef = useRef(null);

    if (!client) return null;

    async function doUpload(file) {
        setUploading(true);
        try {
            await uploadFileToClient(client.id, file);
            toast.success("CNI téléversée.");
            onRefreshClient?.();
        } catch (err) {
            toast.error(err?.response?.data?.message || "Upload impossible.");
        } finally {
            setUploading(false);
        }
    }

    async function onFileChange(e) {
        const file = e.target.files?.[0];
        if (!file) return;
        await doUpload(file);
        e.target.value = "";
    }

    async function onPaste() {
        setUploading(true);
        await pasteClipboardImage(
            client.id,
            () => { toast.success("CNI collée depuis le presse-papier."); onRefreshClient?.(); setUploading(false); },
            (msg) => { toast.error(msg); setUploading(false); }
        );
    }

    async function onDelete() {
        if (!window.confirm("Supprimer la CNI de ce client ?")) return;
        setDeleting(true);
        try {
            await deleteClientCni(client.id);
            toast.success("CNI supprimée.");
            onRefreshClient?.();
        } catch (err) {
            toast.error(err?.response?.data?.message || "Suppression impossible.");
        } finally {
            setDeleting(false);
        }
    }

    const hasCni = !!client.cniImagePublicId;
    const cniUrl = hasCni ? getClientCniUrl(client.cniImagePublicId) : null;

    return (
        <>
        {cniModalOpen && cniUrl && <CniModal url={cniUrl} onClose={() => setCniModalOpen(false)} />}
        <div className="bg-cca-base/30 border border-cca-border/40 rounded-2xl p-4 space-y-3">
            <div className="flex items-center gap-2">
                <IdCard size={16} className="text-cca-textSecondary/60" />
                <div className="text-[10px] uppercase font-black tracking-widest text-cca-textSecondary/60">Pièce d'identité (CNI)</div>
            </div>
            {hasCni ? (
                <div className="flex items-center gap-3 flex-wrap">
                    <button type="button" onClick={() => setCniModalOpen(true)}
                        className="px-3 py-1.5 rounded-lg bg-indigo-600/20 border border-indigo-500/30 text-xs text-indigo-300 font-bold hover:bg-indigo-600/30 transition-all">
                        Voir la CNI
                    </button>
                    {canUploadCni && (
                        <>
                            <GlassButton type="button" onClick={() => inputRef.current?.click()} disabled={uploading} className="text-[9px]">
                                <Upload size={14} /> Remplacer
                            </GlassButton>
                            <GlassButton type="button" onClick={onPaste} disabled={uploading} className="text-[9px] bg-violet-600/20 border-violet-500/30">
                                📋 Coller presse-papier
                            </GlassButton>
                            <GlassButton type="button" onClick={onDelete} disabled={deleting} className="bg-red-600/20 border-red-500/30 text-[9px]">
                                <Trash2 size={14} /> Supprimer
                            </GlassButton>
                        </>
                    )}
                </div>
            ) : (
                <div className="flex items-center gap-3 flex-wrap">
                    <div className="text-xs text-cca-textSecondary/40">Aucune CNI enregistrée.</div>
                    {canUploadCni && (
                        <>
                            <GlassButton type="button" onClick={() => inputRef.current?.click()} disabled={uploading} className="bg-indigo-600/20 border-indigo-500/30">
                                <Upload size={14} /> {uploading ? "Upload…" : "Téléverser CNI"}
                            </GlassButton>
                            <GlassButton type="button" onClick={onPaste} disabled={uploading} className="bg-violet-600/20 border-violet-500/30">
                                📋 {uploading ? "…" : "Coller presse-papier"}
                            </GlassButton>
                        </>
                    )}
                </div>
            )}
            <input ref={inputRef} type="file" accept="image/*" className="hidden" onChange={onFileChange} />
        </div>
        </>
    );
}

/* ============================================================================
   Page
============================================================================ */
export default function PawnshopEstimationsPage() {
    const navigate = useNavigate();
    const { activeCompanyId } = useCompany();
    const { has, isReady } = usePermissions();

    const canAccess = has("PAWNSHOP.ACCESS");
    const canView = has("PAWNSHOP.ESTIMATIONS.VIEW") || has("PAWNSHOP.ESTIMATIONS.MANAGE");
    const canCreate = has("PAWNSHOP.ESTIMATIONS.CREATE") || has("PAWNSHOP.ESTIMATIONS.MANAGE");
    const canManage = has("PAWNSHOP.ESTIMATIONS.MANAGE");
    const canConvert = canManage && (has("PAWNSHOP.PURCHASES.CREATE") || has("PAWNSHOP.PURCHASES.MANAGE"));
    const canUploadCni = has("PAWNSHOP.CLIENTS.UPLOAD_CNI") || has("PAWNSHOP.CLIENTS.MANAGE");
    const canViewPurchases = has("PAWNSHOP.PURCHASES.VIEW_ALL") || has("PAWNSHOP.PURCHASES.VIEW_SELF");
    const canManagePublicPage = has("PAWNSHOP.PUBLIC_PAGE.MANAGE");

    const [estimations, setEstimations] = useState([]);
    const [total, setTotal] = useState(null);
    const [loading, setLoading] = useState(false);
    const [page, setPage] = useState(1);
    const [filterStatus, setFilterStatus] = useState("OPEN");

    const [selectedId, setSelectedId] = useState(null);
    const [selected, setSelected] = useState(null);

    const [products, setProducts] = useState([]);

    const [newClientObj, setNewClientObj] = useState(null);
    const [newNotes, setNewNotes] = useState("");
    const [creating, setCreating] = useState(false);

    const [lineProductId, setLineProductId] = useState("");
    const [lineQty, setLineQty] = useState("1");
    const [lineBuy, setLineBuy] = useState("");
    const [addingLine, setAddingLine] = useState(false);

    const [assignClientObj, setAssignClientObj] = useState(null);
    const [assigningClient, setAssigningClient] = useState(false);

    async function refreshList() {
        if (!activeCompanyId) return;
        setLoading(true);
        try {
            const res = await listEstimations({ page, pageSize: 25, status: filterStatus || undefined });
            setEstimations(Array.isArray(res?.items) ? res.items : []);
            setTotal(Number.isFinite(res?.total) ? res.total : null);
        } catch {
            toast.error("Impossible de charger les estimations.");
        } finally {
            setLoading(false);
        }
    }

    async function refreshProducts() {
        try {
            const res = await listPurchaseCatalog({ includeInactive: false });
            setProducts(Array.isArray(res?.items) ? res.items : []);
        } catch { /* */ }
    }

    async function openEstimation(id) {
        setSelectedId(id);
        setSelected(null);
        try {
            const est = await getEstimation(id);
            setSelected(est);
            setAssignClientObj(est.client || null);
        } catch {
            toast.error("Impossible de charger l'estimation.");
            setSelectedId(null);
        }
    }

    async function refreshSelected() {
        if (!selectedId) return;
        const est = await getEstimation(selectedId);
        setSelected(est);
        setAssignClientObj(est.client || null);
    }

    useEffect(() => {
        if (!isReady || !activeCompanyId || !canAccess || !canView) return;
        refreshList();
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isReady, activeCompanyId, canAccess, canView, page, filterStatus]);

    useEffect(() => {
        if (!isReady || !activeCompanyId || !canAccess) return;
        refreshProducts();
    }, [isReady, activeCompanyId, canAccess]);

    async function onCreate() {
        setCreating(true);
        try {
            const est = await createEstimation({
                clientId: newClientObj?.id || null,
                notes: newNotes.trim() || null,
            });
            toast.success("Estimation créée.");
            setNewClientObj(null);
            setNewNotes("");
            await refreshList();
            await openEstimation(est.id);
        } catch (e) {
            toast.error(e?.response?.data?.message || "Création impossible.");
        } finally {
            setCreating(false);
        }
    }

    async function onAddLine() {
        if (!selected?.id) return;
        const productId = Number(lineProductId);
        const quantity = Number(String(lineQty).replace(",", "."));
        if (!Number.isFinite(productId) || productId <= 0) return toast.error("Produit invalide.");
        if (!Number.isFinite(quantity) || quantity <= 0) return toast.error("Quantité invalide.");
        const estimatedBuyPrice = safeText(lineBuy) ? Number(String(lineBuy).replace(",", ".")) : null;

        setAddingLine(true);
        try {
            await addEstimationItem(selected.id, { productId, quantity, estimatedBuyPrice });
            toast.success("Ligne ajoutée.");
            setLineProductId(""); setLineQty("1"); setLineBuy("");
            await refreshSelected();
        } catch (e) {
            toast.error(e?.response?.data?.message || "Ajout impossible.");
        } finally {
            setAddingLine(false);
        }
    }

    async function onDeleteLine(itemId) {
        if (!selected?.id || !canManage) return;
        try {
            await deleteEstimationItem(selected.id, itemId);
            toast.success("Ligne supprimée.");
            await refreshSelected();
        } catch (e) {
            toast.error(e?.response?.data?.message || "Suppression impossible.");
        }
    }

    async function onAssignClient() {
        if (!selected?.id || !assignClientObj?.id) return;
        setAssigningClient(true);
        try {
            await updateEstimation(selected.id, { clientId: assignClientObj.id });
            toast.success("Client associé.");
            await refreshSelected();
        } catch (e) {
            toast.error(e?.response?.data?.message || "Impossible d'associer le client.");
        } finally {
            setAssigningClient(false);
        }
    }

    async function onReject() {
        if (!selected?.id || !canManage) return;
        if (!window.confirm("Rejeter cette estimation ?")) return;
        try {
            const updated = await rejectEstimation(selected.id);
            toast.success("Estimation rejetée.");
            setSelected(updated);
            await refreshList();
        } catch (e) {
            toast.error(e?.response?.data?.message || "Impossible.");
        }
    }

    const [convertModal, setConvertModal] = useState(null); // { justificatif, copied }

    async function onConvert() {
        if (!selected?.id || !canConvert) return;
        if (!selected.clientId) return toast.error("Associer un client avant de convertir.");

        // If total >= 25000 and justificatif exists, force copy before converting
        const total25k = (selected.items || []).reduce((s, it) => s + Number(it.estimatedBuyPrice || 0) * Number(it.quantity || 0), 0);
        if (total25k >= 25000 && selected.justificatif) {
            setConvertModal({ justificatif: selected.justificatif, copied: false });
            return;
        }

        await doConvert();
    }

    async function doConvert() {
        try {
            const updated = await convertEstimation(selected.id);
            toast.success(`Feuille d'achat #${updated.convertedPurchase?.id} créée.`);
            setSelected(updated);
            setConvertModal(null);
            await refreshList();
        } catch (e) {
            toast.error(e?.response?.data?.message || "Conversion impossible.");
        }
    }

    const isOpen = selected?.status === "OPEN";

    const totalEstimated = useMemo(() => {
        if (!selected?.items) return 0;
        return selected.items.reduce((s, it) => s + Number(it.estimatedBuyPrice || 0) * Number(it.quantity || 0), 0);
    }, [selected]);

    if (!isReady) return <div className="p-6 text-cca-textPrimary">Chargement…</div>;
    if (!canAccess) return <div className="p-6 text-cca-textPrimary">Accès refusé (PAWNSHOP.ACCESS).</div>;
    if (!canView && !canCreate) return <div className="p-6 text-cca-textPrimary">Accès refusé (PAWNSHOP.ESTIMATIONS.VIEW).</div>;

    // Mobile: show detail panel when an estimation is selected
    const showMobileDetail = !!selectedId;

    return (
        <>
        {convertModal && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
                <div className="bg-cca-surface border border-cca-border rounded-xl shadow-2xl w-full max-w-lg p-6 space-y-4">
                    <h2 className="text-lg font-bold text-cca-textPrimary">⚠️ Déclaration d'origine des biens requise</h2>
                    <p className="text-sm text-cca-textSecondary">
                        Ce dossier dépasse 25 000 $. Vous devez copier et conserver la déclaration ci-dessous avant de créer la feuille d'achat.
                    </p>
                    <div className="bg-amber-900/20 border border-amber-500/40 rounded-lg p-4 text-sm text-cca-textPrimary whitespace-pre-wrap leading-relaxed max-h-60 overflow-y-auto">
                        {convertModal.justificatif}
                    </div>
                    <button
                        type="button"
                        onClick={async () => {
                            try {
                                await navigator.clipboard.writeText(convertModal.justificatif);
                            } catch {
                                // fallback: select text
                            }
                            setConvertModal(m => ({ ...m, copied: true }));
                        }}
                        className={`w-full py-2 rounded-lg text-sm font-semibold transition-colors ${convertModal.copied ? "bg-green-700 text-white" : "bg-amber-600 hover:bg-amber-500 text-white"}`}
                    >
                        {convertModal.copied ? "✓ Copié !" : "Copier la déclaration"}
                    </button>
                    <div className="flex gap-3 pt-1">
                        <button
                            type="button"
                            onClick={() => setConvertModal(null)}
                            className="flex-1 py-2 rounded-lg text-sm font-medium bg-cca-surface border border-cca-border text-cca-textSecondary hover:bg-cca-border transition-colors"
                        >
                            Annuler
                        </button>
                        <button
                            type="button"
                            disabled={!convertModal.copied}
                            onClick={doConvert}
                            className="flex-1 py-2 rounded-lg text-sm font-semibold bg-blue-600 text-white disabled:opacity-40 disabled:cursor-not-allowed hover:bg-blue-500 transition-colors"
                        >
                            Confirmer la conversion
                        </button>
                    </div>
                </div>
            </div>
        )}
        <div className="space-y-4 sm:space-y-8 text-cca-textPrimary">
            <div className="pb-2 flex items-start justify-between gap-2">
                <div className="min-w-0">
                    <h1 className="text-xl sm:text-3xl font-bold tracking-wide">Estimations</h1>
                    <p className="text-cca-textSecondary/40 text-xs sm:text-sm mt-1 hidden sm:block">
                        Créer une estimation → associer un client → vérifier CNI → convertir en feuille d'achat.
                    </p>
                </div>
                <div className="flex gap-2 shrink-0">
                    {canManagePublicPage && (
                        <GlassButton onClick={() => navigate("/dashboard/company/pawnshop/public-settings")} type="button">
                            <ExternalLink size={16} /> <span className="hidden sm:inline">Page publique</span>
                        </GlassButton>
                    )}
                    <GlassButton onClick={() => navigate("/dashboard/company/pawnshop/purchases")} type="button">
                        <Settings size={16} /> <span className="hidden sm:inline">Feuilles</span>
                    </GlassButton>
                </div>
            </div>

            {/* Créer estimation */}
            {canCreate && (
                <GlassCard title="Nouvelle estimation" subtitle="Client optionnel à la création">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3 items-end">
                        <div>
                            <div className="text-[10px] uppercase tracking-widest font-black text-cca-textSecondary/40 mb-1">Client (optionnel)</div>
                            <ClientSearchSelect value={newClientObj} onChange={setNewClientObj} />
                        </div>
                        <div>
                            <div className="text-[10px] uppercase tracking-widest font-black text-cca-textSecondary/40 mb-1">Notes</div>
                            <GlassInput value={newNotes} onChange={e => setNewNotes(e.target.value)} placeholder="Optionnel…" />
                        </div>
                        <GlassButton onClick={onCreate} disabled={creating} type="button" className="bg-indigo-600/30 hover:bg-indigo-600/40">
                            <Plus size={16} /> {creating ? "Création…" : "Créer"}
                        </GlassButton>
                    </div>
                </GlassCard>
            )}

            {/* Liste + Détail */}
            {canView && (
                <div className={["grid gap-6", showMobileDetail ? "grid-cols-1" : "grid-cols-1 lg:grid-cols-2"].join(" ")}>
                    {/* Liste — masquée sur mobile quand détail ouvert */}
                    <GlassCard
                        className={showMobileDetail ? "hidden lg:block" : ""}
                        title={`Estimations (${total ?? estimations.length})`}
                        right={
                            <div className="flex items-center gap-2">
                                <GlassSelect value={filterStatus} onChange={e => { setFilterStatus(e.target.value); setPage(1); }} className="text-xs">
                                    <option value="">Toutes</option>
                                    <option value="OPEN">Ouvertes</option>
                                    <option value="CONVERTED">Converties</option>
                                    <option value="REJECTED">Rejetées</option>
                                </GlassSelect>
                                <GlassButton onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page <= 1} type="button">←</GlassButton>
                                <span className="text-xs text-cca-textSecondary/40">{page}</span>
                                <GlassButton onClick={() => setPage(p => p + 1)} type="button">→</GlassButton>
                            </div>
                        }
                    >
                        {loading ? <div className="flex justify-center py-8"><Spinner /></div> :
                            estimations.length === 0 ? <div className="text-cca-textSecondary/40">Aucune estimation.</div> :
                                <div className="space-y-2">
                                    {estimations.map(est => (
                                        <button key={est.id} onClick={() => openEstimation(est.id)}
                                            className={["w-full text-left rounded-2xl px-5 py-4 bg-cca-base/40 border border-cca-border/30 hover:bg-brand-primary/10 hover:border-brand-primary/30 transition-all", selectedId === est.id ? "ring-2 ring-brand-primary/50" : ""].join(" ")}
                                            type="button">
                                            <div className="flex justify-between gap-2">
                                                <span className="font-semibold">#{est.id}</span>
                                                <span className={est.status === "CONVERTED" ? "text-emerald-400 text-xs font-black uppercase" : est.status === "REJECTED" ? "text-red-400 text-xs font-black uppercase" : "text-amber-400 text-xs font-black uppercase"}>{est.status}</span>
                                            </div>
                                            <div className="text-xs text-cca-textSecondary/60 mt-1">
                                                {est.client ? getClientLabel(est.client) : "Sans client"}
                                                {est.client?.cniImagePublicId ? <span className="ml-2 text-emerald-400">✓ CNI</span> : <span className="ml-2 text-amber-400">⚠ CNI manquante</span>}
                                            </div>
                                            <div className="text-[10px] text-cca-textSecondary/40 mt-0.5">
                                                {est.items?.length || 0} ligne(s) · Par {est.createdByEmployee?.user?.name || `#${est.createdByEmployeeId}`}
                                            </div>
                                        </button>
                                    ))}
                                </div>
                        }
                    </GlassCard>

                    {/* Détail */}
                    <GlassCard
                        title={
                            <div className="flex items-center gap-2">
                                {showMobileDetail && (
                                    <button type="button" onClick={() => { setSelectedId(null); setSelected(null); }}
                                        className="lg:hidden p-1.5 rounded-lg bg-cca-base/40 border border-cca-border/30 hover:bg-cca-base/60 transition-all mr-1">
                                        <X size={14} />
                                    </button>
                                )}
                                <span>Détail</span>
                            </div>
                        }
                        subtitle={selected ? `Estimation #${selected.id}` : "Sélectionne une estimation."}
                        right={selected && isOpen ? (
                            <div className="flex flex-wrap gap-2">
                                {canManage && (
                                    <GlassButton onClick={onReject} type="button" className="bg-red-600/20 border-red-500/30">
                                        <Ban size={16} /> <span className="hidden sm:inline">Rejeter</span>
                                    </GlassButton>
                                )}
                                {canConvert && (
                                    <GlassButton onClick={onConvert} disabled={!selected.clientId} type="button" className="bg-emerald-600/20 border-emerald-500/30">
                                        <CheckCircle2 size={16} /> <span className="hidden sm:inline">Convertir</span>
                                    </GlassButton>
                                )}
                            </div>
                        ) : null}
                    >
                        {!selected ? (
                            <div className="text-cca-textSecondary/40">Aucune estimation sélectionnée.</div>
                        ) : (
                            <div className="space-y-5">
                                {/* Statut */}
                                <div className="grid grid-cols-2 gap-3 text-sm">
                                    <div className="bg-cca-base/40 border border-cca-border/40 rounded-2xl p-3">
                                        <div className="text-[9px] uppercase font-black tracking-widest text-cca-textSecondary/40 mb-1">Statut</div>
                                        <div className={selected.status === "CONVERTED" ? "text-emerald-400 font-black uppercase" : selected.status === "REJECTED" ? "text-red-400 font-black uppercase" : "text-amber-400 font-black uppercase"}>{selected.status}</div>
                                    </div>
                                    <div className="bg-cca-base/40 border border-cca-border/40 rounded-2xl p-3">
                                        <div className="text-[9px] uppercase font-black tracking-widest text-cca-textSecondary/40 mb-1">Total estimé</div>
                                        <div className="font-mono text-cca-textPrimary">{fmtMoney(totalEstimated)}</div>
                                    </div>
                                </div>

                                {selected.convertedPurchase && (
                                    <div className="text-xs text-emerald-400 bg-emerald-500/10 border border-emerald-500/30 rounded-xl px-3 py-2">
                                        Convertie en feuille d'achat #{selected.convertedPurchase.id}
                                        {canViewPurchases && (
                                            <button type="button" onClick={() => navigate("/dashboard/company/pawnshop/purchases")} className="ml-2 underline">Voir</button>
                                        )}
                                    </div>
                                )}

                                {selected.isPublicSubmission && (
                                    <div className="text-[10px] text-indigo-400 bg-indigo-500/10 border border-indigo-500/20 rounded-lg px-3 py-1.5">
                                        Soumission via la page publique
                                    </div>
                                )}

                                {selected.justificatif && (
                                    <div className="bg-cca-base/30 border border-amber-500/30 rounded-2xl p-4 space-y-2">
                                        <div className="text-[10px] uppercase font-black tracking-widest text-amber-400/80">
                                            Déclaration d'origine des biens
                                        </div>
                                        <div className="text-xs text-cca-textPrimary/80 leading-relaxed italic whitespace-pre-wrap">
                                            {selected.justificatif}
                                        </div>
                                    </div>
                                )}

                                {/* Associer client */}
                                {isOpen && canManage && (
                                    <div className="bg-cca-base/30 border border-cca-border/40 rounded-2xl p-4 space-y-2">
                                        <div className="text-[10px] uppercase font-black tracking-widest text-cca-textSecondary/40">Client associé</div>
                                        <ClientSearchSelect value={assignClientObj} onChange={setAssignClientObj} />
                                        {assignClientObj?.id !== selected.clientId && (
                                            <GlassButton onClick={onAssignClient} disabled={assigningClient} type="button" className="bg-indigo-600/20">
                                                <Plus size={14} /> {assigningClient ? "…" : "Associer"}
                                            </GlassButton>
                                        )}
                                    </div>
                                )}

                                {/* CNI */}
                                {selected.client && (
                                    <CniUploadBlock
                                        client={selected.client}
                                        canUploadCni={canUploadCni}
                                        onRefreshClient={refreshSelected}
                                    />
                                )}

                                {/* Vérification identité */}
                                {selected.client && !selected.client.cniImagePublicId && (
                                    <div className="text-xs text-amber-300 bg-amber-500/10 border border-amber-500/30 rounded-xl px-3 py-2">
                                        ⚠ Pièce d'identité manquante — la conversion sera bloquée si la CNI n'est pas uploadée.
                                    </div>
                                )}

                                {/* Lignes */}
                                <div className="rounded-2xl border border-cca-border/40 overflow-x-auto">
                                    <table className="min-w-full text-sm text-cca-textPrimary border-separate border-spacing-0">
                                        <thead className="bg-cca-base/80">
                                            <tr>
                                                <th className="py-3 px-4 text-left text-[9px] font-black uppercase tracking-widest text-cca-textSecondary/60 border-b border-cca-border/30">Produit</th>
                                                <th className="py-3 px-4 text-right text-[9px] font-black uppercase tracking-widest text-cca-textSecondary/60 border-b border-cca-border/30">Qté</th>
                                                <th className="py-3 px-4 text-right text-[9px] font-black uppercase tracking-widest text-cca-textSecondary/60 border-b border-cca-border/30">Prix achat</th>
                                                <th className="py-3 px-4 text-right text-[9px] font-black uppercase tracking-widest text-cca-textSecondary/60 border-b border-cca-border/30">S/Total</th>
                                                {isOpen && canManage && <th className="py-3 px-4 border-b border-cca-border/30" />}
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-cca-border/30">
                                            {(selected.items || []).map(it => (
                                                <tr key={it.id} className="hover:bg-cca-surface/30 transition-all">
                                                    <td className="py-2 px-4 font-medium">{it.product?.name || `#${it.productId}`}</td>
                                                    <td className="py-2 px-4 text-right font-mono">{Number(it.quantity)}</td>
                                                    <td className="py-2 px-4 text-right font-mono">{fmtMoney(it.estimatedBuyPrice)}</td>
                                                    <td className="py-2 px-4 text-right font-mono text-amber-300">{fmtMoney(Number(it.estimatedBuyPrice) * Number(it.quantity))}</td>
                                                    {isOpen && canManage && (
                                                        <td className="py-2 px-4 text-right">
                                                            <GlassButton onClick={() => onDeleteLine(it.id)} type="button" className="px-2 py-1">
                                                                <Trash2 size={14} />
                                                            </GlassButton>
                                                        </td>
                                                    )}
                                                </tr>
                                            ))}
                                            {selected.items?.length === 0 && (
                                                <tr><td colSpan={5} className="py-4 text-center text-cca-textSecondary/40">Aucune ligne.</td></tr>
                                            )}
                                        </tbody>
                                    </table>
                                </div>

                                {/* Ajouter ligne */}
                                {isOpen && canManage && (
                                    <div className="grid grid-cols-1 md:grid-cols-4 gap-3 items-end">
                                        <div className="md:col-span-2">
                                            <div className="text-[10px] uppercase tracking-widest font-black text-cca-textSecondary/40 mb-1">Produit</div>
                                            <GlassSelect value={lineProductId} onChange={e => setLineProductId(e.target.value)}>
                                                <option value="">— Sélectionner —</option>
                                                {products.map(p => <option key={p.id} value={p.id}>#{p.id} — {p.name}</option>)}
                                            </GlassSelect>
                                        </div>
                                        <div>
                                            <div className="text-[10px] uppercase tracking-widest font-black text-cca-textSecondary/40 mb-1">Quantité</div>
                                            <GlassInput value={lineQty} onChange={e => setLineQty(e.target.value)} />
                                        </div>
                                        <div>
                                            <div className="text-[10px] uppercase tracking-widest font-black text-cca-textSecondary/40 mb-1">Prix achat</div>
                                            <GlassInput value={lineBuy} onChange={e => setLineBuy(e.target.value)} placeholder="Défaut produit" />
                                        </div>
                                        <div className="md:col-span-4 flex justify-end">
                                            <GlassButton onClick={onAddLine} disabled={addingLine} type="button">
                                                <Plus size={16} /> {addingLine ? "Ajout…" : "Ajouter"}
                                            </GlassButton>
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}
                    </GlassCard>
                </div>
            )}
        </div>
        </>
    );
}
