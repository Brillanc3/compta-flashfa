// frontend/src/components/admin/company/CompanyUsersTable.jsx
import React, { useState } from 'react';
import PropTypes from 'prop-types';
import { AlertTriangle, Search } from 'lucide-react';

// Tooltip simple pour les avertissements
const Tooltip = ({ message, children }) => (
    <div className="relative flex items-center group">
        {children}
        <div className="absolute bottom-full mb-2 w-max px-2 py-1 bg-slate-900 text-white text-xs rounded-md opacity-0 group-hover:opacity-100 transition-opacity">
            {message}
        </div>
    </div>
);

const CompanyUsersTable = ({ employees }) => {
    const [searchTerm, setSearchTerm] = useState('');

    const filteredEmployees = employees.filter(emp =>
        emp.user.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        emp.user.username.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const getWarning = (user) => {
        if (!user.discordId) return "ID Discord manquant";
        if (!user.characterId) return "N° de personnage manquant";
        return null;
    };

    return (
        <div className="bg-slate-800 p-4 rounded-lg shadow-md">
            <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-semibold text-white">Employés</h3>
                <div className="relative">
                    <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                        type="text"
                        placeholder="Rechercher un employé..."
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
                        <th scope="col" className="px-6 py-3">Nom</th>
                        <th scope="col" className="px-6 py-3">Statut</th>
                        <th scope="col" className="px-6 py-3">Alertes</th>
                    </tr>
                    </thead>
                    <tbody>
                    {filteredEmployees.map(emp => {
                        const warning = getWarning(emp.user);
                        return (
                            <tr key={emp.id} className="border-b border-slate-700 hover:bg-slate-700/50">
                                <td className="px-6 py-4 font-medium text-white">{emp.user.name} ({emp.user.username})</td>
                                <td className="px-6 py-4">{emp.user.status}</td>
                                <td className="px-6 py-4">
                                    {warning && (
                                        <Tooltip message={warning}>
                                            <AlertTriangle size={18} className="text-yellow-400" />
                                        </Tooltip>
                                    )}
                                </td>
                            </tr>
                        );
                    })}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

CompanyUsersTable.propTypes = {
    employees: PropTypes.array.isRequired,
};

export default CompanyUsersTable;