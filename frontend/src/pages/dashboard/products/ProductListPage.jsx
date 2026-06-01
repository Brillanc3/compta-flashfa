// /frontend/src/pages/dashboard/products/ProductListPage.jsx

import React, { useEffect, useMemo, useState } from 'react';
import {
    fetchProducts,
    deactivateProduct,
    updateProduct,
} from '@/services/productsService';
import Button from '@/components/ui/button';
import Switch from '@/components/ui/switch';
import Spinner from '@/components/ui/Spinner';
import toast from 'react-hot-toast';
import ProductFormModal from './ProductFormModal';
import { usePermissions } from "@/contexts/PermissionsContext";
import { useCompany } from "@/contexts/CompanyContext.jsx";

const usd = (value) => {
    const n = Number(value);
    if (!Number.isFinite(n)) return '$0.00';
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n);
};

const normalize = (v) => String(v || '').toLowerCase().trim();

const ProductListPage = () => {
    const permissions = usePermissions();

    const { activeCompanyId } = useCompany();
    const companyId = activeCompanyId;

    const canEdit = permissions.has(`PRODUCTS.${companyId}.MANAGE`);

    const [products, setProducts] = useState([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingProduct, setEditingProduct] = useState(null);

    // Afficher uniquement les produits désactivés
    const [showDisabledOnly, setShowDisabledOnly] = useState(false);

    // Recherche client-side (sans toucher l’API)
    const [search, setSearch] = useState('');

    const loadProducts = async () => {
        try {
            setLoading(true);
            const data = await fetchProducts(companyId, { activeOnly: false });
            setProducts(data?.products || []);
        } catch (error) {
            console.error(error);
            toast.error('Erreur lors du chargement des produits.');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (companyId) loadProducts();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [companyId]);

    const handleOpenCreate = () => {
        setEditingProduct(null);
        setIsModalOpen(true);
    };

    const handleOpenEdit = (product) => {
        setEditingProduct(product);
        setIsModalOpen(true);
    };

    const handleCloseModal = (didChange) => {
        setIsModalOpen(false);
        setEditingProduct(null);
        if (didChange) loadProducts();
    };

    const getDeactivatedAt = (p) => {
        return (
            p.deactivatedAt ||
            p.disabledAt ||
            p.inactivatedAt ||
            p.archivedAt ||
            p.deletedAt ||
            null
        );
    };

    const formatDateTime = (value) => {
        if (!value) return null;
        const d = new Date(value);
        if (Number.isNaN(d.getTime())) return null;

        return new Intl.DateTimeFormat('fr-FR', {
            timeZone: 'Europe/Paris',
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
        }).format(d);
    };

    const displayedProducts = useMemo(() => {
        const s = normalize(search);
        let list = products;

        if (showDisabledOnly) {
            list = list.filter((p) => !p.isActive);
        }

        if (s) {
            list = list.filter((p) => {
                const name = normalize(p?.name);
                const desc = normalize(p?.description);
                const price = normalize(p?.price);
                return name.includes(s) || desc.includes(s) || price.includes(s);
            });
        }

        return list;
    }, [products, showDisabledOnly, search]);

    if (!permissions.isReady) {
        return (
            <div className="flex justify-center items-center h-64">
                <Spinner />
            </div>
        );
    }

    if (loading) {
        return (
            <div className="flex justify-center items-center h-64">
                <Spinner />
            </div>
        );
    }

    return (
        // NOTE: min-w-0 + w-full pour éviter les débordements horizontaux dans les layouts en flex.
        <div className="w-full min-w-0 p-4 md:p-6 space-y-4 md:space-y-6">
            <div className="min-w-0 flex flex-col gap-3 md:flex-row md:justify-between md:items-center">
                <div className="min-w-0">
                    <h1 className="text-2xl font-semibold text-cca-textPrimary">Produits</h1>
                    <p className="text-sm text-cca-textSecondary mt-1">
                        {displayedProducts.length} résultat(s)
                        {showDisabledOnly ? ' — désactivés uniquement' : ''}
                    </p>
                </div>

                <div className="min-w-0 flex flex-col sm:flex-row sm:flex-wrap gap-2 sm:items-center sm:justify-end">
                    <input
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        placeholder="Rechercher (nom, description, prix)"
                        className="w-full min-w-0 sm:flex-1 sm:min-w-[220px] md:w-80 rounded-lg bg-cca-surface border border-cca-border px-3 py-2.5 text-sm text-cca-textPrimary focus:border-indigo-400 outline-none"
                    />

                    <Button
                        onClick={() => setShowDisabledOnly((v) => !v)}
                        className="whitespace-nowrap bg-cca-base hover:bg-cca-surface text-cca-textPrimary"
                    >
                        {showDisabledOnly ? '📋 Tous' : '🗄️ Désactivés'}
                    </Button>

                    {canEdit && (
                        <Button onClick={handleOpenCreate} className="whitespace-nowrap bg-indigo-600 hover:bg-indigo-700">
                            ➕ Ajouter
                        </Button>
                    )}
                </div>
            </div>

            {displayedProducts.length === 0 ? (
                <div className="p-6 text-cca-textSecondary text-center border border-cca-border rounded-md">
                    {showDisabledOnly ? 'Aucun produit désactivé.' : 'Aucun produit trouvé.'}
                </div>
            ) : (
                <>
                    {/* Mobile : cards */}
                    <div className="md:hidden min-w-0 space-y-3">
                        {displayedProducts.map((p) => {
                            const deactivatedAt = !p.isActive ? getDeactivatedAt(p) : null;
                            const deactivatedAtLabel = !p.isActive ? formatDateTime(deactivatedAt) : null;

                            const statusHover =
                                !p.isActive
                                    ? (deactivatedAtLabel ? `Désactivé le ${deactivatedAtLabel}` : 'Produit désactivé')
                                    : 'Produit actif';

                            return (
                                <div
                                    key={p.id}
                                    className="w-full min-w-0 rounded-xl border border-cca-border bg-cca-surface shadow-lg shadow-black/20 p-4"
                                >
                                    <div className="min-w-0 flex items-start justify-between gap-3">
                                        <div className="min-w-0">
                                            <div className="text-cca-textPrimary font-semibold leading-5 whitespace-normal break-words max-w-full">{p.name}</div>
                                            <div className="text-sm text-cca-textSecondary mt-0.5">{usd(p.price || 0)}</div>
                                        </div>

                                        <div className="flex items-center gap-2" title={statusHover}>
                                            <Switch
                                                checked={p.isActive}
                                                disabled={!canEdit || refreshing}
                                                onChange={async (next) => {
                                                    try {
                                                        setRefreshing(true);
                                                        if (next) {
                                                            await updateProduct(companyId, p.id, { isActive: true });
                                                            toast.success('Produit activé.');
                                                        } else {
                                                            await deactivateProduct(companyId, p.id);
                                                            toast.success('Produit désactivé.');
                                                        }
                                                        await loadProducts();
                                                    } catch (_e) {
                                                        toast.error('Erreur lors de la mise à jour du statut.');
                                                    } finally {
                                                        setRefreshing(false);
                                                    }
                                                }}
                                            />
                                        </div>
                                    </div>

                                    <div className="mt-3 text-sm text-cca-textSecondary whitespace-pre-wrap break-words">
                                        {p.description || '—'}
                                    </div>

                                    {canEdit && (
                                        <div className="mt-4 flex justify-end">
                                            <Button
                                                onClick={() => handleOpenEdit(p)}
                                                className="whitespace-nowrap bg-cca-base hover:bg-cca-surface text-cca-textPrimary border border-cca-border"
                                                size="sm"
                                            >
                                                ✏️ Modifier
                                            </Button>
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>

                    {/* Tablette/Desktop : table scrollable (évite le débordement du layout) */}
                    <div className="hidden md:block w-full min-w-0 max-w-full overflow-x-auto border border-cca-border rounded-lg shadow uppercase">
                        <table className="min-w-[720px] w-full table-fixed text-sm text-cca-textSecondary">
                            <thead className="bg-cca-base text-cca-textPrimary">
                            <tr>
                                <th className="p-3 text-left w-[18rem]">Nom</th>
                                <th className="p-3 text-left w-[10rem]">Prix (USD)</th>
                                <th className="p-3 text-left">Description</th>
                                <th className="p-3 text-center w-[7rem]">Actif</th>
                                {canEdit && <th className="p-3 text-center w-[9rem]">Actions</th>}
                            </tr>
                            </thead>

                            <tbody>
                            {displayedProducts.map((p) => {
                                const deactivatedAt = !p.isActive ? getDeactivatedAt(p) : null;
                                const deactivatedAtLabel = !p.isActive ? formatDateTime(deactivatedAt) : null;

                                const statusHover =
                                    !p.isActive
                                        ? (deactivatedAtLabel ? `Désactivé le ${deactivatedAtLabel}` : 'Produit désactivé')
                                        : 'Produit actif';

                                return (
                                    <tr
                                        key={p.id}
                                        className="border-b border-cca-border hover:bg-cca-base/50 transition"
                                    >
                                        <td className="p-3 align-top"><div className="min-w-0 max-w-full whitespace-normal break-words text-cca-textPrimary">{p.name}</div></td>
                                        <td className="p-3 text-cca-textPrimary">{usd(p.price || 0)}</td>
                                        <td className="p-3 text-cca-textSecondary break-words">{p.description || '—'}</td>

                                        <td className="p-3 text-center">
                                            <span title={statusHover} className="inline-flex">
                                                <Switch
                                                    checked={p.isActive}
                                                    disabled={!canEdit || refreshing}
                                                    onChange={async (next) => {
                                                        try {
                                                            setRefreshing(true);
                                                            if (next) {
                                                                await updateProduct(companyId, p.id, { isActive: true });
                                                                toast.success('Produit activé.');
                                                            } else {
                                                                await deactivateProduct(companyId, p.id);
                                                                toast.success('Produit désactivé.');
                                                            }
                                                            await loadProducts();
                                                        } catch (_e) {
                                                            toast.error('Erreur lors de la mise à jour du statut.');
                                                        } finally {
                                                            setRefreshing(false);
                                                        }
                                                    }}
                                                />
                                            </span>
                                        </td>

                                        {canEdit && (
                                            <td className="p-3 text-center">
                                                <Button
                                                    onClick={() => handleOpenEdit(p)}
                                                    className="whitespace-nowrap bg-cca-base hover:bg-cca-surface text-cca-textPrimary border border-cca-border"
                                                    size="sm"
                                                >
                                                    ✏️ Modifier
                                                </Button>
                                            </td>
                                        )}
                                    </tr>
                                );
                            })}
                            </tbody>
                        </table>
                    </div>
                </>
            )}

            {isModalOpen && (
                <ProductFormModal
                    companyId={companyId}
                    initialData={editingProduct}
                    onClose={handleCloseModal}
                />
            )}
        </div>
    );
};

export default ProductListPage;
