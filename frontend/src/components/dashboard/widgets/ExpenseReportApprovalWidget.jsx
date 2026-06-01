// frontend/src/components/dashboard/widgets/ExpenseReportApprovalWidget.jsx

import React, { useState, useEffect, useCallback } from 'react';
import { useCompany } from '@/contexts/CompanyContext.jsx';
import { getExpenseReports, reviewExpenseReport } from '@/services/expenseReportService.js';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import toast from 'react-hot-toast';

import { Eye, Check, X } from 'lucide-react';
import Modal from '../../Modal'; // On réutilise votre composant de modale existant

const ExpenseReportApprovalWidget = ({ config }) => {
    const { selectedCompany } = useCompany();
    const [pendingReports, setPendingReports] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState(null);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [selectedReport, setSelectedReport] = useState(null);

    // On utilise la configuration du widget pour la limite, avec une valeur par défaut
    const limit = config?.limit || 5;

    const fetchPendingReports = useCallback(async () => {
        if (!selectedCompany?.id) return;
        setIsLoading(true);
        setError(null);
        try {
            const allReports = await getExpenseReports(selectedCompany.id);
            const pending = allReports.filter(report => report.status === 'PENDING').slice(0, limit);
            setPendingReports(pending);
        } catch (err) {
            setError("Impossible de charger les notes de frais.");
            console.error(err);
        } finally {
            setIsLoading(false);
        }
    }, [selectedCompany, limit]);

    useEffect(() => {
        fetchPendingReports();
    }, [fetchPendingReports]);

    const handleReview = async (reportId, status) => {
        const promise = reviewExpenseReport(selectedCompany.id, reportId, status);
        toast.promise(promise, {
            loading: 'Mise à jour du statut...',
            success: () => {
                // On rafraîchit la liste après la mise à jour
                fetchPendingReports();
                return `Note de frais ${status === 'REIMBURSED' ? 'approuvée' : 'refusée'}.`;
            },
            error: 'Une erreur est survenue.',
        });
    };

    const openDetailsModal = (report) => {
        setSelectedReport(report);
        setIsModalOpen(true);
    };

    const renderContent = () => {
        if (isLoading) {
            return <p className="text-center text-xs text-cca-textSecondary/40 italic py-8">Audience en cours…</p>;
        }
        if (error) {
            return <p className="text-center text-xs text-rose-400 py-8 font-bold uppercase tracking-widest">{error}</p>;
        }
        if (pendingReports.length === 0) {
            return <p className="text-center text-xs text-cca-textSecondary/40 py-8 italic uppercase tracking-widest opacity-30">Registre vierge</p>;
        }

        return (
            <ul className="space-y-3">
                {pendingReports.map(report => (
                    <li key={report.id} className="flex justify-between items-center bg-cca-base/40 border border-cca-border/50 p-4 rounded-2xl transition-all hover:bg-cca-surface/30">
                        <div className="flex-1 min-w-0">
                            <p className="font-black text-cca-textPrimary truncate tracking-tight text-sm uppercase">{report.author.name}</p>
                            <div className="flex items-center gap-3 mt-1">
                                <p className="text-xs font-mono font-black text-emerald-400">{report.amount} $</p>
                                <span className="w-1 h-1 rounded-full bg-cca-textSecondary/20"></span>
                                <p className="text-[10px] font-bold text-cca-textSecondary/60 uppercase tracking-tighter">
                                    {format(new Date(report.date), 'dd MMM yyyy', { locale: fr })}
                                </p>
                            </div>
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0 ml-4">
                            <button 
                                onClick={() => openDetailsModal(report)} 
                                className="p-2.5 rounded-xl bg-cca-surface/40 border border-cca-border text-cca-textSecondary hover:text-cca-textPrimary transition-all active:scale-90"
                                title="Voir audit complet"
                            >
                                <Eye size={16} />
                            </button>
                            <button 
                                onClick={() => handleReview(report.id, 'REIMBURSED')} 
                                className="p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-500 hover:bg-emerald-500 hover:text-white transition-all active:scale-90"
                                title="Approuver transfert"
                            >
                                <Check size={16} />
                            </button>
                            <button 
                                onClick={() => handleReview(report.id, 'REJECTED')} 
                                className="p-2.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-500 hover:bg-rose-500 hover:text-white transition-all active:scale-90"
                                title="Révoquer demande"
                            >
                                <X size={16} />
                            </button>
                        </div>
                    </li>
                ))}
            </ul>
        );
    };

    return (
        <>
            <Modal premium isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={`Audit de note : ${selectedReport?.author.name || ''}`}>
                <div className="text-cca-textPrimary space-y-6 p-1">
                    <div className="grid grid-cols-2 gap-4">
                        <div className="p-4 rounded-2xl bg-cca-base/40 border border-cca-border/50">
                             <p className="text-[10px] font-black uppercase tracking-[0.2em] text-cca-textSecondary/40 mb-1">Indemnité</p>
                             <p className="text-xl font-mono font-black text-emerald-400">{selectedReport?.amount} $</p>
                        </div>
                        <div className="p-4 rounded-2xl bg-cca-base/40 border border-cca-border/50">
                             <p className="text-[10px] font-black uppercase tracking-[0.2em] text-cca-textSecondary/40 mb-1">Date</p>
                             <p className="text-sm font-bold">{selectedReport && format(new Date(selectedReport.date), 'dd MMMM yyyy', { locale: fr })}</p>
                        </div>
                    </div>
                    <div>
                        <p className="text-[10px] font-black uppercase tracking-[0.2em] text-cca-textSecondary/40 mb-2 ml-1">Justification Circonstanciée</p>
                        <p className="p-5 bg-cca-base/40 border border-cca-border/50 rounded-2xl text-xs leading-relaxed italic text-cca-textSecondary">"{selectedReport?.comment}"</p>
                    </div>
                </div>
            </Modal>

            <div className="h-full flex flex-col min-h-0">
                <h3 className="text-[10px] font-black uppercase tracking-[0.3em] text-cca-textSecondary/40 mb-6 border-b border-cca-border/20 pb-4 flex-shrink-0">
                    Registre des Remboursements
                </h3>
                <div className="overflow-y-auto flex-grow pr-1 glass-scroll min-h-0">
                    {renderContent()}
                </div>
            </div>
        </>
    );
};

export default ExpenseReportApprovalWidget;