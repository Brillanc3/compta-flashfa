// src/pages/admin/CompanyListPage.jsx
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { listCompanies, deleteCompany } from '@/services/adminService';
import apiClient from '@/services/api';
import toast from 'react-hot-toast';
import Spinner from '@/components/ui/Spinner';
import {
    PlusCircle,
    Edit,
    Users,
    Building2,
    AlertTriangle,
    ChevronLeft,
    ChevronRight,
    Search,
    Activity,
} from 'lucide-react';
import CreateCompanyModal from '@/components/admin/company/CreateCompanyModal';
import EditCompanyModal from '@/components/admin/company/EditCompanyModal';
import ManageContactsModal from '@/components/admin/company/ManageContactsModal';
import ManageServicesModal from '@/components/admin/company/ManageServicesModal';
import { useConfirmation } from '@/contexts/ConfirmationContext';
import { AnimatePresence, motion } from 'framer-motion';

const formatUSD = (n) =>
    new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(
        Number.isFinite(+n) ? +n : 0
    );

function Dot({ color = 'bg-slate-500' }) {
    return <span className={`inline-block h-2.5 w-2.5 rounded-full ${color}`} />;
}

function ShardBadge({ shard }) {
    if (!shard) {
        return (
            <div className="flex items-center gap-2 text-slate-300">
                <Dot color="bg-slate-500" />
                <span className="text-xs italic">Inconnue</span>
            </div>
        );
    }

    const color =
        shard.rawStatus === 'ok'
            ? 'bg-emerald-500'
            : shard.rawStatus === 'booting'
                ? 'bg-amber-500'
                : 'bg-rose-500';

    return (
        <div className="flex items-center gap-2 text-slate-200">
            <Dot color={color} />
            <span className="text-xs">{shard?.name || '—'}</span>
            {!shard?.known && (
                <span
                    className="inline-flex items-center gap-1 text-amber-400 text-[11px]"
                    title="Shard non connue par le master (knownCompanies)"
                >
                    <AlertTriangle size={12} aria-hidden="true" />
                    <span className="sr-only">Shard non connue</span>
                </span>
            )}
        </div>
    );
}

function ActiveBadge({ active }) {
    return active ? (
        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-600/20 text-emerald-300 border border-emerald-600/40">
            Activée
        </span>
    ) : (
        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-rose-600/20 text-rose-300 border border-rose-600/40">
            Désactivée
        </span>
    );
}

const CompanyListPage = () => {
    const navigate = useNavigate();
    const { confirmAction } = useConfirmation();

    const [companies, setCompanies] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState(null);

    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [isContactModalOpen, setIsContactModalOpen] = useState(false);
    const [isServiceModalOpen, setIsServiceModalOpen] = useState(false);

    const [companyToEdit, setCompanyToEdit] = useState(null);
    const [companyForContacts, setCompanyForContacts] = useState(null);
    const [companyForServices, setCompanyForServices] = useState(null);

    // Search + pagination
    const [qInput, setQInput] = useState('');
    const [q, setQ] = useState('');
    const [page, setPage] = useState(1);
    const [pageSize, setPageSize] = useState(25);
    const [total, setTotal] = useState(0);
    const [totalPages, setTotalPages] = useState(1);

    // --- MENU CONTEXTUEL (desktop) ---
    const [ctxMenu, setCtxMenu] = useState({ open: false, x: 0, y: 0, anchorX: 0, anchorY: 0, items: [] });
    const ctxRef = useRef(null);

    // Debounce search input -> q
    useEffect(() => {
        const t = window.setTimeout(() => {
            const next = qInput.trim();
            setPage(1);
            setQ(next);
        }, 300);
        return () => window.clearTimeout(t);
    }, [qInput]);

    const fetchCompanies = useCallback(async () => {
        setIsLoading(true);
        setError(null);
        try {
            const res = await listCompanies({ q, page, pageSize });

            const items = Array.isArray(res) ? res : (res?.items || []);
            const companiesWithDefaults = items.map((c) => ({
                ...c,
                billableContacts: c.billableContacts || [],
            }));

            setCompanies(companiesWithDefaults);

            if (!Array.isArray(res)) {
                setTotal(Number.isFinite(+res?.total) ? +res.total : items.length);
                setTotalPages(Number.isFinite(+res?.totalPages) ? +res.totalPages : 1);
            } else {
                setTotal(items.length);
                setTotalPages(1);
            }
        } catch (err) {
            setError('Impossible de charger la liste des entreprises.');
            toast.error(err?.message || 'Une erreur est survenue.');
            setCompanies([]);
            setTotal(0);
            setTotalPages(1);
        } finally {
            setIsLoading(false);
        }
    }, [q, page, pageSize]);

    useEffect(() => {
        fetchCompanies();
    }, [fetchCompanies]);

    const handleDeleteCompany = useCallback(
        (company) => {
            if (!company?.id) return;
            confirmAction({
                title: "Supprimer l’entreprise",
                message: `Cette action supprimera définitivement l’entreprise "${company.name}" ainsi que toutes les données qui lui sont reliées (sauf l’historique de rang archivé).`,
                onConfirm: async () => {
                    try {
                        await deleteCompany(company.id);
                        toast.success('Entreprise supprimée.');
                        // Re-fetch pour garder une pagination cohérente
                        fetchCompanies();
                    } catch (e) {
                        toast.error(e?.message || "Échec suppression de l’entreprise.");
                    }
                },
            });
        },
        [confirmAction, fetchCompanies]
    );

    const handleOpenEditModal = (company) => {
        setCompanyToEdit(company);
        setIsEditModalOpen(true);
    };
    const handleOpenContactModal = (company) => {
        setCompanyForContacts(company);
        setIsContactModalOpen(true);
    };
    const handleOpenServiceModal = (company) => {
        setCompanyForServices(company);
        setIsServiceModalOpen(true);
    };

    // === Actions Shard/Active ===
    const setCompanyKnown = useCallback(async (companyId, known) => {
        try {
            await apiClient.post(`/admin/companies/${companyId}/shard/known`, { known });
            setCompanies((prev) =>
                prev.map((c) => (c.id === companyId ? { ...c, shard: { ...(c.shard || {}), known } } : c))
            );
            toast.success(known ? 'Entreprise ajoutée à la liste des shards.' : 'Entreprise retirée de la liste des shards.');
        } catch (e) {
            toast.error(e?.message || 'Échec mise à jour known.');
        }
    }, []);

    const toggleActive = useCallback(async (company, nextState) => {
        const companyId = company.id;

        // Backend: le statut API est `isApiActive`
        const payload = { isApiActive: nextState };

        const previous = {
            isApiActive: company.isApiActive,
            enabled: company.enabled,
            isActive: company.isActive,
        };

        // MAJ optimiste (on conserve aussi enabled/isActive pour compat UI)
        setCompanies((prev) =>
            prev.map((c) =>
                c.id === companyId ? { ...c, isApiActive: nextState, enabled: nextState, isActive: nextState } : c
            )
        );

        try {
            await apiClient.patch(`/admin/companies/${companyId}`, payload);
            toast.success(nextState ? 'Entreprise activée.' : 'Entreprise désactivée.');
        } catch (e) {
            // revert
            setCompanies((prev) => prev.map((c) => (c.id === companyId ? { ...c, ...previous } : c)));
            toast.error(e?.message || 'Échec de la mise à jour du statut.');
        }
    }, []);

    const activeFromCompany = (c) => {
        // Source de vérité: backend = `isApiActive`
        return typeof c.isApiActive === 'boolean'
            ? c.isApiActive
            : typeof c.enabled === 'boolean'
                ? c.enabled
                : typeof c.isActive === 'boolean'
                    ? c.isActive
                    : true;
    };

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

    const closeContextMenu = useCallback(() => setCtxMenu((s) => ({ ...s, open: false })), []);

    const openContextMenu = (e, company) => {
        e.preventDefault();
        e.stopPropagation();

        const anchorX = e.clientX;
        const anchorY = e.clientY;

        const shardKnown = !!company?.shard?.known;
        const isActive = activeFromCompany(company);

        const items = [
            { label: 'Voir les détails', action: () => navigate(`/admin/companies/${company.id}`) },
            { label: 'Modifier l’entreprise', action: () => handleOpenEditModal(company) },
            { label: 'Gérer les contacts', action: () => handleOpenContactModal(company) },
            { label: 'Gérer les services', action: () => handleOpenServiceModal(company) },
            { type: 'separator' },
            !shardKnown
                ? { label: 'Déclarer comme connue (shard)', action: () => setCompanyKnown(company.id, true) }
                : { label: 'Retirer de la liste des shards', action: () => setCompanyKnown(company.id, false) },
            { type: 'separator' },
            !isActive
                ? { label: "Activer l’entreprise", action: () => toggleActive(company, true) }
                : { label: "Désactiver l’entreprise", action: () => toggleActive(company, false) },
            { type: 'separator' },
            { label: "Supprimer l’entreprise", action: () => handleDeleteCompany(company) },
            { type: 'separator' },
            { label: 'Copier le nom', action: () => copyText('Nom', company.name) },
            { label: 'Copier le solde', action: () => copyText('Solde', formatUSD(company.balance || 0)) },
        ];

        setCtxMenu({ open: true, x: anchorX, y: anchorY, anchorX, anchorY, items });
    };

    // Repositionnement intelligent (clamp + flip) du menu contextuel dans la fenêtre.
    useEffect(() => {
        if (!ctxMenu.open) return;
        const el = ctxRef.current;
        if (!el) return;

        const PADDING = 8;
        const OFFSET = 6;
        const { width, height } = el.getBoundingClientRect();

        const anchorX = Number.isFinite(ctxMenu.anchorX) ? ctxMenu.anchorX : ctxMenu.x;
        const anchorY = Number.isFinite(ctxMenu.anchorY) ? ctxMenu.anchorY : ctxMenu.y;

        let x = anchorX + OFFSET;
        let y = anchorY + OFFSET;

        if (x + width + PADDING > window.innerWidth) x = anchorX - width - OFFSET;
        if (x + width + PADDING > window.innerWidth) x = window.innerWidth - width - PADDING;
        if (x < PADDING) x = PADDING;

        if (y + height + PADDING > window.innerHeight) y = anchorY - height - OFFSET;
        if (y + height + PADDING > window.innerHeight) y = window.innerHeight - height - PADDING;
        if (y < PADDING) y = PADDING;

        setCtxMenu((s) => {
            if (!s.open) return s;
            if (s.x === x && s.y === y) return s;
            return { ...s, x, y };
        });
    }, [ctxMenu.open, ctxMenu.anchorX, ctxMenu.anchorY, ctxMenu.x, ctxMenu.y]);

    useEffect(() => {
        const close = (e) => {
            if (ctxRef.current && !ctxRef.current.contains(e.target)) closeContextMenu();
        };
        const esc = (e) => e.key === 'Escape' && closeContextMenu();
        const scroll = () => closeContextMenu();
        const resize = () => closeContextMenu();

        document.addEventListener('mousedown', close);
        document.addEventListener('keydown', esc);
        window.addEventListener('scroll', scroll, true);
        window.addEventListener('resize', resize, true);

        return () => {
            document.removeEventListener('mousedown', close);
            document.removeEventListener('keydown', esc);
            window.removeEventListener('scroll', scroll, true);
            window.removeEventListener('resize', resize, true);
        };
    }, [closeContextMenu]);

    const goPrev = () => setPage((p) => Math.max(1, p - 1));
    const goNext = () => setPage((p) => Math.min(totalPages || 1, p + 1));

    return (
        <div className="space-y-6 p-4">
            {/* Header */}
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <h1 className="text-2xl sm:text-3xl font-bold text-white flex items-center gap-2">
                    <Building2 className="text-indigo-400" /> Gestion des Entreprises
                </h1>

                <button
                    onClick={() => setIsCreateModalOpen(true)}
                    className="w-full sm:w-auto flex items-center justify-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-md transition-colors"
                >
                    <PlusCircle size={18} />
                    Créer une Entreprise
                </button>
            </div>

            {/* Controls */}
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="relative w-full sm:max-w-[360px]">
                    <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                        value={qInput}
                        onChange={(e) => setQInput(e.target.value)}
                        placeholder="Rechercher une entreprise…"
                        className="w-full pl-9 pr-3 py-2 rounded-md bg-slate-900 border border-slate-700 text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-600"
                    />
                </div>

                <div className="flex flex-wrap items-center gap-2 justify-between sm:justify-end">
                    <div className="text-xs text-slate-300">
                        {total} résultat{total > 1 ? 's' : ''}{totalPages > 1 ? ` • page ${page}/${totalPages}` : ''}
                    </div>

                    <div className="flex items-center gap-2">
                        <select
                            value={pageSize}
                            onChange={(e) => {
                                setPage(1);
                                setPageSize(Number(e.target.value) || 25);
                            }}
                            className="h-9 rounded-md bg-slate-900 border border-slate-700 text-slate-100 px-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-600"
                            aria-label="Taille de page"
                        >
                            {[10, 25, 50, 100].map((n) => (
                                <option key={n} value={n}>
                                    {n}/page
                                </option>
                            ))}
                        </select>

                        <button
                            type="button"
                            onClick={goPrev}
                            disabled={page <= 1 || isLoading}
                            className="h-9 px-2 rounded-md border border-slate-700 bg-slate-900 text-slate-100 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-800"
                            title="Page précédente"
                        >
                            <ChevronLeft size={16} />
                        </button>
                        <button
                            type="button"
                            onClick={goNext}
                            disabled={page >= totalPages || isLoading}
                            className="h-9 px-2 rounded-md border border-slate-700 bg-slate-900 text-slate-100 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-800"
                            title="Page suivante"
                        >
                            <ChevronRight size={16} />
                        </button>
                    </div>
                </div>
            </div>

            {/* Loading / errors */}
            {isLoading && (
                <div className="flex justify-center py-10">
                    <Spinner />
                </div>
            )}
            {error && (
                <p className="text-center text-red-500 bg-red-900/20 p-4 rounded-md">
                    {error}
                </p>
            )}

            {!isLoading && !error && (
                <>
                    {/* Mobile cards */}
                    <div className="sm:hidden space-y-3">
                        {companies.length > 0 ? (
                            companies.map((company) => {
                                const active = activeFromCompany(company);
                                return (
                                    <div
                                        key={company.id}
                                        className="bg-slate-800 border border-slate-700 rounded-lg p-3"
                                    >
                                        <button
                                            type="button"
                                            onClick={() => navigate(`/admin/companies/${company.id}`)}
                                            className="w-full text-left"
                                        >
                                            <div className="flex items-start justify-between gap-2">
                                                <div className="min-w-0">
                                                    <div className="text-white font-semibold truncate">{company.name}</div>
                                                    <div className="mt-1">
                                                        <ShardBadge shard={company.shard} />
                                                    </div>
                                                </div>
                                                <ActiveBadge active={active} />
                                            </div>

                                            <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-slate-300">
                                                <div className="rounded-md bg-slate-900/50 border border-slate-700 p-2">
                                                    <div className="text-slate-400">Solde</div>
                                                    <div className="text-slate-100 font-medium">{formatUSD(company.balance || 0)}</div>
                                                </div>
                                                <div className="rounded-md bg-slate-900/50 border border-slate-700 p-2">
                                                    <div className="text-slate-400">Employés</div>
                                                    <div className="text-slate-100 font-medium">{company._count?.employees ?? 0}</div>
                                                </div>
                                                <div className="rounded-md bg-slate-900/50 border border-slate-700 p-2">
                                                    <div className="text-slate-400">Modules actifs</div>
                                                    <div className="text-slate-100 font-medium">{company._count?.activeModules ?? 0}</div>
                                                </div>
                                                <div className="rounded-md bg-slate-900/50 border border-slate-700 p-2">
                                                    <div className="text-slate-400">ID</div>
                                                    <div className="text-slate-100 font-medium">#{company.id}</div>
                                                </div>
                                            </div>
                                        </button>

                                        <div className="mt-3 flex items-center justify-between gap-2">
                                            <button
                                                type="button"
                                                onClick={() => toggleActive(company, !active)}
                                                className="flex-1 h-9 rounded-md border border-slate-700 bg-slate-900 text-slate-100 hover:bg-slate-800"
                                            >
                                                {active ? 'Désactiver' : 'Activer'}
                                            </button>

                                            <button
                                                type="button"
                                                onClick={() => handleOpenEditModal(company)}
                                                className="h-9 w-10 rounded-md border border-slate-700 bg-slate-900 text-slate-100 hover:bg-slate-800 flex items-center justify-center"
                                                title="Modifier"
                                            >
                                                <Edit size={16} />
                                            </button>

                                            <button
                                                type="button"
                                                onClick={() => handleOpenContactModal(company)}
                                                className="h-9 w-10 rounded-md border border-slate-700 bg-slate-900 text-slate-100 hover:bg-slate-800 flex items-center justify-center"
                                                title="Contacts"
                                            >
                                                <Users size={16} />
                                            </button>

                                            <button
                                                type="button"
                                                onClick={() => handleOpenServiceModal(company)}
                                                className="h-9 w-10 rounded-md border border-slate-700 bg-slate-900 text-slate-100 hover:bg-slate-800 flex items-center justify-center"
                                                title="Services"
                                            >
                                                <Activity size={16} />
                                            </button>
                                        </div>
                                    </div>
                                );
                            })
                        ) : (
                            <div className="text-center px-6 py-8 text-sm text-slate-500 italic bg-slate-800 border border-slate-700 rounded-lg">
                                Aucune entreprise trouvée.
                            </div>
                        )}
                    </div>

                    {/* Desktop table */}
                    <div className="hidden sm:block bg-slate-800 shadow rounded-lg overflow-hidden">
                        <div className="overflow-x-auto">
                            <table className="min-w-full divide-y divide-slate-700">
                                <thead className="bg-slate-900/50">
                                <tr>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-300 uppercase tracking-wider">
                                        Nom
                                    </th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-300 uppercase tracking-wider">
                                        Shard
                                    </th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-300 uppercase tracking-wider">
                                        Statut
                                    </th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-300 uppercase tracking-wider">
                                        Solde
                                    </th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-300 uppercase tracking-wider">
                                        Employés
                                    </th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-300 uppercase tracking-wider">
                                        Modules actifs
                                    </th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-300 uppercase tracking-wider text-right">
                                        Actions
                                    </th>
                                </tr>
                                </thead>
                                <tbody className="bg-slate-800 divide-y divide-slate-700">
                                {companies.length > 0 ? (
                                    companies.map((company) => {
                                        const active = activeFromCompany(company);
                                        return (
                                            <tr
                                                key={company.id}
                                                className="hover:bg-slate-700/50 cursor-pointer"
                                                onContextMenu={(e) => openContextMenu(e, company)}
                                                onDoubleClick={() => navigate(`/admin/companies/${company.id}`)}
                                            >
                                                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-white">
                                                    {company.name}
                                                </td>
                                                <td className="px-6 py-4 text-sm text-slate-300">
                                                    <ShardBadge shard={company.shard} />
                                                </td>
                                                <td className="px-6 py-4 text-sm text-slate-300">
                                                    <ActiveBadge active={active} />
                                                </td>
                                                <td className="px-6 py-4 text-sm text-slate-300">
                                                    {formatUSD(company.balance || 0)}
                                                </td>
                                                <td className="px-6 py-4 text-sm text-slate-300">
                                                    {company._count?.employees ?? 0}
                                                </td>
                                                <td className="px-6 py-4 text-sm text-slate-300">
                                                    {company._count?.activeModules ?? 0}
                                                </td>
                                                <td className="px-6 py-4 text-right text-sm font-medium space-x-2">
                                                    <button
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            handleOpenEditModal(company);
                                                        }}
                                                        className="p-1 text-yellow-400 hover:text-yellow-300 transition-colors"
                                                        title="Modifier"
                                                    >
                                                        <Edit size={16} />
                                                    </button>
                                                    <button
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            handleOpenContactModal(company);
                                                        }}
                                                        className="p-1 text-blue-400 hover:text-blue-300 transition-colors"
                                                        title="Contacts"
                                                    >
                                                        <Users size={16} />
                                                    </button>
                                                    <button
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            handleOpenServiceModal(company);
                                                        }}
                                                        className="p-1 text-emerald-400 hover:text-emerald-300 transition-colors"
                                                        title="Services"
                                                    >
                                                        <Activity size={16} />
                                                    </button>
                                                </td>
                                            </tr>
                                        );
                                    })
                                ) : (
                                    <tr>
                                        <td colSpan="7" className="text-center px-6 py-8 text-sm text-slate-500 italic">
                                            Aucune entreprise trouvée.
                                        </td>
                                    </tr>
                                )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </>
            )}

            {/* Modales */}
            <CreateCompanyModal
                isOpen={isCreateModalOpen}
                onClose={() => setIsCreateModalOpen(false)}
                onComplete={() => {
                    setPage(1);
                    fetchCompanies();
                }}
            />
            <EditCompanyModal
                isOpen={isEditModalOpen}
                onClose={() => setIsEditModalOpen(false)}
                onComplete={() => fetchCompanies()}
                company={companyToEdit}
            />
            <ManageContactsModal
                isOpen={isContactModalOpen}
                onClose={() => setIsContactModalOpen(false)}
                onComplete={() => fetchCompanies()}
                company={companyForContacts}
            />
            <ManageServicesModal
                isOpen={isServiceModalOpen}
                onClose={() => setIsServiceModalOpen(false)}
                onComplete={() => fetchCompanies()}
                company={companyForServices}
            />

            {/* Menu contextuel */}
            <AnimatePresence>
                {ctxMenu.open && (
                    <motion.div
                        ref={ctxRef}
                        initial={{ opacity: 0, scale: 0.98 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.98 }}
                        transition={{ duration: 0.12 }}
                        className="fixed z-[9999] min-w-[240px] bg-slate-900 border border-slate-700 rounded-lg shadow-xl overflow-hidden"
                        style={{ left: ctxMenu.x, top: ctxMenu.y }}
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
                                    <li key={it.label}>
                                        <button
                                            onClick={async () => {
                                                try {
                                                    await it.action?.();
                                                } finally {
                                                    setCtxMenu((s) => ({ ...s, open: false }));
                                                }
                                            }}
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
        </div>
    );
};

export default CompanyListPage;
