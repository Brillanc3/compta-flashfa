// frontend/src/components/accounting/BillViewerModal.jsx
import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import Modal from '../Modal';
import Spinner from '../ui/Spinner';
import toast from 'react-hot-toast';
import { getBillDetails } from '@/services/billService';
import BillCommentsSection from './BillCommentsSection';

const BillViewerModal = ({ billId, companyId, onClose }) => {
    const [bill, setBill] = useState(null);
    const [isLoading, setIsLoading] = useState(false);

    useEffect(() => {
        // ✅ Ne bloque pas le chargement sur companyId :
        // la route n'a pas forcément :companyId dans l'URL (ex: /dashboard/company/journal)
        if (!billId) return;

        setIsLoading(true);
        setBill(null);

        getBillDetails(companyId, billId)
            .then((data) => {
                setBill(data);
            })
            .catch(() => {
                toast.error("Impossible de charger les détails de la facture.");
                onClose();
            })
            .finally(() => {
                setIsLoading(false);
            });
    }, [billId, companyId, onClose]);

    const statusMapping = {
        UNPAID: { text: "Non payée", color: "text-amber-500 bg-amber-500/10 border-amber-500/20" },
        PAID_CASH: { text: "Payée (Espèces)", color: "text-emerald-500 bg-emerald-500/10 border-emerald-500/20" },
        PAID_CARD: { text: "Payée (Carte)", color: "text-emerald-500 bg-emerald-500/10 border-emerald-500/20" },
        CANCELED: { text: "Annulée", color: "text-red-500 bg-red-500/10 border-red-500/20" },
    };

    return (
        <Modal
            isOpen={!!billId}
            onClose={onClose}
            title={bill ? `Facture #${bill.externalBillId}` : "Chargement..."}
        >
            {isLoading && (
                <div className="flex flex-col items-center justify-center p-12 gap-4">
                    <Spinner size="lg" />
                    <p className="text-sm font-bold text-cca-textSecondary animate-pulse">Récupération des détails...</p>
                </div>
            )}

            {bill && !isLoading && (
                <div className="text-cca-textSecondary space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-4">
                            <div>
                                <label className="text-[10px] font-bold uppercase tracking-wider text-cca-textSecondary/50 block mb-1">Raison</label>
                                <p className="text-sm text-cca-textPrimary font-semibold leading-relaxed">{bill.reason}</p>
                            </div>
                            
                            <div>
                                <label className="text-[10px] font-bold uppercase tracking-wider text-cca-textSecondary/50 block mb-1">Montant Total</label>
                                <p className="text-2xl font-black font-heading text-cca-textPrimary tracking-tight">
                                    {parseFloat(bill.amount).toFixed(0)}
                                    <span className="text-sm text-brand-primary ml-1">$</span>
                                </p>
                            </div>
                        </div>

                        <div className="space-y-4">
                            <div>
                                <label className="text-[10px] font-bold uppercase tracking-wider text-cca-textSecondary/50 block mb-1">Statut</label>
                                <span className={`inline-flex items-center px-3 py-1 rounded-xl text-xs font-bold border ${statusMapping[bill.status]?.color || "text-cca-textSecondary bg-cca-base border-cca-border"}`}>
                                    {statusMapping[bill.status]?.text || bill.status}
                                </span>
                            </div>

                            <div>
                                <label className="text-[10px] font-bold uppercase tracking-wider text-cca-textSecondary/50 block mb-1">Date d'émission</label>
                                <p className="text-sm text-cca-textPrimary font-semibold">{new Date(bill.date).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
                            </div>
                        </div>
                    </div>

                    <div className="border-t border-cca-border pt-6 grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="p-4 rounded-2xl bg-cca-base/50 border border-cca-border">
                            <label className="text-[10px] font-bold uppercase tracking-wider text-cca-textSecondary/50 block mb-2">Émission</label>
                            <p className="text-xs font-bold text-cca-textPrimary mb-1">De: <span className="font-normal text-cca-textSecondary">{bill.issuerName}</span></p>
                            <p className="text-xs font-bold text-cca-textPrimary">Par: <span className="font-normal text-cca-textSecondary">{bill.author?.name || 'N/A'}</span></p>
                        </div>

                        <div className="p-4 rounded-2xl bg-cca-base/50 border border-cca-border">
                            <label className="text-[10px] font-bold uppercase tracking-wider text-cca-textSecondary/50 block mb-2">Destinataire</label>
                            <p className="text-xs font-bold text-cca-textPrimary mb-1">À: <span className="font-normal text-cca-textSecondary">{bill.recipientName}</span></p>
                            {bill.client && (
                                <div className="flex items-center gap-2 mt-2 pt-2 border-t border-cca-border/50">
                                    <div className="w-1.5 h-1.5 rounded-full bg-brand-primary shadow-[0_0_8px_rgba(var(--brand-primary-rgb),0.5)]" />
                                    <Link
                                        to={`/dashboard/company/clients/${bill.clientId}`}
                                        className="text-xs font-bold text-brand-primary hover:text-brand-dark transition-colors"
                                        onClick={onClose}
                                    >
                                        Voir la fiche client : {bill.client.name}
                                    </Link>
                                </div>
                            )}
                        </div>
                    </div>

                    <BillCommentsSection billId={bill.id} />

                    {bill.hostedSite && (
                        <div className="mt-4 p-3 bg-slate-800 border border-slate-700 rounded-lg">
                            <p className="text-xs font-medium text-slate-400 mb-1">Site hébergé associé</p>
                            <div className="flex items-center gap-3">
                                <span className="text-sm text-white">{bill.hostedSite.name}</span>
                                <code className="text-xs text-indigo-400">{bill.hostedSite.slug}</code>
                                {bill.hostedSite.isPublished && (
                                    <a
                                        href={`/p/${bill.hostedSite.slug}`}
                                        target="_blank"
                                        rel="noreferrer"
                                        className="text-xs text-indigo-400 hover:underline"
                                    >
                                        Voir le site ↗
                                    </a>
                                )}
                            </div>
                        </div>
                    )}
                </div>
            )}
        </Modal>
    );
};

export default BillViewerModal;
