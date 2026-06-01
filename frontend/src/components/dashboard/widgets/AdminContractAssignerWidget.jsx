// frontend/src/components/dashboard/widgets/AdminContractAssignerWidget.jsx
import React, { useState } from 'react';
import { AssignContractModal } from '@/components/admin/AssignContractModal';
import { FilePlus } from 'lucide-react';

const AdminContractAssignerWidget = () => {
    const [isModalOpen, setIsModalOpen] = useState(false);

    return (
        <>
            {/* La modale est maintenant contrôlée par ce widget */}
            <AssignContractModal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
            />

            <div className="h-full flex flex-col items-center justify-center p-6 text-center">
                <div className="w-16 h-16 rounded-3xl bg-brand-primary/10 flex items-center justify-center text-brand-primary mb-6 shadow-2xl shadow-brand-primary/10">
                    <FilePlus size={32} />
                </div>
                
                <h3 className="font-black text-sm uppercase tracking-widest text-cca-textPrimary mb-2 opacity-80">Assignation de Contrat</h3>
                <p className="text-xs text-cca-textSecondary/60 leading-relaxed mb-8 max-w-[200px]">
                    Initiez le processus d'enrôlement et d'assignation contractuelle.
                </p>

                <button
                    onClick={() => setIsModalOpen(true)}
                    className="w-full flex items-center justify-center py-3 px-6 bg-brand-primary hover:bg-brand-primary/80 text-white font-black text-xs uppercase tracking-widest rounded-xl transition-all shadow-xl shadow-brand-primary/20 active:scale-95 group"
                >
                    <FilePlus size={16} className="mr-2 group-hover:rotate-12 transition-transform" />
                    Nouvelle Assignation
                </button>
            </div>
        </>
    );
};

export default AdminContractAssignerWidget;