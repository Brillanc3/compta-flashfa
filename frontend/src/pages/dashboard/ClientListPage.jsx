import React, { useEffect, useState, useCallback, useMemo, useRef } from "react";
import { useNavigate, Link } from "react-router-dom";
import { listClients, listClientVariables } from "@/services/clientsService";
import Spinner from "@/components/ui/Spinner";
import toast from "react-hot-toast";
import { Search, Eye, MessageSquare, Phone, CalendarDays, MapPin, RotateCcw, Settings2 } from "lucide-react";
import { ContextMenu, ContextMenuItem } from "@/components/ui/ContextMenu";
import { useCompany } from "@/contexts/CompanyContext.jsx";
import { usePermissions } from "@/contexts/PermissionsContext.jsx";

// ======================================================================
// BADGE STATUT DÉDUIT
// ======================================================================
// ======================================================================
// BADGE STATUT DÉDUIT
// ======================================================================
const ClientStatusBadge = ({ cards }) => {
    const hasCard = Array.isArray(cards) && cards.length > 0;

    return (
        <span
            className={`
                px-2.5 py-0.5 text-[9px] font-black uppercase tracking-widest rounded-lg inline-flex items-center border
                ${hasCard
                    ? "bg-brand-primary/10 text-brand-primary border-brand-primary/20 shadow-[0_0_12px_rgba(var(--brand-primary-rgb),0.1)]"
                    : "bg-cca-surface/40 text-cca-textSecondary/60 border-cca-border"}
            `}
        >
            {hasCard ? "Membre Fidélité" : "Client Standard"}
        </span>
    );
};

// ======================================================================
// CONTEXT MENU CLIENT
// ======================================================================
const ClientRowContextMenu = ({ x, y, client, onClose, onView, onMessage, onCall }) => {
    return (
        <ContextMenu x={x} y={y} onClose={onClose}>
            <ContextMenuItem icon={Eye} onClick={() => { onView(client); onClose(); }}>
                Voir la fiche
            </ContextMenuItem>
            {client?.phoneNumber && (
                <ContextMenuItem icon={Phone} onClick={() => { onCall(client); onClose(); }}>
                    Appeler
                </ContextMenuItem>
            )}
            <ContextMenuItem icon={MessageSquare} onClick={() => { onMessage(client); onClose(); }}>
                Envoyer un message
            </ContextMenuItem>
        </ContextMenu>
    );
};

// ======================================================================
// FILTER BAR
// ======================================================================
const ClientFilterBar = ({ search, setSearch, typeFilter, setTypeFilter, onReset, resultCount }) => {
    return (
        <div className="
            relative overflow-visible rounded-3xl mb-8
            bg-cca-surface/30 border border-cca-border shadow-2xl shadow-black/20 backdrop-blur-2xl p-6 md:p-8 space-y-6
        ">
            <div className="
                pointer-events-none absolute inset-0 opacity-[0.03] mix-blend-overlay
                bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')]
            " />

            <div className="relative flex flex-col md:flex-row md:items-center justify-between gap-6">
                <div className="flex items-center gap-4">
                    <div className="flex h-10 w-10 items-center justify-center rounded-2xl
                                    bg-brand-primary/10 text-brand-primary border border-brand-primary/20 shadow-sm transition-transform hover:scale-110 duration-500">
                        <Search size={20} />
                    </div>
                    <div>
                        <h2 className="text-xs font-black text-cca-textPrimary uppercase tracking-[0.3em]">
                            Exploration Clients
                        </h2>
                        <p className="text-[10px] font-bold text-cca-textSecondary/50 mt-1 uppercase tracking-widest">
                            {typeof resultCount === "number" ? `${resultCount} Contacts identifiés` : "Chargement..."}
                        </p>
                    </div>
                </div>

                <button
                    type="button"
                    onClick={onReset}
                    className="
                        group inline-flex items-center gap-2 rounded-xl
                        bg-rose-500/10 border border-rose-500/20
                        px-4 py-2.5 text-[10px] font-black uppercase tracking-widest text-rose-500
                        hover:bg-rose-500 hover:text-white
                        active:scale-95 transition-all duration-300 shadow-lg shadow-rose-500/5
                    "
                >
                    <RotateCcw size={14} className="group-hover:rotate-180 transition-transform duration-500" />
                    <span>Réinitialiser</span>
                </button>
            </div>

            <div className="relative grid grid-cols-1 md:grid-cols-4 gap-6">
                {/* SEARCH */}
                <div className="md:col-span-3 space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-[0.2em] text-cca-textSecondary/60 block ml-1">
                        Critères de recherche
                    </label>
                    <div className="relative group">
                        <input
                            type="text"
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            placeholder="Nom complet, téléphone, adresse résidentielle..."
                            className="
                                w-full rounded-2xl bg-cca-base/40 border border-cca-border
                                pl-5 pr-12 py-3.5 text-sm text-cca-textPrimary placeholder:text-cca-textSecondary/20
                                focus:border-brand-primary focus:ring-4 focus:ring-brand-primary/5
                                outline-none transition-all duration-300
                            "
                        />
                        <div className="absolute right-4 top-1/2 -translate-y-1/2 text-cca-textSecondary/20 group-focus-within:text-brand-primary transition-colors">
                            <Search size={18} />
                        </div>
                    </div>
                </div>

                {/* TYPE */}
                <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-[0.2em] text-cca-textSecondary/60 block ml-1">
                        Catégorie
                    </label>
                    <select
                        value={typeFilter}
                        onChange={(e) => setTypeFilter(e.target.value)}
                        className="
                            w-full rounded-2xl bg-cca-base/40 border border-cca-border cursor-pointer
                            px-5 py-3.5 text-sm text-cca-textPrimary appearance-none
                            focus:border-brand-primary focus:ring-4 focus:ring-brand-primary/5
                            outline-none transition-all duration-300
                        "
                    >
                        <option value="ALL">Tous les profils</option>
                        <option value="FIDELITY">Membres Fidélité</option>
                        <option value="STANDARD">Clients Standards</option>
                    </select>
                </div>
            </div>
        </div>
    );
};

// ======================================================================
// MOBILE CARD
// ======================================================================
const ClientMobileCard = ({ client, onOpen, onContextMenu, onTouchStart, onTouchEnd }) => {
    const initial = (client?.name || "?").trim().slice(0, 1).toUpperCase();
    const createdAtLabel = client?.createdAt ? new Date(client.createdAt).toLocaleDateString("fr-FR") : "—";

    return (
        <div
            role="button"
            tabIndex={0}
            onClick={() => onOpen(client)}
            onContextMenu={(e) => onContextMenu(e, client)}
            onTouchStart={(e) => onTouchStart(e, client)}
            onTouchEnd={onTouchEnd}
            className="
                group rounded-2xl border border-cca-border
                bg-cca-surface/30 backdrop-blur-xl
                shadow-xl p-5 space-y-4
                active:scale-[0.98] transition-all duration-300
                outline-none hover:bg-brand-primary/5 animate-in slide-in-from-bottom-2
            "
        >
            <div className="flex items-start justify-between gap-4">
                <div className="flex items-center gap-4 min-w-0">
                    <div className="
                        h-12 w-12 rounded-2xl
                        bg-brand-primary/10 border border-brand-primary/20
                        text-brand-primary font-black text-xl
                        flex items-center justify-center
                        shrink-0 shadow-inner
                    ">
                        {initial}
                    </div>

                    <div className="min-w-0 space-y-1">
                        <h3 className="font-black text-cca-textPrimary tracking-tight truncate">
                            {client?.name || "—"}
                        </h3>
                        <ClientStatusBadge cards={client?.cards} />
                    </div>
                </div>

                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-cca-base/40 border border-cca-border shadow-sm group-hover:bg-brand-primary group-hover:text-white transition-colors duration-300">
                    <Eye size={18} />
                </div>
            </div>

            <div className="pt-4 border-t border-cca-border/40 space-y-3 text-xs">
                <div className="flex items-center gap-3">
                    <MapPin size={16} className="text-cca-textSecondary/40 shrink-0" />
                    <span className="text-cca-textSecondary font-medium truncate">{client?.address || "Adresse non renseignée"}</span>
                </div>

                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <Phone size={16} className="text-cca-textSecondary/40 shrink-0" />
                        <span className="text-cca-textPrimary font-bold tracking-tight">{client?.phoneNumber || "—"}</span>
                    </div>
                    <div className="text-[9px] font-black uppercase tracking-[0.1em] text-cca-textSecondary/30">
                        Inscrit le {createdAtLabel}
                    </div>
                </div>
            </div>
        </div>
    );
};

// ======================================================================
// PAGE CLIENTS
// ======================================================================
const ClientListPage = () => {
    const { activeCompanyId } = useCompany();
    const companyId = activeCompanyId;
    const { has } = usePermissions();

    const navigate = useNavigate();

    const [clients, setClients] = useState([]);
    const [pagination, setPagination] = useState({ currentPage: 1, totalPages: 1 });
    const [loading, setLoading] = useState(true);
    const [variables, setVariables] = useState([]);

    const [search, setSearch] = useState("");
    const [typeFilter, setTypeFilter] = useState("ALL");

    // Context menu
    const [contextMenu, setContextMenu] = useState({ visible: false, x: 0, y: 0, client: null });
    const touchTimer = useRef(null);

    // Charger les variables de la company en parallèle
    useEffect(() => {
        listClientVariables().then(setVariables).catch(() => {});
    }, [companyId]);

    // ==========================================================
    // FETCH CLIENTS
    // ==========================================================
    const fetchClients = useCallback(async () => {
        try {
            setLoading(true);

            const response = await listClients(companyId, {
                page: pagination.currentPage,
                search,
            });

            setClients(response.data || []);

            setPagination({
                currentPage: Number(response.pagination?.currentPage) || 1,
                totalPages: Number(response.pagination?.totalPages) || 1,
            });
        } catch {
            toast.error("Impossible de charger les clients.");
        } finally {
            setLoading(false);
        }
    }, [companyId, pagination.currentPage, search]);

    useEffect(() => {
        fetchClients();
    }, [fetchClients]);

    const setSearchAndReset = (value) => {
        setSearch(value);
        setPagination((p) => ({ ...p, currentPage: 1 }));
    };

    const setTypeFilterAndReset = (value) => {
        setTypeFilter(value);
        setPagination((p) => ({ ...p, currentPage: 1 }));
    };

    // ==========================================================
    // FILTER RESULTS
    // ==========================================================
    const filtered = useMemo(() => {
        let base = clients;

        if (search) {
            const s = search.toLowerCase();
            base = base.filter((c) =>
                (c.name || "").toLowerCase().includes(s) ||
                (c.address || "").toLowerCase().includes(s) ||
                (c.phoneNumber || "").toLowerCase().includes(s)
            );
        }

        if (typeFilter !== "ALL") {
            base = base.filter((c) => {
                const hasCard = Array.isArray(c.cards) && c.cards.length > 0;
                if (typeFilter === "FIDELITY") return hasCard;
                if (typeFilter === "STANDARD") return !hasCard;
                return true;
            });
        }

        return base;
    }, [clients, search, typeFilter]);

    // ==========================================================
    // CONTEXT MENU HANDLERS
    // ==========================================================
    const openContextMenu = (e, client) => {
        e.preventDefault();
        setContextMenu({ visible: true, x: e.pageX, y: e.pageY, client });
    };

    const handleTouchStart = (e, client) => {
        const t = e.touches[0];
        touchTimer.current = setTimeout(() => {
            setContextMenu({ visible: true, x: t.pageX, y: t.pageY, client });
        }, 500);
    };

    const handleTouchEnd = () => clearTimeout(touchTimer.current);

    const closeContextMenu = () => setContextMenu((prev) => ({ ...prev, visible: false }));

    const viewClient = (c) => {
        closeContextMenu();
        navigate(`/dashboard/company/clients/${c.id}`);
    };

    const messageClient = (_c) => {
        toast("Messaging bientôt !");
        closeContextMenu();
    };

    const callClient = (c) => {
        closeContextMenu();
        if (!c?.phoneNumber) {
            toast.error("Aucun numéro de téléphone.");
            return;
        }
        const phone = String(c.phoneNumber).replace(/\s+/g, "");
        window.location.href = `tel:${phone}`;
    };

    const resetFilters = () => {
        setSearchAndReset("");
        setTypeFilterAndReset("ALL");
    };

    // ==========================================================
    // RENDER
    // ==========================================================
    return (
        <div className="max-w-[1600px] mx-auto space-y-8 pb-12 animate-in fade-in duration-700">
            {/* TITLE */}
            <header className="flex flex-col md:flex-row md:items-end justify-between gap-4">
                <div className="space-y-1">
                    <p className="text-[10px] font-black uppercase tracking-[0.4em] text-brand-primary opacity-70">Relation Client</p>
                    <h1 className="text-4xl font-black tracking-tighter text-cca-textPrimary font-heading">
                        Gestion <span className="text-brand-primary">Contacts</span>
                    </h1>
                </div>
                
                <div className="flex items-center gap-3">
                    {has('clients.variables.manage') && (
                        <Link
                            to="/dashboard/company/clients/variables"
                            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 font-black text-[10px] uppercase tracking-widest hover:bg-indigo-500 hover:text-white transition-all"
                        >
                            <Settings2 size={14} /> Variables
                        </Link>
                    )}
                    <div className="px-4 py-2 rounded-2xl bg-cca-surface/40 border border-cca-border backdrop-blur-xl shadow-sm text-xs font-bold">
                        <span className="text-cca-textSecondary">Base :</span> <span className="text-brand-primary">{clients.length}</span> <span className="text-cca-textSecondary/40 ml-1 uppercase tracking-widest text-[9px]">Enregistrements</span>
                    </div>
                </div>
            </header>

            {/* FILTERS */}
            <ClientFilterBar
                search={search}
                setSearch={setSearchAndReset}
                typeFilter={typeFilter}
                setTypeFilter={setTypeFilterAndReset}
                onReset={resetFilters}
                resultCount={filtered.length}
            />

            {/* LIST / TABLE CONTAINER */}
            <div className="relative rounded-3xl bg-cca-surface/20 border border-cca-border backdrop-blur-3xl shadow-2xl shadow-black/30 overflow-hidden">
                <div className="
                    pointer-events-none absolute inset-0 opacity-[0.02] mix-blend-overlay
                    bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')]
                " />

                {loading ? (
                    <div className="flex justify-center py-24 animate-pulse">
                        <Spinner />
                    </div>
                ) : (
                    <div className="relative">
                        {/* MOBILE LIST */}
                        <div className="md:hidden p-5 space-y-4">
                            {filtered.length > 0 ? (
                                filtered.map((client) => (
                                    <ClientMobileCard
                                        key={client.id}
                                        client={client}
                                        onOpen={viewClient}
                                        onMessage={messageClient}
                                        onCall={callClient}
                                        onContextMenu={openContextMenu}
                                        onTouchStart={handleTouchStart}
                                        onTouchEnd={handleTouchEnd}
                                    />
                                ))
                            ) : (
                                <div className="flex flex-col items-center justify-center py-20 opacity-40">
                                    <p className="text-sm font-bold uppercase tracking-widest text-cca-textSecondary">Aucun résultat</p>
                                </div>
                            )}
                        </div>

                        {/* DESKTOP TABLE */}
                        <div className="hidden md:block overflow-x-auto glass-scroll">
                            <table className="min-w-full text-sm text-cca-textPrimary border-separate border-spacing-0">
                                {/* HEADER */}
                                <thead>
                                    <tr className="sticky top-0 z-10 bg-cca-surface/60 backdrop-blur-2xl">
                                        <th className="px-6 py-5 text-[10px] font-black uppercase tracking-[0.2em] text-cca-textSecondary/60 border-b border-cca-border/30 text-left">Nom du Client</th>
                                        <th className="px-6 py-5 text-[10px] font-black uppercase tracking-[0.2em] text-cca-textSecondary/60 border-b border-cca-border/30 text-left">Localisation</th>
                                        <th className="px-6 py-5 text-[10px] font-black uppercase tracking-[0.2em] text-cca-textSecondary/60 border-b border-cca-border/30 text-left">Coordonnées</th>
                                        <th className="px-6 py-5 text-[10px] font-black uppercase tracking-[0.2em] text-cca-textSecondary/60 border-b border-cca-border/30 text-left">Date d'Inscription</th>
                                        <th className="px-6 py-5 text-[10px] font-black uppercase tracking-[0.2em] text-cca-textSecondary/60 border-b border-cca-border/30 text-left">Classification</th>
                                        {variables.map(v => (
                                            <th key={v.id} className="px-6 py-5 text-[10px] font-black uppercase tracking-[0.2em] text-cca-textSecondary/60 border-b border-cca-border/30 text-center">{v.label}</th>
                                        ))}
                                    </tr>
                                </thead>

                                {/* BODY */}
                                <tbody className="divide-y divide-cca-border/30">
                                {filtered.length > 0 ? (
                                    filtered.map((client) => {
                                        // Calculer le style de ligne basé sur les variables
                                        const rowVars = client.variableValues || [];
                                        let rowStyle = {};
                                        for (const v of variables) {
                                            const val = rowVars.find(rv => rv.variableId === v.id);
                                            const cfg = v.config || {};
                                            if (v.type === 'BOOLEAN' && val?.value === 'true' && cfg.rowBg) {
                                                const opacity = cfg.rowOpacity ?? 1;
                                                // Convertir hex en rgba pour appliquer la transparence
                                                const hex = cfg.rowBg.replace('#', '');
                                                const r = parseInt(hex.substring(0, 2), 16);
                                                const g = parseInt(hex.substring(2, 4), 16);
                                                const b = parseInt(hex.substring(4, 6), 16);
                                                rowStyle.backgroundColor = `rgba(${r},${g},${b},${opacity})`;
                                                if (cfg.rowBorder) rowStyle.boxShadow = `inset 0 0 0 1px ${cfg.rowBorder}`;
                                            }
                                        }
                                        return (
                                            <tr
                                                key={client.id}
                                                style={rowStyle}
                                                onClick={() => navigate(`/dashboard/company/clients/${client.id}`)}
                                                onContextMenu={(e) => openContextMenu(e, client)}
                                                onTouchStart={(e) => handleTouchStart(e, client)}
                                                onTouchEnd={handleTouchEnd}
                                                className="
                                                    group cursor-pointer transition-all duration-300
                                                    hover:bg-brand-primary/5 hover:backdrop-blur-sm
                                                "
                                            >
                                                <td className="px-6 py-4">
                                                    <div className="flex items-center gap-4">
                                                        <div className="h-9 w-9 rounded-xl bg-cca-base border border-cca-border flex items-center justify-center font-black text-xs text-brand-primary group-hover:scale-110 transition-transform">
                                                            {(client.name || "?").slice(0, 1).toUpperCase()}
                                                        </div>
                                                        <span className="font-black text-cca-textPrimary tracking-tight group-hover:text-brand-primary transition-colors">
                                                            {client.name}
                                                        </span>
                                                    </div>
                                                </td>

                                                <td className="px-6 py-4 whitespace-nowrap">
                                                    <div className="flex items-center gap-3 text-cca-textSecondary/80 group-hover:text-cca-textPrimary transition-colors">
                                                        <div className="p-1.5 rounded-lg bg-cca-base/50">
                                                            <MapPin size={14} className="text-cca-textSecondary/40" />
                                                        </div>
                                                        <span className="font-medium text-xs font-mono">{client.address || "—"}</span>
                                                    </div>
                                                </td>

                                                <td className="px-6 py-4 whitespace-nowrap">
                                                    <div className="flex items-center gap-3 text-cca-textSecondary/80 group-hover:text-cca-textPrimary transition-colors">
                                                        <div className="p-1.5 rounded-lg bg-cca-base/50">
                                                            <Phone size={14} className="text-cca-textSecondary/40" />
                                                        </div>
                                                        <span className="font-bold text-xs">{client.phoneNumber || "—"}</span>
                                                    </div>
                                                </td>

                                                <td className="px-6 py-4 whitespace-nowrap">
                                                    <div className="flex items-center gap-3 text-cca-textSecondary/80 group-hover:text-cca-textPrimary transition-colors">
                                                        <div className="p-1.5 rounded-lg bg-cca-base/50">
                                                            <CalendarDays size={14} className="text-cca-textSecondary/40" />
                                                        </div>
                                                        <span className="font-medium text-xs">
                                                            {client.createdAt
                                                                ? new Date(client.createdAt).toLocaleDateString("fr-FR", { day: '2-digit', month: 'short', year: 'numeric' })
                                                                : "—"}
                                                        </span>
                                                    </div>
                                                </td>

                                                <td className="px-6 py-4 whitespace-nowrap">
                                                    <ClientStatusBadge cards={client.cards} />
                                                </td>

                                                {/* Colonnes variables dynamiques */}
                                                {variables.map(v => {
                                                    const val = (client.variableValues || []).find(rv => rv.variableId === v.id);
                                                    const cfg = v.config || {};
                                                    let display = '—';
                                                    if (val?.value !== null && val?.value !== undefined) {
                                                        if (v.type === 'BOOLEAN') {
                                                            const isTrue = val.value === 'true';
                                                            display = isTrue
                                                                ? (cfg.trueIcon || cfg.trueLabel || 'Oui')
                                                                : (cfg.falseIcon || cfg.falseLabel || 'Non');
                                                        } else {
                                                            display = val.value || '—';
                                                        }
                                                    }
                                                    return (
                                                        <td key={v.id} className="px-6 py-4 text-center text-sm font-bold">{display}</td>
                                                    );
                                                })}
                                            </tr>
                                        );
                                    })
                                ) : (
                                    <tr>
                                        <td colSpan={5 + variables.length} className="text-center py-20 opacity-40">
                                            <p className="text-sm font-bold uppercase tracking-widest text-cca-textSecondary">Aucun contact identifié</p>
                                        </td>
                                    </tr>
                                )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}
            </div>

            {/* PAGINATION */}
            <div className="flex flex-col md:flex-row justify-between items-center gap-6 pt-4">
                <div className="flex items-center gap-4 order-2 md:order-1">
                    <p className="text-[10px] font-black uppercase tracking-widest text-cca-textSecondary/60">
                        Page <span className="text-cca-textPrimary">{pagination.currentPage}</span> sur {pagination.totalPages}
                    </p>
                </div>

                <div className="flex gap-4 order-1 md:order-2 w-full md:w-auto">
                    <button
                        disabled={pagination.currentPage <= 1}
                        onClick={() =>
                            setPagination((p) => ({
                                ...p,
                                currentPage: Math.max(1, Number(p.currentPage) - 1),
                            }))
                        }
                        className="
                            flex-1 md:flex-none px-6 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest
                            bg-cca-surface/40 border border-cca-border text-cca-textPrimary
                            hover:bg-cca-surface hover:text-brand-primary active:scale-95 transition-all
                            disabled:opacity-20 disabled:cursor-not-allowed
                        "
                    >
                        Précédent
                    </button>

                    <button
                        disabled={pagination.currentPage >= pagination.totalPages}
                        onClick={() =>
                            setPagination((p) => ({
                                ...p,
                                currentPage: Math.min(Number(p.totalPages), Number(p.currentPage) + 1),
                            }))
                        }
                        className="
                            flex-1 md:flex-none px-6 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest
                            bg-brand-primary text-white border border-brand-primary shadow-xl shadow-brand-primary/20
                            hover:brightness-110 active:scale-95 transition-all
                            disabled:opacity-20 disabled:cursor-not-allowed
                        "
                    >
                        Suivant
                    </button>
                </div>
            </div>

            {/* CONTEXT MENU */}
            {contextMenu.visible && (
                <ClientRowContextMenu
                    x={contextMenu.x}
                    y={contextMenu.y}
                    client={contextMenu.client}
                    onClose={closeContextMenu}
                    onView={viewClient}
                    onMessage={messageClient}
                    onCall={callClient}
                />
            )}
        </div>
    );
};

export default ClientListPage;
