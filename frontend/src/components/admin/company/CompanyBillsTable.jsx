// frontend/src/components/admin/company/CompanyBillsTable.jsx
import React, { useState } from 'react';
import PropTypes from 'prop-types';
import { Search } from 'lucide-react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

const CompanyBillsTable = ({ bills }) => {
    const [searchTerm, setSearchTerm] = useState('');

    const filteredBills = bills.filter(bill =>
        bill.reason.toLowerCase().includes(searchTerm.toLowerCase()) ||
        bill.recipientName.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <div className="bg-slate-800 p-4 rounded-lg shadow-md">
            <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-semibold text-white">Factures Récentes</h3>
                <div className="relative">
                    <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                        type="text"
                        placeholder="Rechercher une facture..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="bg-slate-700 border border-slate-600 rounded-md pl-10 pr-4 py-2 text-sm text-white"
                    />
                </div>
            </div>
            <div className="overflow-x-auto">
                <table className="w-full text-sm text-left text-slate-300">
                    <thead className="text-xs text-slate-400 uppercase bg-slate-700">
                    <tr>
                        <th scope="col" className="px-6 py-3">Date</th>
                        <th scope="col" className="px-6 py-3">Raison</th>
                        <th scope="col" className="px-6 py-3">Montant</th>
                        <th scope="col" className="px-6 py-3">Statut</th>
                    </tr>
                    </thead>
                    <tbody>
                    {filteredBills.map(bill => (
                        <tr key={bill.id} className="border-b border-slate-700 hover:bg-slate-700/50">
                            <td className="px-6 py-4">{format(new Date(bill.date), 'd MMM yyyy', { locale: fr })}</td>
                            <td className="px-6 py-4 font-medium text-white">{bill.reason}</td>
                            <td className="px-6 py-4">{parseFloat(bill.amount).toLocaleString('fr-FR', { style: 'currency', currency: 'USD' })}</td>
                            <td className="px-6 py-4">{bill.status}</td>
                        </tr>
                    ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

CompanyBillsTable.propTypes = {
    bills: PropTypes.array.isRequired,
};

export default CompanyBillsTable;