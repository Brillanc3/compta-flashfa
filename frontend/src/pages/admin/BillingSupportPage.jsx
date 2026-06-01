// frontend/src/pages/admin/BillingSupportPage.jsx
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
    ChevronLeft,
    ChevronRight,
    Loader2,
    AlertTriangle,
    CheckCircle2,
    Clock,
    FileText,
    MessageSquare,
    Settings,
    RefreshCw,
    Send,
    X,
    UserPlus,
    Trash2,
    Star,
    Activity,
} from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import { toast } from 'react-hot-toast';

import Modal from '@/components/Modal';
import apiClient from '@/services/api';
import {
    getBillingSupportDashboard,
    notifyIncompleteCompany,
    createBillingSupportTicket,
    assignBillableContact,
    removeBillableContact,
    listUsers,
    setBillableContactPrio,
} from '@/services/adminService';
import { usePermissions } from '@/contexts/PermissionsContext';

/** USD-only (projet) */
const formatUSD = (n) =>
    new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
        maximumFractionDigits: 0,
    }).format(Number.isFinite(+n) ? +n : 0);

function getWeekNumber(d) {
    const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
    const dayNum = date.getUTCDay() || 7;
    date.setUTCDate(date.getUTCDate() + 4 - dayNum);
    const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
    return Math.ceil(((date - yearStart) / 86400000 + 1) / 7);
}

const resolveIbanToBill = (company) => {
    if (company?.ibanToBill) return company.ibanToBill;
    const prio = company?.billableContacts?.find((b) => b.isPrio && !!b.iban);
    if (prio) return prio.iban;
    const fallback = company?.billableContacts?.find((b) => !!b.iban);
    return fallback?.iban || null;
};

function normalizeStatusLabel(statusRaw) {
    const s = String(statusRaw || '').trim();
    if (!s) return '';

    // compat ancien(s) libellé(s) côté backend
    if (s === 'À faire') return 'Facture à faire';
    if (s === 'En attente de paiement') return 'Facture faite -> En attente de paiement';
    if (s === 'Payée') return 'Facture payé -> Dans les temps';
    if (s === 'DUE') return 'Facture faite -> En attente de paiement';
    if (s === 'OVERDUE') return 'Facture faite -> Temps de paiement dépassé';
    if (s === 'UPCOMING') return 'Facture à faire';

    return s;
}

function getStatusMeta(statusRaw, { forceImpossible = false } = {}) {
    const status = forceImpossible ? 'Impossible' : normalizeStatusLabel(statusRaw);

    if (status === 'Impossible') {
        return {
            label: 'Impossible',
            borderClass: 'border-red-700/60',
            badgeClass: 'bg-red-900/20 text-red-200 border border-red-700/40',
            icon: <AlertTriangle size={18} className="text-red-400" />,
            subtext: 'Profil incomplet — Facturation impossible',
        };
    }

    switch (status) {
        case 'Facture à faire':
            return {
                label: 'Paiement à faire.',
                borderClass: 'border-slate-700/70',
                badgeClass: 'bg-slate-800/60 text-slate-200 border border-slate-700/50',
                icon: <FileText size={18} className="text-slate-300" />,
                subtext: 'Facture à émettre',
            };

        case 'Facture faite -> En attente de paiement':
            return {
                label: 'Facture faite — En attente de paiement',
                borderClass: 'border-blue-700/60',
                badgeClass: 'bg-blue-900/20 text-blue-200 border border-blue-700/40',
                icon: <Clock size={18} className="text-blue-300" />,
                subtext: 'Paiement en attente',
            };

        case 'Facture faite -> Temps de paiement dépassé':
            return {
                label: 'Facture faite — Paiement dépassé',
                borderClass: 'border-red-700/60',
                badgeClass: 'bg-red-900/20 text-red-200 border border-red-700/40',
                icon: <AlertTriangle size={18} className="text-red-400" />,
                subtext: 'Échéance dépassée',
            };

        case 'Facture payé -> Dans les temps':
            return {
                label: 'Payée — Dans les temps',
                borderClass: 'border-emerald-700/60',
                badgeClass: 'bg-emerald-900/20 text-emerald-200 border border-emerald-700/40',
                icon: <CheckCircle2 size={18} className="text-emerald-300" />,
                subtext: 'Payée avant échéance',
            };

        case 'Facture payé -> Mais en retard':
            return {
                label: 'Payée — En retard ',
                borderClass: 'border-amber-700/60',
                badgeClass: 'bg-amber-900/20 text-amber-200 border border-amber-700/40',
                icon: <CheckCircle2 size={18} className="text-amber-300" />,
                subtext: 'Payée après échéance',
            };

        default:
            return {
                label: status || '—',
                borderClass: 'border-slate-700/60',
                badgeClass: 'bg-slate-800/50 text-slate-200 border border-slate-700/40',
                icon: <FileText size={18} className="text-slate-300" />,
                subtext: '',
            };
    }
}

function extractBillExternalId(invoice) {
    if (!invoice) return null;
    return (
        invoice.billExternalId ??
        invoice.externalBillId ??
        invoice.billId ??
        invoice.parentBillExternalId ??
        invoice.parentExternalBillId ??
        null
    );
}

const EXCLUDED_COMPANY_IDS = [9999, 25];

export default function BillingSupportPage() {
    const now = new Date();
    const [week, setWeek] = useState(getWeekNumber(now));
    const [year, setYear] = useState(now.getFullYear());

    const [rows, setRows] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const { isReady: permsReady, has } = usePermissions();
    const canManage = permsReady && has('ADMIN.BILLING.SUPPORT.MANAGE');

    // context menu
    const [ctxMenu, setCtxMenu] = useState({ open: false, x: 0, y: 0, items: [] });
    const ctxRef = useRef(null);
    const closeContextMenu = useCallback(() => setCtxMenu((p) => ({ ...p, open: false })), []);

    // manage modal
    const [manageOpen, setManageOpen] = useState(false);
    const [manageCompany, setManageCompany] = useState(null);

    const [priceInput, setPriceInput] = useState('');
    const [savingPrice, setSavingPrice] = useState(false);

    const [userQuery, setUserQuery] = useState('');
    const [userResults, setUserResults] = useState([]);
    const [userLoading, setUserLoading] = useState(false);
    const [userAddingId, setUserAddingId] = useState(null);
    const [userRemovingId, setUserRemovingId] = useState(null);

    const fetchDashboard = useCallback(
        async (w = week, y = year) => {
            setLoading(true);
            setError('');
            try {
                const data = await getBillingSupportDashboard(w, y);
                setRows(Array.isArray(data) ? data : []);
            } catch (err) {
                console.error('Erreur API Support Facturation:', err);
                setError(err?.message || 'Erreur lors du chargement des données.');
            } finally {
                setLoading(false);
            }
        },
        [week, year]
    );

    useEffect(() => {
        fetchDashboard();
    }, [fetchDashboard]);

    const prevWeek = () => {
        if (week === 1) {
            setWeek(52);
            setYear((y) => y - 1);
        } else {
            setWeek((w) => w - 1);
        }
    };

    const nextWeek = () => {
        if (week === 52) {
            setWeek(1);
            setYear((y) => y + 1);
        } else {
            setWeek((w) => w + 1);
        }
    };

    // Close context menu on click/scroll/esc
    useEffect(() => {
        const handleClick = (e) => {
            if (ctxRef.current && !ctxRef.current.contains(e.target)) closeContextMenu();
        };
        const handleScroll = () => closeContextMenu();
        const handleEsc = (e) => e.key === 'Escape' && closeContextMenu();

        document.addEventListener('mousedown', handleClick);
        document.addEventListener('keydown', handleEsc);
        window.addEventListener('scroll', handleScroll, true);

        return () => {
            document.removeEventListener('mousedown', handleClick);
            document.removeEventListener('keydown', handleEsc);
            window.removeEventListener('scroll', handleScroll, true);
        };
    }, [closeContextMenu]);

    const copyText = async (label, value) => {
        if (!value) return toast.error(`${label} indisponible`);
        try {
            await navigator.clipboard.writeText(String(value));
            toast.success(`${label} copié`);
        } catch {
            toast.error(`Impossible de copier ${label}`);
        }
        closeContextMenu();
    };

    const openManage = (company) => {
        setManageCompany(company);
        const currentPrice = company?.billingStatus?.amount;
        setPriceInput(Number.isFinite(+currentPrice) ? String(+currentPrice) : '');
        setUserQuery('');
        setUserResults([]);
        setManageOpen(true);
        closeContextMenu();
    };

    const handleNotify = async (companyId) => {
        try {
            await notifyIncompleteCompany(companyId);
            toast.success('Notification envoyée');
        } catch (err) {
            console.error(err);
            toast.error('Erreur lors de l’envoi de la notification.');
        }
    };

    const handleOpenTicket = async (company) => {
        try {
            const participantIds = (company.billableContacts || []).map((b) => b.userId);
            const ticket = await createBillingSupportTicket(company, participantIds);
            toast.success(`Ticket #${ticket.id} ouvert pour ${company.name}`);
        } catch (err) {
            console.error('Erreur création ticket:', err);
            toast.error('Impossible de créer le ticket.');
        }
    };

    const handleOpenPersonalTicket = async (company, contact) => {
        try {
            const ticket = await createBillingSupportTicket(
                { id: company.id, name: company.name },
                [contact.userId],
                `Support Facturation (perso) - ${contact.userName}`
            );
            toast.success(`Ticket #${ticket.id} ouvert avec ${contact.userName}`);
        } catch (err) {
            console.error('Erreur ticket personnel:', err);
            toast.error('Impossible de créer le ticket personnel.');
        } finally {
            closeContextMenu();
        }
    };

    const handleRelance = async (invoice) => {
        const billExternalId = extractBillExternalId(invoice);
        if (!billExternalId) {
            toast.error('Aucune facture liée pour relancer.');
            return;
        }
        try {
            // Endpoint attendu côté backend (relance paiement).
            await apiClient.post(`/admin/bills/${billExternalId}/accounting/remind`);
            toast.success('Relance envoyée');
        } catch (err) {
            console.error('Erreur relance:', err?.response?.data || err);
            toast.error(err?.response?.data?.message || 'Erreur lors de la relance.');
        } finally {
            closeContextMenu();
        }
    };

    const handleCompanyContext = (e, company) => {
        e.preventDefault();
        e.stopPropagation();

        const iban = resolveIbanToBill(company);
        const invoices = Array.isArray(company?.billingStatus) ? company.billingStatus : [company.billingStatus];
        const totalAmount = invoices.reduce((sum, inv) => sum + (inv?.amount || 0), 0);

        const items = [
            { label: 'Copier l’IBAN principal', action: () => copyText('IBAN', iban) },
            { label: `Copier le prix total (${formatUSD(totalAmount)})`, action: () => copyText('Prix', formatUSD(totalAmount)) },
        ];

        invoices.forEach((inv, _idx) => {
            const reason = inv.reason || `Paiement W${week}`;
            items.push({ label: `Copier la raison (${reason})`, action: () => copyText('Raison', reason) });
        });

        if (canManage) {
            items.push({ type: 'separator' });
            items.push({ label: 'Gérer (contacts / prix)', action: () => openManage(company) });

            invoices.forEach((inv, idx) => {
                const st = normalizeStatusLabel(inv?.status);
                if (st === 'Facture faite -> En attente de paiement' || st === 'Facture faite -> Temps de paiement dépassé') {
                    items.push({ label: `Relancer paiement (${inv.reason || `Inv #${idx + 1}`})`, action: () => handleRelance(inv) });
                }
            });
        }

        const x = e.clientX;
        const y = e.clientY;
        setCtxMenu({ open: true, x, y, items });
    };

    const handleToggleContactPrio = async (companyId, userId, currentPrio) => {
        try {
            await setBillableContactPrio(companyId, userId, !currentPrio);
            toast.success(currentPrio ? 'Priorité retirée' : 'Contact marqué comme prioritaire');
            await fetchDashboard();
        } catch (err) {
            console.error(err);
            toast.error('Erreur lors de la mise à jour de la priorité');
        } finally {
            closeContextMenu();
        }
    };

    const handleContactContext = (e, company, contact) => {
        e.preventDefault();
        e.stopPropagation();

        const iban = contact?.iban || null;
        const invoices = Array.isArray(company?.billingStatus) ? company.billingStatus : [company.billingStatus];
        const totalAmount = invoices.reduce((sum, inv) => sum + (inv?.amount || 0), 0);
        const phone = contact?.phoneNumber || 'Non renseigné';

        const x = e.clientX;
        const y = e.clientY;

        const items = [];
        if (iban) items.push({ label: 'Copier l’IBAN du contact', action: () => copyText('IBAN', iban) });

        items.push(
            { label: 'Copier le numéro de téléphone', action: () => copyText('Téléphone', phone) },
            { label: `Copier le prix total (${formatUSD(totalAmount)})`, action: () => copyText('Prix', formatUSD(totalAmount)) },
        );

        invoices.forEach((inv, _idx) => {
            const reason = inv.reason || `Paiement W${week}`;
            items.push({ label: `Copier la raison (${reason})`, action: () => copyText('Raison', reason) });
        });

        items.push(
            { type: 'separator' },
            {
                label: `Ouvrir un ticket personnel (${contact.userName})`,
                action: () => handleOpenPersonalTicket(company, contact),
            },
            {
                label: 'Forcer la modification du profil',
                action: () => handleNotify(company.id),
            },
            { type: 'separator' },
            {
                label: contact.isPrio ? 'Retirer des priorités' : 'Marquer comme prioritaire',
                action: () => handleToggleContactPrio(company.id, contact.userId, contact.isPrio),
            }
        );

        if (canManage) {
            invoices.forEach((inv, idx) => {
                const st = normalizeStatusLabel(inv?.status);
                if (st === 'Facture faite -> En attente de paiement' || st === 'Facture faite -> Temps de paiement dépassé') {
                    items.push({ type: 'separator' });
                    items.push({ label: `Relancer paiement (${inv.reason || `Inv #${idx + 1}`})`, action: () => handleRelance(inv) });
                }
            });
        }

        setCtxMenu({ open: true, x, y, items });
    };

    // Debounced users search (manage modal)
    useEffect(() => {
        if (!manageOpen) return;

        const q = userQuery.trim();
        if (!q) {
            setUserResults([]);
            setUserLoading(false);
            return;
        }

        let cancelled = false;
        const t = setTimeout(async () => {
            setUserLoading(true);
            try {
                const res = await listUsers({ search: q });
                if (!cancelled) setUserResults(Array.isArray(res) ? res : []);
            } catch (err) {
                console.error('Erreur listUsers:', err);
                if (!cancelled) setUserResults([]);
            } finally {
                if (!cancelled) setUserLoading(false);
            }
        }, 250);

        return () => {
            cancelled = true;
            clearTimeout(t);
        };
    }, [userQuery, manageOpen]);

    // Keep manageCompany in sync with refreshed rows (after mutate)
    useEffect(() => {
        if (!manageOpen || !manageCompany?.id) return;
        const fresh = rows.find((r) => r.id === manageCompany.id);
        if (fresh) setManageCompany(fresh);
    }, [rows, manageOpen, manageCompany?.id]);

    const onAddBillable = async (userId) => {
        if (!manageCompany?.id) return;
        setUserAddingId(userId);
        try {
            await assignBillableContact(manageCompany.id, userId);
            toast.success('Contact facturable ajouté');
            await fetchDashboard();
        } catch (err) {
            console.error(err);
            toast.error(err?.message || 'Erreur ajout contact facturable');
        } finally {
            setUserAddingId(null);
        }
    };

    const onRemoveBillable = async (userId) => {
        if (!manageCompany?.id) return;
        setUserRemovingId(userId);
        try {
            await removeBillableContact(manageCompany.id, userId);
            toast.success('Contact facturable supprimé');
            await fetchDashboard();
        } catch (err) {
            console.error(err);
            toast.error(err?.message || 'Erreur suppression contact facturable');
        } finally {
            setUserRemovingId(null);
        }
    };

    const onSaveAccountingPrice = async () => {
        if (!manageCompany?.id) return;

        const value = Number(priceInput);
        if (!Number.isFinite(value) || value < 0) {
            toast.error('Prix compta invalide');
            return;
        }

        setSavingPrice(true);
        try {
            await apiClient.patch(`/admin/companies/${manageCompany.id}/accounting-price`, {
                accountingPrice: parseFloat(priceInput),
            });
            toast.success('Prix compta mis à jour');
            await fetchDashboard();
        } catch (err) {
            console.error(err);
            toast.error(err?.response?.data?.message || 'Erreur mise à jour prix compta');
        } finally {
            setSavingPrice(false);
        }
    };

    const companies = useMemo(
        () =>
            (Array.isArray(rows) ? rows : []).filter(
                (c) => c.isApiActive !== false && !EXCLUDED_COMPANY_IDS.includes(c.id)
            ),
        [rows]
    );

    return (
        <div className="p-4 space-y-6 text-slate-200">
            <div className="flex items-center justify-between">
                <h1 className="text-2xl font-bold">Support Facturation</h1>

                <div className="flex items-center gap-3">
                    <button
                        onClick={prevWeek}
                        className="p-2 rounded-md hover:bg-slate-700 transition"
                        aria-label="Semaine précédente"
                    >
                        <ChevronLeft size={20} />
                    </button>
                    <span className="font-semibold text-lg">{`Semaine ${week} / ${year}`}</span>
                    <button
                        onClick={nextWeek}
                        className="p-2 rounded-md hover:bg-slate-700 transition"
                        aria-label="Semaine suivante"
                    >
                        <ChevronRight size={20} />
                    </button>

                    <button
                        onClick={() => fetchDashboard()}
                        className="ml-2 inline-flex items-center gap-2 rounded-md bg-slate-800/70 hover:bg-slate-800 px-3 py-2 text-sm"
                        aria-label="Rafraîchir"
                    >
                        <RefreshCw size={16} />
                        Rafraîchir
                    </button>
                </div>
            </div>

            {loading ? (
                <div className="flex justify-center items-center h-60">
                    <Loader2 className="animate-spin text-indigo-400" size={32} />
                </div>
            ) : error ? (
                <p className="text-red-400">{error}</p>
            ) : (
                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                    <AnimatePresence>
                        {companies.map((c) => {
                            const ibanToBill = resolveIbanToBill(c);

                            return (
                                <motion.div
                                    key={c.id}
                                    initial={{ opacity: 0, y: 10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    exit={{ opacity: 0, y: -10 }}
                                    className="rounded-xl border-2 p-4 flex flex-col justify-between shadow-sm bg-slate-900/40 border-slate-800"
                                    onContextMenu={(e) => handleCompanyContext(e, c)}
                                >
                                    <div className="mb-4">
                                        <h3 className="text-lg font-bold text-white">{c.name}</h3>
                                        <div className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold">ID #{c.id}</div>
                                    </div>

                                    <div className="flex items-start justify-between gap-3">
                                        <div className="flex flex-col gap-3 flex-1 min-w-0">
                                            {(Array.isArray(c.billingStatus) ? c.billingStatus : [c.billingStatus]).map((bs, idx) => {
                                                const stNorm = normalizeStatusLabel(bs?.status);
                                                const forceImpossible =
                                                    !ibanToBill &&
                                                    stNorm !== 'Facture payé -> Dans les temps' &&
                                                    stNorm !== 'Facture payé -> Mais en retard';
                                                const meta = getStatusMeta(bs?.status, { forceImpossible });

                                                return (
                                                    <div key={idx} className="flex items-start gap-3 bg-slate-900/30 p-2 rounded-lg border border-slate-800/50">
                                                        <div className="mt-0.5 shrink-0">{meta.icon}</div>
                                                        <div className="min-w-0 flex-1">
                                                            <div className="flex items-center justify-between gap-2">
                                                                <p className="font-bold text-white truncate text-sm">
                                                                    {bs?.reason || `Paiement W${week}`}
                                                                </p>
                                                                <span className="text-indigo-400 font-bold text-sm">
                                                                    {formatUSD(bs?.amount ?? 0)}
                                                                </span>
                                                            </div>
                                                            <div className="mt-1 flex items-center justify-between gap-2">
                                                                <div className="flex flex-col gap-1">
                                                                    <span
                                                                        className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium ${meta.badgeClass}`}
                                                                    >
                                                                        {meta.label}
                                                                    </span>

                                                                    {stNorm === 'Facture payé -> Mais en retard' && bs?.lateDuration && (
                                                                        <span className="text-[10px] text-amber-300 font-mono">
                                                                            Retard : {bs.lateDuration}
                                                                        </span>
                                                                    )}
                                                                </div>

                                                                {bs?.billExternalId && (
                                                                    <span className="text-[10px] text-slate-500 font-mono">
                                                                        #{bs.billExternalId}
                                                                    </span>
                                                                )}
                                                            </div>
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>

                                        {canManage && (
                                            <button
                                                onClick={() => openManage(c)}
                                                className="p-2 rounded-md hover:bg-slate-800 transition shrink-0"
                                                title="Gérer (contacts / prix)"
                                            >
                                                <Settings size={16} />
                                            </button>
                                        )}
                                    </div>

                                    <div className="mt-4 pt-3 border-t border-slate-800 space-y-2">
                                        <div className="flex items-center justify-between text-xs">
                                            <span className="text-slate-400">Prix compta de base :</span>
                                            <span className="text-slate-100 font-semibold">{formatUSD(c.accountingPrice || 0)}</span>
                                        </div>
                                        <div className="text-xs flex flex-col gap-1">
                                            <div>
                                                <span className="text-slate-400">IBAN à facturer : </span>
                                                {ibanToBill ? (
                                                    <span className="font-mono text-slate-100 break-all">{ibanToBill}</span>
                                                ) : (
                                                    <span className="text-slate-500 italic">Inconnu</span>
                                                )}
                                            </div>
                                        </div>
                                    </div>

                                    {c.customServices && c.customServices.length > 0 && (
                                        <div className="mt-4 border-t border-slate-800 pt-3">
                                            <p className="text-[10px] text-slate-500 mb-2 uppercase tracking-widest font-bold">Services Additionnels</p>
                                            <div className="space-y-1">
                                                {c.customServices.map((cs) => (
                                                    <div key={cs.id} className="flex items-center justify-between gap-2 text-xs">
                                                        <span className="text-slate-300 truncate" title={cs.title}>{cs.title}</span>
                                                        <span className="text-indigo-400 font-mono shrink-0">{formatUSD(cs.price)}</span>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                    {c.billableContacts && c.billableContacts.length > 0 ? (
                                        <div className="mt-4 border-t border-slate-800 pt-3">
                                            <p className="text-xs text-slate-400 mb-2 uppercase tracking-wide">
                                                Contacts facturables
                                            </p>
                                            <div className="space-y-2">
                                                {(c.billableContacts || [])
                                                    .slice()
                                                    .sort((a, b) => (b.isPrio ? 1 : 0) - (a.isPrio ? 1 : 0))
                                                    .map((b) => (
                                                        <div
                                                            key={b.userId}
                                                            className={`flex flex-col bg-slate-900/50 border rounded-md p-2 hover:bg-slate-900/70 cursor-context-menu transition-colors ${b.isPrio ? 'border-amber-500/40 shadow-[0_0_8px_rgba(245,158,11,0.1)]' : 'border-slate-800'
                                                                }`}
                                                            onContextMenu={(e) => handleContactContext(e, c, b)}
                                                        >
                                                            <div className="flex items-center justify-between gap-2">
                                                                <p className="font-medium text-slate-100 text-sm">{b.userName}</p>
                                                                {b.isPrio && <Star size={14} className="text-amber-400 fill-amber-400" />}
                                                            </div>
                                                            <p className="text-xs text-slate-400">
                                                                📞 {b.phoneNumber || 'Non renseigné'}
                                                            </p>
                                                            <p className="text-xs text-slate-400">
                                                                🏦 {b.iban || 'IBAN manquant'}
                                                            </p>
                                                        </div>
                                                    ))}
                                            </div>
                                        </div>
                                    ) : (
                                        <p className="text-sm text-slate-500 mt-4">
                                            Aucun contact facturable lié.
                                        </p>
                                    )}

                                    <div className="mt-4 flex flex-wrap justify-between items-center gap-2 border-t border-slate-800 pt-3">
                                        <button
                                            onClick={() => handleOpenTicket(c)}
                                            className="flex items-center gap-2 text-xs bg-slate-800 hover:bg-slate-700 px-3 py-1.5 rounded-md transition"
                                        >
                                            <MessageSquare size={14} /> Ouvrir un ticket
                                        </button>

                                        <div className="flex flex-wrap items-center gap-2">
                                            {(Array.isArray(c.billingStatus) ? c.billingStatus : [c.billingStatus]).some((bs) => {
                                                const st = normalizeStatusLabel(bs?.status);
                                                return (
                                                    st === 'Facture faite -> En attente de paiement' ||
                                                    st === 'Facture faite -> Temps de paiement dépassé'
                                                );
                                            }) && <p className="text-[10px] text-slate-500 italic">Relance dispo via clic-droit</p>}

                                            {((Array.isArray(c.billingStatus) ? c.billingStatus : [c.billingStatus]).some(
                                                (bs) => normalizeStatusLabel(bs?.status) === 'Facture à faire'
                                            ) ||
                                                !resolveIbanToBill(c)) && (
                                                    <button
                                                        onClick={() => handleNotify(c.id)}
                                                        className="text-xs bg-indigo-600 hover:bg-indigo-500 text-white px-3 py-1.5 rounded-md transition shadow-lg shadow-indigo-900/20"
                                                    >
                                                        {!resolveIbanToBill(c) ? 'Prévenir entreprise' : 'Demander mise à jour'}
                                                    </button>
                                                )}
                                        </div>
                                    </div>
                                </motion.div>
                            );
                        })}
                    </AnimatePresence>
                </div>
            )}

            {/* Context menu */}
            <AnimatePresence>
                {ctxMenu.open && (
                    <motion.div
                        ref={ctxRef}
                        initial={{ opacity: 0, scale: 0.98 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.98 }}
                        transition={{ duration: 0.12 }}
                        className="fixed z-[9999] min-w-[240px] bg-slate-900 border border-slate-700 rounded-lg shadow-xl overflow-hidden"
                        style={{ left: ctxMenu.x, top: ctxMenu.y, transform: 'translate(-2px, -2px)' }}
                        onContextMenu={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                        }}
                    >
                        <ul className="py-1">
                            {ctxMenu.items.map((it, idx) =>
                                it.type === 'separator' ? (
                                    <li key={`sep-${idx}`} className="my-1 h-px bg-slate-700" />
                                ) : (
                                    <li key={`${it.label}-${idx}`}>
                                        <button
                                            onClick={it.action}
                                            className="w-full text-left px-3 py-2 text-sm hover:bg-slate-800 text-slate-200"
                                        >
                                            {it.label}
                                        </button>
                                    </li>
                                )
                            )}
                        </ul>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Manage modal (contacts + prix compta) */}
            <Modal
                isOpen={manageOpen}
                onClose={() => setManageOpen(false)}
                title={manageCompany ? `Gérer — ${manageCompany.name}` : 'Gérer'}
            >
                {!canManage ? (
                    <div className="text-sm text-slate-300">
                        Permission requise : <span className="font-mono">ADMIN.BILLING.SUPPORT.MANAGE</span>
                    </div>
                ) : (
                    <div className="space-y-6 min-w-[min(720px,90vw)]">
                        <div className="flex items-center justify-between gap-3">
                            <div className="text-sm text-slate-400">
                                Modifie les contacts facturables et le prix compta (USD).
                            </div>
                            <button
                                onClick={() => setManageOpen(false)}
                                className="p-2 rounded-md hover:bg-slate-800 transition"
                                aria-label="Fermer"
                            >
                                <X size={16} />
                            </button>
                        </div>

                        <div className="rounded-lg border border-slate-800 bg-slate-900/40 p-4 space-y-3">
                            <div className="flex items-center justify-between">
                                <div className="text-sm font-semibold text-slate-100">Prix compta (USD)</div>
                                <div className="text-xs text-slate-400">USD uniquement</div>
                            </div>

                            <div className="flex flex-wrap gap-2 items-center">
                                <input
                                    value={priceInput}
                                    onChange={(e) => setPriceInput(e.target.value)}
                                    className="w-40 rounded-md bg-slate-950/40 border border-slate-800 px-3 py-2 text-sm text-slate-100 outline-none focus:ring-2 focus:ring-indigo-600/40"
                                    placeholder="ex: 400"
                                    inputMode="decimal"
                                />
                                <button
                                    onClick={onSaveAccountingPrice}
                                    disabled={savingPrice}
                                    className="inline-flex items-center gap-2 rounded-md bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 px-3 py-2 text-sm text-white"
                                >
                                    {savingPrice ? (
                                        <Loader2 className="animate-spin" size={16} />
                                    ) : (
                                        <CheckCircle2 size={16} />
                                    )}
                                    Enregistrer
                                </button>
                            </div>
                        </div>

                        <div className="rounded-lg border border-slate-800 bg-slate-900/40 p-4 space-y-3">
                            <div className="flex items-center justify-between">
                                <div className="text-sm font-semibold text-slate-100">Contacts facturables</div>
                                <div className="text-xs text-slate-400">
                                    {manageCompany?.billableContacts?.length || 0} contact(s)
                                </div>
                            </div>

                            {manageCompany?.billableContacts?.length ? (
                                <div className="space-y-2">
                                    {manageCompany.billableContacts.map((b) => (
                                        <div
                                            key={b.userId}
                                            className="flex items-center justify-between gap-3 rounded-md border border-slate-800 bg-slate-950/30 px-3 py-2"
                                        >
                                            <div className="min-w-0">
                                                <div className="text-sm font-medium text-slate-100 truncate">
                                                    {b.userName}
                                                </div>
                                                <div className="text-xs text-slate-400">
                                                    📞 {b.phoneNumber || 'Non renseigné'} · 🏦 {b.iban || 'IBAN manquant'}
                                                </div>
                                            </div>

                                            <button
                                                onClick={() => onRemoveBillable(b.userId)}
                                                disabled={userRemovingId === b.userId}
                                                className="inline-flex items-center gap-2 rounded-md bg-red-900/30 hover:bg-red-900/40 border border-red-700/30 px-3 py-2 text-xs text-red-200 disabled:opacity-50"
                                                title="Supprimer"
                                            >
                                                {userRemovingId === b.userId ? (
                                                    <Loader2 className="animate-spin" size={14} />
                                                ) : (
                                                    <Trash2 size={14} />
                                                )}
                                                Supprimer
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <div className="text-sm text-slate-400">Aucun contact facturable.</div>
                            )}

                            <div className="mt-3 border-t border-slate-800 pt-3 space-y-2">
                                <div className="text-sm font-semibold text-slate-100 flex items-center gap-2">
                                    <UserPlus size={16} /> Ajouter un contact
                                </div>

                                <input
                                    value={userQuery}
                                    onChange={(e) => setUserQuery(e.target.value)}
                                    className="w-full rounded-md bg-slate-950/40 border border-slate-800 px-3 py-2 text-sm text-slate-100 outline-none focus:ring-2 focus:ring-indigo-600/40"
                                    placeholder="Rechercher par nom / username…"
                                />

                                {userLoading ? (
                                    <div className="flex items-center gap-2 text-sm text-slate-400">
                                        <Loader2 className="animate-spin" size={16} />
                                        Recherche…
                                    </div>
                                ) : userResults.length ? (
                                    <div className="max-h-[260px] overflow-y-auto rounded-md border border-slate-800">
                                        {userResults.slice(0, 25).map((u) => (
                                            <div
                                                key={u.id}
                                                className="flex items-center justify-between gap-3 px-3 py-2 hover:bg-slate-900/60"
                                            >
                                                <div className="min-w-0">
                                                    <div className="text-sm text-slate-100 truncate">
                                                        {u.name || u.username || `User #${u.id}`}
                                                    </div>
                                                    <div className="text-xs text-slate-400 truncate">
                                                        {u.username ? `@${u.username}` : ''}
                                                    </div>
                                                </div>

                                                <button
                                                    onClick={() => onAddBillable(u.id)}
                                                    disabled={userAddingId === u.id}
                                                    className="inline-flex items-center gap-2 rounded-md bg-slate-800 hover:bg-slate-700 px-3 py-2 text-xs text-slate-100 disabled:opacity-50"
                                                >
                                                    {userAddingId === u.id ? (
                                                        <Loader2 className="animate-spin" size={14} />
                                                    ) : (
                                                        <UserPlus size={14} />
                                                    )}
                                                    Ajouter
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                ) : userQuery.trim() ? (
                                    <div className="text-sm text-slate-400">Aucun résultat.</div>
                                ) : null}
                            </div>
                        </div>

                        <div className="rounded-lg border border-slate-800 bg-slate-900/40 p-4 text-sm text-slate-300">
                            <div className="font-semibold text-slate-100 mb-1">Relance paiement</div>
                            <div>
                                Le bouton <span className="inline-flex items-center gap-1 font-mono text-slate-200"><Send size={14} /> Relancer paiement</span> utilise l’endpoint
                                <span className="font-mono"> POST /admin/bills/:billId/accounting/remind</span>.
                            </div>
                        </div>
                    </div>
                )}
            </Modal>
        </div>
    );
}
