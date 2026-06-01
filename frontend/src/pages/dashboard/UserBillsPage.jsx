import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { getMyBills } from '@/services/userService';
import Spinner from '@/components/ui/Spinner';
import Pagination from '@/components/ui/Pagination';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { motion } from 'framer-motion';

const pageVariants = {
    hidden: { opacity: 0 },
    visible: { opacity: 1, transition: { staggerChildren: 0.1 } }
};

const cardVariants = {
    hidden: { y: 20, opacity: 0 },
    visible: { y: 0, opacity: 1, transition: { type: 'spring', stiffness: 100 } }
};

const statusMapping = {
    UNPAID: { text: "Non payée", color: "bg-yellow-500/20 text-yellow-400 border border-yellow-500/30" },
    PAID_CASH: { text: "Payée (Espèces)", color: "bg-green-500/20 text-green-400 border border-green-500/30" },
    PAID_CARD: { text: "Payée (Carte)", color: "bg-green-500/20 text-green-400 border border-green-500/30" },
    CANCELED: { text: "Annulée", color: "bg-red-500/20 text-red-400 border border-red-500/30" },
};

export default function UserBillsPage() {
    const [bills, setBills] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    const [pagination, setPagination] = useState({
        totalCount: 0,
        totalPages: 1,
        currentPage: 1,
        limit: 15
    });

    const [filters, setFilters] = useState({
        page: 1,
        limit: 15,
        status: "",
        billId: "",
        startDate: "",
        endDate: "",
        reason: ""
    });

    const fetchBills = useCallback(async () => {
        try {
            setLoading(true);
            setError(null);
            const res = await getMyBills(filters);
            setBills(res.data || []);
            setPagination(res.pagination || {
                totalCount: 0,
                totalPages: 1,
                currentPage: filters.page,
                limit: filters.limit
            });
        } catch (err) {
            setError(err.message || 'Erreur lors du chargement de vos factures.');
        } finally {
            setLoading(false);
        }
    }, [filters]);

    useEffect(() => {
        fetchBills();
    }, [fetchBills]);

    const handleFilterChange = (e) => {
        const { name, value } = e.target;
        setFilters(prev => ({ ...prev, [name]: value, page: 1 }));
    };

    const handlePageChange = (newPage) => {
        setFilters(prev => ({ ...prev, page: newPage }));
    };

    return (
        <motion.div
            className="space-y-6"
            initial="hidden"
            animate="visible"
            variants={pageVariants}
        >
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-cca-textPrimary tracking-tight">Mes factures</h1>
                    <p className="text-cca-textSecondary text-sm mt-1">Consultez l'historique de vos factures liées à votre identité.</p>
                </div>
            </div>

            <motion.div variants={cardVariants} className="bg-cca-surface/50 backdrop-blur-md rounded-2xl border border-cca-border p-5 shadow-xl">
                <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4">
                    <div className="space-y-1.5">
                        <label className="text-xs font-medium text-cca-textSecondary ml-1">Numéro facture</label>
                        <input
                            type="text"
                            name="billId"
                            value={filters.billId}
                            onChange={handleFilterChange}
                            placeholder="Ex: 12345"
                            className="w-full bg-cca-base border border-cca-border rounded-xl px-4 py-2.5 text-sm text-cca-textPrimary placeholder:text-cca-textSecondary/50 focus:outline-none focus:ring-2 focus:ring-brand-primary/50 focus:border-brand-primary transition-all"
                        />
                    </div>
                    <div className="space-y-1.5">
                        <label className="text-xs font-medium text-cca-textSecondary ml-1">Raison</label>
                        <input
                            type="text"
                            name="reason"
                            value={filters.reason}
                            onChange={handleFilterChange}
                            placeholder="Mot-clé..."
                            className="w-full bg-cca-base border border-cca-border rounded-xl px-4 py-2.5 text-sm text-cca-textPrimary placeholder:text-cca-textSecondary/50 focus:outline-none focus:ring-2 focus:ring-brand-primary/50 focus:border-brand-primary transition-all"
                        />
                    </div>
                    <div className="space-y-1.5">
                        <label className="text-xs font-medium text-cca-textSecondary ml-1">Statut</label>
                        <select
                            name="status"
                            value={filters.status}
                            onChange={handleFilterChange}
                            className="w-full bg-cca-base border border-cca-border rounded-xl px-4 py-2.5 text-sm text-cca-textPrimary focus:outline-none focus:ring-2 focus:ring-brand-primary/50 focus:border-brand-primary transition-all appearance-none"
                        >
                            <option value="">Tous les statuts</option>
                            <option value="UNPAID">Non payée</option>
                            <option value="PAID_CASH">Payée (Espèces)</option>
                            <option value="PAID_CARD">Payée (Carte)</option>
                            <option value="CANCELED">Annulée</option>
                        </select>
                    </div>
                    <div className="space-y-1.5">
                        <label className="text-xs font-medium text-cca-textSecondary ml-1">Date de début</label>
                        <input
                            type="date"
                            name="startDate"
                            value={filters.startDate}
                            onChange={handleFilterChange}
                            className="w-full bg-cca-base border border-cca-border rounded-xl px-4 py-2.5 text-sm text-cca-textPrimary focus:outline-none focus:ring-2 focus:ring-brand-primary/50 focus:border-brand-primary transition-all"
                        />
                    </div>
                    <div className="space-y-1.5">
                        <label className="text-xs font-medium text-cca-textSecondary ml-1">Date de fin</label>
                        <input
                            type="date"
                            name="endDate"
                            value={filters.endDate}
                            onChange={handleFilterChange}
                            className="w-full bg-cca-base border border-cca-border rounded-xl px-4 py-2.5 text-sm text-cca-textPrimary focus:outline-none focus:ring-2 focus:ring-brand-primary/50 focus:border-brand-primary transition-all"
                        />
                    </div>
                </div>
            </motion.div>

            <motion.div variants={cardVariants} className="bg-cca-surface/50 backdrop-blur-md rounded-2xl border border-cca-border shadow-xl overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-cca-base/50 border-b border-cca-border text-xs font-medium text-cca-textSecondary uppercase tracking-wider">
                                <th className="px-6 py-4">Facture</th>
                                <th className="px-6 py-4">Entreprise</th>
                                <th className="px-6 py-4">Raison</th>
                                <th className="px-6 py-4">Date</th>
                                <th className="px-6 py-4 text-right">Montant</th>
                                <th className="px-6 py-4 text-center">Statut</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-cca-border/50">
                            {loading ? (
                                <tr>
                                    <td colSpan="6" className="px-6 py-12 text-center">
                                        <Spinner />
                                    </td>
                                </tr>
                            ) : error ? (
                                <tr>
                                    <td colSpan="6" className="px-6 py-8 text-center text-red-400">
                                        {error}
                                    </td>
                                </tr>
                            ) : bills.length === 0 ? (
                                <tr>
                                    <td colSpan="6" className="px-6 py-12 text-center text-cca-textSecondary">
                                        Aucune facture trouvée.
                                    </td>
                                </tr>
                            ) : (
                                bills.map((bill) => (
                                    <tr key={bill.id} className="hover:bg-cca-surface/30 transition-colors group">
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <div className="flex flex-col">
                                                <span className="text-sm font-medium text-cca-textPrimary group-hover:text-brand-primary transition-colors">#{bill.externalBillId}</span>
                                                <span className="text-xs text-cca-textSecondary/60">ID Interne: {bill.id}</span>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <span className="text-sm text-cca-textSecondary font-medium">
                                                {bill.company?.name || bill.issuerName || "—"}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="text-sm text-cca-textSecondary max-w-[250px] truncate" title={bill.reason}>
                                                {bill.reason}
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-cca-textSecondary">
                                            {format(new Date(bill.date), 'dd/MM/yyyy HH:mm', { locale: fr })}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm font-mono text-right text-cca-textPrimary">
                                            {new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'USD' }).format(Number(bill.amount))}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-center">
                                            <span className={`px-3 py-1 text-xs font-medium rounded-full ${statusMapping[bill.status]?.color || 'bg-cca-surface/20 text-cca-textSecondary'}`}>
                                                {statusMapping[bill.status]?.text || bill.status}
                                            </span>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
                {!loading && bills.length > 0 && (
                    <div className="p-4 border-t border-cca-border bg-cca-base/30">
                        <Pagination
                            currentPage={pagination.currentPage}
                            totalPages={pagination.totalPages}
                            onPageChange={handlePageChange}
                        />
                    </div>
                )}
            </motion.div>
        </motion.div>
    );
}
