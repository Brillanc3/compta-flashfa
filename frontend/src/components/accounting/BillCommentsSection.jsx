import React, { useState, useEffect, useCallback } from 'react';
import { getBillComments, addBillComment, editBillComment, deleteBillComment } from '@/services/comptabiliteService';
import { usePermissions } from '@/contexts/PermissionsContext';
import { useAuth } from '@/contexts/AuthContext';
import { MessageSquare, Edit2, Trash2, Save, X, Send } from 'lucide-react';
import toast from 'react-hot-toast';
import ConfirmationModal from '@/components/ui/ConfirmationModal';

export default function BillCommentsSection({ billId }) {
    const { has } = usePermissions();
    const { user } = useAuth();

    const [comments, setComments] = useState([]);
    const [pagination, setPagination] = useState({ page: 1, limit: 5, totalPages: 1, total: 0 });
    const [isLoading, setIsLoading] = useState(false);
    const [newComment, setNewComment] = useState('');
    const [editingId, setEditingId] = useState(null);
    const [editContent, setEditContent] = useState('');
    const [_confirmModal, setConfirmModal] = useState({ isOpen: false, message: '', onConfirm: null });

    // Permissions globales (sans companyId) — ADMIN.* et COMPTABILITE.1.* couvrent tout
    const canView    = has('COMPTABILITE.BILLS.COMMENT.VIEW');
    const canAdd     = has('COMPTABILITE.BILLS.COMMENT.ADD');
    const canManage  = has('COMPTABILITE.BILLS.COMMENT.MANAGE');
    const canEditAny = has('COMPTABILITE.BILLS.COMMENTS.EDIT') || canManage;
    const canDeleteAny = has('COMPTABILITE.BILLS.COMMENT.REMOVE') || canManage;

    const isVisible = canView || canAdd;

    const fetchComments = useCallback(async (page = 1) => {
        if (!canView || !billId) return;
        setIsLoading(true);
        try {
            const result = await getBillComments(billId, page, 5);
            setComments(result.data);
            setPagination(result.pagination);
        } catch {
            toast.error('Erreur lors du chargement des commentaires');
        } finally {
            setIsLoading(false);
        }
    }, [billId, canView]);

    useEffect(() => {
        fetchComments(1);
    }, [fetchComments]);

    const handleAdd = async (e) => {
        e.preventDefault();
        if (!newComment.trim() || !canAdd) return;
        try {
            await addBillComment(billId, newComment);
            setNewComment('');
            fetchComments(1);
            toast.success('Commentaire ajouté');
        } catch (err) {
            toast.error(err.message || "Erreur lors de l'ajout");
        }
    };

    const handleEditSave = async (id) => {
        if (!editContent.trim()) return;
        try {
            await editBillComment(id, editContent);
            setEditingId(null);
            setEditContent('');
            fetchComments(pagination.page);
            toast.success('Commentaire modifié');
        } catch (err) {
            toast.error(err.message || 'Erreur lors de la modification');
        }
    };

    const handleDelete = (id) => {
        setConfirmModal({
            isOpen: true,
            message: 'Supprimer ce commentaire ?',
            onConfirm: async () => {
                setConfirmModal(p => ({ ...p, isOpen: false }));
                try {
                    await deleteBillComment(id);
                    fetchComments(pagination.page);
                    toast.success('Commentaire supprimé');
                } catch (err) {
                    toast.error(err.message || 'Erreur lors de la suppression');
                }
            },
        });
    };

    if (!isVisible) return null;

    return (
        <div className="space-y-4">
            {/* En-tête */}
            <div className="flex items-center gap-2">
                <MessageSquare size={15} className="text-slate-400" />
                <h3 className="text-sm font-semibold text-slate-200">
                    Commentaires{canView && pagination.total > 0 ? ` (${pagination.total})` : ''}
                </h3>
            </div>

            {/* Liste — uniquement si canView */}
            {canView && (
                <div className="space-y-2">
                    {isLoading ? (
                        <div className="text-center py-4 text-xs text-slate-400 animate-pulse">Chargement...</div>
                    ) : comments.length === 0 ? (
                        <div className="text-center py-4 text-xs italic text-slate-500">Aucun commentaire pour l'instant</div>
                    ) : (
                        comments.map(c => {
                            const isAuthor = c.authorId === user?.userId;
                            const canEditThis = canEditAny || isAuthor;
                            const canDeleteThis = canDeleteAny || isAuthor;
                            const isEditing = editingId === c.id;

                            return (
                                <div key={c.id} className="rounded-xl border border-slate-700/60 bg-slate-900/40 p-3">
                                    <div className="flex justify-between items-start gap-2 mb-1">
                                        <span className="text-xs font-semibold text-slate-200">{c.author?.name || 'Inconnu'}</span>
                                        <span className="text-[10px] text-slate-500">
                                            {new Date(c.createdAt).toLocaleString('fr-FR')}
                                        </span>
                                    </div>

                                    {isEditing ? (
                                        <div className="mt-2 space-y-2">
                                            <textarea
                                                value={editContent}
                                                onChange={(e) => setEditContent(e.target.value)}
                                                className="w-full bg-slate-950/50 border border-slate-700/60 text-sm text-slate-100 p-2 rounded-lg outline-none resize-none focus:border-indigo-500"
                                                rows={2}
                                            />
                                            <div className="flex justify-end gap-2">
                                                <button onClick={() => setEditingId(null)} className="p-1.5 rounded hover:bg-red-500/10 text-red-400">
                                                    <X size={14} />
                                                </button>
                                                <button onClick={() => handleEditSave(c.id)} className="p-1.5 rounded hover:bg-emerald-500/10 text-emerald-400">
                                                    <Save size={14} />
                                                </button>
                                            </div>
                                        </div>
                                    ) : (
                                        <div>
                                            <p className="text-sm text-slate-400 whitespace-pre-wrap">{c.content}</p>
                                            {(canEditThis || canDeleteThis) && (
                                                <div className="flex justify-end gap-3 mt-2 pt-2 border-t border-slate-700/40">
                                                    {canEditThis && (
                                                        <button
                                                            onClick={() => { setEditingId(c.id); setEditContent(c.content); }}
                                                            className="text-slate-500 hover:text-indigo-400 transition-colors"
                                                        >
                                                            <Edit2 size={12} />
                                                        </button>
                                                    )}
                                                    {canDeleteThis && (
                                                        <button
                                                            onClick={() => handleDelete(c.id)}
                                                            className="text-slate-500 hover:text-red-400 transition-colors"
                                                        >
                                                            <Trash2 size={12} />
                                                        </button>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>
                            );
                        })
                    )}

                    {/* Pagination */}
                    {pagination.totalPages > 1 && (
                        <div className="flex justify-between items-center pt-1">
                            <button
                                disabled={pagination.page <= 1}
                                onClick={() => fetchComments(pagination.page - 1)}
                                className="text-xs text-slate-400 hover:text-slate-200 disabled:opacity-30 transition-colors"
                            >
                                ← Précédent
                            </button>
                            <span className="text-xs text-slate-500">{pagination.page} / {pagination.totalPages}</span>
                            <button
                                disabled={pagination.page >= pagination.totalPages}
                                onClick={() => fetchComments(pagination.page + 1)}
                                className="text-xs text-slate-400 hover:text-slate-200 disabled:opacity-30 transition-colors"
                            >
                                Suivant →
                            </button>
                        </div>
                    )}
                </div>
            )}

            {/* Formulaire d'ajout */}
            {canAdd && (
                <form onSubmit={handleAdd} className="flex gap-2">
                    <input
                        type="text"
                        placeholder="Ajouter un commentaire..."
                        value={newComment}
                        onChange={(e) => setNewComment(e.target.value)}
                        className="flex-1 bg-slate-950/50 border border-slate-700/60 rounded-lg px-3 py-2 text-sm text-slate-100 placeholder-slate-500 focus:border-indigo-500 outline-none transition-all"
                    />
                    <button
                        type="submit"
                        disabled={!newComment.trim() || isLoading}
                        className="bg-indigo-600 text-white px-3 rounded-lg hover:bg-indigo-500 transition-all disabled:opacity-50 flex items-center justify-center"
                    >
                        <Send size={14} />
                    </button>
                </form>
            )}
        </div>
    );
}
