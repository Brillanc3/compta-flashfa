// /frontend/src/pages/dashboard/products/ProductFormPage.jsx

import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { createProduct, fetchProducts, updateProduct } from '@/services/productsService';
import { Button } from '@/components/ui/button';
import Spinner from '@/components/ui/Spinner';
import toast from 'react-hot-toast';

/**
 * Page Formulaire Produit
 * -----------------------
 * Utilisée à la fois pour la création et la modification de produits.
 */
const ProductFormPage = ({ companyId }) => {
    const navigate = useNavigate();
    const { id } = useParams(); // utilisé pour l’édition
    const isEditMode = !!id;

    const [loading, setLoading] = useState(isEditMode);
    const [submitting, setSubmitting] = useState(false);
    const [formData, setFormData] = useState({
        name: '',
        price: '',
        description: '',
        isActive: true,
    });

    useEffect(() => {
        if (isEditMode && companyId) {
            const loadProduct = async () => {
                try {
                    setLoading(true);
                    const data = await fetchProducts(companyId, { activeOnly: false });
                    const product = data.products.find((p) => String(p.id) === String(id));
                    if (!product) {
                        toast.error('Produit introuvable.');
                        navigate('/dashboard/products');
                        return;
                    }
                    setFormData({
                        name: product.name || '',
                        price: product.price || '',
                        description: product.description || '',
                        isActive: product.isActive ?? true,
                    });
                } catch (error) {
                    console.error(error);
                    toast.error('Erreur lors du chargement du produit.');
                } finally {
                    setLoading(false);
                }
            };
            loadProduct();
        }
    }, [companyId, id, isEditMode, navigate]);

    const handleChange = (e) => {
        const { name, value, type, checked } = e.target;
        setFormData((prev) => ({
            ...prev,
            [name]: type === 'checkbox' ? checked : value,
        }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setSubmitting(true);
        try {
            const payload = {
                name: formData.name.trim(),
                price: parseFloat(formData.price || 0),
                description: formData.description.trim() || null,
                isActive: !!formData.isActive,
            };

            if (!payload.name || isNaN(payload.price)) {
                toast.error('Veuillez renseigner un nom et un prix valide.');
                setSubmitting(false);
                return;
            }

            if (isEditMode) {
                await updateProduct(companyId, id, payload);
                toast.success('Produit mis à jour avec succès.');
            } else {
                await createProduct(companyId, payload);
                toast.success('Produit créé avec succès.');
            }

            navigate('/dashboard/products');
        } catch (error) {
            console.error(error);
            toast.error('Erreur lors de la sauvegarde du produit.');
        } finally {
            setSubmitting(false);
        }
    };

    if (loading) {
        return (
            <div className="flex justify-center items-center h-64">
                <Spinner />
            </div>
        );
    }

    return (
        <div className="p-6 max-w-2xl mx-auto space-y-6">
            <div className="flex justify-between items-center">
                <h1 className="text-2xl font-semibold text-slate-100">
                    {isEditMode ? 'Modifier le produit' : 'Créer un produit'}
                </h1>
                <Button onClick={() => navigate('/dashboard/products')} className="bg-slate-700 hover:bg-slate-600">
                    ← Retour
                </Button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-5 bg-slate-800/50 p-6 rounded-lg border border-slate-700">
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

                {/* Boutons */}
                <div className="flex justify-end gap-4 pt-4">
                    <Button
                        type="button"
                        onClick={() => navigate('/dashboard/products')}
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
        </div>
    );
};

export default ProductFormPage;
