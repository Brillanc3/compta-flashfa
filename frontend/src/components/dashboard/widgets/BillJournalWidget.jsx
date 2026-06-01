// frontend/src/components/dashboard/widgets/BillJournalWidget.jsx

import React, { useState, useEffect, useCallback } from 'react';
import PropTypes from 'prop-types';
import { useCompany } from '@/contexts/CompanyContext.jsx';
import useWebSocketListener from '@/hooks/useWebSocketListener';
import { getBills } from '@/services/billService.js';
import Spinner from '../../ui/Spinner';

// Hook simple pour "débattre" la saisie (attendre que l'utilisateur finisse de taper)
const useDebounce = (value, delay) => {
    const [debouncedValue, setDebouncedValue] = useState(value);
    useEffect(() => {
        const handler = setTimeout(() => {
            setDebouncedValue(value);
        }, delay);
        return () => {
            clearTimeout(handler);
        };
    }, [value, delay]);
    return debouncedValue;
};

const StatusBadge = ({ status }) => {
    const statusStyles = {
        UNPAID: 'bg-amber-500/10 text-amber-500 border-amber-500/20',
        PAID_CASH: 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20',
        PAID_CARD: 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20',
        CANCELED: 'bg-cca-base/40 text-cca-textSecondary border-cca-border/20',
    };
    return (
        <span className={`px-2 py-0.5 inline-flex text-[10px] leading-4 font-bold rounded-full border ${statusStyles[status] || 'bg-cca-base/20 text-cca-textSecondary border-cca-border/10'}`}>
            {status.replace('_', ' ')}
        </span>
    );
};

const BillJournalWidget = ({ config }) => {
    const { activeCompany } = useCompany();
    const [bills, setBills] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [searchTerm, setSearchTerm] = useState('');

    // On utilise le hook de debounce pour ne pas surcharger l'API à chaque frappe
    const debouncedSearchTerm = useDebounce(searchTerm, 500);

    const fetchData = useCallback(async () => {
        if (!activeCompany) return;
        setLoading(true);
        try {
            const response = await getBills(activeCompany.id, {
                limit: 5,
                search: debouncedSearchTerm,
                sortBy: 'date',
                sortOrder: 'desc',
                config: config
            });
            setBills(response.data);
        } catch {
            setError("Erreur de chargement.");
        } finally {
            setLoading(false);
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [activeCompany, debouncedSearchTerm]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    // --- Logique WebSocket pour les mises à jour en temps réel ---
    const handleBillCreated = useCallback((payload) => {
        if (payload?.companyId !== activeCompany?.id) return;
        // toast.success("Nouvelle facture !");
        // On rafraîchit la liste pour être sûr d'avoir les 5 dernières
        fetchData();
    }, [fetchData, activeCompany]);

    const handleBillUpdated = useCallback((payload) => {
        if (payload?.bill?.companyId !== activeCompany?.id) return;
        // toast.success(`Facture #${payload.bill.externalBillId} mise à jour.`);
        setBills(prev => prev.map(bill => bill.id === payload.bill.id ? payload.bill : bill));
    }, [activeCompany]);

    useWebSocketListener('BILL_CREATED', handleBillCreated);
    useWebSocketListener('BILL_UPDATED', handleBillUpdated);


    const renderContent = () => {
        if (loading) return <div className="flex justify-center items-center h-full"><Spinner /></div>;
        if (error) return <p className="text-center text-rose-400">{error}</p>;
        if (bills.length === 0) return <p className="text-center text-cca-textSecondary/60 py-10 italic">Aucune facture trouvée.</p>;

        return (
            <ul className="space-y-3 overflow-y-auto h-full pr-2">
                {bills.map(bill => (
                    <li key={bill.id} className="text-sm">
                        <div className="flex justify-between items-start">
                            <p className="font-bold text-cca-textPrimary break-all">{bill.reason}</p>
                            <span className="font-black text-brand-primary whitespace-nowrap ml-4">
                                 {parseFloat(bill.amount).toLocaleString('fr-FR', { style: 'currency', currency: 'USD' })}
                             </span>
                        </div>
                        <div className="flex justify-between items-center text-[10px] text-cca-textSecondary/60 mt-1 uppercase tracking-tight">
                            <span>{bill.recipientName}</span>
                            <StatusBadge status={bill.status} />
                        </div>
                    </li>
                ))}
            </ul>
        );
    };

    return (
        <div className="h-full flex flex-col">
            <h3 className="font-black text-cca-textPrimary text-sm uppercase tracking-widest mb-4 flex-shrink-0 opacity-80">Factures Récentes</h3>
            <div className="mb-4 flex-shrink-0">
                <input
                    type="text"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder="Rechercher une facture..."
                    className="w-full bg-cca-base/40 border border-cca-border/30 p-2 rounded-lg text-xs text-cca-textPrimary placeholder:text-cca-textSecondary/40 focus:ring-1 focus:ring-brand-primary/50 outline-none transition-all"
                />
            </div>
            <div className="flex-grow min-h-0">
                {renderContent()}
            </div>
        </div>
    );
};

BillJournalWidget.propTypes = { config: PropTypes.object };

export default BillJournalWidget;