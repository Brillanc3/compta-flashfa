// frontend/src/components/widgets/MyServiceWidget.jsx
import React, { useState, useEffect } from 'react';
import { useCompany } from '@/contexts/CompanyContext';
import { api } from '@/services/api';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { CheckCircle2, TrendingUp } from 'lucide-react';

export default function MyServiceWidget({ className = '' }) {
    const { activeCompanyId } = useCompany();
    const [services, setServices] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        if (!activeCompanyId) {
            setIsLoading(false);
            return;
        }

        const fetchServices = async () => {
            setIsLoading(true);
            setError(null);
            try {
                const res = await api.get('/partenariat/widgets/my_services');
                setServices(Array.isArray(res.data) ? res.data : []);
            } catch (err) {
                console.error(err);
                setError("Impossible de charger les services rendus.");
            } finally {
                setIsLoading(false);
            }
        };

        fetchServices();
    }, [activeCompanyId]);

    const renderContent = () => {
        if (!activeCompanyId) {
            return <div className="p-10 text-center text-cca-textSecondary/60 italic uppercase tracking-widest text-[10px]">Sélectionnez une entreprise</div>;
        }
        if (isLoading) {
            return <div className="p-10 text-center text-cca-textSecondary/60 italic uppercase tracking-widest text-[10px]">Chargement...</div>;
        }
        if (error) {
            return <div className="p-4 text-center text-rose-400 text-xs font-bold bg-rose-400/10 rounded-lg">{error}</div>;
        }
        if (services.length === 0) {
            return <div className="text-[10px] font-black uppercase text-cca-textSecondary/30 italic text-center py-6">Aucun service rendu récent</div>;
        }

        return (
            <ul className="space-y-2">
                {services.map(srv => (
                    <li key={srv.id} className="p-3 border border-cca-border/10 bg-cca-base/20 rounded-xl hover:bg-cca-surface/10 transition-colors group flex justify-between items-center">
                        <div className="min-w-0 flex-1 mr-4">
                            <div className="text-xs font-black text-cca-textPrimary group-hover:text-brand-primary transition-colors truncate flex items-center gap-1.5">
                                <CheckCircle2 className="w-3 h-3 text-emerald-500" />
                                {srv.service}
                            </div>
                            <div className="text-[9px] font-bold text-cca-textSecondary/60 mt-0.5 uppercase tracking-tighter">
                                {srv.partner} • {format(new Date(srv.createdAt), 'd MMM yyyy', { locale: fr })}
                            </div>
                        </div>
                        <div className="flex flex-col items-end flex-shrink-0">
                            <span className="text-xs font-black text-emerald-400 flex items-center gap-1">
                                {srv.quantity} UNITÉS
                            </span>
                            <span className="text-[9px] font-bold text-cca-textSecondary/50 mt-0.5">
                                {srv.pricePerUnit} $ / u
                            </span>
                        </div>
                    </li>
                ))}
            </ul>
        );
    };

    return (
        <div className={`h-full flex flex-col ${className}`}>
            <div className="flex items-center gap-2 mb-4 border-b border-cca-border/20 pb-4 flex-shrink-0">
                <TrendingUp className="w-4 h-4 text-brand-primary opacity-80" />
                <h3 className="text-[10px] font-black uppercase tracking-[0.3em] text-cca-textSecondary/40">
                    Mes Services Rendus
                </h3>
            </div>
            <div className="overflow-y-auto flex-grow pb-2 custom-scrollbar">
                {renderContent()}
            </div>
        </div>
    );
}
