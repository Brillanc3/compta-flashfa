// /frontend/src/modules/myCalendar/components/EventModal.jsx
import React, { useState, useEffect, useRef } from 'react';
import PropTypes from 'prop-types';
import Modal from '@/components/Modal';
import { Button } from '@/components/ui/button';
import { myCalendarService } from '../services/myCalendar.services';
import { getUsersAndRanksForChat } from '@/services/companyService';
import toast from 'react-hot-toast';
import { Loader2, Plus, X, Calendar, Clock, Type, AlignLeft, Palette, Users, Image as ImageIcon, Settings, Search, ChevronDown, Pencil, LogOut } from 'lucide-react';
import ReactDatePicker from 'react-datepicker';
import "react-datepicker/dist/react-datepicker.css";
import ReactMarkdown from 'react-markdown';
import remarkBreaks from 'remark-breaks';
import ActionConfirmationModal from '@/components/dashboard/employees/ActionConfirmationModal';
import { useAuth } from '@/contexts/AuthContext';
import { usePermissions } from '@/contexts/PermissionsContext';

const EMPTY_FORM = () => ({
    title: '', description: '',
    startTime: new Date(),
    endTime: new Date(new Date().getTime() + 3600000),
    color: '#3b82f6', categoryId: '', guests: [], repetition: '', isPredefined: false,
});

const fmtDate = (d) => new Date(d).toLocaleString('fr-FR', {
    day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit',
});

const EventModal = ({ isOpen, onClose, event, companyId, onSaved, categories }) => {
    const { user } = useAuth();
    const { has } = usePermissions();
    const isEdit = !!event?.id;
    const isCreator = isEdit && event?.authorId === user?.id;
    const isGuest = isEdit && !isCreator && !!event?.guests?.some(g => g.user?.username === user?.username);
    const canShare = has('mycalendar.events.share');

    const [editMode, setEditMode] = useState(false);
    const [loading, setLoading] = useState(false);
    const [formData, setFormData] = useState(EMPTY_FORM());
    const [availableUsers, setAvailableUsers] = useState([]);
    const [availableRanks, setAvailableRanks] = useState([]);
    const [guestSearch, setGuestSearch] = useState('');
    const [showGuestDropdown, setShowGuestDropdown] = useState(false);
    const [loadingUsers, setLoadingUsers] = useState(false);
    const dropdownRef = useRef(null);
    const [imageFile, setImageFile] = useState(null);
    const [imagePreview, setImagePreview] = useState(null);
    const [isConfirmDeleteOpen, setIsConfirmDeleteOpen] = useState(false);

    const formDataFromEvent = (ev) => ({
        title: ev.title || '',
        description: ev.description || '',
        startTime: new Date(ev.startTime),
        endTime: new Date(ev.endTime),
        color: ev.color || '#3b82f6',
        categoryId: ev.categoryId || '',
        guests: ev.guests?.map(g => g.user.username) || [],
        repetition: ev.repetition || '',
        isPredefined: ev.isPredefined || false,
    });

    useEffect(() => {
        setEditMode(false);
        if (event) {
            setFormData(formDataFromEvent(event));
            setImagePreview(event.imageUrl);
        } else {
            setFormData(EMPTY_FORM());
            setImagePreview(null);
        }
        setImageFile(null);
    }, [event, isOpen]);

    useEffect(() => {
        if (!isOpen || !canShare) return;
        setLoadingUsers(true);
        getUsersAndRanksForChat()
            .then(({ users = [], ranks = [] }) => {
                setAvailableUsers(users.filter(u => u.username));
                setAvailableRanks(ranks);
            })
            .catch(() => {})
            .finally(() => setLoadingUsers(false));
    }, [isOpen, canShare]);

    useEffect(() => {
        const handler = (e) => {
            if (dropdownRef.current && !dropdownRef.current.contains(e.target)) setShowGuestDropdown(false);
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, []);

    const handleChange = (e) => {
        const { name, value, type, checked } = e.target;
        setFormData(prev => ({ ...prev, [name]: type === 'checkbox' ? checked : value }));
    };

    const addGuest = (username) => {
        if (!username || formData.guests.includes(username)) return;
        setFormData(prev => ({ ...prev, guests: [...prev.guests, username] }));
    };

    const addRankGuests = (rankId) => {
        const newGuests = availableUsers
            .filter(u => u.rankId === rankId && u.username && !formData.guests.includes(u.username))
            .map(u => u.username);
        if (newGuests.length === 0) return;
        setFormData(prev => ({ ...prev, guests: [...prev.guests, ...newGuests] }));
    };

    const handleRemoveGuest = (username) => {
        setFormData(prev => ({ ...prev, guests: prev.guests.filter(g => g !== username) }));
    };

    const handleImageChange = (e) => {
        const file = e.target.files[0];
        if (file) { setImageFile(file); setImagePreview(URL.createObjectURL(file)); }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        try {
            let savedEvent;
            if (isEdit) {
                savedEvent = await myCalendarService.updateEvent(event.id, formData, companyId);
                toast.success("Événement mis à jour");
            } else {
                savedEvent = await myCalendarService.createEvent(formData, companyId);
                toast.success("Événement créé");
            }
            if (imageFile) await myCalendarService.uploadImage(savedEvent.id, imageFile);
            onSaved();
            onClose();
        } catch (error) {
            toast.error(error.response?.data?.message || "Une erreur est survenue");
        } finally {
            setLoading(false);
        }
    };

    const handleDelete = async () => {
        setLoading(true);
        try {
            await myCalendarService.deleteEvent(event.id, companyId);
            toast.success(isCreator ? "Événement supprimé" : "Vous vous êtes retiré de l'événement");
            onSaved();
            onClose();
        } catch (error) {
            toast.error(error.response?.data?.message || "Une erreur est survenue");
        } finally {
            setLoading(false);
            setIsConfirmDeleteOpen(false);
        }
    };

    const handleCancelEdit = () => {
        if (event) { setFormData(formDataFromEvent(event)); setImageFile(null); setImagePreview(event.imageUrl); }
        setEditMode(false);
    };

    const filteredUsers = availableUsers.filter(u =>
        !formData.guests.includes(u.username) &&
        (u.fullName?.toLowerCase().includes(guestSearch.toLowerCase()) ||
         u.username?.toLowerCase().includes(guestSearch.toLowerCase()))
    );
    const filteredRanks = availableRanks.filter(r =>
        r.name?.toLowerCase().includes(guestSearch.toLowerCase())
    );
    const getUserDisplayName = (username) => {
        const found = availableUsers.find(u => u.username === username);
        return found ? found.fullName || username : username;
    };

    // ─── Vue lecture seule ────────────────────────────────────────────────────
    if (isEdit && !editMode) {
        return (
            <>
                <Modal isOpen={isOpen} onClose={onClose} title={event.title}>
                    <div className="space-y-5 w-full max-w-[95vw] sm:max-w-[600px]">
                        {event.imageUrl && (
                            <div className="w-full aspect-video rounded-xl overflow-hidden">
                                <img src={event.imageUrl} alt="" className="w-full h-full object-cover" />
                            </div>
                        )}

                        <div className="flex flex-wrap gap-3 text-sm text-cca-textSecondary">
                            <div className="flex items-center gap-1.5">
                                <Calendar className="h-4 w-4" /><span>{fmtDate(event.startTime)}</span>
                            </div>
                            <span>→</span>
                            <div className="flex items-center gap-1.5">
                                <Clock className="h-4 w-4" /><span>{fmtDate(event.endTime)}</span>
                            </div>
                        </div>

                        {(event.color || event.categoryId) && (
                            <div className="flex items-center gap-2">
                                {event.color && <span className="w-4 h-4 rounded-full shrink-0" style={{ backgroundColor: event.color }} />}
                                {categories?.find(c => c.id === event.categoryId) && (
                                    <span className="text-xs text-cca-textSecondary">
                                        {categories.find(c => c.id === event.categoryId).name}
                                    </span>
                                )}
                            </div>
                        )}

                        {event.description && (
                            <div className="bg-cca-surface/50 border border-cca-border rounded-xl p-4 prose prose-invert prose-sm max-w-none max-h-48 overflow-y-auto">
                                <ReactMarkdown remarkPlugins={[remarkBreaks]}>{event.description}</ReactMarkdown>
                            </div>
                        )}

                        {event.guests?.length > 0 && (
                            <div className="space-y-2">
                                <div className="flex items-center gap-2 text-sm font-medium text-cca-textSecondary">
                                    <Users className="h-4 w-4" /> Invités ({event.guests.length})
                                </div>
                                <div className="flex flex-wrap gap-2">
                                    {event.guests.map(g => (
                                        <div key={g.user.username} className="flex items-center gap-1.5 bg-brand-primary/10 border border-brand-primary/20 text-brand-primary px-2 py-1 rounded-full text-xs">
                                            <img src={g.user.imageUrl || `https://api.dicebear.com/7.x/avataaars/svg?seed=${g.user.username}`} alt="" className="w-4 h-4 rounded-full object-cover" />
                                            <span>{g.user.name || g.user.username}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        <div className="flex items-center justify-between pt-4 border-t border-cca-border">
                            {isGuest ? (
                                <Button type="button" variant="outline" className="text-red-500 border-red-500/20 hover:bg-red-500/10" onClick={() => setIsConfirmDeleteOpen(true)} disabled={loading}>
                                    <LogOut className="h-4 w-4 mr-2" /> Se retirer
                                </Button>
                            ) : <div />}
                            <div className="flex gap-3">
                                <Button type="button" variant="ghost" onClick={onClose}>Fermer</Button>
                                {isCreator && (
                                    <Button type="button" onClick={() => setEditMode(true)} className="bg-brand-primary text-white hover:bg-brand-primary/90">
                                        <Pencil className="h-4 w-4 mr-2" /> Modifier
                                    </Button>
                                )}
                            </div>
                        </div>
                    </div>
                </Modal>

                <ActionConfirmationModal
                    isOpen={isConfirmDeleteOpen}
                    onClose={() => setIsConfirmDeleteOpen(false)}
                    title="Se retirer de l'événement"
                    message="Êtes-vous sûr de vouloir vous retirer de cet événement ?"
                    onConfirm={handleDelete}
                    loading={loading}
                />
            </>
        );
    }

    // ─── Formulaire (création ou modification par le créateur) ────────────────
    return (
        <>
            <Modal isOpen={isOpen} onClose={onClose} title={isEdit ? "Modifier l'événement" : "Nouvel événement"}>
                <form onSubmit={handleSubmit} className="space-y-6 w-full max-w-[95vw] sm:max-w-[600px] md:min-w-[550px]">
                    {/* Image */}
                    <div className="relative group flex flex-col items-center justify-center p-4 border-2 border-dashed border-cca-border rounded-xl hover:border-brand-primary transition-colors cursor-pointer">
                        {imagePreview ? (
                            <div className="relative w-full aspect-video rounded-lg overflow-hidden">
                                <img src={imagePreview} alt="Preview" className="w-full h-full object-cover" />
                                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                    <Button type="button" variant="ghost" className="text-white" onClick={() => { setImageFile(null); setImagePreview(null); }}>
                                        <X className="h-6 w-6" />
                                    </Button>
                                </div>
                            </div>
                        ) : (
                            <div className="flex flex-col items-center py-4 text-cca-textSecondary">
                                <ImageIcon className="h-10 w-10 mb-2 opacity-50" />
                                <span className="text-sm">Ajouter une image</span>
                            </div>
                        )}
                        <input type="file" className="absolute inset-0 opacity-0 cursor-pointer" accept="image/*" onChange={handleImageChange} />
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="col-span-full space-y-1.5">
                            <label className="flex items-center gap-2 text-sm font-medium text-cca-textSecondary">
                                <Type className="h-4 w-4" /> Titre
                            </label>
                            <input required name="title" value={formData.title} onChange={handleChange}
                                className="w-full bg-cca-base border border-cca-border rounded-lg px-3 py-2 text-cca-textPrimary focus:ring-2 focus:ring-brand-primary/50 outline-none transition-all"
                                placeholder="Titre de l'événement" />
                        </div>

                        <div className="space-y-1.5">
                            <label className="flex items-center gap-2 text-sm font-medium text-cca-textSecondary">
                                <Calendar className="h-4 w-4" /> Début
                            </label>
                            <ReactDatePicker selected={formData.startTime} onChange={(d) => setFormData(p => ({ ...p, startTime: d }))}
                                showTimeSelect timeFormat="HH:mm" dateFormat="dd/MM/yyyy HH:mm" timeIntervals={15}
                                className="w-full bg-cca-base border border-cca-border rounded-lg px-3 py-2 text-cca-textPrimary focus:ring-2 focus:ring-brand-primary/50 outline-none" />
                        </div>
                        <div className="space-y-1.5">
                            <label className="flex items-center gap-2 text-sm font-medium text-cca-textSecondary">
                                <Clock className="h-4 w-4" /> Fin
                            </label>
                            <ReactDatePicker selected={formData.endTime} onChange={(d) => setFormData(p => ({ ...p, endTime: d }))}
                                showTimeSelect timeFormat="HH:mm" dateFormat="dd/MM/yyyy HH:mm" timeIntervals={15}
                                className="w-full bg-cca-base border border-cca-border rounded-lg px-3 py-2 text-cca-textPrimary focus:ring-2 focus:ring-brand-primary/50 outline-none" />
                        </div>

                        <div className="space-y-1.5">
                            <label className="flex items-center gap-2 text-sm font-medium text-cca-textSecondary">
                                <Palette className="h-4 w-4" /> Couleur
                            </label>
                            <div className="flex items-center gap-3">
                                <input type="color" name="color" value={formData.color} onChange={handleChange}
                                    className="w-10 h-10 rounded-lg bg-transparent border-none cursor-pointer" />
                                <span className="text-xs font-mono opacity-60">{formData.color}</span>
                            </div>
                        </div>
                        <div className="space-y-1.5">
                            <label className="flex items-center gap-2 text-sm font-medium text-cca-textSecondary">
                                <AlignLeft className="h-4 w-4" /> Catégorie
                            </label>
                            <select name="categoryId" value={formData.categoryId} onChange={handleChange}
                                className="w-full bg-cca-base border border-cca-border rounded-lg px-3 py-2 text-cca-textPrimary focus:ring-2 focus:ring-brand-primary/50 outline-none">
                                <option value="">Aucune</option>
                                {categories?.map(cat => <option key={cat.id} value={cat.id}>{cat.name}</option>)}
                            </select>
                        </div>
                    </div>

                    {/* Description */}
                    <div className="space-y-1.5">
                        <label className="flex items-center gap-2 text-sm font-medium text-cca-textSecondary">
                            <AlignLeft className="h-4 w-4" /> Description (Markdown)
                        </label>
                        <div className="flex flex-col sm:grid sm:grid-cols-2 gap-4 h-[400px] sm:h-64">
                            <textarea name="description" value={formData.description} onChange={handleChange}
                                className="w-full h-1/2 sm:h-full bg-cca-base border border-cca-border rounded-lg px-3 py-2 text-cca-textPrimary resize-none focus:ring-2 focus:ring-brand-primary/50 outline-none font-mono text-sm"
                                placeholder="Détails de l'événement..." />
                            <div className="w-full h-1/2 sm:h-full bg-cca-surface/50 border border-cca-border rounded-lg p-3 overflow-y-auto prose prose-invert prose-sm max-w-none">
                                {formData.description
                                    ? <ReactMarkdown remarkPlugins={[remarkBreaks]}>{formData.description}</ReactMarkdown>
                                    : <span className="text-cca-textSecondary italic">Aperçu...</span>}
                            </div>
                        </div>
                    </div>

                    {/* Invités */}
                    <div className="space-y-1.5">
                        <label className="flex items-center gap-2 text-sm font-medium text-cca-textSecondary">
                            <Users className="h-4 w-4" /> Invités
                        </label>
                        {canShare ? (
                            <div className="relative" ref={dropdownRef}>
                                <div className="flex items-center gap-2 w-full bg-cca-base border border-cca-border rounded-lg px-3 py-2 cursor-pointer"
                                    onClick={() => setShowGuestDropdown(v => !v)}>
                                    <Search className="h-4 w-4 text-cca-textSecondary shrink-0" />
                                    <input value={guestSearch}
                                        onChange={(e) => { setGuestSearch(e.target.value); setShowGuestDropdown(true); }}
                                        onClick={(e) => { e.stopPropagation(); setShowGuestDropdown(true); }}
                                        className="flex-1 bg-transparent outline-none text-cca-textPrimary text-sm placeholder:text-cca-textSecondary"
                                        placeholder="Rechercher un utilisateur ou un rang..." />
                                    <ChevronDown className={`h-4 w-4 text-cca-textSecondary shrink-0 transition-transform ${showGuestDropdown ? 'rotate-180' : ''}`} />
                                </div>
                                {showGuestDropdown && (
                                    <div className="absolute z-50 mt-1 w-full bg-cca-surface border border-cca-border rounded-xl shadow-xl overflow-hidden max-h-64 overflow-y-auto">
                                        {loadingUsers ? (
                                            <div className="flex items-center justify-center py-6">
                                                <Loader2 className="h-5 w-5 animate-spin text-brand-primary" />
                                            </div>
                                        ) : (
                                            <>
                                                {filteredRanks.length > 0 && (
                                                    <div>
                                                        <div className="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-cca-textSecondary bg-cca-base/50">Rangs</div>
                                                        {filteredRanks.map(rank => {
                                                            const count = availableUsers.filter(u => u.rankId === rank.id && !formData.guests.includes(u.username)).length;
                                                            return (
                                                                <button key={rank.id} type="button" disabled={count === 0}
                                                                    onClick={() => { addRankGuests(rank.id); setShowGuestDropdown(false); setGuestSearch(''); }}
                                                                    className="w-full flex items-center justify-between px-3 py-2 hover:bg-brand-primary/10 transition-colors text-left">
                                                                    <span className="text-sm text-cca-textPrimary font-medium">{rank.name}</span>
                                                                    <span className="text-xs text-cca-textSecondary">{count === 0 ? 'Tous ajoutés' : `+${count} membres`}</span>
                                                                </button>
                                                            );
                                                        })}
                                                    </div>
                                                )}
                                                {filteredUsers.length > 0 && (
                                                    <div>
                                                        <div className="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-cca-textSecondary bg-cca-base/50">Utilisateurs</div>
                                                        {filteredUsers.map(u => (
                                                            <button key={u.userId} type="button"
                                                                onClick={() => { addGuest(u.username); setGuestSearch(''); }}
                                                                className="w-full flex items-center gap-3 px-3 py-2 hover:bg-brand-primary/10 transition-colors">
                                                                <img src={u.imageUrl || `https://api.dicebear.com/7.x/avataaars/svg?seed=${u.username}`} alt="" className="w-7 h-7 rounded-full object-cover shrink-0" />
                                                                <div className="text-left min-w-0">
                                                                    <div className="text-sm text-cca-textPrimary truncate">{u.fullName}</div>
                                                                    <div className="text-xs text-cca-textSecondary truncate">@{u.username}{u.rankName ? ` · ${u.rankName}` : ''}</div>
                                                                </div>
                                                            </button>
                                                        ))}
                                                    </div>
                                                )}
                                                {filteredRanks.length === 0 && filteredUsers.length === 0 && (
                                                    <div className="py-6 text-center text-sm text-cca-textSecondary">Aucun résultat</div>
                                                )}
                                            </>
                                        )}
                                    </div>
                                )}
                            </div>
                        ) : (
                            <div className="flex gap-2">
                                <input value={guestSearch} onChange={(e) => setGuestSearch(e.target.value)}
                                    onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addGuest(guestSearch.trim()); setGuestSearch(''); } }}
                                    className="flex-1 bg-cca-base border border-cca-border rounded-lg px-3 py-2 text-cca-textPrimary outline-none focus:ring-2 focus:ring-brand-primary/50"
                                    placeholder="Nom d'utilisateur" />
                                <Button type="button" onClick={() => { addGuest(guestSearch.trim()); setGuestSearch(''); }} variant="outline" className="px-3">
                                    <Plus className="h-4 w-4" />
                                </Button>
                            </div>
                        )}
                        <div className="flex flex-wrap gap-2 mt-2">
                            {formData.guests.map(username => (
                                <div key={username} className="flex items-center gap-1.5 bg-brand-primary/10 border border-brand-primary/20 text-brand-primary px-2 py-1 rounded-full text-xs">
                                    {canShare && availableUsers.find(u => u.username === username) && (
                                        <img src={availableUsers.find(u => u.username === username)?.imageUrl || `https://api.dicebear.com/7.x/avataaars/svg?seed=${username}`} alt="" className="w-4 h-4 rounded-full object-cover" />
                                    )}
                                    <span>{canShare ? getUserDisplayName(username) : username}</span>
                                    <button type="button" onClick={() => handleRemoveGuest(username)} className="hover:text-red-500 transition-colors">
                                        <X className="h-3 w-3" />
                                    </button>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Options admin */}
                    {(has('ADMIN.MYCALENDAR.MANAGE') || user?.permissions?.includes('ADMIN.MYCALENDAR.MANAGE') || user?.permissions?.includes('ADMIN.*')) && (
                        <div className="p-4 rounded-xl bg-brand-primary/5 border border-brand-primary/20 space-y-3">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <Settings className="h-4 w-4 text-brand-primary" />
                                    <span className="text-sm font-semibold text-cca-textPrimary">Options Administrateur</span>
                                </div>
                                <label className="relative inline-flex items-center cursor-pointer">
                                    <input type="checkbox" name="isPredefined" checked={formData.isPredefined} onChange={handleChange} className="sr-only peer" />
                                    <div className="w-11 h-6 bg-cca-base peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-brand-primary"></div>
                                </label>
                            </div>
                            <p className="text-[11px] text-cca-textSecondary">
                                Un événement global sera visible par <strong>tous les utilisateurs</strong> du système et ne pourra pas être modifié par les non-admins.
                            </p>
                        </div>
                    )}

                    {/* Actions */}
                    <div className="flex items-center justify-between pt-4 border-t border-cca-border">
                        {editMode ? (
                            <Button type="button" variant="outline" className="text-red-500 border-red-500/20 hover:bg-red-500/10" onClick={() => setIsConfirmDeleteOpen(true)} disabled={loading}>
                                Supprimer
                            </Button>
                        ) : <div />}
                        <div className="flex gap-3">
                            <Button type="button" variant="ghost" onClick={editMode ? handleCancelEdit : onClose} disabled={loading}>
                                {editMode ? 'Retour' : 'Annuler'}
                            </Button>
                            <Button type="submit" disabled={loading} className="bg-brand-primary text-white hover:bg-brand-primary/90 min-w-[100px]">
                                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : (isEdit ? "Enregistrer" : "Créer")}
                            </Button>
                        </div>
                    </div>
                </form>
            </Modal>

            <ActionConfirmationModal
                isOpen={isConfirmDeleteOpen}
                onClose={() => setIsConfirmDeleteOpen(false)}
                title="Supprimer l'événement"
                message="Êtes-vous sûr de vouloir supprimer cet événement ? Cette action est irréversible."
                onConfirm={handleDelete}
                loading={loading}
            />
        </>
    );
};

EventModal.propTypes = {
    isOpen: PropTypes.bool.isRequired,
    onClose: PropTypes.func.isRequired,
    event: PropTypes.object,
    companyId: PropTypes.number,
    onSaved: PropTypes.func.isRequired,
    categories: PropTypes.array
};

export default EventModal;
