// frontend/src/components/admin/company/CompanyModulesManager.jsx
import React, { useState, useEffect } from 'react';
import PropTypes from 'prop-types';

const CompanyModulesManager = ({ company, allModules, onSave }) => {
    const [selectedModuleIds, setSelectedModuleIds] = useState(new Set());
    const [isSubmitting, setIsSubmitting] = useState(false);

    useEffect(() => {
        if (company.activeModules) {
            setSelectedModuleIds(new Set(company.activeModules.map(m => m.moduleId)));
        }
    }, [company.activeModules]);



    const handleToggle = (moduleId) => {
        setSelectedModuleIds(prev => {
            const newSet = new Set(prev);
            if (newSet.has(moduleId)) {
                newSet.delete(moduleId);
            } else {
                newSet.add(moduleId);
            }
            return newSet;
        });
    };

    const handleSave = async () => {
        setIsSubmitting(true);
        await onSave({ moduleIds: selectedModuleIds });
        setIsSubmitting(false);
    };

    return (
        <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
                {allModules.map(module => (
                    <label key={module.id} className="flex items-center space-x-3 bg-slate-700 p-3 rounded-md">
                        <input
                            type="checkbox"
                            checked={selectedModuleIds.has(module.id)}
                            onChange={() => handleToggle(module.id)}
                            className="h-4 w-4 rounded border-slate-500 text-indigo-600 focus:ring-indigo-500"
                        />
                        <span className="text-white font-medium">{module.name}</span>
                    </label>
                ))}
            </div>
            <div className="text-right">
                <button onClick={handleSave} disabled={isSubmitting} className="py-2 px-4 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-md disabled:opacity-50">
                    {isSubmitting ? "Sauvegarde..." : "Enregistrer les modules"}
                </button>
            </div>
        </div>
    );
};

CompanyModulesManager.propTypes = {
    company: PropTypes.object.isRequired,
    allModules: PropTypes.array.isRequired,
    onSave: PropTypes.func.isRequired,
};

export default CompanyModulesManager;