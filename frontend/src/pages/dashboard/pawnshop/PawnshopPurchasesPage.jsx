// frontend/src/pages/dashboard/pawnshop/PawnshopPurchasesPage.jsx

import React, {useCallback, useEffect, useMemo, useRef, useState} from "react";
import toast from "react-hot-toast";
import { useNavigate } from "react-router-dom";
import {
    Search,
    Plus,
    X,
    Trash2,
    CheckCircle2,
    Ban,
    Settings,
    AlertTriangle,
    Save,
    Banknote,
    UserCog,
    Upload,
    IdCard,
    FileText,
} from "lucide-react";

import { useCompany } from "@/contexts/CompanyContext.jsx";
import { usePermissions } from "@/contexts/PermissionsContext.jsx";
import Spinner from "@/components/ui/Spinner";
import { createPortal } from "react-dom";

import {
    listPurchases,
    createPurchase,
    getPurchase,
    addPurchaseItem,
    deletePurchaseItem,
    validatePurchase,
    cancelPurchase,
    markPurchasePaid,
    changePurchaseOwner,
    deleteCanceledPurchase,
    uploadClientCni,
    getClientCniUrl,
    listPartners,
    listPurchaseCatalog,
    listPawnshopClients,
    getPawnshopClient,
    createPawnshopClient,
    updatePawnshopClient,
} from "@/services/pawnshopService.js";
import { getCompanyEmployees } from "@/services/employeesService.js";

/* =============================================================================
   Utils
============================================================================= */
function fmtMoney(v) {
    const n = Number(v ?? 0);
    return Number.isFinite(n)
        ? n.toLocaleString("fr-FR", {
            style: "currency",
            currency: "USD",
            maximumFractionDigits: 2,
        })
        : "0,00 $US";
}

function safeText(v) {
    return (v ?? "").toString().trim();
}

function getClientLabel(c) {
    if (!c) return "";
    const name = safeText(c.name);
    return name ? `${name} (#${c.id})` : `Client #${c.id}`;
}

/* =============================================================================
   Clients API (Pawnshop)
============================================================================= */
async function getClients(params) {
    return listPawnshopClients(params);
}

async function getClientDetails(clientId) {
    return getPawnshopClient(clientId);
}

async function createClient(payload) {
    return createPawnshopClient(payload);
}

async function updateClient(clientId, payload) {
    return updatePawnshopClient(clientId, payload);
}

/* =============================================================================
   Glass UI helpers
============================================================================= */
function GlassCard({ title, subtitle, right, children, className = "", allowOverflow = false }) {
    return (
        <div
            className={[
                "relative rounded-3xl p-6",
                allowOverflow ? "overflow-visible" : "overflow-hidden",
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
                "text-cca-textPrimary placeholder:text-cca-textSecondary/40",
                "focus:outline-none focus:ring-2 focus:ring-brand-primary/20",
                "disabled:opacity-60 disabled:cursor-not-allowed transition-all",
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
                "text-cca-textPrimary",
                "focus:outline-none focus:ring-2 focus:ring-brand-primary/20",
                "disabled:opacity-60 disabled:cursor-not-allowed transition-all",
                className,
            ].join(" ")}
            {...props}
        >
            {children}
        </select>
    );
}

/* =============================================================================
   CNI Modal
============================================================================= */
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

/* =============================================================================
   Modal
============================================================================= */
function Modal({ open, title, onClose, children, footer, maxWidthClass = "max-w-xl" }) {
    if (!open) return null;
    return (
        <div className="fixed inset-0 z-[80] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/70" onClick={onClose} />
            <div
                className={[
                    "relative w-full overflow-hidden rounded-[2.5rem]",
                    maxWidthClass,
                    "bg-cca-surface/90 border border-cca-border/60 backdrop-blur-3xl shadow-[0_0_50px_rgba(0,0,0,0.8)]",
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
                <div className="relative p-5 border-b border-cca-border/50 flex items-center justify-between">
                    <div className="text-lg font-bold text-cca-textPrimary">{title}</div>
                    <button
                        className="p-2 rounded-lg hover:bg-cca-base/40 border border-transparent hover:border-cca-border/50"
                        onClick={onClose}
                        type="button"
                    >
                        <X size={18} />
                    </button>
                </div>
                <div className="relative p-5">{children}</div>
                {footer ? <div className="relative p-5 border-t border-cca-border/50">{footer}</div> : null}
            </div>
        </div>
    );
}

/* =============================================================================
   Create Client Modal (compatible Prisma Client model)
============================================================================= */
function CreateClientModal({ open, onClose, onCreated, canCreateClient = false }) {
    const [saving, setSaving] = useState(false);
    const [firstName, setFirstName] = useState("");
    const [lastName, setLastName] = useState("");
    const [phoneNumber, setPhoneNumber] = useState("");
    const [iban, setIban] = useState("");
    const [address, setAddress] = useState("");

    useEffect(() => {
        if (!open) return;
        setFirstName("");
        setLastName("");
        setPhoneNumber("");
        setIban("");
        setAddress("");
    }, [open]);

    async function onSubmit() {
        if (!canCreateClient) return toast.error("Permission manquante : PAWNSHOP.CLIENTS.CREATE");

        const fn = safeText(firstName);
        const ln = safeText(lastName);
        const ph = safeText(phoneNumber);
        const ib = safeText(iban);
        const addr = safeText(address);

        if (!fn || !ln) return toast.error("Prénom + nom requis.");
        if (!ph) return toast.error("Téléphone requis (validation achat).");
        if (!ib) return toast.error("IBAN requis (validation achat).");

        const payload = {
            name: `${fn} ${ln}`.trim(),
            phoneNumber: ph || null,
            iban: ib || null,
            address: addr || null,
        };

        setSaving(true);
        try {
            const created = await createClient(payload);
            const client = created?.client ?? created?.data ?? created;
            if (!client?.id) {
                toast.error("Client créé, mais réponse inattendue (id manquant).");
            } else {
                toast.success("Client créé.");
                onCreated?.(client);
                onClose?.();
            }
        } catch (e) {
            console.error(e);
            toast.error(e?.response?.data?.message || "Création client impossible.");
        } finally {
            setSaving(false);
        }
    }

    return (
        <Modal
            open={open}
            title="Créer un client"
            onClose={() => !saving && onClose?.()}
            footer={
                <div className="flex justify-end gap-2">
                    <GlassButton onClick={onClose} disabled={saving} type="button">
                        Annuler
                    </GlassButton>
                    <GlassButton
                        onClick={onSubmit}
                        disabled={saving || !canCreateClient}
                        className="bg-indigo-600/30 hover:bg-indigo-600/40"
                        type="button"
                    >
                        <Plus size={16} />
                        {saving ? "Création…" : canCreateClient ? "Créer" : "Permission manquante"}
                    </GlassButton>
                </div>
            }
        >
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                    <div className="text-xs text-cca-textSecondary/40 mb-1">Prénom</div>
                    <GlassInput value={firstName} onChange={(e) => setFirstName(e.target.value)} />
                </div>
                <div>
                    <div className="text-xs text-cca-textSecondary/40 mb-1">Nom</div>
                    <GlassInput value={lastName} onChange={(e) => setLastName(e.target.value)} />
                </div>
                <div className="md:col-span-2">
                    <div className="text-xs text-cca-textSecondary/40 mb-1">Téléphone (requis)</div>
                    <GlassInput
                        value={phoneNumber}
                        onChange={(e) => setPhoneNumber(e.target.value)}
                        placeholder="+33…"
                    />
                </div>
                <div className="md:col-span-2">
                    <div className="text-xs text-cca-textSecondary/40 mb-1">IBAN (requis)</div>
                    <GlassInput value={iban} onChange={(e) => setIban(e.target.value)} placeholder="A87…" />
                </div>
                <div className="md:col-span-2">
                    <div className="text-xs text-cca-textSecondary/40 mb-1">Adresse (optionnel)</div>
                    <GlassInput value={address} onChange={(e) => setAddress(e.target.value)} />
                </div>
                <div className="md:col-span-2 text-xs text-cca-textSecondary/40">
                    La feuille d’achat ne peut pas être validée si <b>téléphone</b> + <b>IBAN</b> ne sont pas renseignés.
                </div>
            </div>
        </Modal>
    );
}

/* =============================================================================
   Edit Client Modal (UI-first: complétion du compte)
   - verrouille le nom (pas de modif prénom/nom ici)
   - permet de compléter téléphone / IBAN / adresse
============================================================================= */
function EditClientModal({ open, onClose, client, onUpdated, canUpdateClient = false }) {
    const [saving, setSaving] = useState(false);

    const [phoneNumber, setPhoneNumber] = useState("");
    const [iban, setIban] = useState("");
    const [address, setAddress] = useState("");

    useEffect(() => {
        if (!open) return;
        setPhoneNumber(client?.phoneNumber ?? "");
        setIban(client?.iban ?? "");
        setAddress(client?.address ?? "");
    }, [open, client]);

    async function onSubmit() {
        if (!client?.id) return;
        if (!canUpdateClient) return toast.error("Permission manquante : PAWNSHOP.CLIENTS.UPDATE");

        const ph = safeText(phoneNumber);
        const ib = safeText(iban);
        const addr = safeText(address);

        if (!ph) return toast.error("Téléphone requis.");
        if (!ib) return toast.error("IBAN requis.");

        setSaving(true);
        try {
            const updated = await updateClient(client.id, {
                phoneNumber: ph || null,
                iban: ib || null,
                address: addr || null,
            });

            const nextClient = updated?.client ?? updated?.data ?? updated;
            if (!nextClient?.id) {
                toast.success("Client mis à jour.");
                // fallback: garde l'ancien objet mais met à jour localement
                onUpdated?.({
                    ...client,
                    phoneNumber: ph,
                    iban: ib,
                    address: addr || null,
                });
            } else {
                toast.success("Client mis à jour.");
                onUpdated?.(nextClient);
            }

            onClose?.();
        } catch (e) {
            console.error(e);
            toast.error(e?.response?.data?.message || "Mise à jour client impossible.");
        } finally {
            setSaving(false);
        }
    }

    return (
        <Modal
            open={open}
            title="Mise à jour client"
            onClose={() => !saving && onClose?.()}
            footer={
                <div className="flex justify-end gap-2">
                    <GlassButton onClick={onClose} disabled={saving} type="button">
                        Annuler
                    </GlassButton>
                    <GlassButton
                        onClick={onSubmit}
                        disabled={saving || !canUpdateClient}
                        className="bg-amber-500/10 hover:bg-amber-500/15 border-amber-500/30"
                        type="button"
                    >
                        <Save size={16} />
                        {saving ? "Enregistrement…" : "Enregistrer"}
                    </GlassButton>
                </div>
            }
            maxWidthClass="max-w-2xl"
        >
            <div className="space-y-4">
                <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 flex items-start gap-2">
                    <AlertTriangle className="mt-0.5 text-amber-300" size={16} />
                    <div className="text-sm">
                        <div className="font-semibold text-amber-200">Compte incomplet</div>
                        <div className="text-amber-200/80 text-xs mt-0.5">
                            Téléphone et IBAN sont requis pour créer/valider une feuille d’achat.
                        </div>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div className="md:col-span-2">
                        <div className="text-xs text-cca-textSecondary/40 mb-1">Client (nom verrouillé)</div>
                        <GlassInput value={client?.name || `Client #${client?.id ?? "—"}`} disabled />
                    </div>

                    <div className="md:col-span-2">
                        <div className="text-xs text-cca-textSecondary/40 mb-1">Téléphone (requis)</div>
                        <GlassInput value={phoneNumber} onChange={(e) => setPhoneNumber(e.target.value)} placeholder="+33…" />
                    </div>

                    <div className="md:col-span-2">
                        <div className="text-xs text-cca-textSecondary/40 mb-1">IBAN (requis)</div>
                        <GlassInput value={iban} onChange={(e) => setIban(e.target.value)} placeholder="FR76…" />
                    </div>

                    <div className="md:col-span-2">
                        <div className="text-xs text-cca-textSecondary/40 mb-1">Adresse (optionnel)</div>
                        <GlassInput value={address} onChange={(e) => setAddress(e.target.value)} />
                    </div>
                </div>
            </div>
        </Modal>
    );
}

/* =============================================================================
   Client Select (search + bouton "Créer un client")
============================================================================= */
function ClientSelect({ value, onChange, onCreateRequested, canCreateClient = false }) {
    const wrapRef = useRef(null);
    const anchorRef = useRef(null);
    const dropdownRef = useRef(null);

    const [open, setOpen] = useState(false);
    const [dropdownRect, setDropdownRect] = useState(null);

    const [query, setQuery] = useState("");
    const [loading, setLoading] = useState(false);

    const [items, setItems] = useState([]);
    const [baseItems, setBaseItems] = useState([]);

    const selectedLabel = value ? getClientLabel(value) : "";

    const recomputePosition = useCallback(() => {
        const el = anchorRef.current;
        if (!el) return;

        const r = el.getBoundingClientRect();
        const width = r.width;

        const maxH = 320;
        let top = r.bottom + 8;
        let left = r.left;

        const spaceBelow = window.innerHeight - top;
        if (spaceBelow < 220) {
            const aboveTop = r.top - 8 - maxH;
            if (aboveTop > 12) top = aboveTop;
        }

        const maxLeft = window.innerWidth - width - 12;
        left = Math.max(12, Math.min(left, maxLeft));

        setDropdownRect({ top, left, width, maxH });
    }, []);

    // ✅ Click outside FIX (wrap + dropdown portal)
    useEffect(() => {
        if (!open) return;

        function onDocPointerDown(e) {
            const t = e.target;
            const wrap = wrapRef.current;
            const drop = dropdownRef.current;

            const inWrap = wrap && wrap.contains(t);
            const inDrop = drop && drop.contains(t);

            if (!inWrap && !inDrop) setOpen(false);
        }

        // pointerdown est plus fiable que mousedown/click pour éviter des races
        document.addEventListener("pointerdown", onDocPointerDown);
        return () => document.removeEventListener("pointerdown", onDocPointerDown);
    }, [open]);

    useEffect(() => {
        if (!open) return;
        recomputePosition();

        const onScroll = () => recomputePosition();
        const onResize = () => recomputePosition();

        window.addEventListener("scroll", onScroll, true);
        window.addEventListener("resize", onResize);

        return () => {
            window.removeEventListener("scroll", onScroll, true);
            window.removeEventListener("resize", onResize);
        };
    }, [open, recomputePosition]);

    // Charge les clients à l’ouverture
    useEffect(() => {
        if (!open) return;

        let cancelled = false;
        (async () => {
            setLoading(true);
            try {
                const raw = await getClients({ page: 1, limit: 50, search: query.trim() });

                let list = [];
                if (Array.isArray(raw)) list = raw;
                else if (Array.isArray(raw?.data)) list = raw.data;
                else if (Array.isArray(raw?.items)) list = raw.items;
                else if (Array.isArray(raw?.clients)) list = raw.clients;
                else if (Array.isArray(raw?.rows)) list = raw.rows;

                if (cancelled) return;
                setBaseItems(list);

                const q = query.trim().toLowerCase();
                const filtered = q
                    ? list.filter((c) => (c?.name || "").toLowerCase().includes(q))
                    : list;

                setItems(filtered.slice(0, 50));
            } catch (e) {
                console.error(e);
                if (!cancelled) {
                    setBaseItems([]);
                    setItems([]);
                }
            } finally {
                if (!cancelled) setLoading(false);
            }
        })();

        return () => {
            cancelled = true;
        };
    }, [open, query]);

    // Les résultats sont filtrés côté API Pawnshop ; on garde aussi le cache local pour l'affichage immédiat.
    useEffect(() => {
        if (!open) return;
        const q = query.trim().toLowerCase();
        const filtered = q
            ? baseItems.filter((c) => (c?.name || "").toLowerCase().includes(q))
            : baseItems;
        setItems(filtered.slice(0, 50));
    }, [query, open, baseItems]);

    const dropdown =
        open && dropdownRect
            ? createPortal(
                <div
                    ref={dropdownRef}
                    className={[
                        "fixed z-[9999] overflow-hidden rounded-[2rem]",
                        "bg-cca-surface/95 border border-cca-border backdrop-blur-3xl shadow-2xl shadow-black/80",
                    ].join(" ")}
                    style={{
                        top: dropdownRect.top,
                        left: dropdownRect.left,
                        width: dropdownRect.width,
                    }}
                >
                    <div className="p-4 border-b border-cca-border/50 flex gap-3 items-center bg-cca-base/20">
                        <div className="flex-1">
                            <div className="relative">
                                <div className="absolute left-4 top-1/2 -translate-y-1/2 text-cca-textSecondary/50">
                                    <Search size={16} />
                                </div>
                                <GlassInput
                                    value={query}
                                    onChange={(e) => setQuery(e.target.value)}
                                    placeholder="Rechercher par nom..."
                                    className="pl-12 h-12 bg-cca-base/40"
                                    autoFocus
                                />
                            </div>
                        </div>

                        {canCreateClient ? (
                            <GlassButton
                                type="button"
                                onClick={() => {
                                    setOpen(false);
                                    onCreateRequested?.();
                                }}
                                className="whitespace-nowrap h-12 bg-brand-primary text-white border-brand-light/20 shadow-lg shadow-brand-primary/20"
                            >
                                <Plus size={16} />
                                Nouveau Client
                            </GlassButton>
                        ) : null}
                    </div>

                    <div className="max-h-80 overflow-auto" style={{ maxHeight: dropdownRect.maxH }}>
                        {loading ? (
                            <div className="p-8 text-cca-textSecondary/60 flex flex-col items-center gap-3">
                                <Spinner />
                                <span className="text-[10px] font-black uppercase tracking-widest">Recherche en cours...</span>
                            </div>
                        ) : items.length === 0 ? (
                            <div className="p-8 text-center text-cca-textSecondary/40 italic">Aucun client trouvé.</div>
                        ) : (
                            items.map((c) => (
                                <button
                                    key={c.id}
                                    type="button"
                                    onClick={() => {
                                        onChange?.(c);
                                        setOpen(false);
                                    }}
                                    className={[
                                        "w-full text-left px-6 py-4",
                                        "hover:bg-brand-primary/10 transition-all",
                                        "border-b border-cca-border/10 last:border-b-0 group",
                                    ].join(" ")}
                                >
                                    <div className="font-black text-cca-textPrimary group-hover:text-brand-primary transition-colors">{getClientLabel(c)}</div>
                                    <div className="text-[10px] font-bold text-cca-textSecondary/50 mt-1 uppercase tracking-widest">
                                        Tel: {c.phoneNumber || "—"} · IBAN: {c.iban || "—"}
                                    </div>
                                </button>
                            ))
                        )}
                    </div>
                </div>,
                document.body
            )
            : null;

    return (
        <div ref={wrapRef} className="relative">
            <button
                ref={anchorRef}
                type="button"
                onClick={() => setOpen((v) => !v)}
                className={[
                    "w-full px-4 py-3 rounded-xl text-sm text-left transition-all",
                    "bg-cca-base/40 border border-cca-border/40 hover:border-cca-border/80",
                    "flex items-center justify-between gap-2 shadow-inner",
                ].join(" ")}
            >
        <span className={selectedLabel ? "text-cca-textPrimary font-bold" : "text-cca-textSecondary/40"}>
          {selectedLabel || "Sélectionner un client de la base…"}
        </span>
                <Search size={16} className="text-cca-textSecondary/40" />
            </button>

            {dropdown}
        </div>
    );
}


/* =============================================================================
   Page
============================================================================= */
export default function PawnshopPurchasesPage() {
    const navigate = useNavigate();
    const { activeCompanyId } = useCompany();
    const { has, isReady } = usePermissions();

    const canAccess = has("PAWNSHOP.ACCESS");
    const canViewAny = has("PAWNSHOP.PURCHASES.VIEW_ALL") || has("PAWNSHOP.PURCHASES.VIEW_SELF");
    const canCreate = has("PAWNSHOP.PURCHASES.CREATE");
    const canUpdate = has("PAWNSHOP.PURCHASES.UPDATE");
    const canValidate = has("PAWNSHOP.PURCHASES.VALIDATE");
    const canCancel = has("PAWNSHOP.PURCHASES.CANCEL");
    const canMarkPaid = has("PAWNSHOP.PURCHASES.MARK_PAID") || has("PAWNSHOP.PURCHASES.MANAGE");
    const canChangeOwner = has("PAWNSHOP.PURCHASES.CHANGE_OWNER") || has("PAWNSHOP.PURCHASES.MANAGE");
    const canDeleteCanceled = has("PAWNSHOP.PURCHASES.DELETE_CANCELED") || has("PAWNSHOP.PURCHASES.MANAGE");
    const canUploadCni = has("PAWNSHOP.CLIENTS.UPLOAD_CNI") || has("PAWNSHOP.CLIENTS.MANAGE");
    const canCreateClient = has("PAWNSHOP.CLIENTS.CREATE") || has("PAWNSHOP.CLIENTS.MANAGE");
    const canUpdateClient = has("PAWNSHOP.CLIENTS.UPDATE") || has("PAWNSHOP.CLIENTS.MANAGE");
    const canUsePage = canCreate || canViewAny;

    const [loadingList, setLoadingList] = useState(false);
    const [page, setPage] = useState(1);
    const pageSize = 25;

    const [purchases, setPurchases] = useState([]);
    const [total, setTotal] = useState(null);

    const [products, setProducts] = useState([]);
    const productById = useMemo(() => new Map(products.map((p) => [p.id, p])), [products]);

    const [partners, setPartners] = useState([]);
    const [employees, setEmployees] = useState([]);

    const [filterSearch, setFilterSearch] = useState("");
    const [filterStatus, setFilterStatus] = useState("");
    const [filterEmployeeId, setFilterEmployeeId] = useState("");
    const [filterDateStart, setFilterDateStart] = useState("");
    const [filterDateEnd, setFilterDateEnd] = useState("");

    const [selectedId, setSelectedId] = useState(null);
    const [selected, setSelected] = useState(null);

    const [client, setClient] = useState(null);

    // UX: on force le flow
    const [isPartnerOrder, setIsPartnerOrder] = useState(false);
    const [partnerId, setPartnerId] = useState("");
    const [creating, setCreating] = useState(false);

    const [createClientOpen, setCreateClientOpen] = useState(false);
    const [editClientOpen, setEditClientOpen] = useState(false);

    const [lineProductId, setLineProductId] = useState("");
    const [lineQty, setLineQty] = useState("1");
    const [lineBuy, setLineBuy] = useState("");
    const [lineResale, setLineResale] = useState("");
    const [addingLine, setAddingLine] = useState(false);

    const [changeOwnerEmployeeId, setChangeOwnerEmployeeId] = useState("");
    const [changingOwner, setChangingOwner] = useState(false);
    const [uploadingCni, setUploadingCni] = useState(false);
    const [cniModalUrl, setCniModalUrl] = useState(null);
    const cniInputRef = React.useRef(null);

    const isClientIncomplete = useMemo(() => {
        if (!client) return false;
        return !safeText(client.phoneNumber) || !safeText(client.iban);
    }, [client]);

    async function refreshProductsPartners() {
        if (!activeCompanyId || !canCreate) {
            setProducts([]);
            setPartners([]);
            return;
        }

        try {
            const [prod, part] = await Promise.all([
                listPurchaseCatalog({ includeInactive: false }),
                listPartners({ includeInactive: false }),
            ]);
            setProducts(Array.isArray(prod?.items) ? prod.items : Array.isArray(prod) ? prod : []);
            setPartners(Array.isArray(part?.items) ? part.items : Array.isArray(part) ? part : []);
        } catch (e) {
            console.error(e);
            toast.error("Impossible de charger le catalogue achat / les partenaires.");
        }
    }

    async function refreshList() {
        if (!activeCompanyId) return;
        setLoadingList(true);
        try {
            const res = await listPurchases({
                page,
                pageSize,
                search: filterSearch || undefined,
                status: filterStatus || undefined,
                employeeId: filterEmployeeId || undefined,
                dateStart: filterDateStart || undefined,
                dateEnd: filterDateEnd || undefined,
            });
            setPurchases(Array.isArray(res?.items) ? res.items : Array.isArray(res) ? res : []);
            setTotal(Number.isFinite(res?.total) ? res.total : null);
        } catch (e) {
            console.error(e);
            toast.error("Impossible de charger les feuilles.");
        } finally {
            setLoadingList(false);
        }
    }

    async function refreshEmployees() {
        if (!activeCompanyId) return;
        try {
            const res = await getCompanyEmployees(activeCompanyId);
            setEmployees(Array.isArray(res) ? res : res?.items || []);
        } catch (e) {
            console.error(e);
        }
    }

    useEffect(() => {
        if (!isReady || !activeCompanyId || !canAccess) return;
        refreshEmployees();
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isReady, activeCompanyId, canAccess]);

    useEffect(() => {
        if (!isReady) return;
        if (!activeCompanyId) return;
        if (!canAccess || !canCreate) return;
        refreshProductsPartners();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isReady, activeCompanyId, canAccess, canCreate]);

    useEffect(() => {
        if (!isReady) return;
        if (!activeCompanyId) return;
        if (!canAccess || !canViewAny) return;
        refreshList();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isReady, activeCompanyId, canAccess, canViewAny, page, filterSearch, filterStatus, filterEmployeeId, filterDateStart, filterDateEnd]);

    async function handleSelectClient(nextClient) {
        if (!nextClient?.id) {
            setClient(null);
            return;
        }

        try {
            const fullClient = await getClientDetails(nextClient.id);
            setClient(fullClient?.id ? fullClient : nextClient);
        } catch (e) {
            console.error(e);
            setClient(nextClient);
            toast.error(e?.response?.data?.message || "Impossible de charger le détail du client.");
        }
    }

    async function openPurchase(id) {
        setSelectedId(id);
        setSelected(null);
        try {
            const p = await getPurchase(id);
            setSelected(p);
        } catch (e) {
            console.error(e);
            toast.error("Impossible de charger la feuille.");
            setSelectedId(null);
        }
    }

    async function onCreatePurchase() {
        if (!activeCompanyId) return;
        if (!client?.id) return toast.error("Sélectionne un client.");

        if (isPartnerOrder && !partnerId) {
            return toast.error("Commande partenaire : sélectionne un partenaire.");
        }

        const pid = partnerId ? Number(partnerId) : null;

        setCreating(true);
        try {
            const created = await createPurchase({
                clientId: client.id,
                partnerId: pid && Number.isFinite(pid) ? pid : null,
            });
            toast.success("Feuille créée.");
            setPartnerId("");
            await refreshList();
            if (created?.id) await openPurchase(created.id);
        } catch (e) {
            console.error(e);
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

        const payload = { productId, quantity };
        if (safeText(lineBuy) !== "") payload.unitBuyPrice = Number(String(lineBuy).replace(",", "."));
        if (safeText(lineResale) !== "") payload.unitResalePrice = Number(String(lineResale).replace(",", "."));

        setAddingLine(true);
        try {
            await addPurchaseItem(selected.id, payload);
            toast.success("Ligne ajoutée.");
            setLineProductId("");
            setLineQty("1");
            setLineBuy("");
            setLineResale("");
            await openPurchase(selected.id);
        } catch (e) {
            console.error(e);
            toast.error(e?.response?.data?.message || "Ajout impossible.");
        } finally {
            setAddingLine(false);
        }
    }

    async function onDeleteLine(itemId) {
        if (!selected?.id) return;
        if (!canUpdate) return toast.error("Permission manquante.");
        try {
            await deletePurchaseItem(selected.id, itemId);
            toast.success("Ligne supprimée.");
            await openPurchase(selected.id);
        } catch (e) {
            console.error(e);
            toast.error(e?.response?.data?.message || "Suppression impossible.");
        }
    }

    async function onValidate() {
        if (!selected?.id) return;
        if (!canValidate) return toast.error("Permission manquante.");
        try {
            const updated = await validatePurchase(selected.id);
            toast.success("Feuille validée.");
            setSelected(updated);
            await refreshList();
        } catch (e) {
            console.error(e);
            toast.error(e?.response?.data?.message || "Validation impossible.");
        }
    }

    async function onCancel() {
        if (!selected?.id) return;
        if (!canCancel) return toast.error("Permission manquante.");
        try {
            const updated = await cancelPurchase(selected.id, { reason: "Annulation" });
            toast.success("Feuille annulée.");
            setSelected(updated);
            await refreshList();
        } catch (e) {
            console.error(e);
            toast.error(e?.response?.data?.message || "Annulation impossible.");
        }
    }

    async function onMarkPaid() {
        if (!selected?.id) return;
        if (!canMarkPaid) return toast.error("Permission manquante.");
        try {
            const updated = await markPurchasePaid(selected.id);
            toast.success("Virement marqué comme effectué.");
            setSelected(updated);
            await refreshList();
        } catch (e) {
            console.error(e);
            toast.error(e?.response?.data?.message || "Impossible de marquer le paiement.");
        }
    }

    async function onChangeOwner() {
        if (!selected?.id) return;
        if (!canChangeOwner) return toast.error("Permission manquante.");
        const eid = Number(changeOwnerEmployeeId);
        if (!Number.isFinite(eid) || eid <= 0) return toast.error("Sélectionne un employé.");
        setChangingOwner(true);
        try {
            const updated = await changePurchaseOwner(selected.id, eid);
            toast.success("Propriétaire modifié.");
            setSelected(updated);
            setChangeOwnerEmployeeId("");
            await refreshList();
        } catch (e) {
            console.error(e);
            toast.error(e?.response?.data?.message || "Impossible de changer le propriétaire.");
        } finally {
            setChangingOwner(false);
        }
    }

    async function onDeleteCanceled() {
        if (!selected?.id) return;
        if (!canDeleteCanceled) return toast.error("Permission manquante.");
        if (!window.confirm(`Supprimer définitivement la feuille annulée #${selected.id} ?`)) return;
        try {
            await deleteCanceledPurchase(selected.id);
            toast.success("Feuille supprimée.");
            setSelected(null);
            setSelectedId(null);
            await refreshList();
        } catch (e) {
            console.error(e);
            toast.error(e?.response?.data?.message || "Suppression impossible.");
        }
    }

    async function onCniPaste(targetClientId) {
        setUploadingCni(true);
        try {
            const items = await navigator.clipboard.read();
            let found = false;
            for (const item of items) {
                const imageType = item.types.find(t => t.startsWith("image/"));
                if (imageType) {
                    const blob = await item.getType(imageType);
                    const file = new File([blob], `cni-clipboard.${imageType.split("/")[1] || "png"}`, { type: imageType });
                    await uploadClientCni(targetClientId, file);
                    toast.success("CNI collée depuis le presse-papier.");
                    if (selected?.client?.id === targetClientId) {
                        const p = await getPurchase(selected.id);
                        setSelected(p);
                    }
                    if (client?.id === targetClientId) {
                        const updated = await getPawnshopClient(targetClientId);
                        setClient(updated);
                    }
                    found = true;
                    break;
                }
            }
            if (!found) toast.error("Aucune image dans le presse-papier.");
        } catch {
            toast.error("Impossible d'accéder au presse-papier (permission refusée ou aucune image).");
        } finally {
            setUploadingCni(false);
        }
    }

    async function onCniFileChange(e, targetClientId) {
        const file = e.target.files?.[0];
        if (!file) return;
        setUploadingCni(true);
        try {
            await uploadClientCni(targetClientId, file);
            toast.success("CNI téléversée.");
            // Refresh client data
            if (selected?.client?.id === targetClientId) {
                const p = await getPurchase(selected.id);
                setSelected(p);
            }
            if (client?.id === targetClientId) {
                const updated = await getPawnshopClient(targetClientId);
                setClient(updated);
            }
        } catch (err) {
            toast.error(err?.response?.data?.message || "Upload impossible.");
        } finally {
            setUploadingCni(false);
            e.target.value = "";
        }
    }

    if (!isReady) return <div className="p-6 text-cca-textPrimary">Chargement…</div>;
    if (!canAccess) return <div className="p-6 text-cca-textPrimary">Accès refusé (PAWNSHOP.ACCESS).</div>;
    if (!canUsePage) return <div className="p-6 text-cca-textPrimary">Accès refusé (PAWNSHOP.PURCHASES.CREATE ou VIEW_SELF / VIEW_ALL).</div>;

    return (
        <>
        {cniModalUrl && <CniModal url={cniModalUrl} onClose={() => setCniModalUrl(null)} />}
        <div className="space-y-8 text-cca-textPrimary">
            {/* Header + shortcut */}
            <div className="pb-2 flex items-start justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold tracking-wide">Pawnshop — Feuilles d&apos;achat</h1>
                    <p className="text-cca-textSecondary/40 text-sm mt-1">
                        Créer une feuille, sélectionner/créer un client, ajouter des produits, puis valider.
                    </p>
                </div>

                <div className="flex gap-2">
                    <GlassButton onClick={() => navigate("/dashboard/company/pawnshop/manage")} type="button">
                        <Settings size={16} />
                        Gérer
                    </GlassButton>
                </div>
            </div>

            {/* Create purchase (compact + guided flow) */}
            <GlassCard
                allowOverflow
                title="Nouvelle feuille"
                subtitle="1) Client → 2) Commande partenaire (optionnel) → 3) Création"
                right={<div className="text-xs text-cca-textSecondary/40">Téléphone + IBAN requis pour la validation.</div>}
                className="p-4"
            >
                {!canCreate ? (
                    <div className="text-sm text-cca-textSecondary/40">Permission manquante : PAWNSHOP.PURCHASES.CREATE</div>
                ) : (
                    <div className="space-y-3">
                        {/* Step 1: Client */}
                        <div className="grid grid-cols-1 md:grid-cols-[1fr_auto] gap-3 items-end">
                            <div>
                                <div className="text-[11px] uppercase tracking-wide text-cca-textSecondary/40 mb-1">Client</div>
                                <ClientSelect
                                    value={client}
                                    onChange={(c) => {
                                        handleSelectClient(c);
                                        if (!isPartnerOrder) setPartnerId("");
                                    }}
                                    onCreateRequested={() => setCreateClientOpen(true)}
                                    canCreateClient={canCreateClient}
                                />

                                {client ? (
                                    <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
                    <span className="px-2 py-1 rounded-md bg-cca-base border border-cca-border/60 text-cca-textSecondary">
                      Tel: <span className="font-mono">{client.phoneNumber || "—"}</span>
                    </span>
                                        <span className="px-2 py-1 rounded-md bg-cca-base border border-cca-border/60 text-cca-textSecondary">
                      IBAN: <span className="font-mono">{client.iban || "—"}</span>
                    </span>
                                        <span className="px-2 py-1 rounded-md bg-cca-base border border-cca-border/60 text-cca-textSecondary max-w-full truncate">
                      Adresse: <span className="font-mono">{client.address || "—"}</span>
                    </span>
                                    </div>
                                ) : null}
                            </div>

                            <div className="flex gap-2 justify-end">
                                {canCreateClient ? (
                                    <GlassButton type="button" onClick={() => setCreateClientOpen(true)} className="whitespace-nowrap">
                                        <Plus size={16} />
                                        Nouveau client
                                    </GlassButton>
                                ) : null}
                            </div>
                        </div>

                        {/* Incomplete client warning (ONLY update action visible for the workflow) */}
                        {client && isClientIncomplete ? (
                            <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 flex items-start gap-2">
                                <AlertTriangle className="mt-0.5 text-amber-300" size={16} />
                                <div className="text-sm">
                                    <div className="font-semibold text-amber-200">Compte client incomplet</div>
                                    <div className="text-amber-200/80 text-xs mt-0.5">
                                        Téléphone et IBAN seront requis au moment de la validation de la feuille.
                                    </div>
                                </div>
                                <div className="ml-auto">
                                    {canUpdateClient ? (
                                        <GlassButton
                                            type="button"
                                            className="bg-amber-500/10 hover:bg-amber-500/15 border-amber-500/30"
                                            onClick={() => setEditClientOpen(true)}
                                        >
                                            Mise à jour client
                                        </GlassButton>
                                    ) : (
                                        <div className="text-[11px] text-amber-200/80 text-right max-w-[220px]">
                                            Une permission PAWNSHOP.CLIENTS.UPDATE est requise pour corriger ce client.
                                        </div>
                                    )}
                                </div>
                            </div>
                        ) : null}

                        {/* Step 2 & 3 hidden when client incomplete (flow enforced) */}
                        {client ? (
                            <>
                                {/* Step 2: Partner order toggle + partner select */}
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 items-end">
                                    <div className="md:col-span-1">
                                        <div className="text-[11px] uppercase tracking-wide text-cca-textSecondary/40 mb-1">Commande partenaire</div>
                                        <div className="flex items-center gap-2 rounded-lg bg-cca-base/40 border border-cca-border/60 px-3 py-2">
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    const next = !isPartnerOrder;
                                                    setIsPartnerOrder(next);
                                                    if (!next) setPartnerId("");
                                                }}
                                                className={[
                                                    "relative h-6 w-11 rounded-full transition cursor-pointer",
                                                    isPartnerOrder ? "bg-indigo-500/60" : "bg-cca-base/60",
                                                ].join(" ")}
                                                aria-pressed={isPartnerOrder}
                                            >
                        <span
                            className={[
                                "absolute top-0.5 h-5 w-5 rounded-full bg-white/90 transition",
                                isPartnerOrder ? "left-5" : "left-0.5",
                            ].join(" ")}
                        />
                                            </button>
                                            <span className="text-sm text-cca-textSecondary">{isPartnerOrder ? "Oui" : "Non"}</span>
                                        </div>
                                    </div>

                                    <div className="md:col-span-2">
                                        <div className="text-[11px] uppercase tracking-wide text-cca-textSecondary/40 mb-1">Partenaire</div>
                                        <GlassSelect
                                            value={partnerId}
                                            onChange={(e) => setPartnerId(e.target.value)}
                                            disabled={!isPartnerOrder}
                                        >
                                            <option value="">— Sélectionner —</option>
                                            {partners.map((p) => (
                                                <option key={p.id} value={p.id}>
                                                    #{p.id} — {p.name}
                                                </option>
                                            ))}
                                        </GlassSelect>
                                        <div className="text-[11px] text-cca-textSecondary/20 mt-1">
                                            {isPartnerOrder ? "Requis si commande partenaire." : "Désactivé."}
                                        </div>
                                    </div>
                                </div>

                                {/* Step 3: Create */}
                                <div className="flex flex-col items-end gap-2">
                                    {isClientIncomplete ? (
                                        <div className="text-[11px] text-amber-200/80">
                                            La feuille peut être créée, mais elle ne pourra pas être validée tant que le client est incomplet.
                                        </div>
                                    ) : null}
                                    <GlassButton
                                        onClick={onCreatePurchase}
                                        disabled={creating || !client?.id || (isPartnerOrder && !partnerId)}
                                        type="button"
                                        className="bg-indigo-600/30 hover:bg-indigo-600/40"
                                    >
                                        <Plus size={16} />
                                        {creating ? "Création…" : "Créer la feuille"}
                                    </GlassButton>
                                </div>
                            </>
                        ) : (
                            // no client selected yet => show a minimal hint only
                            !client ? <div className="text-xs text-cca-textSecondary/40">Sélectionne un client pour continuer.</div> : null
                        )}
                    </div>
                )}
            </GlassCard>

            {/* Content */}
            {canViewAny ? (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* List */}
                    <GlassCard
                        title={`Feuilles (${total ?? purchases.length})`}
                        subtitle="Liste paginée"
                        right={
                            <div className="flex items-center gap-2">
                                <GlassButton onClick={() => setPage((x) => Math.max(1, x - 1))} disabled={page <= 1} type="button">
                                    Précédent
                                </GlassButton>
                                <div className="text-sm text-cca-textSecondary/40">Page {page}</div>
                                <GlassButton onClick={() => setPage((x) => x + 1)} type="button">
                                    Suivant
                                </GlassButton>
                            </div>
                        }
                    >
                        {/* Filters */}
                        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-3 mb-6">
                            <div className="md:col-span-1">
                                <div className="text-[10px] font-black uppercase tracking-widest text-cca-textSecondary/40 mb-1">Recherche</div>
                                <div className="relative">
                                    <GlassInput
                                        placeholder="ID ou Client..."
                                        value={filterSearch}
                                        onChange={(e) => {
                                            setFilterSearch(e.target.value);
                                            setPage(1);
                                        }}
                                        className="pl-9"
                                    />
                                    <div className="absolute left-3 top-1/2 -translate-y-1/2 text-cca-textSecondary/40">
                                        <Search size={14} />
                                    </div>
                                </div>
                            </div>

                            <div>
                                <div className="text-[10px] font-black uppercase tracking-widest text-cca-textSecondary/40 mb-1">Employé</div>
                                <GlassSelect
                                    value={filterEmployeeId}
                                    onChange={(e) => {
                                        setFilterEmployeeId(e.target.value);
                                        setPage(1);
                                    }}
                                >
                                    <option value="">Tous</option>
                                    {employees.map((emp) => (
                                        <option key={emp.id} value={emp.id}>
                                            {emp.user?.name || `Employé #${emp.id}`}
                                        </option>
                                    ))}
                                </GlassSelect>
                            </div>

                            <div>
                                <div className="text-[10px] font-black uppercase tracking-widest text-cca-textSecondary/40 mb-1">Status</div>
                                <GlassSelect
                                    value={filterStatus}
                                    onChange={(e) => {
                                        setFilterStatus(e.target.value);
                                        setPage(1);
                                    }}
                                >
                                    <option value="">Tous</option>
                                    <option value="DRAFT">Brouillon</option>
                                    <option value="VALIDATED">Validé</option>
                                    <option value="CANCELED">Annulé</option>
                                </GlassSelect>
                            </div>

                            <div>
                                <div className="text-[10px] font-black uppercase tracking-widest text-cca-textSecondary/40 mb-1">Début</div>
                                <GlassInput
                                    type="date"
                                    value={filterDateStart}
                                    onChange={(e) => {
                                        setFilterDateStart(e.target.value);
                                        setPage(1);
                                    }}
                                />
                            </div>

                            <div>
                                <div className="text-[10px] font-black uppercase tracking-widest text-cca-textSecondary/40 mb-1">Fin</div>
                                <GlassInput
                                    type="date"
                                    value={filterDateEnd}
                                    onChange={(e) => {
                                        setFilterDateEnd(e.target.value);
                                        setPage(1);
                                    }}
                                />
                            </div>
                        </div>
                        {loadingList ? (
                            <div className="flex justify-center py-10">
                                <Spinner />
                            </div>
                        ) : purchases.length === 0 ? (
                            <div className="text-cca-textSecondary/40">Aucune feuille.</div>
                        ) : (
                            <div className="space-y-2">
                                {purchases.map((p) => {
                                    const labelClient = p?.client ? getClientLabel(p.client) : `Client #${p.clientId}`;
                                    return (
                                        <button
                                            key={p.id}
                                            onClick={() => openPurchase(p.id)}
                                            className={[
                                                "w-full text-left rounded-2xl px-5 py-4",
                                                "bg-cca-base/40 border border-cca-border/30",
                                                "hover:bg-brand-primary/10 hover:border-brand-primary/30 transition-all active:scale-[0.99]",
                                                selectedId === p.id ? "ring-2 ring-brand-primary/50 bg-brand-primary/5" : "",
                                            ].join(" ")}
                                            type="button"
                                        >
                                            <div className="flex justify-between gap-3">
                                                <div className="font-semibold text-cca-textPrimary">
                                                    #{p.id} — <span className={
                                                        p.status === "VALIDATED" ? "text-emerald-400" :
                                                        p.status === "CANCELED" ? "text-red-400" : "text-amber-400"
                                                    }>{p.status}</span>
                                                </div>
                                                <div className="text-sm font-mono">
                                                    {fmtMoney(p.totalBuyAmount)}
                                                </div>
                                            </div>
                                            <div className="flex justify-between items-end mt-1">
                                                <div className="text-xs text-cca-textSecondary/60">
                                                    {labelClient}
                                                    <div className="text-[9px] uppercase tracking-wider opacity-60">
                                                        Par {p.createdByEmployee?.user?.name || `Employé #${p.createdByEmployeeId}`}
                                                    </div>
                                                </div>
                                                <div className="text-[10px] text-cca-textSecondary/40 font-mono">
                                                    {new Date(p.createdAt).toLocaleString("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" })}
                                                </div>
                                            </div>
                                        </button>
                                    );
                                })}
                            </div>
                        )}
                    </GlassCard>

                    {/* Detail */}
                    <GlassCard
                        title="Détail de la feuille"
                        subtitle={selected ? `Feuille #${selected.id}` : "Sélectionne une feuille dans la liste."}
                        right={
                            selected ? (
                                <div className="flex flex-wrap gap-2">
                                    <GlassButton onClick={onValidate} disabled={!canValidate || selected.status !== "DRAFT"} type="button">
                                        <CheckCircle2 size={16} />
                                        Valider
                                    </GlassButton>
                                    <GlassButton onClick={onCancel} disabled={!canCancel || selected.status === "CANCELED"} type="button">
                                        <Ban size={16} />
                                        Annuler
                                    </GlassButton>
                                    {canMarkPaid && selected.status === "VALIDATED" && selected.paymentStatus !== "PAID_TRANSFER" && (
                                        <GlassButton onClick={onMarkPaid} type="button" className="bg-emerald-600/20 hover:bg-emerald-600/30 border-emerald-500/40">
                                            <Banknote size={16} />
                                            Virement effectué
                                        </GlassButton>
                                    )}
                                    {canDeleteCanceled && selected.status === "CANCELED" && (
                                        <GlassButton onClick={onDeleteCanceled} type="button" className="bg-red-600/20 hover:bg-red-600/30 border-red-500/40">
                                            <Trash2 size={16} />
                                            Supprimer
                                        </GlassButton>
                                    )}
                                </div>
                            ) : null
                        }
                    >
                        {!selected ? (
                            <div className="text-cca-textSecondary/40">Aucune feuille sélectionnée.</div>
                        ) : (
                            <div className="space-y-6">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm font-bold">
                                    <div className="bg-cca-base/40 border border-cca-border/40 rounded-2xl p-4 shadow-inner">
                                        <div className="text-cca-textSecondary/40 text-[10px] uppercase font-black tracking-widest mb-1">Créée le</div>
                                        <div className="text-cca-textPrimary font-mono">
                                            {selected?.createdAt ? new Date(selected.createdAt).toLocaleString("fr-FR") : "—"}
                                        </div>
                                    </div>
                                    <div className="bg-cca-base/40 border border-cca-border/40 rounded-2xl p-4 shadow-inner">
                                        <div className="text-cca-textSecondary/40 text-[10px] uppercase font-black tracking-widest mb-1">Vendeur</div>
                                        <div className="text-cca-textPrimary truncate">
                                            {selected?.createdByEmployee?.user?.name || `Employé #${selected?.createdByEmployeeId}`}
                                        </div>
                                    </div>
                                    <div className="bg-cca-base/40 border border-cca-border/40 rounded-2xl p-4 shadow-inner">
                                        <div className="text-cca-textSecondary/40 text-[10px] uppercase font-black tracking-widest mb-1">Client</div>
                                        <div className="text-cca-textPrimary truncate">
                                            {selected?.client ? getClientLabel(selected.client) : `Client #${selected.clientId}`}
                                        </div>
                                    </div>
                                    <div className="bg-cca-base/40 border border-cca-border/40 rounded-2xl p-4 shadow-inner">
                                        <div className="text-cca-textSecondary/40 text-[10px] uppercase font-black tracking-widest mb-1">RIB client</div>
                                        <div className="text-cca-textPrimary font-mono text-xs break-all">
                                            {selected?.client?.iban || "—"}
                                        </div>
                                    </div>
                                    <div className="bg-cca-base/40 border border-cca-border/40 rounded-2xl p-4 shadow-inner md:col-span-2">
                                        <div className="text-cca-textSecondary/40 text-[10px] uppercase font-black tracking-widest mb-2">Pièce d'identité (CNI)</div>
                                        {selected?.client?.cniImagePublicId ? (
                                            <div className="flex items-center gap-3 flex-wrap">
                                                <button type="button" onClick={() => setCniModalUrl(getClientCniUrl(selected.client.cniImagePublicId))}
                                                    className="px-3 py-1.5 rounded-lg bg-indigo-600/20 border border-indigo-500/30 text-xs text-indigo-300 font-bold hover:bg-indigo-600/30 transition-all">
                                                    Voir CNI
                                                </button>
                                                {canUploadCni && (
                                                    <>
                                                        <GlassButton type="button" onClick={() => cniInputRef.current?.click()} disabled={uploadingCni} className="text-[9px]">
                                                            <Upload size={14} /> Remplacer
                                                        </GlassButton>
                                                        <GlassButton type="button" onClick={() => onCniPaste(selected.client.id)} disabled={uploadingCni} className="bg-violet-600/20 border-violet-500/30 text-[9px]">
                                                            📋 Coller presse-papier
                                                        </GlassButton>
                                                        <input ref={cniInputRef} type="file" accept="image/*" className="hidden"
                                                            onChange={e => onCniFileChange(e, selected.client.id)} />
                                                    </>
                                                )}
                                            </div>
                                        ) : (
                                            <div className="flex items-center gap-3">
                                                <span className="text-amber-300 text-xs">⚠ Aucune CNI</span>
                                                {canUploadCni && (
                                                    <>
                                                        <GlassButton type="button" onClick={() => cniInputRef.current?.click()} disabled={uploadingCni} className="bg-indigo-600/20 border-indigo-500/30 text-[9px]">
                                                            <Upload size={14} /> {uploadingCni ? "Upload…" : "Téléverser"}
                                                        </GlassButton>
                                                        <GlassButton type="button" onClick={() => onCniPaste(selected.client.id)} disabled={uploadingCni} className="bg-violet-600/20 border-violet-500/30 text-[9px]">
                                                            📋 {uploadingCni ? "…" : "Coller presse-papier"}
                                                        </GlassButton>
                                                        <input ref={cniInputRef} type="file" accept="image/*" className="hidden"
                                                            onChange={e => onCniFileChange(e, selected.client.id)} />
                                                    </>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                    <div className="bg-cca-base/40 border border-cca-border/40 rounded-2xl p-4 shadow-inner">
                                        <div className="text-cca-textSecondary/40 text-[10px] uppercase font-black tracking-widest mb-1">État</div>
                                        <div className={
                                            selected.status === "VALIDATED" ? "text-emerald-400 uppercase font-black" :
                                            selected.status === "CANCELED" ? "text-red-400 uppercase font-black" : "text-amber-400 uppercase font-black"
                                        }>{selected.status}</div>
                                    </div>
                                    <div className="bg-cca-base/40 border border-cca-border/40 rounded-2xl p-4 shadow-inner">
                                        <div className="text-cca-textSecondary/40 text-[10px] uppercase font-black tracking-widest mb-1">Paiement</div>
                                        <div className={selected.paymentStatus === "PAID_TRANSFER" ? "text-emerald-400 uppercase font-black" : "text-amber-400 uppercase font-black"}>
                                            {selected.paymentStatus === "PAID_TRANSFER" ? `Payé (virement)` : "Non payé"}
                                        </div>
                                        {selected.paidAt ? (
                                            <div className="text-[10px] text-cca-textSecondary/40 font-mono mt-1">
                                                {new Date(selected.paidAt).toLocaleString("fr-FR")}
                                            </div>
                                        ) : null}
                                    </div>
                                    <div className="bg-cca-base/40 border border-cca-border/40 rounded-2xl p-4 shadow-inner">
                                        <div className="text-cca-textSecondary/40 text-[10px] uppercase font-black tracking-widest mb-1">Volume d'Achat</div>
                                        <div className="text-cca-textPrimary font-mono tracking-tighter text-lg">{fmtMoney(selected.totalBuyAmount)}</div>
                                    </div>
                                    <div className="bg-cca-base/40 border border-cca-border/40 rounded-2xl p-4 shadow-inner">
                                        <div className="text-cca-textSecondary/40 text-[10px] uppercase font-black tracking-widest mb-1">Valeur de Revente</div>
                                        <div className="text-emerald-400 font-mono tracking-tighter text-lg">{fmtMoney(selected.totalResaleAmount)}</div>
                                    </div>
                                </div>

                                {canChangeOwner && selected.status === "DRAFT" && (
                                    <div className="bg-cca-base/30 border border-cca-border/40 rounded-2xl p-4 flex flex-wrap items-end gap-3">
                                        <div className="flex-1 min-w-[160px]">
                                            <div className="text-[10px] uppercase font-black tracking-widest text-cca-textSecondary/40 mb-1">Changer vendeur</div>
                                            <GlassSelect value={changeOwnerEmployeeId} onChange={(e) => setChangeOwnerEmployeeId(e.target.value)}>
                                                <option value="">— Sélectionner —</option>
                                                {employees.map((emp) => (
                                                    <option key={emp.id} value={emp.id}>
                                                        {emp.user?.name || `Employé #${emp.id}`}
                                                    </option>
                                                ))}
                                            </GlassSelect>
                                        </div>
                                        <GlassButton onClick={onChangeOwner} disabled={changingOwner || !changeOwnerEmployeeId} type="button" className="bg-indigo-600/20 hover:bg-indigo-600/30">
                                            <UserCog size={16} />
                                            {changingOwner ? "…" : "Appliquer"}
                                        </GlassButton>
                                    </div>
                                )}

                                <div className="relative overflow-hidden rounded-[2rem] p-6 bg-cca-base/20 border border-cca-border/40 min-h-[300px]">
                                    <div className="text-xl font-black font-heading mb-4 text-cca-textPrimary uppercase tracking-tight">Inventaire des Articles</div>

                                    <div className="overflow-x-auto min-h-[200px]">
                                        <table className="min-w-full text-sm text-cca-textPrimary border-separate border-spacing-0">
                                            <thead className="bg-cca-base/80 backdrop-blur-md sticky top-0 z-10">
                                            <tr>
                                                <th className="py-4 px-4 text-left text-[9px] font-black uppercase tracking-[0.2em] text-cca-textSecondary/60 border-b border-cca-border/30">
                                                    Désignation Produit
                                                </th>
                                                <th className="py-4 px-4 text-right text-[9px] font-black uppercase tracking-[0.2em] text-cca-textSecondary/60 border-b border-cca-border/30">
                                                    Qté
                                                </th>
                                                <th className="py-4 px-4 text-right text-[9px] font-black uppercase tracking-[0.2em] text-cca-textSecondary/60 border-b border-cca-border/30">
                                                    Prix Achat
                                                </th>
                                                <th className="py-4 px-4 text-right text-[9px] font-black uppercase tracking-[0.2em] text-cca-textSecondary/60 border-b border-cca-border/30">
                                                    Prix Revente
                                                </th>
                                                <th className="py-4 px-4 text-right text-[9px] font-black uppercase tracking-[0.2em] text-cca-textSecondary/60 border-b border-cca-border/30">
                                                    S/Total Achat
                                                </th>
                                                <th className="py-4 px-4 text-right text-[9px] font-black uppercase tracking-[0.2em] text-cca-textSecondary/60 border-b border-cca-border/30">
                                                    S/Total Revente
                                                </th>
                                                <th className="py-4 px-4 text-right text-[9px] font-black uppercase tracking-[0.2em] text-cca-textSecondary/60 border-b border-cca-border/30">
                                                    Actions
                                                </th>
                                            </tr>
                                            </thead>

                                            <tbody className="divide-y divide-cca-border/40 backdrop-blur-xl">
                                            {(selected.items || []).map((it) => {
                                                const prod = it.product || productById.get(it.productId);
                                                return (
                                                    <tr
                                                        key={it.id}
                                                        className="transition hover:bg-cca-surface/50 hover:backdrop-blur-lg hover:[background:linear-gradient(to_right,rgba(99,102,241,0.08),transparent)]"
                                                    >
                                                        <td className="py-3 px-3 font-medium">
                                                            {prod ? prod.name : `Produit #${it.productId}`}
                                                        </td>
                                                        <td className="py-3 px-3 text-right font-mono">{String(it.quantity)}</td>
                                                        <td className="py-3 px-3 text-right font-mono">{fmtMoney(it.unitBuyPrice)}</td>
                                                        <td className="py-3 px-3 text-right font-mono">{fmtMoney(it.unitResalePrice)}</td>
                                                        <td className="py-3 px-3 text-right font-mono">{fmtMoney(it.lineTotal)}</td>
                                                        <td className="py-3 px-3 text-right font-mono text-green-300">
                                                            {fmtMoney(it.resaleLineTotal)}
                                                        </td>
                                                        <td className="py-3 px-3 text-right">
                                                            <GlassButton
                                                                className="px-3 py-1"
                                                                disabled={!canUpdate || selected.status !== "DRAFT"}
                                                                onClick={() => onDeleteLine(it.id)}
                                                                type="button"
                                                            >
                                                                <Trash2 size={16} />
                                                                Supprimer
                                                            </GlassButton>
                                                        </td>
                                                    </tr>
                                                );
                                            })}
                                            </tbody>
                                        </table>
                                    </div>

                                    <div className="mt-4 grid grid-cols-1 md:grid-cols-5 gap-3 items-end">
                                        <div className="md:col-span-2">
                                            <div className="text-xs text-cca-textSecondary/40 mb-1">Produit</div>
                                            <GlassSelect
                                                value={lineProductId}
                                                onChange={(e) => setLineProductId(e.target.value)}
                                                disabled={!canUpdate || selected.status !== "DRAFT"}
                                            >
                                                <option value="">— Sélectionner —</option>
                                                {products.map((p) => (
                                                    <option key={p.id} value={p.id}>
                                                        #{p.id} — {p.name}
                                                    </option>
                                                ))}
                                            </GlassSelect>
                                        </div>

                                        <div>
                                            <div className="text-xs text-cca-textSecondary/40 mb-1">Quantité</div>
                                            <GlassInput
                                                value={lineQty}
                                                onChange={(e) => setLineQty(e.target.value)}
                                                disabled={!canUpdate || selected.status !== "DRAFT"}
                                            />
                                        </div>

                                        <div>
                                            <div className="text-xs text-cca-textSecondary/40 mb-1">Override achat/u</div>
                                            <GlassInput
                                                value={lineBuy}
                                                onChange={(e) => setLineBuy(e.target.value)}
                                                placeholder="optionnel"
                                                disabled={!canUpdate || selected.status !== "DRAFT"}
                                            />
                                        </div>

                                        <div>
                                            <div className="text-xs text-cca-textSecondary/40 mb-1">Override revente/u</div>
                                            <GlassInput
                                                value={lineResale}
                                                onChange={(e) => setLineResale(e.target.value)}
                                                placeholder="optionnel"
                                                disabled={!canUpdate || selected.status !== "DRAFT"}
                                            />
                                        </div>

                                        <div className="md:col-span-5 flex justify-end">
                                            <GlassButton
                                                onClick={onAddLine}
                                                disabled={!canUpdate || selected.status !== "DRAFT" || addingLine}
                                                type="button"
                                            >
                                                <Plus size={16} />
                                                {addingLine ? "Ajout…" : "Ajouter la ligne"}
                                            </GlassButton>
                                        </div>

                                        {selected.status !== "DRAFT" && (
                                            <div className="md:col-span-5 text-xs text-cca-textSecondary/40">
                                                La feuille n’est plus en brouillon → lignes verrouillées.
                                            </div>
                                        )}
                                    </div>
                                </div>

                                <div className="text-xs text-cca-textSecondary/40">
                                    Salaire: calculé côté paie via la matrix <b>pawnshopProductRemunerations</b>.
                                </div>
                            </div>
                        )}
                    </GlassCard>
                </div>
            ) : (
                <GlassCard
                    title="Feuilles d'achat"
                    subtitle="La consultation de la liste nécessite VIEW_SELF ou VIEW_ALL."
                >
                    <div className="text-sm text-cca-textSecondary/40">
                        Tu peux créer une nouvelle feuille d'achat avec PAWNSHOP.PURCHASES.CREATE, mais la liste et le détail des feuilles restent masqués sans permission de vue.
                    </div>
                </GlassCard>
            )}


            <CreateClientModal
                open={createClientOpen}
                onClose={() => setCreateClientOpen(false)}
                onCreated={(c) => setClient(c)}
                canCreateClient={canCreateClient}
            />

            <EditClientModal
                open={editClientOpen}
                onClose={() => setEditClientOpen(false)}
                client={client}
                canUpdateClient={canUpdateClient}
                onUpdated={(nextClient) => {
                    setClient(nextClient);
                    setIsPartnerOrder(false);
                    setPartnerId("");
                }}
            />
        </div>
        </>
    );
}
