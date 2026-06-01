// frontend/src/components/admin/AssignContractModal.jsx
import React, { useState, useEffect, useMemo } from 'react'; // Ajout de useMemo
import PropTypes from 'prop-types';
import Select from 'react-select';
import toast from 'react-hot-toast';
import Modal from '../Modal';
import CustomLoader from '../ui/CustomLoader';
import { getContractTemplates, getContractTemplateById, assignContract } from '@/services/contractService';
import { getAssignableUsers } from '@/services/userService';
import ReactMarkdown from 'react-markdown';

// ... (Les sous-composants et styles restent inchangés)
const selectStyles = {
    control: (styles) => ({ ...styles, backgroundColor: '#1f2937', borderColor: '#4b5563' }),
    menu: (styles) => ({ ...styles, backgroundColor: '#1f2937' }),
    option: (styles, { isFocused, isSelected }) => ({
        ...styles,
        backgroundColor: isSelected ? '#4f46e5' : isFocused ? '#374151' : null,
        color: '#d1d5db',
    }),
    singleValue: (styles) => ({ ...styles, color: '#d1d5db' }),
};

const DynamicFormField = ({ field, value, onChange }) => {
    const handleChange = (e) => {
        onChange(field.key, e.target.value);
    };

    return (
        <div className="mb-4">
            <label htmlFor={field.key} className="block text-sm font-medium text-slate-300 mb-1">{field.label}</label>
            <input
                type={field.fieldType.toLowerCase()}
                id={field.key}
                name={field.key}
                value={value || ''}
                onChange={handleChange}
                className="w-full p-2 bg-slate-800 border border-slate-600 rounded-md text-white focus:ring-2 focus:ring-indigo-500 outline-none"
                required
            />
        </div>
    );
};


export const AssignContractModal = ({ isOpen, onClose }) => {
    const [templates, setTemplates] = useState([]);
    const [users, setUsers] = useState([]);
    const [selectedTemplateId, setSelectedTemplateId] = useState(null);
    const [selectedUserId, setSelectedUserId] = useState(null);
    const [templateDetails, setTemplateDetails] = useState(null);
    const [fieldValues, setFieldValues] = useState({});
    const [createCompany, setCreateCompany] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);

    // ... (les useEffect restent inchangés)
    useEffect(() => {
        if (isOpen) {
            const loadInitialData = async () => {
                setIsLoading(true);
                try {
                    const [templatesData, usersData] = await Promise.all([
                        getContractTemplates(),
                        getAssignableUsers(),
                    ]);
                    setTemplates(templatesData.map(t => ({ value: t.id, label: t.title })));
                    setUsers(usersData.map(u => ({ value: u.id, label: `${u.name} (${u.username})` })));
                } catch (_error) {
                    toast.error("Erreur de chargement des données initiales.");
                    onClose();
                } finally {
                    setIsLoading(false);
                }
            };
            loadInitialData();
        } else {
            setSelectedTemplateId(null);
            setSelectedUserId(null);
            setTemplateDetails(null);
            setFieldValues({});
            setCreateCompany(false);
        }
    }, [isOpen, onClose]);

    useEffect(() => {
        if (selectedTemplateId) {
            const loadTemplateDetails = async () => {
                setIsLoading(true);
                setFieldValues({}); // Reset field values when template changes
                try {
                    const details = await getContractTemplateById(selectedTemplateId);
                    setTemplateDetails(details);
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

    // --- NOUVELLE LOGIQUE POUR LA PRÉVISUALISATION DYNAMIQUE ---
    const previewContent = useMemo(() => {
        if (!templateDetails?.content) return '';

        let content = templateDetails.content;
        // On boucle sur les champs définis pour remplacer les placeholders
        templateDetails.fields.forEach(field => {
            const value = fieldValues[field.key] || '';
            const regex = new RegExp(`{{${field.key}}}`, 'g');
            // On remplace par la valeur si elle existe, sinon par une chaîne vide pour ne pas afficher le placeholder
            content = content.replace(regex, value);
        });
        return content;
    }, [templateDetails, fieldValues]);


    const handleFieldChange = (key, value) => {
        setFieldValues(prev => ({ ...prev, [key]: value }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setIsSubmitting(true);
        try {
            await assignContract({
                templateId: selectedTemplateId,
                assignedToUserId: selectedUserId,
                fieldValues,
                createCompanyOnSignature: createCompany,
            });
            toast.success("Contrat assigné avec succès !");
            onClose();
        } catch (error) {
            toast.error(error.message || "Erreur lors de l'assignation du contrat.");
        } finally {
            setIsSubmitting(false);
        }
    };

    const isAssignable = selectedTemplateId && selectedUserId;

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Assigner un Nouveau Contrat" disableOverlayClose={true}>
            {isLoading && <CustomLoader text="Chargement..." />}

            {!isLoading && (
                <form onSubmit={handleSubmit} className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-slate-300 mb-1">Modèle de contrat</label>
                            <Select options={templates} styles={selectStyles} onChange={(opt) => setSelectedTemplateId(opt.value)} placeholder="Choisir un modèle..." />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-300 mb-1">Assigner à l'utilisateur</label>
                            <Select options={users} styles={selectStyles} onChange={(opt) => setSelectedUserId(opt.value)} placeholder="Choisir un utilisateur..." />
                        </div>
                    </div>

                    {templateDetails && (
                        <div className="border-t border-slate-700 pt-4">
                            <h3 className="font-semibold text-white mb-2">Aperçu et Champs du Contrat</h3>
                            <div className="prose prose-sm prose-invert max-w-none bg-slate-800 p-4 rounded-md h-48 overflow-y-auto mb-4">
                                {/* MODIFIÉ : On utilise notre contenu dynamique */}
                                <ReactMarkdown>{previewContent}</ReactMarkdown>
                            </div>

                            {templateDetails.fields.map(field => (
                                <DynamicFormField key={field.id} field={field} value={fieldValues[field.key]} onChange={handleFieldChange} />
                            ))}
                        </div>
                    )}

                    <div className="flex items-center space-x-3 bg-slate-800 p-3 rounded-md">
                        <input
                            type="checkbox"
                            id="createCompany"
                            checked={createCompany}
                            onChange={(e) => setCreateCompany(e.target.checked)}
                            className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                        />
                        <label htmlFor="createCompany" className="text-sm text-slate-300">
                            Créer une nouvelle entreprise lors de la signature de ce contrat
                        </label>
                    </div>

                    <div className="flex justify-end space-x-3 pt-4 border-t border-slate-700">
                        <button type="button" onClick={onClose} className="py-2 px-4 bg-slate-600 hover:bg-slate-700 text-white font-semibold rounded-md transition-colors" disabled={isSubmitting}>
                            Annuler
                        </button>
                        <button type="submit" disabled={!isAssignable || isSubmitting} className="py-2 px-4 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
                            {isSubmitting ? "Assignation en cours..." : "Assigner le Contrat"}
                        </button>
                    </div>
                </form>
            )}
        </Modal>
    );
};

AssignContractModal.propTypes = {
    isOpen: PropTypes.bool.isRequired,
    onClose: PropTypes.func.isRequired,
};