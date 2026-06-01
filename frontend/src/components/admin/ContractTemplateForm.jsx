// frontend/src/components/admin/ContractTemplateForm.jsx
// Je préfère que la première ligne d'un fichier soit la route du fichier.

import React, { useState, useCallback } from 'react';
import TemplateFieldManager from './TemplateFieldManager';
import { createContractTemplate } from '@/services/contractService';
import toast from 'react-hot-toast';
import { Save, ClipboardList, Type as TypeIcon } from 'lucide-react';

const ContractTemplateForm = ({ onTemplateCreated, initialData }) => {
    const [title, setTitle] = useState(initialData?.title || '');
    const [content, setContent] = useState(initialData?.content || '## Contrat Standard\n\nContenu légal...');
    const [type, setType] = useState(initialData?.type || 'ADMIN');
    const [fields, setFields] = useState(initialData?.fields || []);
    const [isLoading, setIsLoading] = useState(false);

    // Fonction pour insérer la balise à la position du curseur dans le contenu
    const handleInsertTag = useCallback((tag) => {
        setContent(prevContent => prevContent + ` ${tag} `); // Simplification: ajoute à la fin pour un simple textarea
        // Dans une implémentation réelle avec un éditeur Rich Text, il faudrait manipuler le DOM/état de l'éditeur.
        toast.success(`Balise ${tag} ajoutée au contenu. (Vérifier le placement dans un éditeur complet)`);
    }, []);

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!title || !content || fields.length === 0) {
            toast.error("Veuillez remplir le titre, le contenu et définir au moins un champ variable.");
            return;
        }

        setIsLoading(true);
        try {
            const templateData = {
                title,
                content,
                type,
                fields,
            };
            const newTemplate = await createContractTemplate(templateData);
            toast.success("Template de contrat créé avec succès !");
            onTemplateCreated(newTemplate); // Appelle le parent pour rafraîchir la liste

            // Réinitialisation optionnelle
            setTitle('');
            setContent('## Contrat Standard\n\n');
            setFields([]);

        } catch (error) {
            toast.error(error.message || "Erreur lors de la création du template.");
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <form onSubmit={handleSubmit} className="space-y-6">
            {/* Infos de base */}
            <div className="grid grid-cols-2 gap-4">
                <div>
                    <label className="block text-sm font-medium text-slate-300">Titre du Template</label>
                    <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Contrat Premium 2025" className="w-full p-2 bg-slate-700 border border-slate-600 rounded-md text-white mt-1"/>
                </div>
                <div>
                    <label className="block text-sm font-medium text-slate-300">Type de Template</label>
                    <select value={type} onChange={(e) => setType(e.target.value)} className="w-full p-2 bg-slate-700 border border-slate-600 rounded-md text-white mt-1">
                        <option value="ADMIN">ADMIN (Utilisation globale/onboarding)</option>
                        <option value="COMPANY">COMPANY (Contrat interne/employé)</option>
                        <option value="LAWYER" disabled>LAWYER (Pour futur rôle)</option>
                    </select>
                </div>
            </div>

            {/* Gestion des Champs Variables */}
            <TemplateFieldManager fields={fields} setFields={setFields} onInsertTag={handleInsertTag} />

            {/* Contenu Rich Text (Simulé avec TextArea) */}
            <div>
                <label className="block text-sm font-medium text-slate-300 mb-1 flex items-center"><ClipboardList size={16} className="mr-2"/> Contenu du Contrat (Markdown supporté)</label>
                <textarea
                    value={content}
                    onChange={(e) => setContent(e.target.value)}
                    rows="15"
                    placeholder="Collez le texte légal ici et insérez les balises depuis la section Champs Variables..."
                    className="w-full p-3 bg-slate-700 border border-slate-600 rounded-md text-white font-mono text-sm resize-y"
                />
                <p className="text-xs text-slate-400 mt-1">Utilisez l'option "Insérer" ci-dessus pour ajouter des champs dynamiques.</p>
            </div>

            {/* Bouton de soumission */}
            <button
                type="submit"
                disabled={isLoading}
                className="w-full flex items-center justify-center py-3 px-4 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-md disabled:bg-slate-600 transition-colors"
            >
                {isLoading ? 'Sauvegarde...' : <><Save size={20} className="mr-2" /> Créer le Template de Contrat</>}
            </button>
        </form>
    );
};

export default ContractTemplateForm;