import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { 
    Activity, 
    RefreshCcw, 
    AlertCircle, 
    CheckCircle2, 
    Clock, 
    Search, 
    Building2, 
    ChevronLeft, 
    ChevronRight,
    Play
} from 'lucide-react';
import toast from 'react-hot-toast';
import Spinner from '@/components/ui/Spinner';
import { 
    getLogsStats, 
    retryAllFailedLogs, 
    listGlobalLogs, 
    listCompaniesBasic,
    retryLog
} from '@/services/adminService';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

const AdminLogsPage = () => {
    // Stats state
    const [stats, setStats] = useState({ failsCount: 0 });
    
    // UI states
    const [loading, setLoading] = useState(true);
    const [retrying, setRetrying] = useState(false);
    const [retryingIds, setRetryingIds] = useState(new Set());

    // Filter states
    const [companies, setCompanies] = useState([]);
    const [filters, setFilters] = useState({
        companyId: '',
        category: '',
        q: '',
        isProcessed: 'false',
    });
    
    // Pagination and Data state
    const [logs, setLogs] = useState([]);
    const [pagination, setPagination] = useState({
        currentPage: 1,
        pageSize: 20,
        totalCount: 0,
        totalPages: 1
    });

    // Initial load: stats and companies
    useEffect(() => {
        const init = async () => {
            try {
                const [statsData, companiesData] = await Promise.all([
                    getLogsStats(),
                    listCompaniesBasic()
                ]);
                setStats(statsData || { failsCount: 0 });
                setCompanies(companiesData || []);
            } catch {
                toast.error('Erreur lors du chargement initial.');
            }
        };
        init();
    }, []);

    // Fetch logs with current filters and pagination
    const fetchLogs = useCallback(async (page = 1) => {
        try {
            setLoading(true);
            const params = {
                page,
                pageSize: pagination.pageSize,
                ...filters,
                companyId: filters.companyId || undefined,
                isProcessed: filters.isProcessed === 'all' ? undefined : (filters.isProcessed === 'true')
            };
            
            const data = await listGlobalLogs(params);
            if (data) {
                setLogs(data.items || []);
                setPagination({
                    currentPage: data.page,
                    pageSize: data.pageSize,
                    totalCount: data.total,
                    totalPages: data.totalPages
                });

                // Update stats for current filters
                const statsData = await getLogsStats({
                    companyId: filters.companyId || undefined,
                    category: filters.category || undefined
                });
                setStats(statsData || { failsCount: 0 });
            }
        } catch {
            toast.error('Erreur lors du chargement des logs.');
        } finally {
            setLoading(false);
        }
    }, [filters, pagination.pageSize]);

    useEffect(() => {
        fetchLogs(1);
    }, [filters, fetchLogs]);

    const handleFilterChange = (e) => {
        const { name, value } = e.target;
        setFilters(prev => ({ ...prev, [name]: value }));
    };

    const handleRetryAllFiltered = async () => {
        const retryFilters = {
            companyId: filters.companyId || undefined,
            category: filters.category || undefined
        };

        try {
            setRetrying(true);
            const result = await retryAllFailedLogs(retryFilters);
            
            toast.success(result.message || 'Le traitement a été lancé en arrière-plan.');
            
            fetchLogs(1);
        } catch (e) {
            toast.error(e?.message || 'Erreur lors de la relance.');
        } finally {
            setRetrying(false);
        }
    };

    const handleRetrySingle = async (logId) => {
        try {
            setRetryingIds(prev => new Set(prev).add(logId));
            await retryLog(logId);
            toast.success('Log relancé avec succès.');
            fetchLogs(pagination.currentPage);
            // Refresh stats
            const statsData = await getLogsStats();
            setStats(statsData || { failsCount: 0 });
        } catch {
            toast.error('Erreur lors du retraitement.');
        } finally {
            setRetryingIds(prev => {
                const next = new Set(prev);
                next.delete(logId);
                return next;
            });
        }
    };

    const hasActiveFilters = useMemo(() => {
        return filters.companyId !== '' || filters.category !== '' || filters.q !== '';
    }, [filters]);

    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            {/* Header */}
            <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold text-white flex items-center gap-3">
                        <Activity className="text-brand-primary" />
                        Gestion des Logs Système
                    </h1>
                    <p className="text-cca-textSecondary mt-1">
                        Surveillez l'ingestion de données et relancez les traitements en échec.
                    </p>
                </div>
                <div className="flex items-center gap-3">
                    <div className="bg-cca-surface border border-cca-border rounded-lg px-4 py-2 flex items-center gap-4">
                        <div className="flex flex-col">
                            <span className="text-[10px] uppercase tracking-wider text-cca-textSecondary">Échecs totaux</span>
                            <span className="text-xl font-bold text-red-500">{stats.failsCount}</span>
                        </div>
                        <div className="w-px h-8 bg-cca-border" />
                        <button
                            onClick={() => fetchLogs(pagination.currentPage)}
                            className="p-2 rounded-md hover:bg-cca-base text-cca-textSecondary hover:text-white transition-colors"
                            title="Actualiser"
                        >
                            <RefreshCcw size={20} className={loading ? 'animate-spin' : ''} />
                        </button>
                    </div>
                </div>
            </header>

            {/* Filters Bar */}
            <div className="bg-cca-surface border border-cca-border rounded-xl p-4 shadow-sm flex flex-wrap items-center gap-4">
                <div className="flex-1 min-w-[200px] relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-cca-textSecondary" size={18} />
                    <input
                        type="text"
                        name="q"
                        value={filters.q}
                        onChange={handleFilterChange}
                        placeholder="Rechercher dans le message..."
                        className="w-full bg-cca-base border border-cca-border rounded-lg pl-10 pr-4 py-2 text-sm focus:border-brand-primary outline-none transition-colors"
                    />
                </div>

                <div className="flex items-center gap-2 min-w-[200px]">
                    <Building2 className="text-cca-textSecondary" size={18} />
                    <select
                        name="companyId"
                        value={filters.companyId}
                        onChange={handleFilterChange}
                        className="flex-1 bg-cca-base border border-cca-border rounded-lg px-3 py-2 text-sm focus:border-brand-primary outline-none"
                    >
                        <option value="">Toutes les entreprises</option>
                        {companies.map(c => (
                            <option key={c.id} value={c.id}>{c.name}</option>
                        ))}
                    </select>
                </div>

                <div className="flex items-center gap-2 min-w-[150px]">
                    <Activity className="text-cca-textSecondary" size={18} />
                    <input
                        type="text"
                        name="category"
                        value={filters.category}
                        onChange={handleFilterChange}
                        placeholder="Catégorie..."
                        className="flex-1 bg-cca-base border border-cca-border rounded-lg px-3 py-2 text-sm focus:border-brand-primary outline-none"
                    />
                </div>

                <select
                    name="isProcessed"
                    value={filters.isProcessed}
                    onChange={handleFilterChange}
                    className="bg-cca-base border border-cca-border rounded-lg px-3 py-2 text-sm focus:border-brand-primary outline-none"
                >
                    <option value="false">En échec</option>
                    <option value="true">Traités</option>
                    <option value="all">Tous</option>
                </select>

                <button
                    onClick={handleRetryAllFiltered}
                    disabled={retrying || (stats.failsCount === 0 && filters.isProcessed === 'false')}
                    className={`
                        ml-auto px-4 py-2 rounded-lg font-bold flex items-center gap-2 transition-all
                        ${retrying ? 'bg-slate-700' : 'bg-brand-primary hover:bg-brand-hover'}
                        text-white text-sm
                    `}
                >
                    {retrying ? <Spinner size={16} /> : <Play size={16} />}
                    {hasActiveFilters ? 'Relancer filtrés' : 'Tout relancer'}
                </button>
            </div>

            {/* Logs Table */}
            <div className="bg-cca-surface border border-cca-border rounded-xl shadow-xl overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-cca-base border-b border-cca-border">
                                <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wider text-cca-textSecondary">Date</th>
                                <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wider text-cca-textSecondary">Entreprise</th>
                                <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wider text-cca-textSecondary">Catégorie</th>
                                <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wider text-cca-textSecondary">Message</th>
                                <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wider text-cca-textSecondary text-center">Status</th>
                                <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wider text-cca-textSecondary text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-cca-border">
                            {loading && logs.length === 0 ? (
                                <tr>
                                    <td colSpan="6" className="px-6 py-12 text-center text-cca-textSecondary">
                                        <Spinner size={32} className="mx-auto block mb-4" />
                                        Chargement des logs...
                                    </td>
                                </tr>
                            ) : logs.length === 0 ? (
                                <tr>
                                    <td colSpan="6" className="px-6 py-12 text-center text-cca-textSecondary italic">
                                        Aucun log trouvé pour ces critères.
                                    </td>
                                </tr>
                            ) : (
                                logs.map((log) => (
                                    <tr key={log.id} className="hover:bg-cca-base/50 transition-colors group">
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-cca-textSecondary">
                                            {format(new Date(log.createdAt), 'dd/MM HH:mm:ss', { locale: fr })}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <span className="text-sm font-medium text-white">{log.company?.name || 'Inconnue'}</span>
                                            <span className="block text-[10px] text-cca-textSecondary">ID: {log.companyId}</span>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <span className="px-2 py-1 rounded bg-cca-base border border-cca-border text-[10px] font-bold uppercase text-brand-primary">
                                                {log.category}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="max-w-md">
                                                <p className="text-sm text-white line-clamp-1 group-hover:line-clamp-none transition-all duration-300">
                                                    {log.message || log.text || 'Sans message'}
                                                </p>
                                                {!log.isProcessed && log.processingError && (
                                                    <p className="text-xs text-red-400 mt-1 italic flex items-start gap-1">
                                                        <AlertCircle size={12} className="mt-0.5 flex-shrink-0" />
                                                        {log.processingError}
                                                    </p>
                                                )}
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-center">
                                            {log.isProcessed ? (
                                                <CheckCircle2 className="text-green-500 mx-auto" size={18} />
                                            ) : (
                                                <AlertCircle className="text-red-500 mx-auto" size={18} />
                                            )}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-right">
                                            {!log.isProcessed && (
                                                <button
                                                    onClick={() => handleRetrySingle(log.id)}
                                                    disabled={retryingIds.has(log.id)}
                                                    className="p-2 rounded-lg bg-brand-primary/10 text-brand-primary hover:bg-brand-primary hover:text-white transition-all overflow-hidden relative"
                                                    title="Relancer"
                                                >
                                                    {retryingIds.has(log.id) ? (
                                                        <Spinner size={16} />
                                                    ) : (
                                                        <Play size={16} fill="currentColor" />
                                                    )}
                                                </button>
                                            )}
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>

                {/* Pagination */}
                <div className="bg-cca-base px-6 py-4 flex items-center justify-between border-t border-cca-border">
                    <div className="text-sm text-cca-textSecondary">
                        Affichage de <span className="font-medium text-white">{logs.length}</span> sur <span className="font-medium text-white">{pagination.totalCount}</span> logs
                    </div>
                    <div className="flex items-center gap-2">
                        <button
                            onClick={() => fetchLogs(pagination.currentPage - 1)}
                            disabled={pagination.currentPage <= 1 || loading}
                            className="p-2 rounded-lg border border-cca-border hover:bg-cca-surface disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                        >
                            <ChevronLeft size={20} />
                        </button>
                        <span className="text-sm text-cca-textSecondary">
                            Page <span className="font-medium text-white">{pagination.currentPage}</span> sur {pagination.totalPages}
                        </span>
                        <button
                            onClick={() => fetchLogs(pagination.currentPage + 1)}
                            disabled={pagination.currentPage >= pagination.totalPages || loading}
                            className="p-2 rounded-lg border border-cca-border hover:bg-cca-surface disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                        >
                            <ChevronRight size={20} />
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default AdminLogsPage;
