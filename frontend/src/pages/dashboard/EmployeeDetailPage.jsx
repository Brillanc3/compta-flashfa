// /frontend/src/pages/dashboard/EmployeeDetailPage.jsx

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
    getEmployeeDetails, getEmployeeSalary,
    getRanks, changeEmployeeRank, changeEmployeeStatus, resetEmployeeAccount,
} from '@/services/employeesService';
import { listPrimesForWeek } from '@/services/employeesHrService';
import { getISOWeek, getISOWeekYear, startOfISOWeek, endOfISOWeek } from 'date-fns';
import toast from 'react-hot-toast';
import Spinner from '@/components/ui/Spinner';
import {
    ArrowLeft, DollarSign, History, FileText,
    ChevronLeft, ChevronRight, Eye, EyeOff,
    Phone, CreditCard, AtSign, Award, TrendingUp,
    Receipt, ShieldAlert, ChevronDown, Check,
} from 'lucide-react';
import WeekSelector from '@/components/accounting/WeekSelector';
import Tooltip from '@/components/ui/Tooltip';
import { useCompany } from "@/contexts/CompanyContext.jsx";
import { useConfirmation } from '@/contexts/ConfirmationContext';
import LinkCodeManagerCard from '@/components/dashboard/employees/LinkCodeManagerCard.jsx';
import HRTimeline from '@/components/dashboard/employees/hr/HRTimeline';

// ─── Helpers ────────────────────────────────────────────────────────────────

const STATUS_CONFIG = {
    ACTIVE:       { label: 'Actif',      dot: 'bg-emerald-400', text: 'text-emerald-400', badge: 'bg-emerald-400/10 border-emerald-400/30' },
    PENDING_LINK: { label: 'En attente', dot: 'bg-amber-400',   text: 'text-amber-400',   badge: 'bg-amber-400/10 border-amber-400/30' },
    INACTIVE:     { label: 'Inactif',    dot: 'bg-slate-400',   text: 'text-slate-400',   badge: 'bg-slate-400/10 border-slate-400/30' },
    SUSPENDED:    { label: 'Suspendu',   dot: 'bg-rose-400',    text: 'text-rose-400',    badge: 'bg-rose-400/10 border-rose-400/30' },
    FIRE:         { label: 'Licencié',   dot: 'bg-rose-500',    text: 'text-rose-500',    badge: 'bg-rose-500/10 border-rose-500/30' },
    RESIGNED:     { label: 'Démission',  dot: 'bg-orange-400',  text: 'text-orange-400',  badge: 'bg-orange-400/10 border-orange-400/30' },
};

function getStatusCfg(status) {
    return STATUS_CONFIG[status] ?? { label: status, dot: 'bg-slate-400', text: 'text-slate-400', badge: 'bg-slate-400/10 border-slate-400/30' };
}

function getInitials(name = '') {
    return name.trim().split(/\s+/).slice(0, 2).map(w => w[0]?.toUpperCase() ?? '').join('');
}

/** Convertit semaine ISO + année en plage from/to */
function weekToDateRange(week, year) {
    const jan4 = new Date(year, 0, 4);
    const weekOneStart = startOfISOWeek(jan4);
    const targetStart = new Date(weekOneStart);
    targetStart.setDate(weekOneStart.getDate() + (week - 1) * 7);
    return {
        from: startOfISOWeek(targetStart),
        to: endOfISOWeek(targetStart),
    };
}

// ─── Tab bar ────────────────────────────────────────────────────────────────

const TABS = [
    { id: 'remuneration', label: 'Rémunération', icon: DollarSign },
    { id: 'rh',           label: 'Dossier RH',   icon: ShieldAlert },
    { id: 'activite',     label: 'Activité',      icon: History },
];

const TabBar = ({ active, onChange }) => (
    <div className="flex gap-1 border-b border-cca-border/30 mb-8">
        {TABS.map(({ id, label, icon: Icon }) => {
            const isActive = active === id;
            return (
                <button
                    key={id}
                    onClick={() => onChange(id)}
                    className={`flex items-center gap-2 px-5 py-3 text-xs font-black uppercase tracking-widest transition-all relative ${
                        isActive ? 'text-cca-textPrimary' : 'text-cca-textSecondary/50 hover:text-cca-textSecondary'
                    }`}
                >
                    <Icon size={13} />
                    {label}
                    {isActive && <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-brand-primary rounded-full" />}
                </button>
            );
        })}
    </div>
);

// ─── Card container ──────────────────────────────────────────────────────────

const Card = ({ children, className = '' }) => (
    <div className={`bg-cca-surface/30 border border-cca-border/40 rounded-2xl p-6 backdrop-blur-xl ${className}`}>
        {children}
    </div>
);

const Section = ({ icon: Icon, title, color = 'text-brand-primary', children }) => (
    <div className="space-y-4">
        <div className="flex items-center gap-2">
            <Icon size={14} className={color} />
            <h3 className={`text-[11px] font-black uppercase tracking-[0.15em] ${color}`}>{title}</h3>
        </div>
        {children}
    </div>
);

// ─── Salary Calculator ───────────────────────────────────────────────────────

const SalaryCalculator = ({ companyId, employeeId }) => {
    const [selectedWeek, setSelectedWeek] = useState({
        week: getISOWeek(new Date()),
        year: getISOWeekYear(new Date()),
    });
    const [salaryData, setSalaryData] = useState(null);
    const [primesData, setPrimesData] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [expandedItems, setExpandedItems] = useState(new Set());

    useEffect(() => {
        const { from, to } = weekToDateRange(selectedWeek.week, selectedWeek.year);
        setIsLoading(true);
        setExpandedItems(new Set());

        Promise.all([
            getEmployeeSalary(companyId, employeeId, {
                from: from.toISOString(),
                to: to.toISOString(),
            }).catch(() => { toast.error("Erreur calcul salaire."); return null; }),
            listPrimesForWeek(companyId, employeeId, selectedWeek.week, selectedWeek.year)
                .catch(() => []),
        ]).then(([salary, primes]) => {
            setSalaryData(salary);
            setPrimesData(primes ?? []);
        }).finally(() => setIsLoading(false));
    }, [selectedWeek, companyId, employeeId]);

    const handleWeekChange = useCallback(({ week, year }) => {
        setSelectedWeek({ week, year });
    }, []);

    const toggleExpand = (index) => {
        const next = new Set(expandedItems);
        if (next.has(index)) next.delete(index);
        else next.add(index);
        setExpandedItems(next);
    };

    const totalPrimes = primesData.reduce((s, p) => s + parseFloat(p.amount), 0);

    return (
        <div className="space-y-6">
            {/* Sélecteur de semaine */}
            <div className="flex items-center gap-4">
                <WeekSelector onWeekChange={handleWeekChange} />
                <span className="text-xs text-cca-textSecondary/40 font-medium">
                    S{String(selectedWeek.week).padStart(2, '0')} · {selectedWeek.year}
                </span>
            </div>

            {isLoading ? (
                <div className="flex justify-center py-12"><Spinner /></div>
            ) : (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                    {/* Détail breakdown — toujours visible */}
                    <div className="lg:col-span-2">
                        <Card>
                            <Section icon={DollarSign} title="Masse salariale" color="text-emerald-400">
                                {salaryData?.breakdown?.length > 0 ? (
                                    <div className="space-y-1 mt-3">
                                        {salaryData.breakdown.map((item, index) => {
                                            const isExpanded = expandedItems.has(index);
                                            const details = item.details || null;
                                            const hasDetails = Array.isArray(details) && details.length > 0;
                                            return (
                                                <div key={index}>
                                                    <div className="flex justify-between items-center py-2.5 px-3 rounded-xl bg-cca-base/30 hover:bg-cca-base/50 border border-cca-border/20 transition-colors">
                                                        <div className="flex items-center gap-2">
                                                            <span className="text-sm text-cca-textPrimary font-semibold">{item.label}</span>
                                                            {hasDetails && (
                                                                <button
                                                                    onClick={() => toggleExpand(index)}
                                                                    className={`p-1 rounded-lg transition-colors text-xs ${isExpanded ? 'bg-brand-primary/20 text-brand-primary' : 'text-cca-textSecondary/40 hover:text-cca-textSecondary'}`}
                                                                >
                                                                    {isExpanded ? <EyeOff size={12} /> : <Eye size={12} />}
                                                                </button>
                                                            )}
                                                            {hasDetails && (
                                                                <span className="text-[9px] font-black uppercase tracking-wider text-cca-textSecondary/30">
                                                                    {details.length} élém.
                                                                </span>
                                                            )}
                                                        </div>
                                                        <span className="font-mono font-black text-cca-textPrimary text-sm">{item.value.toFixed(2)} $</span>
                                                    </div>

                                                    {/* Détail toujours visible si déplié */}
                                                    {isExpanded && hasDetails && (
                                                        <div className="mx-2 bg-cca-base/15 border-x border-b border-cca-border/15 rounded-b-xl overflow-hidden">
                                                            <div className="max-h-52 overflow-y-auto custom-scrollbar">
                                                                {details.map((d, dIdx) => (
                                                                    <div key={dIdx} className="flex justify-between items-center px-4 py-2 border-b border-cca-border/10 last:border-0 hover:bg-cca-base/30 transition-colors">
                                                                        <div>
                                                                            <span className="text-xs text-cca-textSecondary">{d.label || d.description}</span>
                                                                            {d.date && (
                                                                                <span className="text-[10px] text-cca-textSecondary/30 ml-2">
                                                                                    {new Date(d.date).toLocaleString('fr-FR', { day:'2-digit', month:'2-digit', hour:'2-digit', minute:'2-digit' })}
                                                                                </span>
                                                                            )}
                                                                        </div>
                                                                        <span className="font-mono text-xs text-cyan-400/80 shrink-0 ml-4">{d.value.toFixed(2)} $</span>
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        </div>
                                                    )}
                                                </div>
                                            );
                                        })}
                                    </div>
                                ) : (
                                    <p className="text-center text-cca-textSecondary/30 italic text-xs uppercase tracking-widest py-8">
                                        Aucune donnée pour cette semaine.
                                    </p>
                                )}
                            </Section>
                        </Card>
                    </div>

                    {/* Totaux */}
                    <div className="space-y-4">
                        <Card className="border-emerald-500/20">
                            <div className="text-center space-y-1">
                                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-emerald-400/60">Total à percevoir</p>
                                <p className="font-black text-3xl text-emerald-400 font-mono tracking-tight">
                                    {salaryData?.finalSalary?.toFixed(2) ?? '0.00'} $
                                </p>
                                {salaryData?.isOverridden && (
                                    <span className="inline-block text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-400 border border-amber-500/30">
                                        Fixé manuellement
                                    </span>
                                )}
                                {salaryData?.isMissingCap && !salaryData?.isOverridden && (
                                    <Tooltip text="Salaire limite non défini sur ce rang">
                                        <span className="inline-block text-amber-500 text-xs cursor-help">⚠ Cap manquant</span>
                                    </Tooltip>
                                )}
                            </div>
                        </Card>

                        <Card className="border-amber-500/20">
                            <div className="space-y-3">
                                <div className="flex items-center justify-between">
                                    <p className="text-[10px] font-black uppercase tracking-[0.2em] text-amber-400/60">
                                        Primes · S{selectedWeek.week}
                                    </p>
                                    <span className="font-mono font-black text-amber-400 text-lg">
                                        +{totalPrimes.toFixed(2)} $
                                    </span>
                                </div>
                                {primesData.length > 0 ? (
                                    <div className="space-y-1.5 pt-2 border-t border-cca-border/20">
                                        {primesData.map(p => (
                                            <div key={p.id} className="flex justify-between items-center text-xs">
                                                <span className="text-cca-textSecondary truncate pr-2">{p.title}</span>
                                                <span className="font-mono text-amber-400 shrink-0">+{parseFloat(p.amount).toFixed(2)}</span>
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <p className="text-[10px] text-cca-textSecondary/30 italic text-center pt-2 border-t border-cca-border/20">
                                        Aucune prime cette semaine
                                    </p>
                                )}
                            </div>
                        </Card>
                    </div>
                </div>
            )}
        </div>
    );
};

// ─── Main Page ───────────────────────────────────────────────────────────────

const EmployeeDetailPage = () => {
    const { employeeId } = useParams();
    const { activeCompanyId } = useCompany();
    const companyId = activeCompanyId;

    const { confirmAction } = useConfirmation();

    const [employee, setEmployee] = useState(null);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState('remuneration');

    // Rang picker
    const rankBtnRef = useRef(null);
    const [rankPickerOpen, setRankPickerOpen] = useState(false);
    const [rankPickerPos, setRankPickerPos] = useState({ top: 0, left: 0 });
    const [allRanks, setAllRanks] = useState([]);
    const [ranksLoading, setRanksLoading] = useState(false);
    const [rankSaving, setRankSaving] = useState(false);

    // Statut picker
    const statusBtnRef = useRef(null);
    const [statusPickerOpen, setStatusPickerOpen] = useState(false);
    const [statusPickerPos, setStatusPickerPos] = useState({ top: 0, left: 0 });
    const [statusSaving, setStatusSaving] = useState(false);

    // Reset modal
    const [showResetModal, setShowResetModal] = useState(false);
    const [resetData, setResetData] = useState(null);
    const [timeLeft, setTimeLeft] = useState(0);

    const fetchDetails = useCallback(async (page = 1) => {
        if (page === 1) setLoading(true);
        try {
            const data = await getEmployeeDetails(companyId, employeeId, page);
            setEmployee(data);
        } catch {
            toast.error("Impossible de charger les détails de l'employé.");
        } finally {
            setLoading(false);
        }
    }, [companyId, employeeId]);

    useEffect(() => { fetchDetails(); }, [fetchDetails]);

    // Timer reset modal
    useEffect(() => {
        if (!resetData) return;
        const interval = setInterval(() => {
            const diff = Math.max(new Date(resetData.tempPasswordExpiresAt).getTime() - Date.now(), 0);
            setTimeLeft(diff);
            if (diff <= 0) clearInterval(interval);
        }, 1000);
        return () => clearInterval(interval);
    }, [resetData]);

    const openRankPicker = useCallback(async () => {
        setStatusPickerOpen(false);
        if (rankBtnRef.current) {
            const r = rankBtnRef.current.getBoundingClientRect();
            setRankPickerPos({ top: r.bottom + 8, left: r.left });
        }
        setRankPickerOpen(o => !o);
        if (allRanks.length === 0) {
            setRanksLoading(true);
            try {
                setAllRanks(await getRanks(companyId));
            } catch {
                toast.error("Impossible de charger les rangs.");
            } finally {
                setRanksLoading(false);
            }
        }
    }, [allRanks.length, companyId]);

    const handleRankChange = useCallback(async (rankId) => {
        if (rankSaving) return;
        setRankSaving(true);
        try {
            await changeEmployeeRank(companyId, employee.id, rankId);
            toast.success("Rang mis à jour.");
            setRankPickerOpen(false);
            fetchDetails();
        } catch (e) {
            toast.error(e.message || "Erreur.");
        } finally {
            setRankSaving(false);
        }
    }, [rankSaving, companyId, employee?.id, fetchDetails]);

    const handleStatusChange = useCallback((newStatus) => {
        const labels = { FIRE: 'licencier', RESIGNED: 'marquer comme démissionnaire' };
        setStatusPickerOpen(false);
        confirmAction({
            title: 'Confirmation',
            message: `Êtes-vous sûr de vouloir ${labels[newStatus] || 'changer le statut de'} cet employé ?`,
            onConfirm: async () => {
                setStatusSaving(true);
                try {
                    await changeEmployeeStatus(companyId, employee.id, newStatus);
                    toast.success("Statut mis à jour.");
                    fetchDetails();
                } catch (e) {
                    toast.error(e.message || "Erreur.");
                } finally {
                    setStatusSaving(false);
                }
            },
        });
    }, [confirmAction, companyId, employee?.id, fetchDetails]);

    const handleResetAccount = useCallback(() => {
        setStatusPickerOpen(false);
        confirmAction({
            title: 'Reset du compte',
            message: 'Voulez-vous vraiment réinitialiser son mot de passe ? Un token temporaire sera généré.',
            onConfirm: async () => {
                setStatusSaving(true);
                try {
                    const response = await resetEmployeeAccount(companyId, employee.id);
                    const reset = response?.data;
                    if (!reset) { toast.error("Erreur inattendue."); return; }
                    setResetData(reset);
                    setShowResetModal(true);
                    toast.success(reset.alreadyActive ? "Token déjà actif." : "Token généré !");
                } catch (e) {
                    toast.error(e.message || "Erreur.");
                } finally {
                    setStatusSaving(false);
                }
            },
        });
    }, [confirmAction, companyId, employee?.id]);

    const formattedTime = () => {
        const s = Math.floor(timeLeft / 1000);
        return `${Math.floor(s / 60)}m ${String(s % 60).padStart(2, '0')}s`;
    };
    const progressPercent = () => Math.max(0, (timeLeft / (15 * 60 * 1000)) * 100);

    if (loading) return <div className="flex justify-center py-24"><Spinner /></div>;
    if (!employee) return (
        <div className="text-center text-rose-500 font-black uppercase tracking-widest py-24">
            Employé non trouvé.
        </div>
    );

    const { user, bills, rankHistory } = employee;
    const statusCfg = getStatusCfg(employee.status);
    const initials = getInitials(user.name);

    return (
        <div className="space-y-4 pb-12">
            {/* Back link */}
            <Link
                to="/dashboard/company/employees"
                className="inline-flex items-center gap-2 text-cca-textSecondary/50 hover:text-cca-textSecondary transition-colors group"
            >
                <ArrowLeft size={14} className="group-hover:-translate-x-0.5 transition-transform" />
                <span className="text-[10px] font-black uppercase tracking-widest">Retour aux employés</span>
            </Link>

            {/* ── Hero card ── */}
            <div className="relative overflow-hidden rounded-2xl bg-cca-surface/40 border border-cca-border/40 backdrop-blur-xl">
                <div className="absolute inset-0 bg-gradient-to-br from-brand-primary/5 via-transparent to-transparent pointer-events-none" />

                <div className="relative p-6 sm:p-8">
                    <div className="flex flex-col sm:flex-row items-start sm:items-center gap-6">
                        {/* Avatar */}
                        <div className="relative shrink-0">
                            {user.imageUrl ? (
                                <img
                                    src={user.imageUrl}
                                    alt={user.name}
                                    className="w-20 h-20 rounded-2xl object-cover border-2 border-brand-primary/30 shadow-xl"
                                />
                            ) : (
                                <div className="w-20 h-20 rounded-2xl bg-brand-primary/20 border-2 border-brand-primary/30 flex items-center justify-center shadow-xl">
                                    <span className="font-black text-2xl text-brand-primary font-heading tracking-tight">
                                        {initials}
                                    </span>
                                </div>
                            )}
                            <span className={`absolute -bottom-1 -right-1 w-4 h-4 rounded-full border-2 border-cca-surface ${statusCfg.dot} shadow-md`} />
                        </div>

                        {/* Infos + chips cliquables */}
                        <div className="flex-1 min-w-0">
                            <h1 className="font-black text-2xl text-cca-textPrimary font-heading tracking-tight truncate mb-2">
                                {user.name}
                            </h1>

                            <div className="flex flex-wrap items-center gap-2">
                                {user.username && (
                                    <span className="flex items-center gap-1 text-xs text-cca-textSecondary/50">
                                        <AtSign size={11} />
                                        {user.username}
                                    </span>
                                )}

                                {/* Rang — popover fixed */}
                                <button
                                    ref={rankBtnRef}
                                    onClick={openRankPicker}
                                    className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider border transition-all hover:brightness-125 ${
                                        rankPickerOpen
                                            ? 'bg-brand-primary/20 border-brand-primary/40 text-brand-primary'
                                            : 'bg-brand-primary/10 border-brand-primary/20 text-brand-primary/80 hover:bg-brand-primary/15'
                                    }`}
                                >
                                    <Award size={10} />
                                    {employee.rank?.name ?? 'Sans rang'}
                                    <ChevronDown size={10} className={`transition-transform duration-200 ${rankPickerOpen ? 'rotate-180' : ''}`} />
                                </button>

                                {/* Statut — popover fixed */}
                                <button
                                    ref={statusBtnRef}
                                    onClick={() => {
                                        setRankPickerOpen(false);
                                        if (statusBtnRef.current) {
                                            const r = statusBtnRef.current.getBoundingClientRect();
                                            setStatusPickerPos({ top: r.bottom + 8, left: r.left });
                                        }
                                        setStatusPickerOpen(o => !o);
                                    }}
                                    className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider border transition-all hover:brightness-125 ${statusCfg.badge} ${statusCfg.text}`}
                                >
                                    <span className={`w-1.5 h-1.5 rounded-full ${statusCfg.dot}`} />
                                    {statusCfg.label}
                                    <ChevronDown size={10} className={`transition-transform duration-200 ${statusPickerOpen ? 'rotate-180' : ''}`} />
                                </button>
                            </div>

                            {/* Contact */}
                            {(user.phoneNumber || user.iban) && (
                                <div className="flex flex-wrap gap-5 mt-3 text-xs text-cca-textSecondary/40">
                                    {user.phoneNumber && (
                                        <span className="flex items-center gap-1.5">
                                            <Phone size={10} />
                                            <span className="font-mono">{user.phoneNumber}</span>
                                        </span>
                                    )}
                                    {user.iban && (
                                        <span className="flex items-center gap-1.5">
                                            <CreditCard size={10} />
                                            <span className="font-mono tracking-wider">{user.iban}</span>
                                        </span>
                                    )}
                                </div>
                            )}
                        </div>

                        {/* Stats rapides */}
                        <div className="flex gap-6 text-center shrink-0">
                            <div>
                                <p className="font-black text-xl text-cca-textPrimary font-mono">
                                    {rankHistory.pagination.totalCount}
                                </p>
                                <p className="text-[9px] font-black uppercase tracking-widest text-cca-textSecondary/40">Rangs</p>
                            </div>
                            <div>
                                <p className="font-black text-xl text-cca-textPrimary font-mono">
                                    {bills.length}
                                </p>
                                <p className="text-[9px] font-black uppercase tracking-widest text-cca-textSecondary/40">Factures</p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* ── Lien en attente ── */}
            {employee.status === 'PENDING_LINK' && (
                <LinkCodeManagerCard
                    employee={employee}
                    companyId={companyId}
                    onRefresh={fetchDetails}
                />
            )}

            {/* ── Reset modal ── */}
            {showResetModal && resetData && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50">
                    <div className="bg-cca-surface border border-brand-primary/30 backdrop-blur-2xl p-8 rounded-[2.5rem] shadow-2xl w-full max-w-md">
                        <h2 className="text-2xl font-black font-heading text-cca-textPrimary uppercase tracking-tight mb-6">Reset du compte</h2>
                        <div className="space-y-4 mb-8">
                            <div className="bg-cca-base/40 p-4 rounded-2xl border border-cca-border/20">
                                <span className="text-[10px] font-black uppercase tracking-widest text-cca-textSecondary/40 block mb-1">Identifiant</span>
                                <span className="text-lg font-bold text-cca-textPrimary">{resetData.username}</span>
                            </div>
                            <div className="bg-cca-base/40 p-4 rounded-2xl border border-cca-border/20">
                                <span className="text-[10px] font-black uppercase tracking-widest text-cca-textSecondary/40 block mb-1">Code Temporaire</span>
                                <span className="text-2xl font-black font-mono text-brand-primary tracking-tighter">{resetData.tempPasswordToken}</span>
                            </div>
                            <div className="flex justify-between items-center px-2">
                                <span className="text-[10px] font-black uppercase tracking-widest text-cca-textSecondary/60">Expiration</span>
                                <span className="text-sm font-black text-rose-400 font-mono">{formattedTime()}</span>
                            </div>
                        </div>
                        <div className="w-full h-1.5 bg-cca-base/40 rounded-full overflow-hidden mb-8">
                            <div
                                className="h-full bg-gradient-to-r from-brand-primary to-indigo-400 transition-all duration-1000"
                                style={{ width: `${progressPercent()}%` }}
                            />
                        </div>
                        <button
                            className="w-full h-14 bg-brand-primary text-white font-black uppercase tracking-widest text-[10px] rounded-2xl shadow-xl shadow-brand-primary/20 hover:brightness-110 active:scale-95 transition-all"
                            onClick={() => setShowResetModal(false)}
                        >
                            Terminer & Fermer
                        </button>
                    </div>
                </div>
            )}

            {/* ── Onglets ── */}
            <div className="pt-2">
                <TabBar active={activeTab} onChange={setActiveTab} />

                {activeTab === 'remuneration' && (
                    <SalaryCalculator companyId={companyId} employeeId={employeeId} />
                )}

                {activeTab === 'rh' && (
                    <HRTimeline
                        companyId={companyId}
                        employeeId={employeeId}
                        canManage={true}
                    />
                )}

                {activeTab === 'activite' && (
                    <div className="space-y-6">
                        {/* Historique des rangs */}
                        <Card>
                            <Section icon={TrendingUp} title="Historique des rangs" color="text-cyan-400">
                                <div className="mt-2 overflow-x-auto">
                                    <table className="w-full text-sm">
                                        <thead>
                                            <tr className="border-b border-cca-border/30">
                                                <th className="py-3 text-left text-[9px] font-black uppercase tracking-[0.15em] text-cca-textSecondary/40">Rang</th>
                                                <th className="py-3 text-left text-[9px] font-black uppercase tracking-[0.15em] text-cca-textSecondary/40">Assigné le</th>
                                                <th className="py-3 text-left text-[9px] font-black uppercase tracking-[0.15em] text-cca-textSecondary/40">Fin</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {rankHistory.data.map(h => (
                                                <tr key={h.id} className="border-b border-cca-border/10 last:border-0 hover:bg-cca-base/20 transition-colors">
                                                    <td className="py-3">
                                                        <span className="font-bold text-cca-textPrimary">{h.rankName}</span>
                                                        {!h.leaveAt && (
                                                            <span className="ml-2 text-[9px] font-black uppercase tracking-wider text-emerald-400 bg-emerald-400/10 border border-emerald-400/20 px-1.5 py-0.5 rounded-full">Actuel</span>
                                                        )}
                                                    </td>
                                                    <td className="py-3 text-cca-textSecondary text-xs">
                                                        {new Date(h.assignedAt).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' })}
                                                    </td>
                                                    <td className="py-3 text-cca-textSecondary/40 text-xs italic">
                                                        {h.leaveAt
                                                            ? new Date(h.leaveAt).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' })
                                                            : '—'}
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                                {rankHistory.pagination.totalPages > 1 && (
                                    <div className="flex justify-end items-center gap-2 pt-4 mt-2 border-t border-cca-border/20">
                                        <button
                                            onClick={() => fetchDetails(rankHistory.pagination.currentPage - 1)}
                                            disabled={rankHistory.pagination.currentPage === 1}
                                            className="p-1.5 rounded-lg hover:bg-cca-base/40 disabled:opacity-30 transition-colors"
                                        >
                                            <ChevronLeft size={16} />
                                        </button>
                                        <span className="text-[10px] font-black uppercase tracking-widest text-cca-textSecondary/40">
                                            {rankHistory.pagination.currentPage} / {rankHistory.pagination.totalPages}
                                        </span>
                                        <button
                                            onClick={() => fetchDetails(rankHistory.pagination.currentPage + 1)}
                                            disabled={rankHistory.pagination.currentPage === rankHistory.pagination.totalPages}
                                            className="p-1.5 rounded-lg hover:bg-cca-base/40 disabled:opacity-30 transition-colors"
                                        >
                                            <ChevronRight size={16} />
                                        </button>
                                    </div>
                                )}
                            </Section>
                        </Card>

                        {/* Dernières factures */}
                        <Card>
                            <Section icon={Receipt} title="Dernières factures" color="text-rose-400">
                                <div className="mt-2 space-y-2">
                                    {bills.length > 0 ? bills.map(bill => (
                                        <div
                                            key={bill.id}
                                            className="flex justify-between items-center py-2.5 px-3 rounded-xl bg-cca-base/30 hover:bg-cca-base/50 border border-cca-border/20 transition-colors"
                                        >
                                            <div className="flex items-center gap-3 min-w-0">
                                                <FileText size={12} className="text-cca-textSecondary/30 shrink-0" />
                                                <span className="text-sm font-semibold text-cca-textPrimary">#{bill.externalBillId}</span>
                                                {bill.reason && (
                                                    <span className="text-xs text-cca-textSecondary/50 truncate">{bill.reason}</span>
                                                )}
                                            </div>
                                            <span className="font-mono font-black text-cca-textPrimary text-sm shrink-0 ml-4">{bill.amount} $</span>
                                        </div>
                                    )) : (
                                        <p className="text-center text-cca-textSecondary/30 italic text-xs uppercase tracking-widest py-6">
                                            Aucune facture enregistrée.
                                        </p>
                                    )}
                                </div>
                            </Section>
                        </Card>
                    </div>
                )}
            </div>

            {/* ── Dropdowns fixed (hors overflow-hidden) ── */}
            {rankPickerOpen && (
                <>
                    <div className="fixed inset-0 z-40" onClick={() => setRankPickerOpen(false)} />
                    <div
                        className="fixed z-50 bg-cca-surface border border-cca-border/60 rounded-2xl shadow-2xl backdrop-blur-xl min-w-44 overflow-hidden"
                        style={{ top: rankPickerPos.top, left: rankPickerPos.left }}
                    >
                        {ranksLoading ? (
                            <div className="flex justify-center py-4"><Spinner /></div>
                        ) : (
                            <div className="py-1.5">
                                {allRanks.map(rank => (
                                    <button
                                        key={rank.id}
                                        onClick={() => handleRankChange(rank.id)}
                                        disabled={rankSaving}
                                        className={`w-full text-left px-4 py-2.5 text-xs transition-colors flex items-center justify-between gap-3 ${
                                            rank.id === employee.rank?.id
                                                ? 'bg-brand-primary/15 text-brand-primary font-black'
                                                : 'text-cca-textPrimary hover:bg-cca-base/50 font-semibold'
                                        }`}
                                    >
                                        {rank.name}
                                        {rank.id === employee.rank?.id && <Check size={10} className="shrink-0" />}
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>
                </>
            )}

            {statusPickerOpen && (
                <>
                    <div className="fixed inset-0 z-40" onClick={() => setStatusPickerOpen(false)} />
                    <div
                        className="fixed z-50 bg-cca-surface border border-cca-border/60 rounded-2xl shadow-2xl backdrop-blur-xl min-w-44 overflow-hidden"
                        style={{ top: statusPickerPos.top, left: statusPickerPos.left }}
                    >
                        <div className="py-1.5">
                            <button
                                onClick={() => handleStatusChange('FIRE')}
                                disabled={statusSaving || employee.status === 'FIRE'}
                                className="w-full text-left px-4 py-2.5 text-xs text-rose-400 hover:bg-rose-500/10 disabled:opacity-30 font-semibold transition-colors"
                            >
                                Licencier
                            </button>
                            <button
                                onClick={() => handleStatusChange('RESIGNED')}
                                disabled={statusSaving || employee.status === 'RESIGNED'}
                                className="w-full text-left px-4 py-2.5 text-xs text-amber-400 hover:bg-amber-500/10 disabled:opacity-30 font-semibold transition-colors"
                            >
                                Démission
                            </button>
                            <div className="border-t border-cca-border/20 my-1" />
                            <button
                                onClick={handleResetAccount}
                                disabled={statusSaving}
                                className="w-full text-left px-4 py-2.5 text-xs text-sky-400 hover:bg-sky-500/10 disabled:opacity-30 font-semibold transition-colors"
                            >
                                Reset Accès
                            </button>
                        </div>
                    </div>
                </>
            )}
        </div>
    );
};

export default EmployeeDetailPage;
