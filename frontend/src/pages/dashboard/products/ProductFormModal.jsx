// /frontend/src/pages/dashboard/products/ProductFormModal.jsx

import React, { useEffect, useState } from 'react';
import Modal from '@/components/Modal';
import Button from '@/components/ui/button';
import Spinner from '@/components/ui/Spinner';
import toast from 'react-hot-toast';
import { createProduct, updateProduct } from '@/services/productsService';

const ProductFormModal = ({ companyId, initialData = null, onClose }) => {
    const isEditMode = !!initialData;

    const [submitting, setSubmitting] = useState(false);
    const [formData, setFormData] = useState({
        name: '',
        price: '',
        description: '',
        isActive: true,
    });

    useEffect(() => {
        if (isEditMode) {
            setFormData({
                name: initialData?.name ?? '',
                price: initialData?.price ?? '',
                description: initialData?.description ?? '',
                isActive: initialData?.isActive ?? true,
            });
        } else {
            setFormData({ name: '', price: '', description: '', isActive: true });
        }
    }, [isEditMode, initialData]);

    const handleChange = (e) => {
        const { name, value, type, checked } = e.target;
        setFormData((prev) => ({ ...prev, [name]: type === 'checkbox' ? checked : value }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setSubmitting(true);

        try {
            const payload = {
                name: String(formData.name || '').trim(),
                price: parseFloat(formData.price || 0),
                description: (formData.description || '').trim() || null,
                isActive: !!formData.isActive,
            };

            if (!payload.name || isNaN(payload.price)) {
                toast.error('Veuillez renseigner un nom et un prix valide.');
                setSubmitting(false);
                return;
            }

            if (isEditMode) {
                await updateProduct(companyId, initialData.id, payload);
                toast.success('Produit mis à jour.');
            } else {
                await createProduct(companyId, payload);
                toast.success('Produit créé.');
            }

            onClose(true); // indique au parent de rafraîchir
        } catch (error) {
            console.error(error);
            toast.error('Erreur lors de la sauvegarde du produit.');
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <Modal
            isOpen
            onClose={() => onClose(false)}
            title={isEditMode ? 'Modifier le produit' : 'Créer un produit'}
        >
            <form onSubmit={handleSubmit} className="space-y-5">
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

                {/* Actif */}
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
                <div className="flex justify-end gap-3 pt-2">
                    <Button type="button" onClick={() => onClose(false)} className="bg-slate-600 hover:bg-slate-500">
                        Annuler
                    </Button>
                    <Button type="submit" disabled={submitting} className="bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50">
                        {submitting ? 'Sauvegarde...' : isEditMode ? 'Mettre à jour' : 'Créer'}
                    </Button>
                </div>
            </form>
        </Modal>
    );
};

export default ProductFormModal;
