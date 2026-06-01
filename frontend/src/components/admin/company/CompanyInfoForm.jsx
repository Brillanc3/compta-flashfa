// frontend/src/components/admin/company/CompanyInfoForm.jsx
import React, { useState, useEffect } from 'react';
import PropTypes from 'prop-types';

const CompanyInfoForm = ({ company, onSave }) => {
    const [name, setName] = useState(company.name);
    const [accountingPrice, setAccountingPrice] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);

    useEffect(() => {
        // Synchroniser l'état local si l'objet company change
        setName(company.name);
        setAccountingPrice(company.accountingPrice || '');
    }, [company]);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setIsSubmitting(true);
        // On passe les données au composant parent pour qu'il gère la sauvegarde
        await onSave({ name, accountingPrice: parseFloat(accountingPrice) || 0 });
        setIsSubmitting(false);
    };

    return (
        <form onSubmit={handleSubmit} className="space-y-4">
            <div>
                <label htmlFor="company-name" className="block text-sm font-medium text-slate-300">Nom de l'entreprise</label>
                <input type="text" id="company-name" value={name} onChange={(e) => setName(e.target.value)} className="mt-1 w-full bg-slate-700 border-slate-600 rounded-md py-2 px-3 text-white" />
            </div>
            <div>
                <label htmlFor="accounting-price" className="block text-sm font-medium text-slate-300">Prix de la comptabilité ($)</label>
                <input type="number" step="0.01" id="accounting-price" value={accountingPrice} onChange={(e) => setAccountingPrice(e.target.value)} className="mt-1 w-full bg-slate-700 border-slate-600 rounded-md py-2 px-3 text-white" />
            </div>
            <div className="text-right">
                <button type="submit" disabled={isSubmitting} className="py-2 px-4 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-md disabled:opacity-50">
                    {isSubmitting ? "Sauvegarde..." : "Enregistrer"}
                </button>
            </div>
        </form>
    );
};

CompanyInfoForm.propTypes = {
    company: PropTypes.object.isRequired,
    onSave: PropTypes.func.isRequired,
};

export default CompanyInfoForm;