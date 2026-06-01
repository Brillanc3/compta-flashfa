// frontend/src/pages/products/ProductFormModal.jsx
import React, { useState } from 'react';
import { productsService } from '@/services/productsService';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

export function ProductFormModal({ open, onClose, companyId, product, onSaved }) {
    const [form, setForm] = useState(() => ({
        name: product?.name ?? '',
        description: product?.description ?? '',
        price: product?.price ?? 0,
    }));
    const [loading, setLoading] = useState(false);

    const handleChange = e => {
        const { name, value } = e.target;
        setForm(prev => ({ ...prev, [name]: name === 'price' ? Number(value) : value }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        try {
            if (product) {
                await productsService.update(companyId, product.id, form);
            } else {
                await productsService.create(companyId, form);
            }
            onSaved?.();
            onClose?.();
        } finally {
            setLoading(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onClose}>
            <DialogContent className="sm:max-w-lg">
                <DialogHeader>
                    <DialogTitle>{product ? 'Modifier le produit' : 'Nouveau produit'}</DialogTitle>
                </DialogHeader>

                <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="space-y-2">
                        <label className="text-sm font-medium">Nom</label>
                        <Input name="name" value={form.name} onChange={handleChange} placeholder="Nom du produit" required />
                    </div>
                    <div className="space-y-2">
                        <label className="text-sm font-medium">Description</label>
                        <Input name="description" value={form.description} onChange={handleChange} placeholder="Description (optionnel)" />
                    </div>
                    <div className="space-y-2">
                        <label className="text-sm font-medium">Prix (USD)</label>
                        <Input type="number" step="0.01" name="price" value={form.price} onChange={handleChange} placeholder="0.00" required />
                    </div>

                    <DialogFooter>
                        <Button type="button" variant="outline" onClick={onClose}>Annuler</Button>
                        <Button type="submit" disabled={loading}>{loading ? 'Enregistrement…' : 'Enregistrer'}</Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}
