// /frontend/src/modules/myCalendar/components/CategoryManager.jsx
import React, { useState } from 'react';
import PropTypes from 'prop-types';
import { Button } from '@/components/ui/button';
import { myCalendarService } from '../services/myCalendar.services';
import toast from 'react-hot-toast';
import { Plus, X, Palette, Tag, Loader2 } from 'lucide-react';
import ActionConfirmationModal from '@/components/dashboard/employees/ActionConfirmationModal';

const CategoryManager = ({ categories, onUpdated, companyId }) => {
    const [loading, setLoading] = useState(false);
    const [newName, setNewName] = useState('');
    const [newColor, setNewColor] = useState('#3b82f6');
    const [isConfirmDeleteOpen, setIsConfirmDeleteOpen] = useState(false);
    const [categoryToDelete, setCategoryToDelete] = useState(null);

    const handleCreate = async (e) => {
        e.preventDefault();
        if (!newName.trim()) return;
        setLoading(true);
        try {
            await myCalendarService.createCategory({ name: newName, color: newColor }, companyId);
            setNewName('');
            toast.success("Catégorie créée");
            onUpdated();
        } catch (_error) {
            toast.error("Erreur lors de la création");
        } finally {
            setLoading(false);
        }
    };

    const handleDelete = async () => {
        if (!categoryToDelete) return;
        setLoading(true);
        try {
            await myCalendarService.deleteCategory(categoryToDelete, companyId);
            toast.success("Catégorie supprimée");
            setCategoryToDelete(null);
            setIsConfirmDeleteOpen(false);
            onUpdated();
        } catch (_error) {
            toast.error("Erreur lors de la suppression");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="space-y-4 p-1">
            <div className="flex items-center gap-2 mb-4">
                <Tag className="h-5 w-5 text-brand-primary" />
                <h3 className="text-lg font-semibold text-cca-textPrimary">Gestion des catégories</h3>
            </div>

            {/* List */}
            <div className="grid grid-cols-1 gap-2 max-h-48 overflow-y-auto pr-2">
                {categories?.length > 0 ? categories.map(cat => (
                    <div key={cat.id} className="group flex items-center justify-between p-2 rounded-lg bg-cca-surface border border-cca-border hover:border-brand-primary transition-all">
                        <div className="flex items-center gap-3">
                            <div className="w-4 h-4 rounded-full" style={{ backgroundColor: cat.color }} />
                            <span className="text-sm font-medium text-cca-textPrimary">{cat.name}</span>
                        </div>
                        <button
                            onClick={() => { setCategoryToDelete(cat.id); setIsConfirmDeleteOpen(true); }}
                            className="p-1 text-cca-textSecondary hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                            <X className="h-4 w-4" />
                        </button>
                    </div>
                )) : (
                    <div className="text-center py-4 text-cca-textSecondary italic text-sm">
                        Aucune catégorie
                    </div>
                )}
            </div>

            {/* Form */}
            <form onSubmit={handleCreate} className="pt-4 border-t border-cca-border space-y-3">
                <div className="flex flex-col gap-3">
                    <div className="flex-1 space-y-1">
                        <label className="text-xs text-cca-textSecondary">Nom de la catégorie</label>
                        <input
                            value={newName}
                            onChange={(e) => setNewName(e.target.value)}
                            className="w-full bg-cca-base border border-cca-border rounded-lg px-3 py-1.5 text-sm text-cca-textPrimary outline-none focus:ring-1 focus:ring-brand-primary"
                            placeholder="Anniversaires, Réunions..."
                        />
                    </div>
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <Palette className="h-4 w-4 text-cca-textSecondary" />
                            <input
                                type="color"
                                value={newColor}
                                onChange={(e) => setNewColor(e.target.value)}
                                className="w-8 h-8 rounded cursor-pointer bg-transparent border-none"
                            />
                        </div>
                        <Button type="submit" size="sm" disabled={loading || !newName.trim()} className="bg-brand-primary text-white">
                            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4 mr-1" />}
                            Ajouter
                        </Button>
                    </div>
                </div>
            </form>

            <ActionConfirmationModal
                isOpen={isConfirmDeleteOpen}
                onClose={() => setIsConfirmDeleteOpen(false)}
                title="Supprimer la catégorie"
                message="Êtes-vous sûr de vouloir supprimer cette catégorie ? Les événements associés n'auront plus de catégorie."
                onConfirm={handleDelete}
                loading={loading}
            />
        </div>
    );
};

CategoryManager.propTypes = {
    categories: PropTypes.array,
    onUpdated: PropTypes.func.isRequired,
    companyId: PropTypes.number
};

export default CategoryManager;
