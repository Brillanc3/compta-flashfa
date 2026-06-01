// /frontend/src/pages/admin/AdminImagesPage.jsx

import React, { useEffect, useRef, useState } from 'react';
import { toast } from 'react-hot-toast';
import { Upload, Trash2, RefreshCw, Copy, Filter, FileImage } from 'lucide-react';
import ConfirmationModal from '@/components/ui/ConfirmationModal';
import {
    listImages,
    uploadImage,
    replaceImage,
    deleteImage,
    convertToWebP,
} from '../../services/adminImageService';

const OWNER_TYPES = ['', 'USER', 'COMPANY', 'ADMIN', 'CLIENT_VARIABLE', 'MY_CALENDAR_EVENT',
    'COMPANY_LOADING', 'COMPANY_BANNER', 'COMPANY_ICON', 'CLIENT_CNI'];

function formatBytes(bytes) {
    if (bytes == null) return '—';
    if (bytes < 1024) return `${bytes} o`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} Ko`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} Mo`;
}

const AdminImagesPage = () => {
    const [images, setImages] = useState([]);
    const [total, setTotal] = useState(0);
    const [loading, setLoading] = useState(true);
    const [page, setPage] = useState(1);
    const limit = 20;

    const [filters, setFilters] = useState({ ownerType: '', ownerId: '', search: '', webpOnly: '' });
    const [pendingFilters, setPendingFilters] = useState({ ownerType: '', ownerId: '', search: '', webpOnly: '' });

    const [uploading, setUploading] = useState(false);
    const [replacingId, setReplacingId] = useState(null);
    const [convertingId, setConvertingId] = useState(null);

    const uploadRef = useRef(null);
    const replaceRef = useRef(null);

    const [confirmModal, setConfirmModal] = useState({ isOpen: false, message: '', onConfirm: null });

    const load = async (f = filters, p = page) => {
        setLoading(true);
        try {
            const res = await listImages({ ...f, page: p, limit });
            setImages(res.images);
            setTotal(res.total);
        } catch {
            toast.error('Impossible de charger les images.');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { load(); }, [page, filters]); // eslint-disable-line react-hooks/exhaustive-deps

    const applyFilters = () => {
        setPage(1);
        setFilters(pendingFilters);
    };

    const handleUpload = async (e) => {
        const file = e.target.files?.[0];
        if (!file) return;
        setUploading(true);
        try {
            await uploadImage(file);
            toast.success('Image uploadée.');
            load();
        } catch {
            toast.error("Erreur lors de l'upload.");
        } finally {
            setUploading(false);
            if (uploadRef.current) uploadRef.current.value = '';
        }
    };

    const handleReplace = (imageId) => {
        setReplacingId(imageId);
        replaceRef.current?.click();
    };

    const handleReplaceFile = async (e) => {
        const file = e.target.files?.[0];
        if (!file || !replacingId) return;
        try {
            await replaceImage(replacingId, file);
            toast.success('Image remplacée.');
            load();
        } catch {
            toast.error('Erreur lors du remplacement.');
        } finally {
            setReplacingId(null);
            if (replaceRef.current) replaceRef.current.value = '';
        }
    };

    const handleConvert = async (image) => {
        setConvertingId(image.id);
        try {
            await convertToWebP(image.id);
            toast.success('Convertie en WebP.');
            load();
        } catch (err) {
            toast.error(err?.response?.data?.message || 'Erreur lors de la conversion.');
        } finally {
            setConvertingId(null);
        }
    };

    const handleDelete = (image) => {
        setConfirmModal({
            isOpen: true,
            message: `Supprimer l'image ${image.publicId} ?`,
            onConfirm: async () => {
                setConfirmModal(p => ({ ...p, isOpen: false }));
                try {
                    await deleteImage(image.id);
                    toast.success('Image supprimée.');
                    load();
                } catch {
                    toast.error('Erreur lors de la suppression.');
                }
            },
        });
    };

    const copyUrl = (url) => {
        navigator.clipboard.writeText(window.location.origin + url);
        toast.success('Lien copié.');
    };

    const totalPages = Math.ceil(total / limit);

    return (
        <div className="p-6 space-y-6">
            <div className="flex items-center justify-between">
                <h1 className="text-xl font-heading font-semibold text-cca-textPrimary">Gestion des Images</h1>
                <button
                    onClick={() => uploadRef.current?.click()}
                    disabled={uploading}
                    className="flex items-center gap-2 px-4 py-2 bg-brand-primary text-white rounded-md text-sm font-medium hover:opacity-90 disabled:opacity-50"
                >
                    <Upload size={16} />
                    {uploading ? 'Upload...' : 'Uploader'}
                </button>
            </div>

            {/* Filters */}
            <div className="flex flex-wrap gap-3 items-end bg-cca-base border border-cca-border rounded-lg p-4">
                <div className="flex flex-col gap-1">
                    <label className="text-xs text-cca-textSecondary">Type propriétaire</label>
                    <select
                        value={pendingFilters.ownerType}
                        onChange={e => setPendingFilters(p => ({ ...p, ownerType: e.target.value }))}
                        className="px-3 py-1.5 text-sm border border-cca-border rounded-md bg-cca-surface text-cca-textPrimary"
                    >
                        {OWNER_TYPES.map(t => <option key={t} value={t}>{t || 'Tous'}</option>)}
                    </select>
                </div>
                <div className="flex flex-col gap-1">
                    <label className="text-xs text-cca-textSecondary">Owner ID</label>
                    <input
                        type="number"
                        value={pendingFilters.ownerId}
                        onChange={e => setPendingFilters(p => ({ ...p, ownerId: e.target.value }))}
                        placeholder="Ex: 42"
                        className="px-3 py-1.5 text-sm border border-cca-border rounded-md bg-cca-surface text-cca-textPrimary w-28"
                    />
                </div>
                <div className="flex flex-col gap-1">
                    <label className="text-xs text-cca-textSecondary">Recherche (publicId)</label>
                    <input
                        type="text"
                        value={pendingFilters.search}
                        onChange={e => setPendingFilters(p => ({ ...p, search: e.target.value }))}
                        placeholder="publicId partiel..."
                        className="px-3 py-1.5 text-sm border border-cca-border rounded-md bg-cca-surface text-cca-textPrimary w-48"
                    />
                </div>
                <div className="flex flex-col gap-1">
                    <label className="text-xs text-cca-textSecondary">Format WebP</label>
                    <select
                        value={pendingFilters.webpOnly}
                        onChange={e => setPendingFilters(p => ({ ...p, webpOnly: e.target.value }))}
                        className="px-3 py-1.5 text-sm border border-cca-border rounded-md bg-cca-surface text-cca-textPrimary"
                    >
                        <option value="">Tous formats</option>
                        <option value="true">WebP uniquement</option>
                        <option value="false">Non-WebP uniquement</option>
                    </select>
                </div>
                <button
                    onClick={applyFilters}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-brand-primary text-white rounded-md text-sm font-medium hover:opacity-90"
                >
                    <Filter size={14} />
                    Filtrer
                </button>
            </div>

            {/* Table */}
            <div className="overflow-x-auto rounded-lg border border-cca-border">
                <table className="w-full text-sm">
                    <thead className="bg-cca-base border-b border-cca-border">
                        <tr>
                            <th className="px-4 py-3 text-left text-xs font-semibold text-cca-textSecondary uppercase">Aperçu</th>
                            <th className="px-4 py-3 text-left text-xs font-semibold text-cca-textSecondary uppercase">publicId</th>
                            <th className="px-4 py-3 text-left text-xs font-semibold text-cca-textSecondary uppercase">Format</th>
                            <th className="px-4 py-3 text-left text-xs font-semibold text-cca-textSecondary uppercase">Taille</th>
                            <th className="px-4 py-3 text-left text-xs font-semibold text-cca-textSecondary uppercase">Type</th>
                            <th className="px-4 py-3 text-left text-xs font-semibold text-cca-textSecondary uppercase">Owner ID</th>
                            <th className="px-4 py-3 text-left text-xs font-semibold text-cca-textSecondary uppercase">Date</th>
                            <th className="px-4 py-3 text-left text-xs font-semibold text-cca-textSecondary uppercase">Lien</th>
                            <th className="px-4 py-3 text-right text-xs font-semibold text-cca-textSecondary uppercase">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-cca-border bg-cca-surface">
                        {loading ? (
                            <tr>
                                <td colSpan={9} className="px-4 py-8 text-center text-cca-textSecondary">Chargement...</td>
                            </tr>
                        ) : images.length === 0 ? (
                            <tr>
                                <td colSpan={9} className="px-4 py-8 text-center text-cca-textSecondary">Aucune image.</td>
                            </tr>
                        ) : images.map(img => {
                            const isWebP = img.mimetype === 'image/webp';
                            const isConverting = convertingId === img.id;
                            return (
                                <tr key={img.id} className="hover:bg-cca-base transition-colors">
                                    <td className="px-4 py-3">
                                        <img
                                            src={img.publicUrl}
                                            alt=""
                                            className="w-12 h-12 object-cover rounded border border-cca-border"
                                            onError={e => { e.target.style.display = 'none'; }}
                                        />
                                    </td>
                                    <td className="px-4 py-3 font-mono text-xs text-cca-textPrimary max-w-[140px] truncate">{img.publicId}</td>
                                    <td className="px-4 py-3">
                                        {isWebP ? (
                                            <span className="px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-700 border border-green-200">WebP</span>
                                        ) : (
                                            <span className="px-2 py-0.5 rounded text-xs font-medium bg-amber-100 text-amber-700 border border-amber-200">
                                                {img.mimetype.split('/')[1]?.toUpperCase() || img.mimetype}
                                            </span>
                                        )}
                                    </td>
                                    <td className="px-4 py-3 text-cca-textSecondary whitespace-nowrap">{formatBytes(img.byteSize)}</td>
                                    <td className="px-4 py-3">
                                        <span className="px-2 py-0.5 rounded text-xs bg-cca-base border border-cca-border text-cca-textSecondary">{img.ownerType}</span>
                                    </td>
                                    <td className="px-4 py-3 text-cca-textSecondary">{img.ownerId}</td>
                                    <td className="px-4 py-3 text-cca-textSecondary whitespace-nowrap">
                                        {new Date(img.createdAt).toLocaleDateString('fr-FR')}
                                    </td>
                                    <td className="px-4 py-3">
                                        <button
                                            onClick={() => copyUrl(img.publicUrl)}
                                            className="flex items-center gap-1 text-xs text-brand-primary hover:underline"
                                        >
                                            <Copy size={12} />
                                            Copier
                                        </button>
                                    </td>
                                    <td className="px-4 py-3">
                                        <div className="flex items-center justify-end gap-1.5">
                                            {!isWebP && (
                                                <button
                                                    onClick={() => handleConvert(img)}
                                                    disabled={isConverting}
                                                    title="Convertir en WebP"
                                                    className="flex items-center gap-1 px-2 py-1 rounded text-xs text-amber-700 bg-amber-50 border border-amber-200 hover:bg-amber-100 disabled:opacity-50 transition-colors"
                                                >
                                                    <FileImage size={12} />
                                                    {isConverting ? '...' : 'WebP'}
                                                </button>
                                            )}
                                            <button
                                                onClick={() => handleReplace(img.id)}
                                                title="Remplacer"
                                                className="p-1.5 rounded text-cca-textSecondary hover:text-brand-primary hover:bg-cca-base transition-colors"
                                            >
                                                <RefreshCw size={15} />
                                            </button>
                                            <button
                                                onClick={() => handleDelete(img)}
                                                title="Supprimer"
                                                className="p-1.5 rounded text-cca-textSecondary hover:text-red-500 hover:bg-red-50 transition-colors"
                                            >
                                                <Trash2 size={15} />
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
                <div className="flex items-center justify-between text-sm text-cca-textSecondary">
                    <span>{total} image{total > 1 ? 's' : ''} au total</span>
                    <div className="flex items-center gap-2">
                        <button
                            onClick={() => setPage(p => Math.max(1, p - 1))}
                            disabled={page === 1}
                            className="px-3 py-1 border border-cca-border rounded-md disabled:opacity-40 hover:bg-cca-base"
                        >
                            Précédent
                        </button>
                        <span>Page {page} / {totalPages}</span>
                        <button
                            onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                            disabled={page === totalPages}
                            className="px-3 py-1 border border-cca-border rounded-md disabled:opacity-40 hover:bg-cca-base"
                        >
                            Suivant
                        </button>
                    </div>
                </div>
            )}

            {/* Hidden file inputs */}
            <input ref={uploadRef} type="file" accept="image/*" className="hidden" onChange={handleUpload} />
            <input ref={replaceRef} type="file" accept="image/*" className="hidden" onChange={handleReplaceFile} />

            <ConfirmationModal
                isOpen={confirmModal.isOpen}
                onClose={() => setConfirmModal(p => ({ ...p, isOpen: false }))}
                onConfirm={confirmModal.onConfirm}
                message={confirmModal.message}
            />
        </div>
    );
};

export default AdminImagesPage;
