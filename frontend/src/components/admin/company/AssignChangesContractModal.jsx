// frontend/src/components/admin/company/AssignChangesContractModal.jsx
import React, { useState, useEffect } from 'react';
import PropTypes from 'prop-types';
import Select from 'react-select';
import toast from 'react-hot-toast';
import Modal from '../../Modal';
import CustomLoader from '../../ui/CustomLoader';
import { getContractTemplates, getContractTemplateById, assignContract } from '@/services/contractService';

const selectStyles = {
    control: (styles) => ({ ...styles, backgroundColor: '#1f2937', borderColor: '#4b5563' }),
    menu: (styles) => ({ ...styles, backgroundColor: '#1f2937' }),
    option: (styles, { isFocused, isSelected }) => ({ ...styles, backgroundColor: isSelected ? '#4f46e5' : isFocused ? '#374151' : null, color: '#d1d5db' }),
    singleValue: (styles) => ({ ...styles, color: '#d1d5db' }),
};

// Helper pour générer les options de mappage
const getMappingOptions = (field, pendingChanges, company) => {
    const options = [{ value: 'none', label: 'Néant' }];

    // Logique pour le prix
    if (field.fieldType === 'PRICE' || field.key.toLowerCase().includes('price')) {
        if (pendingChanges?.accountingPrice !== undefined) {
            options.push({ value: 'pending_price', label: `Prix en attente (${pendingChanges.accountingPrice}$)` });
        }
        options.push({ value: 'current_price', label: `Prix actuel (${company.accountingPrice}$)` });
    }

    // Logique pour les modules
    if (field.fieldType === 'MODULE_SELECTION' || field.key.toLowerCase().includes('module')) {
        if (pendingChanges?.modules) {
            options.push({ value: 'modules_summary', label: 'Résumé des changements de modules' });
        }
        options.push({ value: 'modules_current', label: 'Liste des modules actuels' });
    }

    // Logique pour le nom de l'entreprise
    if (field.key.toLowerCase().includes('name') || field.key.toLowerCase().includes('client')) {
        if (pendingChanges?.name) {
            options.push({ value: 'pending_name', label: `Nom en attente (${pendingChanges.name})` });
        }
        options.push({ value: 'current_name', label: `Nom actuel (${company.name})` });
    }

    // Logique pour la date
    if (field.fieldType === 'DATE' || field.key.toLowerCase().includes('date')) {
        options.push({ value: 'current_date', label: 'Date du jour' });
    }

    // Possibilité d'ajouter une valeur personnalisée
    options.push({ value: 'custom', label: 'Valeur personnalisée...' });

    return options;
};

export const AssignChangesContractModal = ({ isOpen, onClose, manager, pendingChanges, company }) => {
    const [adminTemplates, setAdminTemplates] = useState([]);
    const [selectedTemplateId, setSelectedTemplateId] = useState(null);
    const [templateDetails, setTemplateDetails] = useState(null);
    const [mappings, setMappings] = useState({});
    const [customValues, setCustomValues] = useState({});
    const [isLoading, setIsLoading] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);

    useEffect(() => {
        if (isOpen) {
            const loadAdminTemplates = async () => {
                setIsLoading(true);
                try {
                    const allTemplates = await getContractTemplates();
                    const adminTpls = allTemplates.filter(t => t.type === 'ADMIN').map(t => ({ value: t.id, label: t.title }));
                    setAdminTemplates(adminTpls);
                    if (adminTpls.length === 0) toast.error("Aucun modèle de contrat 'ADMIN' trouvé.", { duration: 5000 });
                } catch (_error) {
                    toast.error("Erreur de chargement des modèles de contrat.");
                } finally {
                    setIsLoading(false);
                }
            };
            loadAdminTemplates();
        } else {
            // Reset state on close
            setSelectedTemplateId(null);
            setTemplateDetails(null);
            setMappings({});
            setCustomValues({});
        }
    }, [isOpen]);

    useEffect(() => {
        if (selectedTemplateId) {
            const loadTemplateDetails = async () => {
                setIsLoading(true);
                try {
                    const details = await getContractTemplateById(selectedTemplateId);
                    setTemplateDetails(details);
                    // Initialiser les mappages à 'Néant'
                    const initialMappings = {};
                    details.fields.forEach(field => {
                        initialMappings[field.key] = 'none';
                    });
                    setMappings(initialMappings);
                } catch (_error) {
                    toast.error("Impossible de charger les détails du contrat.");
                } finally {
                    setIsLoading(false);
                }
            };
            loadTemplateDetails();
        } else {
            setTemplateDetails(null);
        }
    }, [selectedTemplateId]);

    const handleMappingChange = (fieldKey, selectedValue) => {
        setMappings(prev => ({ ...prev, [fieldKey]: selectedValue }));
    };

    const handleCustomValueChange = (fieldKey, value) => {
        setCustomValues(prev => ({ ...prev, [fieldKey]: value }));
    };

    const buildFieldValues = () => {
        const finalValues = {};
        if (!templateDetails) return finalValues;

        for (const field of templateDetails.fields) {
            const key = field.key;
            const source = mappings[key];
            let value = '';

            switch (source) {
                case 'pending_price': value = pendingChanges.accountingPrice; break;
                case 'current_price': value = company.accountingPrice; break;
                case 'modules_summary': {
                    const added = pendingChanges.modules.add ? `Ajoutés: ${pendingChanges.modules.add.join(', ')}` : '';
                    const removed = pendingChanges.modules.remove ? `Retirés: ${pendingChanges.modules.remove.join(', ')}` : '';
                    value = [added, removed].filter(Boolean).join('; ');
                    break;
                }
                case 'modules_current': value = company.activeModules.map(m => m.module.name).join(', '); break;
                case 'pending_name': value = pendingChanges.name; break;
                case 'current_name': value = company.name; break;
                case 'current_date': value = new Date().toLocaleDateString('fr-FR'); break;
                case 'custom': value = customValues[key] || ''; break;
                case 'none':
                default: value = 'Néant'; break;
            }
            finalValues[key] = value;
        }
        return finalValues;
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setIsSubmitting(true);
        try {
            const fieldValues = buildFieldValues();
            console.log("MANAGER ->", manager);
            await assignContract({
                templateId: selectedTemplateId,
                assignedToUserId: manager.id,
                fieldValues,
                modifiesCompanyId: company.id,
            });
            toast.success("Contrat assigné au gérant avec succès !");
            onClose();
        } catch (error) {
            toast.error(error.message || "Erreur lors de l'assignation du contrat.");
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title={`Assigner un contrat pour "${company.name}"`}>
            {isLoading && <CustomLoader />}
            {!isLoading && (
                <form onSubmit={handleSubmit} className="space-y-6">
                    <div>
                        <p className="text-slate-300 mb-2">Assignation du contrat à : <strong className="text-white">{manager?.name}</strong></p>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-slate-300 mb-1">Modèle de contrat (Type ADMIN)</label>
                        <Select options={adminTemplates} styles={selectStyles} onChange={(opt) => setSelectedTemplateId(opt.value)} placeholder="Choisir un modèle..." isDisabled={adminTemplates.length === 0} />
                    </div>

                    {templateDetails && (
                        <div className="space-y-4 border-t border-slate-700 pt-4">
                            <h3 className="font-semibold text-white">Mappage des champs du contrat</h3>
                            {templateDetails.fields.map(field => (
                                <div key={field.id} className="grid grid-cols-2 gap-4 items-center">
                                    <label className="text-sm font-medium text-slate-300">{field.label}</label>
                                    <div>
                                        <Select
                                            options={getMappingOptions(field, pendingChanges, company)}
                                            styles={selectStyles}
                                            value={getMappingOptions(field, pendingChanges, company).find(o => o.value === mappings[field.key])}
                                            onChange={(opt) => handleMappingChange(field.key, opt.value)}
                                        />
                                        {mappings[field.key] === 'custom' && (
                                            <input
                                                type="text"
                                                placeholder="Entrez une valeur personnalisée"
                                                className="mt-2 w-full p-2 bg-slate-800 border border-slate-600 rounded-md text-white"
                                                onChange={(e) => handleCustomValueChange(field.key, e.target.value)}
                                            />
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}

                    <div className="flex justify-end space-x-3 pt-4 border-t border-slate-700">
                        <button type="button" onClick={onClose} className="py-2 px-4 bg-slate-600 hover:bg-slate-700 text-white rounded-md" disabled={isSubmitting}>Annuler</button>
                        <button type="submit" disabled={!selectedTemplateId || isSubmitting} className="py-2 px-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-md disabled:opacity-50">
                            {isSubmitting ? "Assignation..." : "Assigner le Contrat"}
                        </button>
                    </div>
                </form>
            )}
        </Modal>
    );
};

AssignChangesContractModal.propTypes = {
    isOpen: PropTypes.bool.isRequired,
    onClose: PropTypes.func.isRequired,
    manager: PropTypes.object,
    pendingChanges: PropTypes.object,
    company: PropTypes.object.isRequired,
};