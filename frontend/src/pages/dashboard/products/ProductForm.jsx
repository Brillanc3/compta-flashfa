// /frontend/src/pages/dashboard/products/ProductForm.jsx

import React from 'react';
import { Button } from '@/components/ui/button';

/**
 * Formulaire de création / édition de produit.
 * Réutilisé par ProductFormPage.jsx.
 */
const ProductForm = ({ formData, onChange, onSubmit, onCancel, submitting, isEditMode }) => {
    const handleChange = (e) => {
        const { name, value, type, checked } = e.target;
        onChange({
            ...formData,
            [name]: type === 'checkbox' ? checked : value,
        });
    };

    return (
        <form onSubmit={onSubmit} className="space-y-5 bg-slate-800/50 p-6 rounded-lg border border-slate-700">
            {/* Nom */}
            <div>
                <label htmlFor="name" className="block text-sm font-medium text-slate-300">
                    Nom du produit
                </label>
                <input
                    type="text"
                    id="name"
                    name="name"
                    required
                    value={formData.name}
                    onChange={handleChange}
                    className="mt-1 w-full bg-slate-700 border border-slate-600 rounded-md p-2 text-white"
                />
            </div>

            {/* Prix */}
            <div>
                <label htmlFor="price" className="block text-sm font-medium text-slate-300">
                    Prix de vente ($)
                </label>
                <input
                    type="number"
                    id="price"
                    name="price"
                    min="0"
                    step="0.01"
                    required
                    value={formData.price}
                    onChange={handleChange}
                    className="mt-1 w-full bg-slate-700 border border-slate-600 rounded-md p-2 text-white"
                />
            </div>

            {/* Description */}
            <div>
                <label htmlFor="description" className="block text-sm font-medium text-slate-300">
                    Description (optionnelle)
                </label>
                <textarea
                    id="description"
                    name="description"
                    rows="3"
                    value={formData.description}
                    onChange={handleChange}
                    className="mt-1 w-full bg-slate-700 border border-slate-600 rounded-md p-2 text-white"
                />
            </div>

            {/* Statut actif */}
            <div className="flex items-center gap-2">
                <input
                    type="checkbox"
                    id="isActive"
                    name="isActive"
                    checked={formData.isActive}
                    onChange={handleChange}
                    className="h-4 w-4 text-indigo-600 bg-slate-700 border-slate-600 focus:ring-indigo-500 rounded"
                />
                <label htmlFor="isActive" className="text-sm text-slate-300">
                    Produit actif
                </label>
            </div>

            {/* Actions */}
            <div className="flex justify-end gap-4 pt-4">
                <Button
                    type="button"
                    onClick={onCancel}
                    className="bg-slate-600 hover:bg-slate-500"
                >
                    Annuler
                </Button>
                <Button
                    type="submit"
                    disabled={submitting}
                    className="bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50"
                >
                    {submitting ? 'Sauvegarde...' : isEditMode ? 'Mettre à jour' : 'Créer'}
                </Button>
            </div>
        </form>
    );
};

export default ProductForm;
