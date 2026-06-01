// src/components/admin/company/ManageServicesModal.jsx

import React, { useEffect, useState } from 'react';
import Modal from '@/components/Modal';
import toast from 'react-hot-toast';
import { Trash2, Plus, Edit2, Save, X, Activity } from 'lucide-react';

import Spinner from '@/components/ui/Spinner';
import { useConfirmation } from '@/contexts/ConfirmationContext';

import {
    listCustomServices,
    createCustomService,
    updateCustomService,
    deleteCustomService,
} from '@/services/adminService';

const DURATIONS = [
    'Ponctuel',
    'Hebdomadaire',
    'Mensuel',
    'Trimestriel',
    'Annuel'
];

export default function ManageServicesModal({ isOpen, onClose, _onComplete, company }) {
    const { confirmAction } = useConfirmation();

    const [services, setServices] = useState([]);
    const [isLoading, setIsLoading] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState(null);

    // Form state
    const [isAdding, setIsAdding] = useState(false);
    const [editingId, setEditingId] = useState(null);
    const [formData, setFormData] = useState({
        title: '',
        invoiceReason: '',
        description: '',
        price: '',
        duration: 'Ponctuel',
        startWeek: '',
        endWeek: '',
    });

    const fetchServices = async () => {
        if (!company?.id) return;
        setIsLoading(true);
        setError(null);
        try {
            const data = await listCustomServices(company.id);
            setServices(data || []);
        } catch {
            setError('Impossible de charger les services.');
            setServices([]);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        if (isOpen && company) {
            fetchServices();
            resetForm();
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isOpen, company?.id]);

    const resetForm = () => {
        setFormData({
            title: '',
            invoiceReason: '',
            description: '',
            price: '',
            duration: 'Ponctuel',
            startWeek: '',
            endWeek: '',
        });
        setIsAdding(false);
        setEditingId(null);
    };

    const handleEdit = (service) => {
        setFormData({
            title: service.title,
            invoiceReason: service.invoiceReason,
            description: service.description || '',
            price: service.price,
            duration: service.duration,
            startWeek: service.startWeek || '',
            endWeek: service.endWeek || '',
        });
        setEditingId(service.id);
        setIsAdding(true);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!company) return;

        setIsSubmitting(true);
        try {
            const payload = {
                ...formData,
                price: parseFloat(formData.price),
                startWeek: formData.startWeek ? parseInt(formData.startWeek, 10) : null,
                endWeek: formData.endWeek ? parseInt(formData.endWeek, 10) : null,
            };

            if (editingId) {
                await updateCustomService(editingId, payload);
                toast.success('Service mis à jour.');
            } else {
                await createCustomService(company.id, payload);
                toast.success('Service créé.');
            }
            resetForm();
            fetchServices();
        } catch (err) {
            toast.error(err?.message || 'Erreur lors de l’enregistrement.');
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleDelete = (service) => {
        confirmAction({
            title: 'Supprimer le service',
            message: `Supprimer définitivement le service "${service.title}" ?`,
            onConfirm: async () => {
                try {
                    await deleteCustomService(service.id);
                    toast.success('Service supprimé.');
                    fetchServices();
                } catch (err) {
                    toast.error(err?.message || 'Erreur lors de la suppression.');
                }
            },
        });
    };

    if (!isOpen || !company) return null;

    return (
        <Modal 
            isOpen={isOpen} 
            onClose={onClose} 
            title={`Gérer les services — ${company.name}`}
            size="lg"
        >
            <div className="space-y-6">
                {error && (
                    <div className="p-3 rounded-md bg-red-900/30 border border-red-500/50 text-red-200 text-sm">
                        {error}
                    </div>
                )}

                {/* Formulaire d'ajout / édition */}
                {isAdding ? (
                    <form onSubmit={handleSubmit} className="bg-slate-800/50 p-4 rounded-lg border border-slate-700 space-y-4">
                        <div className="flex items-center justify-between mb-2">
                            <h3 className="text-lg font-semibold text-white">
                                {editingId ? 'Modifier le service' : 'Nouveau service'}
                            </h3>
                            <button 
                                type="button" 
                                onClick={resetForm}
                                className="text-slate-400 hover:text-white transition-colors"
                            >
                                <X size={20} />
                            </button>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="space-y-1">
                                <label className="text-xs font-medium text-slate-400 uppercase tracking-wider">Titre du service</label>
                                <input
                                    type="text"
                                    required
                                    placeholder="Ex: Maintenance serveur"
                                    className="w-full bg-slate-900 border border-slate-700 rounded-md px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                    value={formData.title}
                                    onChange={e => setFormData({ ...formData, title: e.target.value })}
                                />
                            </div>

                            <div className="space-y-1">
                                <label className="text-xs font-medium text-slate-400 uppercase tracking-wider">Raison (facture)</label>
                                <input
                                    type="text"
                                    required
                                    placeholder="Libellé qui apparaîtra sur la facture"
                                    className="w-full bg-slate-900 border border-slate-700 rounded-md px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                    value={formData.invoiceReason}
                                    onChange={e => setFormData({ ...formData, invoiceReason: e.target.value })}
                                />
                            </div>

                            <div className="space-y-1 md:col-span-2">
                                <label className="text-xs font-medium text-slate-400 uppercase tracking-wider">Description (interne)</label>
                                <textarea
                                    placeholder="Notes additionnelles..."
                                    className="w-full bg-slate-900 border border-slate-700 rounded-md px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 min-h-[80px]"
                                    value={formData.description}
                                    onChange={e => setFormData({ ...formData, description: e.target.value })}
                                />
                            </div>

                            <div className="space-y-1">
                                <label className="text-xs font-medium text-slate-400 uppercase tracking-wider">Prix ($)</label>
                                <input
                                    type="number"
                                    step="0.01"
                                    required
                                    placeholder="0.00"
                                    className="w-full bg-slate-900 border border-slate-700 rounded-md px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                    value={formData.price}
                                    onChange={e => setFormData({ ...formData, price: e.target.value })}
                                />
                            </div>

                            <div className="space-y-1">
                                <label className="text-xs font-medium text-slate-400 uppercase tracking-wider">Fréquence</label>
                                <select
                                    className="w-full bg-slate-900 border border-slate-700 rounded-md px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                    value={formData.duration}
                                    onChange={e => setFormData({ ...formData, duration: e.target.value })}
                                >
                                    {DURATIONS.map(d => (
                                        <option key={d} value={d}>{d}</option>
                                    ))}
                                </select>
                            </div>

                            <div className="space-y-1">
                                <label className="text-xs font-medium text-slate-400 uppercase tracking-wider">Semaine début (optionnel)</label>
                                <input
                                    type="number"
                                    placeholder="Ex: 1"
                                    className="w-full bg-slate-900 border border-slate-700 rounded-md px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                    value={formData.startWeek}
                                    onChange={e => setFormData({ ...formData, startWeek: e.target.value })}
                                />
                            </div>

                            <div className="space-y-1">
                                <label className="text-xs font-medium text-slate-400 uppercase tracking-wider">Semaine fin (optionnel)</label>
                                <input
                                    type="number"
                                    placeholder="Ex: 52"
                                    className="w-full bg-slate-900 border border-slate-700 rounded-md px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                    value={formData.endWeek}
                                    onChange={e => setFormData({ ...formData, endWeek: e.target.value })}
                                />
                            </div>
                        </div>

                        <div className="flex justify-end gap-3 pt-2">
                            <button
                                type="button"
                                onClick={resetForm}
                                className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-md transition-colors"
                            >
                                Annuler
                            </button>
                            <button
                                type="submit"
                                disabled={isSubmitting}
                                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white rounded-md flex items-center gap-2 transition-all"
                            >
                                {isSubmitting ? <Spinner size="sm" /> : <Save size={18} />}
                                <span>{editingId ? 'Mettre à jour' : 'Enregistrer'}</span>
                            </button>
                        </div>
                    </form>
                ) : (
                    <div className="flex justify-between items-center">
                        <h3 className="text-lg font-semibold text-white">Services configurés</h3>
                        <button
                            onClick={() => setIsAdding(true)}
                            className="flex items-center gap-2 px-3 py-1.5 bg-green-600 hover:bg-green-500 text-white text-sm font-medium rounded-md transition-all shadow-lg shadow-green-900/20"
                        >
                            <Plus size={16} />
                            Ajouter un service
                        </button>
                    </div>
                )}

                {/* Liste des services */}
                <div className="bg-slate-900/50 rounded-lg border border-slate-800 overflow-hidden">
                    {isLoading ? (
                        <div className="py-12 flex flex-col items-center justify-center text-slate-500 gap-3">
                            <Spinner size="lg" />
                            <p>Chargement des services...</p>
                        </div>
                    ) : services.length > 0 ? (
                        <div className="overflow-x-auto">
                            <table className="w-full text-left border-collapse">
                                <thead>
                                    <tr className="bg-slate-800/50">
                                        <th className="px-4 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wider">Service</th>
                                        <th className="px-4 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wider">Prix</th>
                                        <th className="px-4 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wider">Fréquence</th>
                                        <th className="px-4 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wider">Période</th>
                                        <th className="px-4 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wider text-right">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-800">
                                    {services.map(service => (
                                        <tr key={service.id} className="hover:bg-slate-800/30 transition-colors group">
                                            <td className="px-4 py-3">
                                                <div className="font-medium text-slate-100">{service.title}</div>
                                                <div className="text-xs text-slate-500 truncate max-w-[200px]">{service.invoiceReason}</div>
                                            </td>
                                            <td className="px-4 py-3 text-indigo-400 font-mono">
                                                ${parseFloat(service.price).toFixed(2)}
                                            </td>
                                            <td className="px-4 py-3">
                                                <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-slate-800 text-slate-300 border border-slate-700">
                                                    {service.duration}
                                                </span>
                                            </td>
                                            <td className="px-4 py-3 text-xs text-slate-400">
                                                {service.startWeek || service.endWeek ? (
                                                    <div className="flex items-center gap-1">
                                                        <Activity size={12} className="text-slate-500" />
                                                        <span>W{service.startWeek || '1'} → W{service.endWeek || '52'}</span>
                                                    </div>
                                                ) : (
                                                    <span className="italic text-slate-600">Permanent</span>
                                                )}
                                            </td>
                                            <td className="px-4 py-3 text-right">
                                                <div className="flex justify-end items-center gap-1">
                                                    <button
                                                        onClick={() => handleEdit(service)}
                                                        className="p-1.5 text-slate-400 hover:text-indigo-400 hover:bg-indigo-400/10 rounded transition-all"
                                                        title="Modifier"
                                                    >
                                                        <Edit2 size={16} />
                                                    </button>
                                                    <button
                                                        onClick={() => handleDelete(service)}
                                                        className="p-1.5 text-slate-400 hover:text-red-400 hover:bg-red-400/10 rounded transition-all"
                                                        title="Supprimer"
                                                    >
                                                        <Trash2 size={16} />
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    ) : (
                        <div className="py-12 flex flex-col items-center justify-center text-slate-500 gap-2">
                            <div className="p-4 rounded-full bg-slate-800/50 mb-2">
                                <Plus size={32} className="text-slate-600" />
                            </div>
                            <p className="font-medium">Aucun service configuré</p>
                            <p className="text-sm">Cliquez sur le bouton pour en ajouter un.</p>
                        </div>
                    )}
                </div>

                <div className="flex justify-end pt-4 border-t border-slate-800">
                    <button
                        type="button"
                        onClick={onClose}
                        className="px-6 py-2 bg-slate-800 hover:bg-slate-700 text-white font-semibold rounded-md transition-colors"
                    >
                        Fermer
                    </button>
                </div>
            </div>
        </Modal>
    );
}
