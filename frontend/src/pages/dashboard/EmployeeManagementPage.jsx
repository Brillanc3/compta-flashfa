// frontend/src/pages/dashboard/EmployeeManagementPage.jsx

import React, {
    useState,
    useEffect,
    useCallback,
    useMemo,
} from "react";
import { Link, useNavigate } from "react-router-dom";
import { getCompanyEmployees, getAvailableColumns } from "@/services/employeesService";
import { getUserPreferences, saveUserPreferences } from "@/services/userService";
import toast from "react-hot-toast";
import { getISOWeek, getYear, format } from "date-fns";
import { fr } from "date-fns/locale";
import Spinner from "@/components/ui/Spinner";
import ViewCustomizationModal from "@/components/dashboard/employees/ViewCustomizationModal";
import SalaryDetailModal from "@/components/dashboard/employees/SalaryDetailModal";
import WeekSelector from "@/components/accounting/WeekSelector";
import Tooltip from "@/components/ui/Tooltip";
import { Settings, Info, Eye, Shield, LogOut, UserMinus, Search, ChevronUp, ChevronDown, Pencil } from "lucide-react";
import { ContextMenu, ContextMenuItem } from "@/components/ui/ContextMenu";
import {useCompany} from "@/contexts/CompanyContext.jsx";
import { changeEmployeeRank, changeEmployeeStatus } from "@/services/employeesService";
import ChangeRankModal from "@/components/dashboard/employees/ChangeRankModal";
import ActionConfirmationModal from "@/components/dashboard/employees/ActionConfirmationModal";

// ======================================================================
// STATUS BADGE
// ======================================================================
const StatusBadge = ({ status, date }) => {
    if (typeof status !== "string") {
        return (
            <span className="px-2.5 py-0.5 text-[9px] font-black uppercase tracking-widest rounded-lg bg-cca-surface/40 text-cca-textSecondary/60 border border-cca-border">
                INCONNU
            </span>
        );
    }
    const styles = {
        ACTIVE: "bg-emerald-500/10 text-emerald-500 border-emerald-500/20 shadow-[0_0_10px_rgba(16,185,129,0.1)]",
        PENDING_LINK: "bg-amber-500/10 text-amber-500 border-amber-500/20 shadow-[0_0_10px_rgba(245,158,11,0.1)]",
        FIRE: "bg-rose-500/10 text-rose-500 border-rose-500/20 shadow-[0_0_10px_rgba(239,68,68,0.1)]",
        RESIGNED: "bg-cca-surface/40 text-cca-textSecondary/60 border-cca-border",
    };
    
    const labels = {
        ACTIVE: "ACTIF",
        PENDING_LINK: "EN ATTENTE",
        FIRE: "LICENCIÉ",
        RESIGNED: "DÉMISSION",
    };

    return (
        <span
            className={`px-2.5 py-0.5 inline-flex items-center gap-2 text-[9px] font-black uppercase tracking-widest rounded-lg border ${styles[status] || styles.RESIGNED}`}
        >
            {labels[status] || status.replace("_", " ")}
            {(status === "FIRE" || status === "RESIGNED") && date && (
                <Tooltip text={`Date: ${format(new Date(date), "PPP", { locale: fr })}`}>
                    <Info size={10} className="cursor-help opacity-60 hover:opacity-100 transition-opacity" />
                </Tooltip>
            )}
        </span>
    );
};

// ======================================================================
// FILTER BAR
// ======================================================================
const EmployeeFilterBar = ({
                               search,
                               setSearch,
                               rankFilter,
                               setRankFilter,
                               statusFilter,
                               setStatusFilter,
                               ranks,
                           }) => {
    return (
        <div className="relative overflow-hidden rounded-3xl bg-cca-surface/20 border border-cca-border backdrop-blur-3xl shadow-2xl shadow-black/40 p-1 mb-8 group">
             {/* Glowing edge effect */}
            <div className="absolute -inset-1 bg-gradient-to-r from-brand-primary/0 via-brand-primary/5 to-brand-primary/0 opacity-0 group-hover:opacity-100 transition-opacity duration-1000" />
            
            <div className="relative p-6 sm:p-8 space-y-6">
                <div className="flex items-center justify-between border-b border-cca-border/50 pb-4">
                    <div className="space-y-0.5">
                        <div className="text-[10px] font-black uppercase tracking-[0.4em] text-brand-primary/80">Affiner les résultats</div>
                        <h2 className="text-xl font-black tracking-tight text-cca-textPrimary font-heading">Filtres Dynamiques</h2>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">

                    {/* Search */}
                    <div className="md:col-span-2 space-y-2">
                        <label className="text-[10px] font-black uppercase tracking-widest text-cca-textSecondary/60 ml-1">
                            Recherche Identitaire
                        </label>
                        <div className="relative">
                            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-cca-textSecondary/30" size={16} />
                            <input
                                type="text"
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                placeholder="Nom, prénom ou identifiant..."
                                className="
                                    w-full rounded-2xl bg-cca-base/40 border border-cca-border
                                    pl-12 pr-4 py-3.5 text-sm font-bold text-cca-textPrimary placeholder:text-cca-textSecondary/20
                                    focus:border-brand-primary focus:ring-4 focus:ring-brand-primary/5
                                    outline-none transition-all
                                "
                            />
                        </div>
                    </div>

                    {/* Rang */}
                    <div className="space-y-2">
                        <label className="text-[10px] font-black uppercase tracking-widest text-cca-textSecondary/60 ml-1">Hiérarchie</label>
                        <select
                            value={rankFilter}
                            onChange={(e) => setRankFilter(e.target.value)}
                            className="
                                w-full rounded-2xl bg-cca-base/40 border border-cca-border
                                px-4 py-3.5 text-sm font-bold text-cca-textPrimary
                                focus:border-brand-primary outline-none transition-all
                                appearance-none
                            "
                        >
                            <option value="">Tous les Rangs</option>
                            {ranks.map((r) => (
                                <option key={r.id} value={r.id}>{r.name}</option>
                            ))}
                        </select>
                    </div>

                    {/* Statut */}
                    <div className="space-y-2">
                        <label className="text-[10px] font-black uppercase tracking-widest text-cca-textSecondary/60 ml-1">État de Service</label>
                        <select
                            value={statusFilter}
                            onChange={(e) => setStatusFilter(e.target.value)}
                            className="
                                w-full rounded-2xl bg-cca-base/40 border border-cca-border
                                px-4 py-3.5 text-sm font-bold text-cca-textPrimary
                                focus:border-brand-primary outline-none transition-all
                                appearance-none
                            "
                        >
                            <option value="">Tous les Statuts</option>
                            <option value="ACTIVE">Actif uniquement</option>
                            <option value="FIRE">Licenciements</option>
                            <option value="RESIGNED">Démissions</option>
                        </select>
                    </div>

                </div>
            </div>
        </div>
    );
};

// ======================================================================
// CONTEXT MENU
// ======================================================================
const EmployeeRowContextMenu = ({
                                    x,
                                    y,
                                    onClose,
                                    employee,
                                    onView,
                                    onChangeRank,
                                    onFire,
                                    onResign,
                                    onCopySalary,
                                    onOverrideSalary,
                                }) => (
    <ContextMenu x={x} y={y} onClose={onClose}>
        <ContextMenuItem icon={Eye} onClick={() => onView(employee)}>Consulter le dossier</ContextMenuItem>
        <ContextMenuItem icon={Search} onClick={() => onCopySalary(employee)}>Extraire le salaire net</ContextMenuItem>
        {employee.salary != null && (
            <ContextMenuItem icon={Pencil} onClick={() => onOverrideSalary(employee)}>Modifier le salaire</ContextMenuItem>
        )}
        <ContextMenuItem icon={Shield} onClick={() => onChangeRank(employee)}>Mutation hiérarchique</ContextMenuItem>
        <ContextMenuItem icon={UserMinus} danger onClick={() => onFire(employee)}>Procéder au licenciement</ContextMenuItem>
        <ContextMenuItem icon={LogOut} danger onClick={() => onResign(employee)}>Enregistrer démission</ContextMenuItem>
    </ContextMenu>
);

// ======================================================================
// PAGE PRINCIPALE
// ======================================================================
const EmployeeManagementPage = () => {
    const { activeCompanyId } = useCompany();
    const companyId = Number(activeCompanyId);
    const navigate = useNavigate();

    const PREFERENCES_KEY = "employees_view_columns";

    const [employees, setEmployees] = useState([]);
    const [availableColumns, setAvailableColumns] = useState([]);
    const [visibleColumns, setVisibleColumns] = useState([]);
    const [loading, setLoading] = useState(true);
    const [configLoaded, setConfigLoaded] = useState(false);

    const [selectedEmployeeForModal, setSelectedEmployeeForModal] = useState(null);
    const [isModalOpen, setIsModalOpen] = useState(false);

    // filters
    const [search, setSearch] = useState("");
    const [rankFilter, setRankFilter] = useState("");
    const [statusFilter, setStatusFilter] = useState("");

    // sorting
    const [sortConfig, setSortConfig] = useState({ key: "name", direction: "asc" });

    // mobile cards (respect visibleColumns)
    const MOBILE_CARD_FIELD_LIMIT = 6;
    const [expandedCards, setExpandedCards] = useState(() => ({}));

    const toggleExpandedCard = (employeeId) => {
        setExpandedCards((prev) => ({
            ...prev,
            [employeeId]: !prev[employeeId],
        }));
    };

    // ------------------------------------------------------------------
    // CELL RENDERER
    // ------------------------------------------------------------------
    const renderCell = (employee, key) => {
        if (key === "name") {
            return (
                <Link
                    to={`/dashboard/company/employees/${employee.id}`}
                    onClick={(e) => e.stopPropagation()}
                    className="text-brand-primary font-black hover:brightness-125 transition-all"
                >
                    {employee.user?.name || "N/A"}
                </Link>
            );
        }

        if (key === "rank") return <span className="text-cca-textPrimary/80 font-bold">{employee.rank?.name}</span>;

        if (key === "status") return <StatusBadge status={employee.status} date={employee.statusUpdatedAt} />;

        if (key === "salary") {
            const final = employee.salary?.finalSalary;
            if (final == null) return <span className="text-cca-textSecondary/20 font-mono italic">en attente</span>;
            return (
                <button
                    onClick={(e) => {
                        e.stopPropagation();
                        setSelectedEmployeeForModal(employee);
                    }}
                    className="group/salary flex items-center gap-2 text-left"
                >
                    <span className="text-emerald-400 font-mono font-black group-hover/salary:underline">
                        {final.toFixed(0)} $
                    </span>
                    {employee.salary.isOverridden && (
                        <Tooltip text={`Salaire manuel (calculé: ${employee.salary.calculatedSalary?.toFixed(0) ?? '?'} $)`}>
                            <span className="text-violet-400 text-[10px] font-black">✎</span>
                        </Tooltip>
                    )}
                    {employee.salary.isMissingCap && (
                        <Tooltip text="Salaire limite non défini">
                            <span className="text-amber-500 animate-pulse text-[10px]">⚠️</span>
                        </Tooltip>
                    )}
                </button>
            );
        }

        if (key === "billCount") {
            return <span className="font-mono font-black text-sky-400/80 tracking-tighter">{employee.billCount ?? "0"}</span>;
        }

        const value = employee[key];

        if (value === null || value === undefined) return "—";
        if (typeof value === "boolean") return value ? "Oui" : "Non";
        if (typeof value === "number") return <span className="font-mono font-bold text-cca-textPrimary/60">{value}</span>;
        if (typeof value === "string") return <span className="text-cca-textPrimary/70">{value}</span>;
        if (Array.isArray(value)) return value.join(", ");

        return String(value);
    };

    // Mobile specific logic
    const showMobileName = visibleColumns.includes("name");
    const showMobileRank = visibleColumns.includes("rank");
    const showMobileStatus = visibleColumns.includes("status");
    const mobileCardKeys = visibleColumns.filter(k => !["name", "rank", "status"].includes(k));
    const renderCardValue = (employee, key) => renderCell(employee, key);


    // week selector
    const [weekParams, setWeekParams] = useState(() => {
        const now = new Date();
        return { year: getYear(now), week: getISOWeek(now) };
    });

    // context menu
    const [contextMenu, setContextMenu] = useState({ visible: false, x: 0, y: 0, employee: null });

    // modals
    const [rankModal, setRankModal] = useState({ isOpen: false, employee: null, loading: false });
    const [actionModal, setActionModal] = useState({
        isOpen: false,
        type: null,
        employee: null,
        loading: false,
    });

    const openContextMenu = (e, employee) => {
        e.preventDefault();
        setContextMenu({
            visible: true,
            x: e.clientX,
            y: e.clientY,
            employee,
        });
    };

    const closeContextMenu = () => {
        setContextMenu({ ...contextMenu, visible: false });
    };

    const view = (emp) => {
        navigate(`/dashboard/company/employees/${emp.id}`);
        closeContextMenu();
    };

    const copy = (emp) => {
        const salary = emp.salary?.finalSalary ?? 0;
        navigator.clipboard.writeText(salary.toFixed(0));
        toast.success("Salaire copié dans le presse-papier");
        closeContextMenu();
    };

    const overrideSalary = (emp) => {
        setSelectedEmployeeForModal(emp);
        closeContextMenu();
    };

    const changeRank = (emp) => {
        setRankModal({ isOpen: true, employee: emp, loading: false });
        closeContextMenu();
    };

    const fire = (emp) => {
        setActionModal({ isOpen: true, type: "FIRE", employee: emp, loading: false });
        closeContextMenu();
    };

    const resign = (emp) => {
        setActionModal({ isOpen: true, type: "RESIGN", employee: emp, loading: false });
        closeContextMenu();
    };

    const handleConfirmRankChange = async (newRankId) => {
        setRankModal((s) => ({ ...s, loading: true }));
        try {
            await changeEmployeeRank(companyId, rankModal.employee.id, newRankId);
            toast.success("Rang mis à jour avec succès");
            fetchEmployees();
            setRankModal({ isOpen: false, employee: null, loading: false });
        } catch (_err) {
            toast.error("Erreur lors de la mutation");
            setRankModal((s) => ({ ...s, loading: false }));
        }
    };

    const handleConfirmAction = async () => {
        setActionModal((s) => ({ ...s, loading: true }));
        try {
            await changeEmployeeStatus(companyId, actionModal.employee.id, actionModal.type);
            toast.success("Statut mis à jour");
            fetchEmployees();
            setActionModal({ isOpen: false, type: null, employee: null, loading: false });
        } catch (_err) {
            toast.error("Erreur lors de l'opération");
            setActionModal((s) => ({ ...s, loading: false }));
        }
    };

    // ------------------------------------------------------------------
    // LOAD CONFIG
    // ------------------------------------------------------------------
    useEffect(() => {
        const load = async () => {
            try {
                const [cols, prefs] = await Promise.all([
                    getAvailableColumns(companyId),
                    getUserPreferences(PREFERENCES_KEY),
                ]);
                setAvailableColumns(cols);
                setVisibleColumns(
                    prefs?.columns?.length ? prefs.columns : cols.filter(c => c.isDefault).map(c => c.key)
                );
            } finally {
                setConfigLoaded(true);
            }
        };
        load();
    }, [companyId]);

    // ------------------------------------------------------------------
    // LOAD EMPLOYEES
    // ------------------------------------------------------------------
    const fetchEmployees = useCallback(async () => {
        if (!visibleColumns.length || !configLoaded) return;

        setLoading(true);
        try {
            const optional = visibleColumns.filter(key => !availableColumns.find(c => c.key === key)?.isDefault);
            const data = await getCompanyEmployees(companyId, {
                fields: optional.join(",") || undefined,
                year: weekParams.year,
                week: weekParams.week,
            });
            setEmployees(data);
        } finally {
            setLoading(false);
        }
    }, [companyId, visibleColumns, availableColumns, configLoaded, weekParams]);

    useEffect(() => { fetchEmployees(); }, [fetchEmployees]);

    // ------------------------------------------------------------------
    // RANK LIST
    // ------------------------------------------------------------------
    const ranks = useMemo(() => {
        const m = new Map();
        employees.forEach(e => e.rank && m.set(e.rank.id, e.rank));
        return [...m.values()];
    }, [employees]);

    // ------------------------------------------------------------------
    // FILTERING & SORTING
    // ------------------------------------------------------------------
    const sortedEmployees = useMemo(() => {
        // 1. Filter
        const filtered = employees.filter((e) => {
            const matchName = e.user?.name?.toLowerCase().includes(search.toLowerCase());
            const matchRank = !rankFilter || e.rankId === Number(rankFilter);
            const matchStatus = !statusFilter || e.status === statusFilter;
            return matchName && matchRank && matchStatus;
        });

        // 2. Sort
        if (!sortConfig.key) return filtered;

        return [...filtered].sort((a, b) => {
            let valA, valB;

            switch (sortConfig.key) {
                case "name":
                    valA = a.user?.name || "";
                    valB = b.user?.name || "";
                    break;
                case "rank":
                    // Priorité par 'order' du rang, sinon le nom
                    valA = a.rank?.order ?? 999;
                    valB = b.rank?.order ?? 999;
                    if (valA === valB) {
                        valA = a.rank?.name || "";
                        valB = b.rank?.name || "";
                    }
                    break;
                case "status": {
                    const statusOrder = { ACTIVE: 0, PENDING_LINK: 1, FIRE: 2, RESIGNED: 3 };
                    valA = statusOrder[a.status] ?? 99;
                    valB = statusOrder[b.status] ?? 99;
                    break;
                }
                case "salary":
                    valA = a.salary?.finalSalary ?? 0;
                    valB = b.salary?.finalSalary ?? 0;
                    break;
                case "billCount":
                    valA = a.billCount ?? 0;
                    valB = b.billCount ?? 0;
                    break;
                default:
                    valA = a[sortConfig.key];
                    valB = b[sortConfig.key];
            }

            if (valA < valB) return sortConfig.direction === "asc" ? -1 : 1;
            if (valA > valB) return sortConfig.direction === "asc" ? 1 : -1;
            return 0;
        });
    }, [employees, search, rankFilter, statusFilter, sortConfig]);

    const handleSort = (key) => {
        setSortConfig((prev) => ({
            key,
            direction: prev.key === key && prev.direction === "asc" ? "desc" : "asc",
        }));
    };


    // ------------------------------------------------------------------
    // RENDER
    // ------------------------------------------------------------------
    return (
        <div className="max-w-[1600px] mx-auto space-y-8 pb-12 animate-in fade-in duration-700">

            {/* --- TITRE --- */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
                <div className="space-y-1">
                    <p className="text-[10px] font-black uppercase tracking-[0.4em] text-brand-primary/80">Ressources Humaines & Gestion</p>
                    <h1 className="text-3xl sm:text-5xl font-black tracking-tight text-cca-textPrimary font-heading">Répertoire des Effectifs</h1>
                </div>

                <div className="flex items-center gap-4 w-full md:w-auto">
                    <WeekSelector onWeekChange={setWeekParams} />
                    
                    <button
                        onClick={() => setIsModalOpen(true)}
                        className="
                            h-[56px] px-6 rounded-2xl bg-brand-primary text-cca-textPrimary text-[10px] font-black uppercase tracking-widest
                            shadow-xl shadow-brand-primary/20 hover:brightness-110 active:scale-95 transition-all
                            border border-brand-light/30 flex items-center gap-2
                        "
                    >
                        <Settings size={14} />
                        <span className="hidden sm:inline">Configuration Vue</span>
                    </button>
                </div>
            </div>

            {/* --- FILTERS --- */}
            <EmployeeFilterBar
                search={search}
                setSearch={setSearch}
                rankFilter={rankFilter}
                setRankFilter={setRankFilter}
                statusFilter={statusFilter}
                setStatusFilter={setStatusFilter}
                ranks={ranks}
            />


            {/* --- LISTE MOBILE (cards) --- */}
            <div className="md:hidden space-y-4">
                {loading ? (
                    <div className="flex justify-center py-12"><Spinner /></div>
                ) : sortedEmployees.length > 0 ? (
                    sortedEmployees.map((employee) => {
                        const expanded = !!expandedCards[employee.id];
                        const shownKeys = expanded
                            ? mobileCardKeys
                            : mobileCardKeys.slice(0, MOBILE_CARD_FIELD_LIMIT);
                        const extraCount = Math.max(0, mobileCardKeys.length - MOBILE_CARD_FIELD_LIMIT);

                        const nameText = employee.user?.name || `Employé #${employee.id}`;
                        const rankText = employee.rank?.name || "—";

                        return (
                            <div
                                key={employee.id}
                                onClick={() => navigate(`/dashboard/company/employees/${employee.id}`)}
                                onContextMenu={(e) => openContextMenu(e, employee)}
                                className="
                                    relative overflow-hidden rounded-3xl
                                    border border-cca-border bg-cca-surface/20 p-6
                                    backdrop-blur-3xl shadow-xl active:scale-[0.98] transition-all
                                "
                            >
                                <div className="flex items-start justify-between gap-3 mb-4">
                                    <div className="min-w-0">
                                        <div className="text-cca-textPrimary font-black text-lg tracking-tight truncate">
                                            {showMobileName ? nameText : `Employé #${employee.id}`}
                                        </div>

                                        {showMobileRank && (
                                            <div className="text-[10px] font-black uppercase tracking-widest text-brand-primary/60 mt-0.5 truncate">
                                                {rankText}
                                            </div>
                                        )}
                                    </div>

                                    {showMobileStatus && (
                                        <div className="shrink-0">
                                            <StatusBadge status={employee.status} date={employee.statusUpdatedAt} />
                                        </div>
                                    )}
                                </div>

                                {shownKeys.length > 0 && (
                                    <div className="space-y-3">
                                        {shownKeys.map((key) => {
                                            const col = availableColumns.find((c) => c.key === key);
                                            const label = col?.label || key;
                                            const valueNode = renderCardValue(employee, key);

                                            return (
                                                <div
                                                    key={key}
                                                    className="
                                                        flex items-center justify-between gap-3
                                                        rounded-xl bg-cca-base/40 px-4 py-2.5
                                                        border border-cca-border/50
                                                    "
                                                >
                                                    <div className="text-[9px] font-black uppercase tracking-widest text-cca-textSecondary/40">
                                                        {label}
                                                    </div>
                                                    <div className="text-xs font-bold text-cca-textPrimary min-w-0 text-right">
                                                        {valueNode}
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}

                                {mobileCardKeys.length > MOBILE_CARD_FIELD_LIMIT && (
                                    <button
                                        type="button"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            toggleExpandedCard(employee.id);
                                        }}
                                        className="
                                            w-full mt-4 rounded-xl
                                            border border-cca-border bg-cca-surface/40
                                            py-2.5 text-[9px] font-black uppercase tracking-[0.2em] text-cca-textSecondary/60
                                            hover:bg-cca-surface transition-all
                                        "
                                    >
                                        {expanded ? "Masquer" : `+ ${extraCount} Informations`}
                                    </button>
                                )}
                            </div>
                        );
                    })
                ) : (
                    <div className="text-center py-24 rounded-3xl bg-cca-surface/10 border border-cca-border/30 opacity-40">
                         <Info size={48} className="mx-auto mb-4" />
                        <p className="text-[10px] font-black uppercase tracking-widest">Aucune identité ne correspond à vos filtres</p>
                    </div>
                )}
            </div>

            {/* --- TABLEAU GLASS PREMIUM --- */}
            <div className="hidden md:block 
                relative overflow-hidden rounded-[2.5rem]
                bg-cca-surface/30 border border-cca-border/40 backdrop-blur-3xl
                shadow-2xl shadow-black/30
            ">
                {loading ? (
                    <div className="flex justify-center py-24"><Spinner /></div>
                ) : (
                    <div className="overflow-x-auto min-h-[400px]">
                        <table className="min-w-full text-sm text-cca-textPrimary border-separate border-spacing-0">

                            {/* HEADER */}
                            <thead className="bg-cca-base/80 backdrop-blur-md sticky top-0 z-10">
                            <tr>
                                {visibleColumns.map((key) => {
                                    const col = availableColumns.find((c) => c.key === key);
                                    return (
                                        <th
                                            key={key}
                                            onClick={() => handleSort(key)}
                                            className="
                                                    px-6 py-6 text-[9px] font-black uppercase tracking-[0.25em]
                                                    text-cca-textSecondary/60 border-b border-cca-border/40
                                                    cursor-pointer hover:bg-cca-surface/60 transition-all
                                                "
                                        >
                                            <div className="flex items-center gap-2 justify-center first:justify-start">
                                                {col?.label}
                                                {sortConfig.key === key && (
                                                    sortConfig.direction === "asc" ? <ChevronUp size={14} className="text-brand-primary" /> : <ChevronDown size={14} className="text-brand-primary" />
                                                )}
                                            </div>
                                        </th>
                                    );
                                })}
                            </tr>
                            </thead>

                            {/* ROWS */}
                            <tbody className="divide-y divide-cca-border/20">

                            {sortedEmployees.length > 0 ? (
                                sortedEmployees.map((employee) => (
                                    <tr
                                        key={employee.id}
                                        onClick={() => navigate(`/dashboard/company/employees/${employee.id}`)}
                                        onContextMenu={(e) => openContextMenu(e, employee)}
                                        className="
                                                group cursor-pointer transition-all
                                                hover:bg-brand-primary/5 border-b border-cca-border/10 last:border-0
                                            "
                                    >
                                        {visibleColumns.map((key) => (
                                            <td key={key} className="px-6 py-4 text-center first:text-left">
                                                {renderCell(employee, key)}
                                            </td>
                                        ))}
                                    </tr>
                                ))
                            ) : (
                                <tr>
                                    <td colSpan={visibleColumns.length} className="text-center py-24 opacity-30">
                                        <div className="flex flex-col items-center gap-4">
                                            <Info size={48} />
                                            <p className="text-[10px] font-black uppercase tracking-widest">Répertoire vide ou filtré</p>
                                        </div>
                                    </td>
                                </tr>
                            )}

                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {/* CONTEXT MENU */}
            {contextMenu.visible && (
                <EmployeeRowContextMenu
                    x={contextMenu.x}
                    y={contextMenu.y}
                    employee={contextMenu.employee}
                    onClose={closeContextMenu}
                    onView={view}
                    onChangeRank={changeRank}
                    onFire={fire}
                    onResign={resign}
                    onCopySalary={copy}
                    onOverrideSalary={overrideSalary}
                />
            )}

            {/* VIEW CUSTOMIZER */}
            {configLoaded && (
                <ViewCustomizationModal
                    isOpen={isModalOpen}
                    onClose={() => setIsModalOpen(false)}
                    allColumns={availableColumns}
                    visibleColumns={visibleColumns}
                    onSave={(cols) => {
                        saveUserPreferences(PREFERENCES_KEY, { columns: cols });
                        setVisibleColumns(cols);
                    }}
                />
            )}

            {/* SALARY MODAL */}
            <SalaryDetailModal
                isOpen={!!selectedEmployeeForModal}
                onClose={() => setSelectedEmployeeForModal(null)}
                employee={selectedEmployeeForModal}
                companyId={companyId}
                weekParams={weekParams}
                onUpdate={() => { fetchEmployees(); setSelectedEmployeeForModal(null); }}
            />

            {/* ACTION MODALS */}
            {rankModal.isOpen && (
                <ChangeRankModal
                    isOpen={rankModal.isOpen}
                    onClose={() => setRankModal({ isOpen: false, employee: null, loading: false })}
                    employee={rankModal.employee}
                    ranks={ranks}
                    onConfirm={handleConfirmRankChange}
                    loading={rankModal.loading}
                />
            )}

            {actionModal.isOpen && (
                <ActionConfirmationModal
                    isOpen={actionModal.isOpen}
                    onClose={() => setActionModal({ isOpen: false, type: null, employee: null, loading: false })}
                    title={actionModal.type === "FIRE" ? "Licenciement Immédiat" : "Enregistrement Démission"}
                    message={
                        actionModal.type === "FIRE"
                            ? `Êtes-vous absolument sûr de vouloir engager la procédure de licenciement pour ${actionModal.employee?.user?.name} ?`
                            : `Confirmer que ${actionModal.employee?.user?.name} a officiellement présenté son départ ?`
                    }
                    onConfirm={handleConfirmAction}
                    loading={actionModal.loading}
                    variant={actionModal.type === "FIRE" ? "danger" : "indigo"}
                />
            )}
        </div>
    );
};

export default EmployeeManagementPage;
