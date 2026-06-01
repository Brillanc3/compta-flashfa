import React, { useState } from 'react';
import { useTheme } from '@/providers/ThemeProvider';

export default function DevPage() {
  const { theme, setTheme } = useTheme();

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);

  const [editableData, setEditableData] = useState([
    { id: 1, name: 'Harry Finch', role: 'Directeur', status: 'Actif' },
    { id: 2, name: 'John Doe', role: 'Comptable', status: 'En congé' },
    { id: 3, name: 'Jane Smith', role: 'Assistant', status: 'Actif' },
  ]);

  const handleEdit = (id, field, value) => {
    setEditableData(prev => prev.map(row => 
      row.id === id ? { ...row, [field]: value } : row
    ));
  };

  return (
    <div className="min-h-screen bg-cca-base p-8 transition-colors duration-500">
      <div className="max-w-6xl mx-auto space-y-8">
        
        {/* Header Theme Switcher */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center bg-cca-surface p-6 rounded-lg shadow-sm border border-cca-border transition-all duration-300 hover:shadow-md animate-in fade-in slide-in-from-bottom-4 duration-500 fill-mode-both gap-4 md:gap-0">
          <div>
            <h1 className="text-3xl font-heading font-bold text-cca-textPrimary">Test du Système de Thème</h1>
            <p className="text-cca-textSecondary mt-2">Valider la typographie (Montserrat & Inter) et les couleurs.</p>
          </div>
          <div className="flex bg-cca-base rounded-lg p-1 border border-cca-border shrink-0">
            <button
              onClick={() => setTheme('light')}
              className={`px-4 py-2 rounded-md font-medium transition-all duration-300 active:scale-95 ${
                theme === 'light' 
                  ? 'bg-brand-primary text-white shadow-sm' 
                  : 'text-cca-textSecondary hover:text-cca-textPrimary hover:bg-cca-surface'
              }`}
            >
              Clair
            </button>
            <button
              onClick={() => setTheme('dark')}
              className={`px-4 py-2 rounded-md font-medium transition-all duration-300 active:scale-95 ${
                theme === 'dark' 
                  ? 'bg-brand-primary text-white shadow-sm' 
                  : 'text-cca-textSecondary hover:text-cca-textPrimary hover:bg-cca-surface'
              }`}
            >
              Sombre
            </button>
          </div>
        </div>

        {/* Brand Colors Grid */}
        <div className="bg-cca-surface p-6 rounded-lg shadow-sm border border-cca-border space-y-4 group hover:shadow-md transition-all duration-300 hover:border-brand-primary/30 animate-in fade-in slide-in-from-bottom-4 fill-mode-both duration-500 delay-75">
          <h2 className="text-xl font-heading font-semibold text-cca-textPrimary">Couleurs Principales (Marque CCA)</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="flex items-center space-x-4 p-4 rounded-lg bg-cca-base border border-cca-border hover:border-brand-light transition-all duration-300 hover:-translate-y-1 hover:shadow-sm">
              <div className="w-12 h-12 rounded-full bg-brand-light shadow-inner"></div>
              <div>
                <p className="font-semibold text-cca-textPrimary">Brand Light</p>
                <p className="text-sm text-cca-textSecondary">--brand-light</p>
              </div>
            </div>
            <div className="flex items-center space-x-4 p-4 rounded-lg bg-cca-base border border-cca-border hover:border-brand-primary transition-all duration-300 hover:-translate-y-1 hover:shadow-sm">
              <div className="w-12 h-12 rounded-full bg-brand-primary shadow-inner"></div>
              <div>
                <p className="font-semibold text-cca-textPrimary">Brand Primary</p>
                <p className="text-sm text-cca-textSecondary">--brand-primary</p>
              </div>
            </div>
            <div className="flex items-center space-x-4 p-4 rounded-lg bg-cca-base border border-cca-border hover:border-brand-dark transition-all duration-300 hover:-translate-y-1 hover:shadow-sm">
              <div className="w-12 h-12 rounded-full bg-brand-dark shadow-inner"></div>
              <div>
                <p className="font-semibold text-cca-textPrimary">Brand Dark</p>
                <p className="text-sm text-cca-textSecondary">--brand-dark</p>
              </div>
            </div>
          </div>
        </div>

        {/* Typography Testing */}
        <div className="bg-cca-surface p-6 rounded-lg shadow-sm border border-cca-border space-y-6 hover:shadow-md transition-all duration-300 hover:border-brand-primary/30 animate-in fade-in slide-in-from-bottom-4 fill-mode-both duration-500 delay-150">
          <h2 className="text-xl font-heading font-semibold text-cca-textPrimary">Typographie</h2>
          
          <div className="space-y-4 p-4 rounded-lg bg-cca-base border border-cca-border transition-colors hover:bg-cca-base/80">
            <div>
              <p className="text-xs text-cca-textSecondary mb-1 font-mono">Heading 1 - Montserrat Bold</p>
              <h1 className="text-4xl font-heading font-bold text-cca-textPrimary transition-transform origin-left hover:scale-[1.01] duration-300">L'Évolutivité comme Maître Mot</h1>
            </div>
            <div>
              <p className="text-xs text-cca-textSecondary mb-1 font-mono">Heading 2 - Montserrat SemiBold</p>
              <h2 className="text-2xl font-heading font-semibold text-cca-textPrimary transition-transform origin-left hover:scale-[1.01] duration-300">Transparence et Rigueur</h2>
            </div>
            <div>
              <p className="text-xs text-cca-textSecondary mb-1 font-mono">Heading 3 - Montserrat Medium</p>
              <h3 className="text-lg font-heading font-medium text-cca-textPrimary transition-transform origin-left hover:scale-[1.01] duration-300">Modernité Financière</h3>
            </div>
          </div>

          <div className="space-y-4 p-4 rounded-lg bg-cca-base border border-cca-border transition-colors hover:bg-cca-base/80">
            <div>
              <p className="text-xs text-cca-textSecondary mb-1 font-mono">Paragraph - Inter Regular</p>
              <p className="text-base text-cca-textPrimary">
                Le système doit conserver le choix de l'utilisateur via localStorage et modifier l'attribut data-theme 
                sur l'élément racine. Notre objectif est de proposer un rendu clair, précis et agréable pour l'analyse des flux financiers.
              </p>
            </div>
            <div>
              <p className="text-xs text-cca-textSecondary mb-1 font-mono">Paragraph - Inter Medium (Secondary Text)</p>
              <p className="text-sm font-medium text-cca-textSecondary">
                Compatibilité garantie avec Google Chrome 103 minimum. Utilisable sur smartphone, tablette et TV.
              </p>
            </div>
          </div>
        </div>

        {/* Tableau Simple */}
        <div className="bg-cca-surface p-6 rounded-lg shadow-sm border border-cca-border space-y-4 group hover:shadow-md hover:border-brand-primary/30 transition-all duration-300 animate-in fade-in slide-in-from-bottom-4 fill-mode-both duration-500 delay-200">
          <h2 className="text-xl font-heading font-semibold text-cca-textPrimary">Tableau Simple</h2>
          <div className="overflow-x-auto border border-cca-border rounded-md transition-shadow group-hover:shadow-sm">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-cca-base border-b border-cca-border">
                  <th className="p-3 font-semibold text-cca-textSecondary text-sm uppercase tracking-wider">ID</th>
                  <th className="p-3 font-semibold text-cca-textSecondary text-sm uppercase tracking-wider">Date</th>
                  <th className="p-3 font-semibold text-cca-textSecondary text-sm uppercase tracking-wider">Description</th>
                  <th className="p-3 font-semibold text-cca-textSecondary text-sm uppercase tracking-wider text-right">Montant</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-b border-cca-border hover:bg-cca-surface hover:pl-4 focus-within:bg-cca-surface focus-within:pl-4 transition-all duration-200 cursor-default">
                  <td className="p-3 text-cca-textPrimary font-medium">#1023</td>
                  <td className="p-3 text-cca-textSecondary text-sm">07/04/2026</td>
                  <td className="p-3 text-cca-textPrimary">Consultation Financière</td>
                  <td className="p-3 text-cca-textPrimary font-medium text-right">1 200,00 $</td>
                </tr>
                <tr className="border-b border-cca-border hover:bg-cca-surface hover:pl-4 focus-within:bg-cca-surface focus-within:pl-4 transition-all duration-200 cursor-default">
                  <td className="p-3 text-cca-textPrimary font-medium">#1024</td>
                  <td className="p-3 text-cca-textSecondary text-sm">08/04/2026</td>
                  <td className="p-3 text-cca-textPrimary">Audit de sécurité</td>
                  <td className="p-3 text-cca-textPrimary font-medium text-right">850,00 $</td>
                </tr>
                <tr className="hover:bg-cca-surface hover:pl-4 focus-within:bg-cca-surface focus-within:pl-4 transition-all duration-200 cursor-default">
                  <td className="p-3 text-cca-textPrimary font-medium">#1025</td>
                  <td className="p-3 text-cca-textSecondary text-sm">09/04/2026</td>
                  <td className="p-3 text-cca-textPrimary">Frais de déplacement</td>
                  <td className="p-3 text-cca-textPrimary font-medium text-right">145,50 $</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* Tableau Modifiable */}
        <div className="bg-cca-surface p-6 rounded-lg shadow-sm border border-cca-border space-y-4 group hover:shadow-md hover:border-brand-primary/30 transition-all duration-300 animate-in fade-in slide-in-from-bottom-4 fill-mode-both duration-500 delay-300">
          <h2 className="text-xl font-heading font-semibold text-cca-textPrimary">Tableau Modifiable</h2>
          <div className="overflow-x-auto border border-cca-border rounded-md transition-shadow group-hover:shadow-sm">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-cca-base border-b border-cca-border">
                  <th className="p-3 font-semibold text-cca-textSecondary text-sm uppercase tracking-wider w-16">ID</th>
                  <th className="p-3 font-semibold text-cca-textSecondary text-sm uppercase tracking-wider">Nom</th>
                  <th className="p-3 font-semibold text-cca-textSecondary text-sm uppercase tracking-wider">Rôle</th>
                  <th className="p-3 font-semibold text-cca-textSecondary text-sm uppercase tracking-wider">Statut</th>
                </tr>
              </thead>
              <tbody>
                {editableData.map((row) => (
                  <tr key={row.id} className="border-b border-cca-border transition-colors focus-within:bg-brand-primary/5 hover:bg-brand-primary/5">
                    <td className="p-3 text-cca-textSecondary font-medium align-middle">{row.id}</td>
                    <td className="p-2 align-middle">
                        <input 
                            type="text" 
                            className="w-full bg-transparent border border-transparent hover:border-cca-border focus:bg-cca-surface focus:border-brand-primary rounded p-2 text-cca-textPrimary focus:outline-none focus:ring-1 focus:ring-brand-primary transition-all duration-200"
                            value={row.name}
                            onChange={(e) => handleEdit(row.id, 'name', e.target.value)}
                        />
                    </td>
                    <td className="p-2 align-middle">
                        <input 
                            type="text" 
                            className="w-full bg-transparent border border-transparent hover:border-cca-border focus:bg-cca-surface focus:border-brand-primary rounded p-2 text-cca-textPrimary focus:outline-none focus:ring-1 focus:ring-brand-primary transition-all duration-200"
                            value={row.role}
                            onChange={(e) => handleEdit(row.id, 'role', e.target.value)}
                        />
                    </td>
                    <td className="p-2 align-middle">
                        <select 
                            className="w-full bg-transparent border border-transparent hover:border-cca-border focus:bg-cca-surface focus:border-brand-primary rounded p-2 text-cca-textPrimary focus:outline-none focus:ring-1 focus:ring-brand-primary transition-all duration-200 cursor-pointer"
                            value={row.status}
                            onChange={(e) => handleEdit(row.id, 'status', e.target.value)}
                        >
                            <option value="Actif" className="bg-cca-surface text-cca-textPrimary">Actif</option>
                            <option value="En congé" className="bg-cca-surface text-cca-textPrimary">En congé</option>
                            <option value="Inactif" className="bg-cca-surface text-cca-textPrimary">Inactif</option>
                        </select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Modals & Dialogs */}
        <div className="bg-cca-surface p-6 rounded-lg shadow-sm border border-cca-border space-y-4 hover:shadow-md hover:border-brand-primary/30 transition-all duration-300 animate-in fade-in slide-in-from-bottom-4 fill-mode-both duration-500 delay-500">
          <h2 className="text-xl font-heading font-semibold text-cca-textPrimary">Modales & Dialogues</h2>
          <div className="flex flex-wrap gap-4">
            <button 
                onClick={() => setIsModalOpen(true)}
                className="px-6 py-2.5 bg-brand-primary text-white rounded-md font-medium hover:bg-brand-dark transition-all duration-300 active:scale-95 shadow-sm focus:outline-none focus:ring-2 focus:ring-brand-light focus:ring-offset-2 focus:ring-offset-cca-base hover:shadow-md"
            >
              Ouvrir Modale Standard
            </button>
            <button 
                onClick={() => setIsConfirmOpen(true)}
                className="px-6 py-2.5 bg-cca-base border border-cca-border rounded-md font-medium text-cca-textPrimary hover:bg-cca-surface hover:border-brand-primary transition-all duration-300 active:scale-95 shadow-sm focus:outline-none focus:ring-2 focus:ring-brand-light focus:ring-offset-2 focus:ring-offset-cca-base hover:shadow-md hover:-translate-y-0.5"
            >
              Ouvrir Modale de Confirmation
            </button>
          </div>
        </div>

      </div>

      {/* Modal Standard */}
      {isModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-300">
            <div className="bg-cca-surface border border-cca-border rounded-xl shadow-2xl w-full max-w-md overflow-hidden flex flex-col animate-in zoom-in-95 slide-in-from-bottom-4 duration-300">
                <div className="flex justify-between items-center p-5 border-b border-cca-border bg-cca-base">
                    <h3 className="font-heading font-semibold text-lg text-cca-textPrimary">Paramètres du profil</h3>
                    <button onClick={() => setIsModalOpen(false)} className="text-cca-textSecondary hover:text-brand-primary transition-colors duration-200 rounded-full hover:bg-brand-primary/10 p-1 active:scale-90">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                            <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                        </svg>
                    </button>
                </div>
                <div className="p-6">
                    <p className="text-cca-textSecondary text-sm">
                        Voici une modale standard. Elle s'intègre parfaitement aux fonds de surface <code className="bg-cca-base px-1 py-0.5 rounded border border-cca-border">bg-cca-surface</code> et aux bordures <code className="bg-cca-base px-1 py-0.5 rounded border border-cca-border">border-cca-border</code>.
                    </p>
                    <div className="mt-5 space-y-4">
                        <div className="group">
                            <label className="block text-xs font-semibold text-cca-textSecondary mb-2 tracking-wider group-focus-within:text-brand-primary transition-colors duration-200">NOUVELLE ADRESSE EMAIL</label>
                            <input 
                                type="email" 
                                defaultValue="contact@cca.com" 
                                className="w-full bg-cca-base border border-cca-border rounded-md p-2.5 text-cca-textPrimary focus:outline-none focus:ring-2 focus:ring-brand-primary/50 focus:border-brand-primary transition-all duration-300 hover:border-brand-primary/30" 
                            />
                        </div>
                    </div>
                </div>
                <div className="p-5 border-t border-cca-border bg-cca-base flex justify-end gap-3">
                    <button onClick={() => setIsModalOpen(false)} className="px-5 py-2.5 bg-transparent text-cca-textSecondary font-medium hover:text-cca-textPrimary transition-all duration-200 hover:bg-cca-surface rounded-md">
                        Annuler
                    </button>
                    <button onClick={() => setIsModalOpen(false)} className="px-5 py-2.5 bg-brand-primary text-white rounded-md font-medium hover:bg-brand-dark transition-all duration-300 active:scale-95 shadow-sm hover:shadow-md">
                        Enregistrer
                    </button>
                </div>
            </div>
        </div>
      )}

      {/* Modal Confirmation */}
      {isConfirmOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-md animate-in fade-in duration-300">
            <div className="bg-cca-surface border border-cca-border rounded-xl shadow-2xl w-full max-w-sm flex flex-col p-6 text-center animate-in zoom-in-95 slide-in-from-bottom-8 duration-300">
                <div className="mx-auto flex items-center justify-center h-14 w-14 rounded-full bg-red-100 dark:bg-red-900/30 mb-5 ring-4 ring-red-50 dark:ring-red-900/10 scale-100 transition-transform duration-300 hover:scale-110">
                    <svg className="h-7 w-7 text-red-600 dark:text-red-400 animate-pulse duration-1000" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                </div>
                <h3 className="font-heading font-semibold text-xl text-cca-textPrimary mb-2">Supprimer la facture ?</h3>
                <p className="text-cca-textSecondary text-sm mb-8">
                    Êtes-vous sûr de vouloir supprimer définitivement cette facture ? Cette action est irréversible et effacera les données de manière permanente.
                </p>
                <div className="flex gap-3 w-full">
                    <button 
                        onClick={() => setIsConfirmOpen(false)} 
                        className="flex-1 px-4 py-2.5 bg-cca-base border border-cca-border text-cca-textPrimary rounded-md font-medium hover:bg-cca-surface hover:border-brand-primary/50 transition-all duration-300 active:scale-95"
                    >
                        Annuler
                    </button>
                    <button 
                        onClick={() => setIsConfirmOpen(false)} 
                        className="flex-1 px-4 py-2.5 bg-red-600 text-white rounded-md font-medium hover:bg-red-700 shadow-sm transition-all duration-300 active:scale-95 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 focus:ring-offset-cca-base hover:-translate-y-0.5"
                    >
                        Supprimer
                    </button>
                </div>
            </div>
        </div>
      )}

    </div>
  );
}
