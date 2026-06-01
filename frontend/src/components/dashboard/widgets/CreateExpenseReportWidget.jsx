// /frontend/src/components/dashboard/widgets/CreateExpenseReportWidget.jsx
import React, { useState, useEffect } from 'react';
import { useCompany } from '@/contexts/CompanyContext';
import { getExpenseReportCategories, createExpenseReport } from '@/services/comptabiliteService';
import toast from 'react-hot-toast';
import Spinner from '@/components/ui/Spinner';

const CreateExpenseReportWidget = () => {
    const { selectedCompany } = useCompany();
    const [categories, setCategories] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isSubmitting, setIsSubmitting] = useState(false);

    // États du formulaire
    const [categoryId, setCategoryId] = useState('');
    const [amount, setAmount] = useState('');
    const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
    const [comment, setComment] = useState('');

    useEffect(() => {
        if (selectedCompany) {
            getExpenseReportCategories(selectedCompany.id)
                .then(setCategories)
                .catch(() => toast.error("Impossible de charger les catégories."))
                .finally(() => setIsLoading(false));
        }
    }, [selectedCompany]);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setIsSubmitting(true);
        try {
            await createExpenseReport(selectedCompany.id, { categoryId, amount, date, comment });
            toast.success("Note de frais soumise avec succès !");
            // Réinitialiser le formulaire
            setCategoryId('');
            setAmount('');
            setComment('');
        } catch (error) {
            toast.error(error.message || "Erreur lors de la soumission.");
        } finally {
            setIsSubmitting(false);
        }
    };

    if (isLoading) {
        return <div className="flex justify-center items-center h-full"><Spinner /></div>;
    }

    return (
        <form onSubmit={handleSubmit} className="flex flex-col h-full">
            <h3 className="font-black text-sm uppercase tracking-widest text-cca-textPrimary mb-4 opacity-80">Nouvelle Note de Frais</h3>
            
            <div className="space-y-3 flex-grow min-h-0">
                <div>
                    <select 
                        value={categoryId} 
                        onChange={(e) => setCategoryId(e.target.value)} 
                        required 
                        className="w-full bg-cca-base/40 border border-cca-border/20 p-2 rounded-lg text-xs text-cca-textPrimary outline-none focus:ring-1 focus:ring-brand-primary transition-all"
                    >
                        <option value="" disabled className="bg-cca-surface">-- Catégorie --</option>
                        {categories.map(cat => <option key={cat.id} value={cat.id} className="bg-cca-surface">{cat.name}</option>)}
                    </select>
                </div>
                
                <div className="flex gap-2">
                    <input 
                        type="number" 
                        value={amount} 
                        onChange={(e) => setAmount(e.target.value)} 
                        placeholder="Montant ($)" 
                        required 
                        className="w-1/2 bg-cca-base/40 border border-cca-border/20 p-2 rounded-lg text-xs text-cca-textPrimary outline-none focus:ring-1 focus:ring-brand-primary transition-all" 
                    />
                    <input 
                        type="date" 
                        value={date} 
                        onChange={(e) => setDate(e.target.value)} 
                        required 
                        className="w-1/2 bg-cca-base/40 border border-cca-border/20 p-2 rounded-lg text-xs text-cca-textPrimary outline-none focus:ring-1 focus:ring-brand-primary transition-all" 
                    />
                </div>
                
                <div>
                    <textarea 
                        value={comment} 
                        onChange={(e) => setComment(e.target.value)} 
                        placeholder="Détails de la dépense..." 
                        required 
                        className="w-full bg-cca-base/40 border border-cca-border/20 p-2 rounded-lg text-xs text-cca-textPrimary outline-none focus:ring-1 focus:ring-brand-primary transition-all resize-none" 
                        rows="3"
                    ></textarea>
                </div>
            </div>

            <button 
                type="submit" 
                disabled={isSubmitting} 
                className="w-full mt-4 bg-brand-primary hover:bg-brand-primary/80 text-white font-black text-xs uppercase tracking-widest py-3 px-4 rounded-lg shadow-lg shadow-brand-primary/20 transition-all active:scale-95 disabled:opacity-50 disabled:grayscale disabled:cursor-not-allowed"
            >
                {isSubmitting ? "TRANSMISSION..." : "SOUMETTRE"}
            </button>
        </form>
    );
};

export default CreateExpenseReportWidget;