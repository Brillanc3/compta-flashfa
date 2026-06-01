// frontend/src/pages/dashboard/BillJournalPage.jsx

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import toast from "react-hot-toast";
import { format } from "date-fns";
import { fr } from "date-fns/locale";

import Spinner from "../../components/ui/Spinner";
import EntityMultiSelect from "@/components/common/EntityMultiSelect";
import BillCommentsSection from "@/components/accounting/BillCommentsSection";

import { useCompany } from "@/contexts/CompanyContext.jsx";
import { useWebSocket } from "@/contexts/WebSocketContext";
import { usePermissions } from "@/contexts/PermissionsContext.jsx";

import { getBills, getBillDetails } from "@/services/comptabiliteService.js";
import { getCompanyEmployeesData } from "@/services/companyService.js";
import { updateBillShares } from "@/services/billService.js";
import { MessageSquare } from "lucide-react";

/* --------------------------------------------------------------------------
   Helpers
--------------------------------------------------------------------------- */
function useDebouncedValue(value, delayMs = 450) {
    const [debounced, setDebounced] = useState(value);

    useEffect(() => {
        const id = setTimeout(() => setDebounced(value), delayMs);
        return () => clearTimeout(id);
    }, [value, delayMs]);

    return debounced;
}

function toInt(v, fallback = null) {
    const n = Number.parseInt(String(v), 10);
    return Number.isFinite(n) ? n : fallback;
}

function sanitizePositiveIntList(list) {
    const arr = Array.isArray(list) ? list : [];
    return arr
        .map((x) => Math.abs(toInt(x, 0)))
        .filter((x) => Number.isFinite(x) && x > 0);
}

function formatMoneyUSD(amount) {
    return new Intl.NumberFormat("fr-FR", { style: "currency", currency: "USD" }).format(
        Number(amount) || 0
    );
}

/* --------------------------------------------------------------------------
   Partage / Modal UI
--------------------------------------------------------------------------- */
function clampDecimalString(v, { min = 0, max = 100, decimals = 2 } = {}) {
    const raw = String(v ?? "").replace(",", ".").trim();
    if (raw === "") return "";
    const n = Number(raw);
    if (!Number.isFinite(n)) return "";
    const clamped = Math.min(max, Math.max(min, n));
    return clamped.toFixed(decimals);
}

// "basis points" à 2 décimales : 12.34% => 1234, 100% => 10000
function percentToBp(v) {
    const raw = String(v ?? "").replace(",", ".").trim();
    if (!raw) return 0;
    const n = Number(raw);
    if (!Number.isFinite(n)) return 0;
    return Math.round(n * 100);
}

function toPercentNumber(v) {
    const raw = String(v ?? "").replace(",", ".").trim();
    const n = Number(raw);
    return Number.isFinite(n) ? n : 0;
}

function SharesModal({
                         open,
                         onClose,
                         bill,
                         billDetails,
                         billDetailsLoading,
                         employees,
                         employeesLoading,
                         sharesDraft,
                         setSharesDraft,
                         renderEmployeeLabel,
                         saving,
                         onSave,
                         canManageShares = false,
                         canSeeComments = false,
                     }) {
    const defaultTab = canManageShares ? "shares" : "comments";
    const [activeTab, setActiveTab] = useState(defaultTab);

    useEffect(() => {
        if (open) setActiveTab(canManageShares ? "shares" : "comments");
    }, [open, canManageShares]);

    // ⚠️ pas de return conditionnel avant les hooks
    const safeSharesDraft = useMemo(() => Array.isArray(sharesDraft) ? sharesDraft : [], [sharesDraft]);

    const selectedIds = useMemo(() => {
        if (!open) return [];
        return safeSharesDraft.map((s) => Number(s.companyEmployeeId)).filter(Boolean);
    }, [open, safeSharesDraft]);

    const employeeById = useMemo(() => {
        const map = new Map();
        (employees || []).forEach((e) => map.set(Number(e.id), e));
        return map;
    }, [employees]);

    const syncFromSelectedIds = useCallback(
        (ids) => {
            const nextIds = sanitizePositiveIntList(ids);
            setSharesDraft((prev) => {
                const prevArr = Array.isArray(prev) ? prev : [];
                const existing = new Map(prevArr.map((s) => [Number(s.companyEmployeeId), s]));
                return nextIds.map((id) => existing.get(id) ?? { companyEmployeeId: id, percentage: "" });
            });
        },
        [setSharesDraft]
    );

    const removeEmployee = useCallback(
        (id) => {
            setSharesDraft((prev) =>
                (Array.isArray(prev) ? prev : []).filter(
                    (s) => Number(s.companyEmployeeId) !== Number(id)
                )
            );
        },
        [setSharesDraft]
    );

    const updatePercentage = useCallback(
        (id, v) => {
            setSharesDraft((prev) =>
                (Array.isArray(prev) ? prev : []).map((s) =>
                    Number(s.companyEmployeeId) === Number(id)
                        ? { ...s, percentage: clampDecimalString(v) }
                        : s
                )
            );
        },
        [setSharesDraft]
    );

    const totalBp = useMemo(() => {
        if (!open) return 0;
        return safeSharesDraft.reduce((acc, s) => acc + percentToBp(s?.percentage), 0);
    }, [open, safeSharesDraft]);

    const total = totalBp / 100;
    const isTotal100 = totalBp === 10000;
    const isOver100 = totalBp > 10000;

    const headerId = bill?.externalBillId ? `#${bill.externalBillId}` : bill?.id ? `#${bill.id}` : "—";
    const activeTotalClass = isOver100 ? "text-red-400" : isTotal100 ? "text-green-400" : "text-yellow-400";

    const canSave =
        open &&
        isTotal100 &&
        safeSharesDraft.length > 0 &&
        !employeesLoading &&
        !billDetailsLoading &&
        !saving;

    const handleSaveClick = () => {
        if (!bill?.id) return;

        // Payload: [{ companyEmployeeId, percentage }]
        const sharesPayload = safeSharesDraft
            .map((s) => ({
                companyEmployeeId: Number.parseInt(String(s.companyEmployeeId), 10),
                percentage: toPercentNumber(s.percentage),
            }))
            .filter(
                (s) =>
                    Number.isFinite(s.companyEmployeeId) &&
                    s.companyEmployeeId > 0 &&
                    Number.isFinite(s.percentage) &&
                    s.percentage > 0
            );

        const checkBp = sharesPayload.reduce((acc, s) => acc + percentToBp(s.percentage), 0);
        if (checkBp !== 10000) {
            toast.error("Le total doit être exactement 100.00%.");
            return;
        }

        onSave?.(bill.id, sharesPayload);
    };

    if (!open) return null;
    if (typeof document === "undefined") return null;

    const modal = (
        <div className="fixed inset-0 z-[80]">
            <div
                className="absolute inset-0 bg-black/70 backdrop-blur-sm"
                onClick={saving ? undefined : onClose}
            />
            <div className="absolute inset-0 flex items-center justify-center p-4">
                <div className="w-full max-w-2xl max-h-[calc(100dvh-2rem)] rounded-2xl border border-slate-700/70 bg-slate-950/95 shadow-2xl overflow-hidden flex flex-col">
                    {/* Header fixe */}
                    <div className="px-5 py-4 border-b border-slate-700/70 flex items-start justify-between gap-3">
                        <div className="flex-1">
                            <div className="text-slate-100 font-semibold text-lg mb-1">Détails de la facture</div>
                            <div className="text-slate-400 text-xs font-mono mb-3">{headerId}</div>
                            
                            {/* Onglets */}
                            <div className="flex gap-4 border-b border-slate-700/50">
                                {canManageShares && (
                                    <button
                                        className={`pb-2 text-sm font-medium transition-colors border-b-2 ${activeTab === 'shares' ? 'border-indigo-500 text-indigo-400' : 'border-transparent text-slate-400 hover:text-slate-300'}`}
                                        onClick={() => setActiveTab('shares')}
                                    >
                                        Partage
                                    </button>
                                )}
                                {canSeeComments && (
                                    <button
                                        className={`pb-2 text-sm font-medium transition-colors border-b-2 ${activeTab === 'comments' ? 'border-indigo-500 text-indigo-400' : 'border-transparent text-slate-400 hover:text-slate-300'}`}
                                        onClick={() => setActiveTab('comments')}
                                    >
                                        Commentaires
                                    </button>
                                )}
                            </div>
                        </div>
                        <button
                            className="px-3 py-1.5 rounded-lg bg-slate-800/70 hover:bg-slate-700 text-slate-100 text-sm disabled:opacity-50 mt-1"
                            onClick={onClose}
                            disabled={saving}
                        >
                            Fermer
                        </button>
                    </div>

                    {/* Contenu scrollable */}
                    <div className="p-5 space-y-4 overflow-y-auto min-h-0 flex-1">
                        {activeTab === "shares" ? (
                            <>
                                <div className="rounded-xl border border-slate-700/60 bg-slate-900/40 p-4">
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                                <div>
                                    <div className="text-slate-400 text-xs">Destinataire</div>
                                    <div className="text-slate-100 font-semibold">{bill?.recipientName || "—"}</div>
                                </div>
                                <div>
                                    <div className="text-slate-400 text-xs">Montant</div>
                                    <div className="text-slate-100 font-mono">
                                        {bill?.amount ? formatMoneyUSD(bill.amount) : "—"}
                                    </div>
                                </div>
                                <div className="sm:col-span-2">
                                    <div className="text-slate-400 text-xs">Raison</div>
                                    <div className="text-slate-200">{bill?.reason || "—"}</div>
                                </div>
                            </div>

                            <div className="mt-3 text-xs text-slate-400">
                                {billDetailsLoading ? "Chargement du détail…" : billDetails ? "Détail chargé." : ""}
                            </div>
                        </div>

                        <div className="space-y-2">
                            <div className="flex items-center justify-between gap-3">
                                <div className="text-slate-200 font-semibold">Bénéficiaires</div>
                                <div className="text-xs text-slate-400">
                                    Total:{" "}
                                    <span className={`${activeTotalClass} font-semibold`}>
                                        {Number.isFinite(total) ? total.toFixed(2) : "—"}%
                                    </span>
                                </div>
                            </div>

                            {isOver100 && (
                                <div className="rounded-xl border border-red-500/30 bg-red-950/20 px-3 py-2 text-sm text-red-200">
                                    Le total ne doit jamais dépasser 100%.
                                </div>
                            )}

                            <div className="rounded-xl border border-slate-700/60 bg-slate-900/40 p-3">
                                <EntityMultiSelect
                                    label="Ajouter / retirer des employés"
                                    placeholder="Rechercher un employé…"
                                    items={employees || []}
                                    selectedIds={selectedIds}
                                    onChangeSelectedIds={syncFromSelectedIds}
                                    getId={(e) => Number(e?.id)}
                                    renderItem={renderEmployeeLabel}
                                    disabled={employeesLoading || saving}
                                />
                                {(employeesLoading || saving) && (
                                    <div className="mt-2 text-xs text-slate-400">
                                        {employeesLoading ? "Chargement des employés…" : "Enregistrement…"}
                                    </div>
                                )}
                            </div>

                            <div className="space-y-2">
                                {safeSharesDraft.length === 0 ? (
                                    <div className="text-sm text-slate-400 py-6 text-center">
                                        Ajoute un ou plusieurs bénéficiaires pour définir le partage.
                                    </div>
                                ) : (
                                    safeSharesDraft.map((s) => {
                                        const emp = employeeById.get(Number(s.companyEmployeeId));
                                        const label = emp ? renderEmployeeLabel(emp) : `Employé #${s.companyEmployeeId}`;

                                        return (
                                            <div
                                                key={s.companyEmployeeId}
                                                className="flex flex-col sm:flex-row sm:items-center gap-3 rounded-xl border border-slate-700/60 bg-slate-900/40 p-3"
                                            >
                                                <div className="flex-1">
                                                    <div className="text-slate-100 font-semibold text-sm">{label}</div>
                                                    <div className="text-slate-400 text-xs">Pourcentage attribué sur la facture</div>
                                                </div>

                                                <div className="flex items-center gap-2">
                                                    <input
                                                        value={s.percentage}
                                                        onChange={(e) => updatePercentage(s.companyEmployeeId, e.target.value)}
                                                        inputMode="decimal"
                                                        className="w-28 px-3 py-2 rounded-lg bg-slate-950/50 border border-slate-700/60 text-slate-100 font-mono text-sm disabled:opacity-50"
                                                        placeholder="0.00"
                                                        disabled={saving}
                                                    />
                                                    <span className="text-slate-300 text-sm">%</span>
                                                    <button
                                                        className="px-3 py-2 rounded-lg bg-slate-800/70 hover:bg-slate-700 text-slate-100 text-sm disabled:opacity-50"
                                                        onClick={() => removeEmployee(s.companyEmployeeId)}
                                                        disabled={saving}
                                                    >
                                                        Retirer
                                                    </button>
                                                </div>
                                            </div>
                                        );
                                    })
                                )}
                            </div>
                        </div>
                            </>
                        ) : (
                            <BillCommentsSection billId={bill.id} />
                        )}
                    </div>

                    {/* Footer fixe */}
                    <div className="px-5 pb-5 pt-3 border-t border-slate-700/70 flex items-center justify-end gap-2">
                        <button
                            className="px-4 py-2 rounded-lg bg-slate-800/70 hover:bg-slate-700 text-slate-100 text-sm disabled:opacity-50"
                            onClick={onClose}
                            disabled={saving}
                        >
                            Annuler
                        </button>

                        {canManageShares && activeTab === 'shares' && (
                            <button
                                className="px-4 py-2 rounded-lg bg-indigo-600/80 hover:bg-indigo-500 text-white text-sm disabled:opacity-50"
                                disabled={!canSave}
                                title={
                                    canSave
                                        ? "Enregistrer"
                                        : saving
                                            ? "Enregistrement…"
                                            : "Le total doit être exactement 100.00% (et au moins un bénéficiaire)"
                                }
                                onClick={handleSaveClick}
                            >
                                {saving ? "Enregistrement…" : "Enregistrer"}
                            </button>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );

    // IMPORTANT (mobile): ce modal était rendu *dans* le <main> du DashboardLayout.
    // Or <main> a un z-index (z-[1]) qui crée un nouveau stacking context,
    // ce qui faisait que le modal passait *sous* la MobileNavBar (z-50).
    // Portaler vers <body> garantit que le modal est au-dessus.
    return createPortal(modal, document.body);
}

/* --------------------------------------------------------------------------
   Status mapping
--------------------------------------------------------------------------- */
const statusMapping = {
    UNPAID: { text: "Non payée", color: "bg-yellow-500/20 text-yellow-400" },
    PAID_CASH: { text: "Payée (Espèces)", color: "bg-green-500/20 text-green-400" },
    PAID_CARD: { text: "Payée (Carte)", color: "bg-green-500/20 text-green-400" },
    CANCELED: { text: "Annulée", color: "bg-red-500/20 text-red-400" },
};

/* --------------------------------------------------------------------------
   Filter Bar (auto / debounced)
--------------------------------------------------------------------------- */
function BillFilterBar({ value, onChange, employees, employeesLoading, renderEmployeeLabel }) {
    const setField = (name, next) => onChange({ ...value, [name]: next });

    const reset = () =>
        onChange({
            search: "",
            billId: "",
            status: "",
            minAmount: "",
            maxAmount: "",
            startDate: "",
            endDate: "",
            employeeIds: [],
        });

    return (
        <div
            className="relative overflow-hidden rounded-xl bg-cca-surface border border-cca-border shadow-lg"
        >
            <div className="relative p-4 md:p-5 space-y-4">
                <div className="flex items-start justify-between gap-3">
                    <div className="space-y-1">
                        <div className="text-cca-textPrimary font-semibold">Filtres</div>
                        <div className="text-xs text-cca-textSecondary">La liste se met à jour automatiquement.</div>
                    </div>

                    <button
                        className="px-3 py-1.5 rounded-lg bg-cca-base hover:bg-brand-primary/10 text-cca-textPrimary border border-cca-border text-sm transition-colors"
                        onClick={reset}
                    >
                        Réinitialiser
                    </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                    <div className="space-y-1">
                        <div className="text-xs text-cca-textSecondary">Recherche</div>
                        <input
                            value={value.search}
                            onChange={(e) => setField("search", e.target.value)}
                            className="w-full px-3 py-2 rounded-lg bg-cca-base border border-cca-border text-cca-textPrimary text-sm focus:outline-none focus:ring-1 focus:ring-brand-primary focus:border-brand-primary transition-colors"
                            placeholder="ID ext, destinataire, raison..."
                        />
                    </div>

                    <div className="space-y-1">
                        <div className="text-xs text-cca-textSecondary">ID Facture</div>
                        <input
                            value={value.billId}
                            onChange={(e) => setField("billId", e.target.value)}
                            className="w-full px-3 py-2 rounded-lg bg-cca-base border border-cca-border text-cca-textPrimary text-sm focus:outline-none focus:ring-1 focus:ring-brand-primary focus:border-brand-primary transition-colors"
                            placeholder="ID interne ou ID externe..."
                        />
                    </div>

                    <div className="space-y-1">
                        <div className="text-xs text-cca-textSecondary">Statut</div>
                        <select
                            value={value.status}
                            onChange={(e) => setField("status", e.target.value)}
                            className="w-full px-3 py-2 rounded-lg bg-cca-base border border-cca-border text-cca-textPrimary text-sm focus:outline-none focus:ring-1 focus:ring-brand-primary focus:border-brand-primary transition-colors"
                        >
                            <option value="">Tous</option>
                            <option value="UNPAID">Non payée</option>
                            <option value="PAID_CASH">Payée (Espèces)</option>
                            <option value="PAID_CARD">Payée (Carte)</option>
                            <option value="CANCELED">Annulée</option>
                        </select>
                    </div>

                    <div className="space-y-1">
                        <div className="text-xs text-cca-textSecondary">Montant min</div>
                        <input
                            value={value.minAmount}
                            onChange={(e) => setField("minAmount", e.target.value)}
                            inputMode="decimal"
                            className="w-full px-3 py-2 rounded-lg bg-cca-base border border-cca-border text-cca-textPrimary text-sm focus:outline-none focus:ring-1 focus:ring-brand-primary focus:border-brand-primary transition-colors"
                            placeholder="0.00"
                        />
                    </div>

                    <div className="space-y-1">
                        <div className="text-xs text-cca-textSecondary">Montant max</div>
                        <input
                            value={value.maxAmount}
                            onChange={(e) => setField("maxAmount", e.target.value)}
                            inputMode="decimal"
                            className="w-full px-3 py-2 rounded-lg bg-cca-base border border-cca-border text-cca-textPrimary text-sm focus:outline-none focus:ring-1 focus:ring-brand-primary focus:border-brand-primary transition-colors"
                            placeholder="9999.99"
                        />
                    </div>

                    <div className="space-y-1">
                        <div className="text-xs text-cca-textSecondary">Date début</div>
                        <input
                            type="date"
                            value={value.startDate}
                            onChange={(e) => setField("startDate", e.target.value)}
                            className="w-full px-3 py-2 rounded-lg bg-cca-base border border-cca-border text-cca-textPrimary text-sm focus:outline-none focus:ring-1 focus:ring-brand-primary focus:border-brand-primary transition-colors"
                        />
                    </div>

                    <div className="space-y-1">
                        <div className="text-xs text-cca-textSecondary">Date fin</div>
                        <input
                            type="date"
                            value={value.endDate}
                            onChange={(e) => setField("endDate", e.target.value)}
                            className="w-full px-3 py-2 rounded-lg bg-cca-base border border-cca-border text-cca-textPrimary text-sm focus:outline-none focus:ring-1 focus:ring-brand-primary focus:border-brand-primary transition-colors"
                        />
                    </div>

                    <div className="space-y-1 md:col-span-2 xl:col-span-3">
                        <div className="rounded-xl border border-cca-border bg-cca-base p-2">
                            <EntityMultiSelect
                                label="Employés (filtre)"
                                placeholder="Filtrer par employés…"
                                items={employees || []}
                                selectedIds={value.employeeIds}
                                onChangeSelectedIds={(ids) => setField("employeeIds", sanitizePositiveIntList(ids))}
                                getId={(e) => Number(e?.id)}
                                renderItem={renderEmployeeLabel}
                                disabled={employeesLoading}
                            />
                            {employeesLoading && <div className="mt-2 text-xs text-slate-400">Chargement…</div>}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

/* --------------------------------------------------------------------------
   Page
--------------------------------------------------------------------------- */
export default function BillJournalPage() {
    const { activeCompanyId } = useCompany();
    const companyId = activeCompanyId;

    const { has: hasPerm, isReady: permsReady } = usePermissions();

    const companyWildcard = useMemo(() => {
        if (!companyId) return false;
        return hasPerm(`COMPANY.${companyId}.*`);
    }, [hasPerm, companyId]);

    const canManageShares = useMemo(() => {
        return hasPerm("COMPTABILITE.BILLS.SHARES") || companyWildcard || hasPerm("ADMIN.*");
    }, [hasPerm, companyWildcard]);

    const canViewComments = useMemo(() => {
        return hasPerm("COMPTABILITE.BILLS.COMMENT.VIEW") || hasPerm("COMPTABILITE.BILLS.COMMENT.MANAGE") || companyWildcard || hasPerm("ADMIN.*");
    }, [hasPerm, companyWildcard]);

    const canAddComments = useMemo(() => {
        return hasPerm("COMPTABILITE.BILLS.COMMENT.ADD") || hasPerm("COMPTABILITE.BILLS.COMMENT.MANAGE") || companyWildcard || hasPerm("ADMIN.*");
    }, [hasPerm, companyWildcard]);

    const canSeeComments = canViewComments || canAddComments;
    const canOpenModal = canManageShares || canSeeComments;

    const { subscribe, unsubscribe } = useWebSocket();

    const [billViewMode, setBillViewMode] = useState(canManageShares ? "ALL" : "SELF");
    const canViewAll = billViewMode === "ALL";

    useEffect(() => {
        if (!permsReady) return;
        setBillViewMode(canManageShares ? "ALL" : "SELF");
    }, [permsReady, canManageShares]);

    const [bills, setBills] = useState([]);
    const [pagination, setPagination] = useState({
        totalCount: 0,
        totalPages: 1,
        currentPage: 1,
        limit: 15,
    });

    // Liste employés pour le filtre
    const [filterEmployees, setFilterEmployees] = useState([]);
    const [filterEmployeesLoading, setFilterEmployeesLoading] = useState(false);

    // Modal de partage
    const [shareModalOpen, setShareModalOpen] = useState(false);
    const [selectedBill, setSelectedBill] = useState(null);

    const [billDetails, setBillDetails] = useState(null);
    const [billDetailsLoading, setBillDetailsLoading] = useState(false);

    // Liste employés "actifs" à la date de la facture
    const [shareEmployees, setShareEmployees] = useState([]);
    const [shareEmployeesLoading, setShareEmployeesLoading] = useState(false);

    const [sharesDraft, setSharesDraft] = useState([]);
    const [savingShares, setSavingShares] = useState(false);

    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    const [filters, setFilters] = useState({
        search: "",
        billId: "",
        status: "",
        minAmount: "",
        maxAmount: "",
        startDate: "",
        endDate: "",
        employeeIds: [],
        page: 1,
        limit: 15,
    });

    const debouncedFilters = useDebouncedValue(filters, 450);

    const renderEmployeeLabel = useCallback((e) => {
        if (!e) return "—";
        const name = e?.user?.name || `Employé #${e?.id ?? "?"}`;
        const username = e?.user?.username ? `@${e.user.username}` : null;
        const rank = e?.rank?.name ? String(e.rank.name).trim() : null;
        const parts = [name, username, rank].filter(Boolean);
        return `${parts.join(" • ")} (#${e.id})`;
    }, []);

    const loadFilterEmployees = useCallback(async () => {
        if (!companyId) return;

        setFilterEmployeesLoading(true);
        try {
            const empData = await getCompanyEmployeesData({
                includeInactive: false,
                statuses: "ACTIVE,PENDING_LINK",
            });

            const list = Array.isArray(empData) ? empData : empData?.data || [];
            list.sort((a, b) => {
                const pa = a?.rank?.position ?? 9999;
                const pb = b?.rank?.position ?? 9999;
                if (pa !== pb) return pb - pa;
                const na = (a?.user?.name || "").toLowerCase();
                const nb = (b?.user?.name || "").toLowerCase();
                return na.localeCompare(nb);
            });

            setFilterEmployees(list);
        } catch (e) {
            console.error(e);
            toast.error("Impossible de charger la liste des employés (filtre).");
            setFilterEmployees([]);
        } finally {
            setFilterEmployeesLoading(false);
        }
    }, [companyId]);

    useEffect(() => {
        loadFilterEmployees();
    }, [loadFilterEmployees]);

    const isGhostBill = useCallback((bill) => {
        return Boolean(bill?.ghost || bill?.shared || bill?.isGhost);
    }, []);

    const ghostMessage = useCallback(() => {
        return "Facture partagée — visible via vos droits / partages.";
    }, []);

    const fetchBills = useCallback(
        async (nextFilters) => {
            if (!companyId) return;
            setLoading(true);
            setError(null);

            try {
                const payload = {
                    ...nextFilters,
                    billViewMode: canViewAll ? "ALL" : "SELF",
                };

                const res = await getBills(companyId, payload);
                setBills(res?.data || []);
                setPagination(
                    res?.pagination || {
                        totalCount: 0,
                        totalPages: 1,
                        currentPage: 1,
                        limit: nextFilters.limit || 15,
                    }
                );
            } catch (err) {
                setError(err?.message || "Erreur lors du chargement des factures.");
            } finally {
                setLoading(false);
            }
        },
        [companyId, canViewAll]
    );

    useEffect(() => {
        fetchBills(debouncedFilters);
    }, [debouncedFilters, fetchBills]);

    // WebSocket refresh
    useEffect(() => {
        const onUpdate = () => fetchBills(debouncedFilters);
        subscribe("BILL_CREATED", onUpdate);
        subscribe("BILL_UPDATED", onUpdate);
        subscribe("BILL_DELETED", onUpdate);
        return () => {
            unsubscribe("BILL_CREATED", onUpdate);
            unsubscribe("BILL_UPDATED", onUpdate);
            unsubscribe("BILL_DELETED", onUpdate);
        };
    }, [subscribe, unsubscribe, fetchBills, debouncedFilters]);

    const openSharesModal = useCallback(
        async (bill) => {
            if (!canOpenModal || !companyId || !bill?.id) return;

            setSelectedBill(bill);
            setShareModalOpen(true);

            // Reset modal state
            setBillDetails(null);
            setSharesDraft([]);
            setShareEmployees([]);
            setSavingShares(false);

            if (!canManageShares) return;

            setBillDetailsLoading(true);
            setShareEmployeesLoading(true);

            try {
                // 1) Détail facture (inclut shares)
                const details = await getBillDetails(companyId, bill.id);
                setBillDetails(details);

                const dShares = Array.isArray(details?.shares) ? details.shares : [];
                setSharesDraft(
                    dShares.map((s) => ({
                        companyEmployeeId: Number(s.companyEmployeeId),
                        percentage: String(s.percentage ?? ""),
                    }))
                );

                // 2) Employés "actifs" à la date de la facture
                const activeAt = details?.date || bill?.date || null;

                try {
                    const empData = await getCompanyEmployeesData({
                        activeAt,
                        includeInactive: false,
                        statuses: "ACTIVE,PENDING_LINK",
                    });

                    const list = Array.isArray(empData) ? empData : empData?.data || [];
                    list.sort((a, b) => {
                        const pa = a?.rank?.position ?? 9999;
                        const pb = b?.rank?.position ?? 9999;
                        if (pa !== pb) return pb - pa;
                        const na = (a?.user?.name || "").toLowerCase();
                        const nb = (b?.user?.name || "").toLowerCase();
                        return na.localeCompare(nb);
                    });

                    setShareEmployees(list);
                } catch (e) {
                    console.error(e);
                    toast.error("Impossible de charger la liste des employés (partage).");
                    setShareEmployees([]);
                }
            } catch (e) {
                console.error(e);
                toast.error("Impossible d’ouvrir la facture.");
            } finally {
                setBillDetailsLoading(false);
                setShareEmployeesLoading(false);
            }
        },
        [canOpenModal, canManageShares, companyId]
    );

    const closeSharesModal = useCallback(() => {
        setShareModalOpen(false);
        setSelectedBill(null);
        setBillDetails(null);
        setSharesDraft([]);
        setBillDetailsLoading(false);
        setShareEmployees([]);
        setShareEmployeesLoading(false);
        setSavingShares(false);
    }, []);

    const handleSaveShares = useCallback(
        async (billId, sharesPayload) => {
            if (!billId) return;
            setSavingShares(true);
            try {
                const res = await updateBillShares(billId, sharesPayload); // -> { bill }
                const updatedBill = res?.bill;

                toast.success("Partage enregistré.");

                if (updatedBill) {
                    setBillDetails(updatedBill);

                    // Re-synchronise le draft depuis le backend (source de vérité)
                    const dShares = Array.isArray(updatedBill?.shares) ? updatedBill.shares : [];
                    setSharesDraft(
                        dShares.map((s) => ({
                            companyEmployeeId: Number(s.companyEmployeeId),
                            percentage: String(s.percentage ?? ""),
                        }))
                    );
                }

                // Refresh liste (shape/fields cohérents)
                await fetchBills(filters);

                closeSharesModal();
            } catch (e) {
                console.error(e);
                const msg = e?.response?.data?.message || e?.message || "Erreur lors de l’enregistrement du partage.";
                toast.error(msg);
            } finally {
                setSavingShares(false);
            }
        },
        [fetchBills, filters, closeSharesModal]
    );

    const handlePageChange = (p) => {
        setFilters((prev) => ({ ...prev, page: Math.max(1, Number(p) || 1) }));
    };

    return (
        <div className="space-y-4">
            <div className="flex items-start justify-between gap-3">
                <div>
                    <div className="text-cca-textPrimary font-semibold text-xl">Journal des factures</div>
                    <div className="text-cca-textSecondary text-sm">
                        {canOpenModal ? "Clique sur une facture pour voir les détails." : "Consultation des factures."}
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    <div
                        className={[
                            "px-3 py-1.5 rounded-lg text-xs border",
                            canManageShares
                                ? "border-brand-primary bg-brand-primary/10 text-brand-primary"
                                : "border-cca-border bg-cca-base text-cca-textSecondary",
                        ].join(" ")}
                        title="COMPTABILITE.BILLS.SHARES ou COMPANY.{companyId}.*"
                    >
                        Partage: {canManageShares ? "Autorisé" : "Non autorisé"}
                    </div>

                    <button
                        className="px-3 py-1.5 rounded-lg bg-cca-base hover:bg-brand-primary/20 text-cca-textPrimary text-sm border border-cca-border shadow-sm transition-colors"
                        onClick={() => fetchBills(filters)}
                    >
                        Rafraîchir
                    </button>
                </div>
            </div>

            <BillFilterBar
                value={filters}
                onChange={(next) => setFilters((prev) => ({ ...prev, ...next, page: 1 }))}
                employees={filterEmployees}
                employeesLoading={filterEmployeesLoading}
                renderEmployeeLabel={renderEmployeeLabel}
            />

            <div className="rounded-2xl border border-cca-border bg-cca-surface overflow-hidden shadow-sm">
                {loading ? (
                    <div className="py-10 flex items-center justify-center">
                        <Spinner />
                    </div>
                ) : error ? (
                    <p className="text-center text-red-500 py-6">{error}</p>
                ) : bills.length === 0 ? (
                    <div className="text-center py-10 text-slate-400">Aucune facture ne correspond aux filtres.</div>
                ) : (
                    <>
                        {/* Mobile cards */}
                        <div className="md:hidden relative p-3 space-y-3">
                            {bills.map((bill) => {
                                const ghost = isGhostBill(bill);
                                const issuer = bill.issuerName || bill.author?.name || "—";
                                const clickable = canOpenModal;

                                return (
                                    <div
                                        key={bill.id}
                                        className={[
                                            "relative rounded-xl border border-slate-700/60 bg-slate-900/40 p-3 transition",
                                            ghost ? "opacity-60" : "",
                                            clickable ? "cursor-pointer hover:border-indigo-500/40" : "",
                                        ].join(" ")}
                                        onClick={clickable ? () => openSharesModal(bill) : undefined}
                                    >
                                        <div className="flex items-start justify-between gap-3">
                                            <div className="space-y-1">
                                                <div className="text-slate-200 font-mono text-sm flex items-center gap-2">
                                                    #{bill.externalBillId}
                                                    {ghost && (
                                                        <span className="text-[11px] px-2 py-0.5 rounded-full border border-slate-600/70 bg-slate-950/40 text-slate-300">
                                                            Partagée
                                                        </span>
                                                    )}
                                                    {bill._count?.comments > 0 && (
                                                        <span className="inline-flex items-center gap-1 text-[10px] text-indigo-400 bg-indigo-500/10 border border-indigo-500/20 rounded-full px-1.5 py-0.5">
                                                            <MessageSquare size={9} />
                                                            {bill._count.comments}
                                                        </span>
                                                    )}
                                                </div>

                                                <div className="text-slate-100 font-semibold">{bill.recipientName}</div>
                                                <div className="text-slate-300 text-sm">{bill.reason}</div>

                                                <div className="text-xs text-slate-400">
                                                    Émetteur : <span className="text-slate-200">{issuer}</span>
                                                </div>
                                                {bill.status === "CANCELED" && (
                                                    <div className="text-xs text-slate-400">
                                                        Annulée par :{" "}
                                                        <span className="text-slate-200">
                                                            {bill.canceledBy?.name || "—"}
                                                        </span>
                                                    </div>
                                                )}
                                            </div>

                                            <div className="text-right space-y-2">
                                                <div className="text-slate-100 font-mono">{formatMoneyUSD(bill.amount)}</div>
                                                <span
                                                    className={`inline-flex w-fit max-w-full items-center whitespace-nowrap px-2 py-1 rounded-full text-xs font-semibold leading-none ${
                                                        statusMapping[bill.status]?.color || "bg-slate-700/50 text-slate-200"
                                                    }`}
                                                >
                                                    {statusMapping[bill.status]?.text || bill.status}
                                                </span>
                                            </div>
                                        </div>

                                        <div className="mt-3 flex items-center justify-between text-xs text-slate-400">
                                            <div>
                                                {bill?.date
                                                    ? format(new Date(bill.date), "d MMM yyyy 'à' HH:mm", { locale: fr })
                                                    : "—"}
                                            </div>
                                            {ghost && (
                                                <div className="text-slate-300 bg-slate-950/40 border border-slate-700/60 rounded-lg px-2 py-1">
                                                    {ghostMessage(bill)}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>

                        {/* Desktop table */}
                        <div className="hidden md:block relative overflow-x-auto glass-scroll">
                            <table className="min-w-full text-sm text-cca-textPrimary">
                                <thead className="bg-cca-base font-medium border-b border-cca-border">
                                <tr>
                                    <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-wide text-cca-textSecondary border-r border-cca-border">
                                        ID Ext.
                                    </th>
                                    <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-wide text-cca-textSecondary border-r border-cca-border">
                                        Destinataire
                                    </th>
                                    <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-wide text-cca-textSecondary border-r border-cca-border">
                                        Raison
                                    </th>
                                    <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-wide text-cca-textSecondary border-r border-cca-border">
                                        Montant
                                    </th>
                                    <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-wide text-cca-textSecondary border-r border-cca-border">
                                        Statut
                                    </th>
                                    <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-wide text-cca-textSecondary border-r border-cca-border">
                                        Annulée par
                                    </th>
                                    <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-wide text-cca-textSecondary border-r border-cca-border">
                                        Émetteur
                                    </th>
                                    <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-wide text-cca-textSecondary">
                                        Date & heure
                                    </th>
                                </tr>
                                </thead>

                                <tbody className="divide-y divide-cca-border">
                                {bills.map((bill) => {
                                    const ghost = isGhostBill(bill);
                                    const issuer = bill.issuerName || bill.author?.name || "—";
                                    const clickable = canOpenModal;

                                    return (
                                        <tr
                                            key={bill.id}
                                            className={[
                                                "group transition-all",
                                                "hover:bg-slate-800/40",
                                                ghost ? "opacity-55" : "",
                                                clickable ? "cursor-pointer" : "",
                                            ].join(" ")}
                                            onClick={clickable ? () => openSharesModal(bill) : undefined}
                                        >
                                            <td className="px-4 py-3 text-slate-200 font-mono">
                                                <div className="relative inline-flex items-center gap-2">
                                                    #{bill.externalBillId}
                                                    {ghost && (
                                                        <>
                                                                <span className="text-[10px] px-2 py-0.5 rounded-full border border-slate-600/70 bg-slate-950/40 text-slate-300">
                                                                    Partagée
                                                                </span>
                                                            <div
                                                                className="pointer-events-none absolute left-0 top-full mt-2 z-20 hidden group-hover:block
                                  w-[360px] rounded-lg border border-slate-700/70 bg-slate-950/95 backdrop-blur-xl
                                  px-3 py-2 text-xs text-slate-200 shadow-2xl"
                                                            >
                                                                {ghostMessage(bill)}
                                                            </div>
                                                        </>
                                                    )}
                                                    {bill._count?.comments > 0 && (
                                                        <span
                                                            title={`${bill._count.comments} commentaire${bill._count.comments > 1 ? 's' : ''}`}
                                                            className="inline-flex items-center gap-1 text-[10px] text-indigo-400 bg-indigo-500/10 border border-indigo-500/20 rounded-full px-1.5 py-0.5"
                                                        >
                                                            <MessageSquare size={9} />
                                                            {bill._count.comments}
                                                        </span>
                                                    )}
                                                </div>
                                            </td>

                                            <td className="px-4 py-3 text-slate-200">{bill.recipientName}</td>
                                            <td className="px-4 py-3 text-slate-200">{bill.reason}</td>
                                            <td className="px-4 py-3 text-slate-200 font-mono">{formatMoneyUSD(bill.amount)}</td>

                                            <td className="px-4 py-3">
                                                    <span
                                                        className={`inline-flex w-fit max-w-full items-center whitespace-nowrap px-2 py-1 rounded-full text-xs font-semibold leading-none ${
                                                            statusMapping[bill.status]?.color || "bg-slate-700/50 text-slate-200"
                                                        }`}
                                                    >
                                                        {statusMapping[bill.status]?.text || bill.status}
                                                    </span>
                                            </td>


                                            <td className="px-4 py-3 text-slate-200">
                                                {bill.status === "CANCELED" ? (bill.canceledBy?.name || "—") : "—"}
                                            </td>

                                            <td className="px-4 py-3 text-slate-200">{issuer}</td>

                                            <td className="px-4 py-3 text-slate-200">
                                                {bill?.date
                                                    ? format(new Date(bill.date), "d MMM yyyy 'à' HH:mm", { locale: fr })
                                                    : "—"}
                                            </td>
                                        </tr>
                                    );
                                })}
                                </tbody>
                            </table>
                        </div>
                    </>
                )}
            </div>

            <SharesModal
                open={shareModalOpen}
                onClose={closeSharesModal}
                bill={selectedBill}
                billDetails={billDetails}
                billDetailsLoading={billDetailsLoading}
                employees={shareEmployees}
                employeesLoading={shareEmployeesLoading}
                sharesDraft={sharesDraft}
                setSharesDraft={setSharesDraft}
                renderEmployeeLabel={renderEmployeeLabel}
                saving={savingShares}
                onSave={handleSaveShares}
                canManageShares={canManageShares}
                canSeeComments={canSeeComments}
            />

            {/* Pagination */}
            <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-2 text-xs text-cca-textSecondary">
                <div>
                    Page <span className="text-cca-textPrimary font-semibold">{pagination.currentPage}</span> sur{" "}
                    <span className="text-cca-textPrimary font-semibold">{pagination.totalPages}</span>
                    {typeof pagination.totalCount === "number" && (
                        <span className="ml-2">({pagination.totalCount} facture(s))</span>
                    )}
                </div>

                <div className="flex gap-2">
                    <button
                        disabled={pagination.currentPage <= 1}
                        onClick={() => handlePageChange(pagination.currentPage - 1)}
                        className="px-3 py-1.5 bg-cca-base text-cca-textPrimary border border-cca-border rounded-md disabled:opacity-40 hover:bg-brand-primary/10 transition-colors"
                    >
                        Précédent
                    </button>
                    <button
                        disabled={pagination.currentPage >= pagination.totalPages}
                        onClick={() => handlePageChange(pagination.currentPage + 1)}
                        className="px-3 py-1.5 bg-cca-base text-cca-textPrimary border border-cca-border rounded-md disabled:opacity-40 hover:bg-brand-primary/10 transition-colors"
                    >
                        Suivant
                    </button>
                </div>
            </div>
        </div>
    );
}
