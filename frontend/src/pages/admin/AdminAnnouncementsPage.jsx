// /frontend/src/pages/admin/AdminAnnouncementsPage.jsx
import React, { useEffect, useState } from 'react';
import { toast } from 'react-hot-toast';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkBreaks from 'remark-breaks';
import { Plus, Pencil, Trash2, Eye, EyeOff, ChevronDown, ChevronUp } from 'lucide-react';
import ConfirmationModal from '@/components/ui/ConfirmationModal';
import {
    listAnnouncements,
    createAnnouncement,
    updateAnnouncement,
    deleteAnnouncement,
} from '../../services/announcementService';

/* ============================================================
   ACTION TYPES
   ============================================================ */
const ACTION_TYPES = [
    { value: 'dismiss', label: 'Fermer le modal' },
    { value: 'reload', label: 'Recharger la page' },
    { value: 'redirect', label: 'Rediriger vers une URL' },
];

const emptyAction = () => ({ label: '', type: 'dismiss', url: '' });
const emptyForm = () => ({
    title: '',
    body: '',
    isActive: false,
    actions: [emptyAction()],
});

/* ============================================================
   MAIN PAGE
   ============================================================ */
const AdminAnnouncementsPage = () => {
    const [announcements, setAnnouncements] = useState([]);
    const [loading, setLoading] = useState(true);
    const [formOpen, setFormOpen] = useState(false);
    const [editing, setEditing] = useState(null);
    const [form, setForm] = useState(emptyForm());
    const [saving, setSaving] = useState(false);
    const [previewOpen, setPreviewOpen] = useState(false);
    const [confirmModal, setConfirmModal] = useState({ isOpen: false, message: '', onConfirm: null });

    const load = async () => {
        try {
            const data = await listAnnouncements();
            setAnnouncements(data);
        } catch {
            toast.error('Impossible de charger les annonces.');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { load(); }, []);

    const openCreate = () => {
        setEditing(null);
        setForm(emptyForm());
        setPreviewOpen(false);
        setFormOpen(true);
    };

    const openEdit = (ann) => {
        setEditing(ann.id);
        setForm({
            title: ann.title,
            body: ann.body,
            isActive: ann.isActive,
            actions: Array.isArray(ann.actions) && ann.actions.length > 0
                ? ann.actions.map((a) => ({ label: a.label || '', type: a.type || 'dismiss', url: a.url || '' }))
                : [emptyAction()],
        });
        setPreviewOpen(false);
        setFormOpen(true);
    };

    const handleDelete = (id) => {
        setConfirmModal({
            isOpen: true,
            message: 'Supprimer cette annonce ?',
            onConfirm: async () => {
                setConfirmModal(p => ({ ...p, isOpen: false }));
                try {
                    await deleteAnnouncement(id);
                    toast.success('Annonce supprimée.');
                    load();
                } catch {
                    toast.error('Impossible de supprimer.');
                }
            },
        });
    };

    const handleToggleActive = async (ann) => {
        try {
            await updateAnnouncement(ann.id, { isActive: !ann.isActive });
            toast.success(ann.isActive ? 'Annonce désactivée.' : 'Annonce activée.');
            load();
        } catch {
            toast.error('Impossible de modifier le statut.');
        }
    };

    const handleSave = async () => {
        if (!form.title.trim()) { toast.error('Titre requis.'); return; }
        if (!form.body.trim()) { toast.error('Contenu requis.'); return; }

        const validActions = form.actions
            .filter((a) => a.label.trim())
            .map((a) => ({ label: a.label, type: a.type, ...(a.type === 'redirect' ? { url: a.url } : {}) }));

        const payload = { ...form, actions: validActions };

        setSaving(true);
        try {
            if (editing) {
                await updateAnnouncement(editing, payload);
                toast.success('Annonce mise à jour.');
            } else {
                await createAnnouncement(payload);
                toast.success('Annonce créée.');
            }
            setFormOpen(false);
            load();
        } catch {
            toast.error('Impossible de sauvegarder.');
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="max-w-4xl mx-auto space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-heading font-bold text-cca-textPrimary">Annonces</h1>
                    <p className="text-sm text-cca-textSecondary mt-1">
                        Gérez les modals d'annonce affichés aux utilisateurs.
                    </p>
                </div>
                <button
                    onClick={openCreate}
                    className="flex items-center gap-2 px-4 py-2 bg-brand-primary text-white rounded-lg text-sm font-semibold hover:opacity-90 transition-opacity"
                >
                    <Plus size={16} /> Nouvelle annonce
                </button>
            </div>

            {formOpen && (
                <AnnouncementForm
                    form={form}
                    setForm={setForm}
                    onSave={handleSave}
                    onCancel={() => setFormOpen(false)}
                    saving={saving}
                    isEdit={Boolean(editing)}
                    previewOpen={previewOpen}
                    setPreviewOpen={setPreviewOpen}
                />
            )}

            {loading ? (
                <p className="text-cca-textSecondary text-sm">Chargement…</p>
            ) : announcements.length === 0 ? (
                <EmptyState onCreate={openCreate} />
            ) : (
                <div className="space-y-3">
                    {announcements.map((ann) => (
                        <AnnouncementRow
                            key={ann.id}
                            ann={ann}
                            onEdit={() => openEdit(ann)}
                            onDelete={() => handleDelete(ann.id)}
                            onToggle={() => handleToggleActive(ann)}
                        />
                    ))}
                </div>
            )}
            <ConfirmationModal
                isOpen={confirmModal.isOpen}
                onClose={() => setConfirmModal(p => ({ ...p, isOpen: false }))}
                onConfirm={confirmModal.onConfirm}
                message={confirmModal.message}
            />
        </div>
    );
};

/* ============================================================
   FORM COMPONENT
   ============================================================ */
const AnnouncementForm = ({ form, setForm, onSave, onCancel, saving, isEdit, previewOpen, setPreviewOpen }) => {
    const set = (key, val) => setForm((f) => ({ ...f, [key]: val }));

    const setAction = (idx, key, val) => {
        const next = form.actions.map((a, i) => i === idx ? { ...a, [key]: val } : a);
        set('actions', next);
    };

    const addAction = () => set('actions', [...form.actions, emptyAction()]);
    const removeAction = (idx) => set('actions', form.actions.filter((_, i) => i !== idx));

    return (
        <div className="rounded-xl border border-cca-border bg-cca-surface p-6 space-y-5">
            <h2 className="font-heading font-bold text-cca-textPrimary text-lg">
                {isEdit ? 'Modifier l\'annonce' : 'Nouvelle annonce'}
            </h2>

            {/* Title */}
            <div>
                <label className="block text-sm font-medium text-cca-textSecondary mb-1">Titre</label>
                <input
                    type="text"
                    value={form.title}
                    onChange={(e) => set('title', e.target.value)}
                    placeholder="Ex: Mise à jour disponible"
                    className="w-full bg-cca-base border border-cca-border rounded-lg px-3 py-2 text-cca-textPrimary text-sm focus:outline-none focus:border-brand-primary"
                />
            </div>

            {/* Body */}
            <div>
                <div className="flex items-center justify-between mb-1">
                    <label className="block text-sm font-medium text-cca-textSecondary">Contenu (Markdown)</label>
                    <button
                        type="button"
                        onClick={() => setPreviewOpen(!previewOpen)}
                        className="flex items-center gap-1 text-xs text-cca-textSecondary hover:text-cca-textPrimary transition-colors"
                    >
                        {previewOpen ? <EyeOff size={12} /> : <Eye size={12} />}
                        {previewOpen ? 'Éditer' : 'Aperçu'}
                    </button>
                </div>
                {previewOpen ? (
                    <div className="min-h-[120px] p-3 rounded-lg bg-cca-base border border-cca-border prose prose-invert prose-sm max-w-none text-cca-textPrimary">
                        <ReactMarkdown remarkPlugins={[remarkGfm, remarkBreaks]}>
                            {form.body || '*Aucun contenu*'}
                        </ReactMarkdown>
                    </div>
                ) : (
                    <textarea
                        value={form.body}
                        onChange={(e) => set('body', e.target.value)}
                        rows={6}
                        placeholder="Le contenu de l'annonce en Markdown..."
                        className="w-full bg-cca-base border border-cca-border rounded-lg px-3 py-2 text-cca-textPrimary text-sm focus:outline-none focus:border-brand-primary resize-y font-mono"
                    />
                )}
            </div>

            {/* Actions */}
            <div>
                <div className="flex items-center justify-between mb-2">
                    <label className="block text-sm font-medium text-cca-textSecondary">Actions</label>
                    <button
                        type="button"
                        onClick={addAction}
                        className="text-xs text-brand-primary hover:opacity-80 flex items-center gap-1"
                    >
                        <Plus size={12} /> Ajouter
                    </button>
                </div>
                <div className="space-y-2">
                    {form.actions.map((action, idx) => (
                        <div key={idx} className="flex items-start gap-2 p-3 rounded-lg bg-cca-base border border-cca-border">
                            <div className="flex-1 grid grid-cols-1 sm:grid-cols-3 gap-2">
                                <input
                                    type="text"
                                    value={action.label}
                                    onChange={(e) => setAction(idx, 'label', e.target.value)}
                                    placeholder="Libellé du bouton"
                                    className="bg-cca-surface border border-cca-border rounded-md px-2 py-1.5 text-sm text-cca-textPrimary focus:outline-none focus:border-brand-primary"
                                />
                                <select
                                    value={action.type}
                                    onChange={(e) => setAction(idx, 'type', e.target.value)}
                                    className="bg-cca-surface border border-cca-border rounded-md px-2 py-1.5 text-sm text-cca-textPrimary focus:outline-none focus:border-brand-primary"
                                >
                                    {ACTION_TYPES.map((t) => (
                                        <option key={t.value} value={t.value}>{t.label}</option>
                                    ))}
                                </select>
                                {action.type === 'redirect' && (
                                    <input
                                        type="text"
                                        value={action.url}
                                        onChange={(e) => setAction(idx, 'url', e.target.value)}
                                        placeholder="/chemin ou https://..."
                                        className="bg-cca-surface border border-cca-border rounded-md px-2 py-1.5 text-sm text-cca-textPrimary focus:outline-none focus:border-brand-primary"
                                    />
                                )}
                            </div>
                            {form.actions.length > 1 && (
                                <button
                                    type="button"
                                    onClick={() => removeAction(idx)}
                                    className="text-red-400 hover:text-red-300 mt-1 transition-colors"
                                >
                                    <Trash2 size={14} />
                                </button>
                            )}
                        </div>
                    ))}
                </div>
            </div>

            {/* isActive */}
            <label className="flex items-center gap-3 cursor-pointer">
                <div className="relative">
                    <input
                        type="checkbox"
                        checked={form.isActive}
                        onChange={(e) => set('isActive', e.target.checked)}
                        className="sr-only"
                    />
                    <div className={`w-10 h-6 rounded-full transition-colors ${form.isActive ? 'bg-brand-primary' : 'bg-cca-border'}`} />
                    <div className={`absolute top-1 left-1 w-4 h-4 rounded-full bg-white transition-transform ${form.isActive ? 'translate-x-4' : ''}`} />
                </div>
                <span className="text-sm text-cca-textSecondary">
                    Activer immédiatement <span className="text-xs">(désactive les autres annonces)</span>
                </span>
            </label>

            <div className="flex justify-end gap-3 pt-2 border-t border-cca-border">
                <button
                    type="button"
                    onClick={onCancel}
                    className="px-4 py-2 rounded-lg border border-cca-border text-sm text-cca-textSecondary hover:text-cca-textPrimary transition-colors"
                >
                    Annuler
                </button>
                <button
                    type="button"
                    onClick={onSave}
                    disabled={saving}
                    className="px-5 py-2 rounded-lg bg-brand-primary text-white text-sm font-semibold hover:opacity-90 disabled:opacity-50 transition-opacity"
                >
                    {saving ? 'Sauvegarde…' : isEdit ? 'Mettre à jour' : 'Créer'}
                </button>
            </div>
        </div>
    );
};

/* ============================================================
   ROW COMPONENT
   ============================================================ */
const AnnouncementRow = ({ ann, onEdit, onDelete, onToggle }) => {
    const [expanded, setExpanded] = useState(false);
    const actionLabels = Array.isArray(ann.actions) ? ann.actions.map((a) => a.label).filter(Boolean) : [];

    return (
        <div className={`rounded-xl border bg-cca-surface transition-colors ${ann.isActive ? 'border-brand-primary/60' : 'border-cca-border'}`}>
            <div className="flex items-center gap-3 p-4">
                <button
                    type="button"
                    onClick={() => setExpanded(!expanded)}
                    className="text-cca-textSecondary hover:text-cca-textPrimary transition-colors"
                >
                    {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                </button>

                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                        <span className="font-semibold text-cca-textPrimary truncate">{ann.title}</span>
                        {ann.isActive && (
                            <span className="px-2 py-0.5 rounded-full bg-green-500/20 text-green-400 text-xs font-medium">Active</span>
                        )}
                    </div>
                    {actionLabels.length > 0 && (
                        <p className="text-xs text-cca-textSecondary mt-0.5">
                            Actions : {actionLabels.join(', ')}
                        </p>
                    )}
                </div>

                <div className="flex items-center gap-1">
                    <button
                        onClick={onToggle}
                        title={ann.isActive ? 'Désactiver' : 'Activer'}
                        className={`p-2 rounded-lg transition-colors ${ann.isActive ? 'text-green-400 hover:bg-green-500/10' : 'text-cca-textSecondary hover:text-cca-textPrimary hover:bg-cca-base'}`}
                    >
                        {ann.isActive ? <Eye size={16} /> : <EyeOff size={16} />}
                    </button>
                    <button
                        onClick={onEdit}
                        className="p-2 rounded-lg text-cca-textSecondary hover:text-cca-textPrimary hover:bg-cca-base transition-colors"
                    >
                        <Pencil size={16} />
                    </button>
                    <button
                        onClick={onDelete}
                        className="p-2 rounded-lg text-red-400 hover:bg-red-500/10 transition-colors"
                    >
                        <Trash2 size={16} />
                    </button>
                </div>
            </div>

            {expanded && (
                <div className="px-4 pb-4 border-t border-cca-border pt-3">
                    <div className="prose prose-invert prose-sm max-w-none text-cca-textSecondary">
                        <ReactMarkdown remarkPlugins={[remarkGfm, remarkBreaks]}>
                            {ann.body}
                        </ReactMarkdown>
                    </div>
                </div>
            )}
        </div>
    );
};

/* ============================================================
   EMPTY STATE
   ============================================================ */
const EmptyState = ({ onCreate }) => (
    <div className="rounded-xl border border-dashed border-cca-border bg-cca-surface p-10 text-center">
        <p className="text-cca-textSecondary mb-4">Aucune annonce. Créez-en une pour informer vos utilisateurs.</p>
        <button
            onClick={onCreate}
            className="px-4 py-2 bg-brand-primary text-white rounded-lg text-sm font-semibold hover:opacity-90"
        >
            Créer une annonce
        </button>
    </div>
);

export default AdminAnnouncementsPage;
