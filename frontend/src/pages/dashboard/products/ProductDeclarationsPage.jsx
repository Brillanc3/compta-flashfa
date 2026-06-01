// /frontend/src/pages/dashboard/products/ProductDeclarationsPage.jsx

import React, { useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";

import Spinner from "@/components/ui/Spinner";
import Button from "@/components/ui/button";

import { useCompany } from "@/contexts/CompanyContext.jsx";
import { usePermissions } from "@/contexts/PermissionsContext";

import {
    fetchDeclarations,
    fetchDeclarationEmployees,
    fetchProducts,
    updateProductDeclaration,
} from "@/services/productsService";

import EditDeclarationModal from "./EditDeclarationModal";

const usd = (value) => {
    const n = Number(value);
    if (!Number.isFinite(n)) return "—";
    return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(n);
};

const toNumber = (v) => {
    const n = Number(v);
    return Number.isFinite(n) ? n : NaN;
};

const normalize = (v) => String(v ?? "").toLowerCase().trim();

export default function ProductDeclarationsPage() {
    const permissions = usePermissions();
    const { activeCompanyId } = useCompany();
    const companyId = activeCompanyId;

    const canEditDeclaration = useMemo(() => {
        if (!companyId) return false;
        return (
            permissions.has?.(`PRODUCTS.${companyId}.DECLARATIONS.EDIT`) ||
            permissions.has?.(`PRODUCTS.${companyId}.MANAGE`)
        );
    }, [permissions, companyId]);

    const [loading, setLoading] = useState(true);
    const [loadingFilters, setLoadingFilters] = useState(true);

    const [mode, setMode] = useState("SELF");
    const [items, setItems] = useState([]);
    const [pagination, setPagination] = useState({ page: 1, pageSize: 15, totalPages: 1, totalCount: 0 });

    const [employees, setEmployees] = useState([]);
    const [products, setProducts] = useState([]);

    const [filters, setFilters] = useState({
        employeeId: "",
        productId: "",
        productStatus: "ALL", // ALL | ACTIVE | INACTIVE
        quantityMin: "",
        quantityMax: "",
        page: 1,
        pageSize: 15,
    });

    // Recherche locale (UX mobile) : filtre sur la page courante (sans toucher l’API)
    const [search, setSearch] = useState("");

    const [editing, setEditing] = useState(null);
    const [saving, setSaving] = useState(false);

    const updateFilter = (key, value) => {
        setFilters((prev) => {
            const next = { ...prev, [key]: value };
            if (key !== "page" && key !== "pageSize") next.page = 1;
            return next;
        });
    };

    const resetFilters = () => {
        setFilters({
            employeeId: "",
            productId: "",
            productStatus: "ALL",
            quantityMin: "",
            quantityMax: "",
            page: 1,
            pageSize: 15,
        });
        setSearch("");
    };

    const formatDateTime = (value) => {
        if (!value) return "—";
        const d = new Date(value);
        if (Number.isNaN(d.getTime())) return "—";
        return new Intl.DateTimeFormat("fr-FR", {
            timeZone: "Europe/Paris",
            year: "numeric",
            month: "2-digit",
            day: "2-digit",
            hour: "2-digit",
            minute: "2-digit",
        }).format(d);
    };

    const loadFilters = async (nextMode) => {
        if (!companyId) return;

        try {
            setLoadingFilters(true);

            const prod = await fetchProducts(companyId, { activeOnly: false });
            setProducts(prod?.products || []);

            const emp = await fetchDeclarationEmployees(companyId);
            if (emp?.employees) setEmployees(emp.employees);
            if (emp?.mode) setMode(emp.mode);

            const m = nextMode || emp?.mode;
            if (m && m !== "ALL") {
                setFilters((prev) => ({ ...prev, employeeId: "" }));
            }
        } catch (e) {
            console.error(e);
            toast.error("Erreur lors du chargement des filtres.");
        } finally {
            setLoadingFilters(false);
        }
    };

    const loadDeclarations = async () => {
        if (!companyId) return;

        try {
            setLoading(true);

            const data = await fetchDeclarations(companyId, {
                page: filters.page,
                pageSize: filters.pageSize,
                employeeId: filters.employeeId || null,
                productId: filters.productId || null,
                productStatus: filters.productStatus || "ALL",
                quantityMin: filters.quantityMin !== "" ? filters.quantityMin : null,
                quantityMax: filters.quantityMax !== "" ? filters.quantityMax : null,
            });

            setMode(data?.mode || "SELF");
            setItems(data?.items || []);
            setPagination((prev) => ({
                ...prev,
                ...(data?.pagination || {}),
                page: data?.pagination?.page ?? filters.page,
                pageSize: data?.pagination?.pageSize ?? filters.pageSize,
                totalPages: data?.pagination?.totalPages ?? 1,
                totalCount: data?.pagination?.totalCount ?? 0,
            }));

            if ((data?.mode || "SELF") !== "ALL") {
                setFilters((prev) => ({ ...prev, employeeId: "" }));
            }
        } catch (e) {
            console.error(e);
            toast.error("Erreur lors du chargement des déclarations.");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (!companyId) return;
        (async () => {
            await loadFilters();
            await loadDeclarations();
        })();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [companyId]);

    useEffect(() => {
        if (!companyId) return;
        if (loadingFilters) return;
        loadDeclarations();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [
        companyId,
        loadingFilters,
        filters.page,
        filters.pageSize,
        filters.employeeId,
        filters.productId,
        filters.productStatus,
        filters.quantityMin,
        filters.quantityMax,
    ]);

    const productOptions = useMemo(() => {
        const base = [{ id: "", name: "Tous les produits", isActive: true }];
        return base.concat(
            (products || []).map((p) => ({
                id: String(p.id),
                name: p.name,
                isActive: !!p.isActive,
            }))
        );
    }, [products]);

    const employeeOptions = useMemo(() => {
        const base = [{ id: "", name: "Tous les employés" }];
        return base.concat(
            (employees || []).map((e) => ({
                id: String(e.id),
                name: e?.name || "Utilisateur",
            }))
        );
    }, [employees]);

    const totalPages = Math.max(1, Number(pagination?.totalPages || 1));
    const totalCount = Number(pagination?.totalCount || 0);

    const displayedItems = useMemo(() => {
        const s = normalize(search);
        if (!s) return items;

        const tokens = s.split(/[\s,]+/).filter(Boolean);
        if (tokens.length === 0) return items;

        return (items || []).filter((d) => {
            const productName = d?.product?.name || d?.productNameSnapshot || "";
            const employeeName =
                d?.employee?.user?.name ||
                d?.employee?.user?.username ||
                d?.employee?.user?.email ||
                "";

            const hay = normalize(
                [
                    productName,
                    employeeName,
                    d?.productId,
                    d?.employeeId,
                    d?.quantity,
                ].join(" ")
            );

            return tokens.every((t) => hay.includes(t));
        });
    }, [items, search]);

    if (!permissions.isReady) {
        return (
            <div className="flex justify-center items-center h-64">
                <Spinner />
            </div>
        );
    }

    const handleSaveQuantity = async ({ declarationId, quantity }) => {
        try {
            setSaving(true);
            const res = await updateProductDeclaration(companyId, declarationId, { quantity });

            const updated = res?.declaration || null;
            if (!updated) {
                toast.error("Réponse invalide lors de la mise à jour.");
                return;
            }

            setItems((prev) => prev.map((it) => (it.id === updated.id ? updated : it)));
            toast.success("Déclaration mise à jour.");
            setEditing(null);
        } catch (e) {
            console.error(e);
            toast.error(e?.message || "Erreur lors de la mise à jour.");
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold text-cca-textPrimary">Déclarations de produits</h1>
                    <p className="text-sm text-cca-textSecondary mt-1">
                        Visualisation et correction des quantités déclarées.
                    </p>
                </div>

                <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                    <Button
                        onClick={resetFilters}
                        className="bg-cca-base hover:bg-cca-border border border-cca-border"
                    >
                        Réinitialiser
                    </Button>
                    <Button
                        onClick={() => loadDeclarations()}
                        className="bg-indigo-600 hover:bg-indigo-700 text-white"
                    >
                        Actualiser
                    </Button>
                </div>
            </div>

            {/* ===================== FILTERS ===================== */}
            <GlassSection title="Filtres" icon="🧾">
                <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4">
                    {/* Recherche locale */}
                    <div className="space-y-1 lg:col-span-2">
                        <label className="text-[11px] uppercase tracking-wide text-cca-textSecondary block">
                            Recherche (page courante)
                        </label>
                        <input
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            placeholder={mode === 'ALL' ? 'Produit, employé, ID…' : 'Produit, ID…'}
                            className="w-full rounded-lg bg-cca-base border border-cca-border px-3 py-2.5 text-sm text-cca-textPrimary focus:border-indigo-400 outline-none"
                        />
                    </div>

                    {/* Employé - visible seulement si mode ALL */}
                    {mode === "ALL" && (
                        <div className="space-y-1">
                            <label className="text-[11px] uppercase tracking-wide text-cca-textSecondary block">
                                Employé
                            </label>
                            <select
                                value={filters.employeeId}
                                onChange={(e) => updateFilter("employeeId", e.target.value)}
                                className="w-full rounded-lg bg-cca-base border border-cca-border px-3 py-2.5 text-sm text-cca-textPrimary focus:border-indigo-400 outline-none"
                            >
                                {employeeOptions.map((o) => (
                                    <option key={o.id} value={o.id}>
                                        {o.name}
                                    </option>
                                ))}
                            </select>
                        </div>
                    )}

                    {/* Produit */}
                    <div className="space-y-1">
                        <label className="text-[11px] uppercase tracking-wide text-cca-textSecondary block">
                            Produit
                        </label>
                        <select
                            value={filters.productId}
                            onChange={(e) => updateFilter("productId", e.target.value)}
                            className="w-full rounded-lg bg-cca-base border border-cca-border px-3 py-2.5 text-sm text-cca-textPrimary focus:border-indigo-400 outline-none"
                        >
                            {productOptions.map((p) => (
                                <option key={p.id} value={p.id}>
                                    {p.name}
                                    {p.id && !p.isActive ? " (désactivé)" : ""}
                                </option>
                            ))}
                        </select>
                    </div>

                    {/* Statut produit */}
                    <div className="space-y-1">
                        <label className="text-[11px] uppercase tracking-wide text-cca-textSecondary block">
                            Statut produit
                        </label>
                        <select
                            value={filters.productStatus}
                            onChange={(e) => updateFilter("productStatus", e.target.value)}
                            className="w-full rounded-lg bg-cca-base border border-cca-border px-3 py-2.5 text-sm text-cca-textPrimary focus:border-indigo-400 outline-none"
                        >
                            <option value="ALL">Tous</option>
                            <option value="ACTIVE">Actifs</option>
                            <option value="INACTIVE">Désactivés</option>
                        </select>
                    </div>

                    {/* Quantité min */}
                    <div className="space-y-1">
                        <label className="text-[11px] uppercase tracking-wide text-cca-textSecondary block">
                            Quantité min
                        </label>
                        <input
                            type="number"
                            value={filters.quantityMin}
                            onChange={(e) => updateFilter("quantityMin", e.target.value)}
                            className="w-full rounded-lg bg-cca-base border border-cca-border px-3 py-2.5 text-sm text-cca-textPrimary focus:border-indigo-400 outline-none"
                            placeholder="0"
                            min="0"
                            step="0.01"
                        />
                    </div>

                    {/* Quantité max */}
                    <div className="space-y-1">
                        <label className="text-[11px] uppercase tracking-wide text-cca-textSecondary block">
                            Quantité max
                        </label>
                        <input
                            type="number"
                            value={filters.quantityMax}
                            onChange={(e) => updateFilter("quantityMax", e.target.value)}
                            className="w-full rounded-lg bg-cca-base border border-cca-border px-3 py-2.5 text-sm text-cca-textPrimary focus:border-indigo-400 outline-none"
                            placeholder="∞"
                            min="0"
                            step="0.01"
                        />
                    </div>

                    {/* Page size */}
                    <div className="space-y-1">
                        <label className="text-[11px] uppercase tracking-wide text-cca-textSecondary block">
                            Taille page
                        </label>
                        <select
                            value={filters.pageSize}
                            onChange={(e) => updateFilter("pageSize", Number(e.target.value))}
                            className="w-full rounded-lg bg-cca-base border border-cca-border px-3 py-2.5 text-sm text-cca-textPrimary focus:border-indigo-400 outline-none"
                        >
                            <option value={10}>10</option>
                            <option value={15}>15</option>
                            <option value={25}>25</option>
                            <option value={50}>50</option>
                        </select>
                    </div>
                </div>

                <div className="mt-4 text-xs text-cca-textSecondary">
                    Affiché : {displayedItems.length} / {items.length} (sur la page courante)
                </div>
            </GlassSection>

            {/* ===================== LIST / TABLE ===================== */}
            <GlassTable title="Déclarations">
                {loading ? (
                    <div className="flex justify-center py-10">
                        <Spinner />
                    </div>
                ) : displayedItems.length === 0 ? (
                    <div className="p-6 text-cca-textSecondary text-center border-t border-cca-border">
                        Aucune déclaration trouvée.
                    </div>
                ) : (
                    <>
                        {/* Mobile : cards */}
                        <div className="md:hidden divide-y divide-cca-border">
                            {displayedItems.map((d) => {
                                const productName = d?.product?.name || d?.productNameSnapshot || "—";
                                const isActive = d?.product?.isActive ?? true;

                                const employeeName =
                                    d?.employee?.user?.name ||
                                    d?.employee?.user?.username ||
                                    d?.employee?.user?.email ||
                                    "Utilisateur";

                                const qty = toNumber(d?.quantity);
                                const unitPrice = toNumber(d?.priceAtSale);
                                const amount = toNumber(d?.amount);

                                return (
                                    <div key={d.id} className="p-4">
                                        <div className="flex items-start justify-between gap-3">
                                            <div className="min-w-0">
                                                <div className="text-cca-textPrimary font-semibold truncate">{productName}</div>
                                                <div className="text-xs text-cca-textSecondary mt-0.5">
                                                    {formatDateTime(d?.declaredAt)}
                                                </div>
                                                {mode === 'ALL' ? (
                                                    <div className="text-xs text-cca-textSecondary mt-1 truncate">
                                                        Employé : <span className="text-cca-textPrimary">{employeeName}</span>
                                                    </div>
                                                ) : null}
                                            </div>

                                            <span
                                                className={
                                                    "text-[11px] px-2 py-0.5 rounded-full border shrink-0 " +
                                                    (isActive
                                                        ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/30"
                                                        : "bg-amber-500/10 text-amber-600 border-amber-500/30")
                                                }
                                                title={isActive ? "Produit actif" : "Produit désactivé"}
                                            >
                                                {isActive ? "Actif" : "Désactivé"}
                                            </span>
                                        </div>

                                        <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
                                            <div>
                                                <div className="text-[11px] uppercase tracking-wide text-cca-textSecondary">Quantité</div>
                                                <div className="text-cca-textPrimary font-semibold">{Number.isFinite(qty) ? qty.toFixed(2) : '—'}</div>
                                            </div>
                                            <div className="text-right">
                                                <div className="text-[11px] uppercase tracking-wide text-cca-textSecondary">Montant</div>
                                                <div className="text-cca-textPrimary font-semibold">{usd(amount)}</div>
                                            </div>
                                            <div>
                                                <div className="text-[11px] uppercase tracking-wide text-cca-textSecondary">Prix unitaire</div>
                                                <div className="text-cca-textPrimary">{usd(unitPrice)}</div>
                                            </div>
                                            <div className="text-right">
                                                <div className="text-[11px] uppercase tracking-wide text-cca-textSecondary">IDs</div>
                                                <div className="text-cca-textSecondary">P:{d?.productId} {mode === 'ALL' ? `• E:${d?.employeeId}` : ''}</div>
                                            </div>
                                        </div>

                                        {canEditDeclaration ? (
                                            <div className="mt-4 flex justify-end">
                                                <Button
                                                    size="sm"
                                                    className="bg-cca-base hover:bg-cca-border border border-cca-border text-cca-textPrimary"
                                                    onClick={() => setEditing(d)}
                                                >
                                                    ✏️ Modifier
                                                </Button>
                                            </div>
                                        ) : null}
                                    </div>
                                );
                            })}
                        </div>

                        {/* Desktop : table */}
                        <div className="hidden md:block overflow-x-auto">
                            <table className="w-full text-sm text-cca-textSecondary">
                                <thead className="bg-cca-base text-cca-textPrimary">
                                <tr>
                                    <th className="p-3 text-left whitespace-nowrap">Date</th>
                                    {mode === "ALL" && <th className="p-3 text-left whitespace-nowrap">Employé</th>}
                                    <th className="p-3 text-left whitespace-nowrap">Produit</th>
                                    <th className="p-3 text-center whitespace-nowrap">Quantité</th>
                                    <th className="p-3 text-right whitespace-nowrap">Prix unitaire</th>
                                    <th className="p-3 text-right whitespace-nowrap">Montant</th>
                                    {canEditDeclaration && <th className="p-3 text-center whitespace-nowrap">Action</th>}
                                </tr>
                                </thead>

                                <tbody>
                                {displayedItems.map((d) => {
                                    const productName = d?.product?.name || d?.productNameSnapshot || "—";
                                    const isActive = d?.product?.isActive ?? true;

                                    const employeeName =
                                        d?.employee?.user?.name ||
                                        d?.employee?.user?.username ||
                                        d?.employee?.user?.email ||
                                        "Utilisateur";

                                    const qty = toNumber(d?.quantity);
                                    const unitPrice = toNumber(d?.priceAtSale);
                                    const amount = toNumber(d?.amount);

                                    return (
                                        <tr
                                            key={d.id}
                                            className="border-b border-cca-border hover:bg-cca-base transition"
                                        >
                                            <td className="p-3 whitespace-nowrap">{formatDateTime(d?.declaredAt)}</td>

                                            {mode === "ALL" && (
                                                <td className="p-3">
                                                    <div className="text-cca-textPrimary font-medium">{employeeName}</div>
                                                    <div className="text-xs text-cca-textSecondary">ID employé: {d?.employeeId}</div>
                                                </td>
                                            )}

                                            <td className="p-3">
                                                <div className="flex items-center gap-2">
                                                    <span className="text-cca-textPrimary font-medium">{productName}</span>
                                                    <span
                                                        className={
                                                            "text-[11px] px-2 py-0.5 rounded-full border " +
                                                            (isActive
                                                                ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/30"
                                                                : "bg-amber-500/10 text-amber-600 border-amber-500/30")
                                                        }
                                                        title={isActive ? "Produit actif" : "Produit désactivé"}
                                                    >
                                                        {isActive ? "Actif" : "Désactivé"}
                                                    </span>
                                                </div>
                                                <div className="text-xs text-cca-textSecondary">ID produit: {d?.productId}</div>
                                            </td>

                                            <td className="p-3 text-center font-semibold text-cca-textPrimary">
                                                {Number.isFinite(qty) ? qty.toFixed(2) : '—'}
                                            </td>

                                            <td className="p-3 text-right">{usd(unitPrice)}</td>
                                            <td className="p-3 text-right font-semibold text-cca-textPrimary">{usd(amount)}</td>

                                            {canEditDeclaration && (
                                                <td className="p-3 text-center">
                                                    <Button
                                                        size="sm"
                                                        className="bg-cca-base hover:bg-cca-border border border-cca-border text-cca-textPrimary"
                                                        onClick={() => setEditing(d)}
                                                    >
                                                        ✏️ Modifier
                                                    </Button>
                                                </td>
                                            )}
                                        </tr>
                                    );
                                })}
                                </tbody>
                            </table>
                        </div>
                    </>
                )}
            </GlassTable>

            {/* ===================== PAGINATION ===================== */}
            <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center text-xs text-cca-textSecondary mt-2 gap-3">
                <p>
                    Page {filters.page} sur {totalPages} ({totalCount} résultats) — mode: {mode}
                </p>

                <div className="flex gap-2 justify-end">
                    <button
                        disabled={filters.page <= 1}
                        onClick={() => updateFilter("page", filters.page - 1)}
                        className="px-3 py-1.5 bg-cca-base border border-cca-border rounded-md disabled:opacity-40 hover:bg-cca-border active:scale-95 text-cca-textPrimary"
                    >
                        Précédent
                    </button>

                    <button
                        disabled={filters.page >= totalPages}
                        onClick={() => updateFilter("page", filters.page + 1)}
                        className="px-3 py-1.5 bg-cca-base border border-cca-border rounded-md disabled:opacity-40 hover:bg-cca-border active:scale-95 text-cca-textPrimary"
                    >
                        Suivant
                    </button>
                </div>
            </div>

            {/* ===================== MODAL EDIT ===================== */}
            {editing && (
                <EditDeclarationModal
                    open={!!editing}
                    declaration={editing}
                    canEdit={canEditDeclaration}
                    saving={saving}
                    onClose={() => setEditing(null)}
                    onSave={handleSaveQuantity}
                />
            )}
        </div>
    );
}

/* --------------------------------------------
   GLASS WRAPPERS
-------------------------------------------- */
function GlassSection({ title, icon, children }) {
    return (
        <div className="relative overflow-hidden rounded-xl bg-cca-surface border border-cca-border shadow-2xl shadow-black/40 p-4 md:p-6">
            <h2 className="relative text-sm font-semibold text-cca-textPrimary tracking-wide flex items-center gap-2 mb-4">
                <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-indigo-500/20 text-xs text-indigo-300 border border-indigo-500/40">
                    {icon}
                </span>
                {title}
            </h2>
            <div className="relative">{children}</div>
        </div>
    );
}

function GlassTable({ title, children }) {
    return (
        <div className="relative overflow-hidden rounded-xl bg-cca-surface border border-cca-border shadow-xl shadow-black/40">
            <div className="px-4 py-3 border-b border-cca-border flex items-center justify-between gap-4">
                <h3 className="text-sm font-semibold text-cca-textPrimary">{title}</h3>
            </div>
            {children}
        </div>
    );
}
