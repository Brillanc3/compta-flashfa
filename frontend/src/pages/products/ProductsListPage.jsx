// frontend/src/pages/products/ProductsListPage.jsx
import React, { useEffect, useMemo, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { productsService } from '@/services/productsService';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Pencil, PlusCircle, Power } from 'lucide-react';
import { ProductFormModal } from './ProductFormModal';

const usd = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });

export default function ProductsListPage() {
    const { companyId } = useParams();
    const [products, setProducts] = useState([]);
    const [activeOnly, setActiveOnly] = useState(true);
    const [selected, setSelected] = useState(null);
    const [open, setOpen] = useState(false);

    const fetchProducts = async () => {
        const list = await productsService.list(companyId, activeOnly);
        setProducts(list);
    };

    useEffect(() => { fetchProducts(); }, [companyId, activeOnly]); // eslint-disable-line react-hooks/exhaustive-deps

    const title = useMemo(() => activeOnly ? 'Produits actifs' : 'Tous les produits', [activeOnly]);

    return (
        <div className="p-4 space-y-4">
            <div className="flex flex-wrap gap-2 justify-between items-center">
                <h1 className="text-xl font-semibold">Produits — Company #{companyId}</h1>
                <div className="flex gap-2">
                    <Button variant="outline" onClick={() => setActiveOnly(v => !v)}>
                        {activeOnly ? 'Afficher tous' : 'Afficher actifs uniquement'}
                    </Button>
                    <Button onClick={() => { setSelected(null); setOpen(true); }}>
                        <PlusCircle className="mr-2 h-4 w-4" /> Nouveau produit
                    </Button>
                    <Link to={`/dashboard/company/${companyId}/products/declarations`}>
                        <Button variant="secondary">Déclarations</Button>
                    </Link>
                </div>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>{title}</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="overflow-x-auto">
                        <table className="w-full border-collapse">
                            <thead>
                            <tr className="bg-gray-100 text-left">
                                <th className="p-2">Nom</th>
                                <th className="p-2">Description</th>
                                <th className="p-2">Prix</th>
                                <th className="p-2">Statut</th>
                                <th className="p-2 text-right">Actions</th>
                            </tr>
                            </thead>
                            <tbody>
                            {products.map(p => (
                                <tr key={p.id} className="border-b hover:bg-gray-50">
                                    <td className="p-2">{p.name}</td>
                                    <td className="p-2">{p.description || '-'}</td>
                                    <td className="p-2">{usd.format(Number(p.price || 0))}</td>
                                    <td className="p-2">{p.isActive ? 'Actif' : 'Inactif'}</td>
                                    <td className="p-2 text-right space-x-2">
                                        <Button size="sm" variant="outline" onClick={() => { setSelected(p); setOpen(true); }}>
                                            <Pencil className="h-4 w-4" />
                                        </Button>
                                        {p.isActive && (
                                            <Button
                                                size="sm"
                                                variant="destructive"
                                                onClick={() => productsService.deactivate(companyId, p.id).then(fetchProducts)}
                                            >
                                                <Power className="h-4 w-4" />
                                            </Button>
                                        )}
                                    </td>
                                </tr>
                            ))}
                            {products.length === 0 && (
                                <tr><td className="p-4 text-sm text-gray-500" colSpan={5}>Aucun produit.</td></tr>
                            )}
                            </tbody>
                        </table>
                    </div>
                </CardContent>
            </Card>

            {open && (
                <ProductFormModal
                    open={open}
                    onClose={() => setOpen(false)}
                    companyId={companyId}
                    product={selected}
                    onSaved={fetchProducts}
                />
            )}
        </div>
    );
}
