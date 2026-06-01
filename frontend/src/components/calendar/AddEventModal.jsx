import React, { useState, useEffect } from 'react';
import Modal from '@/components/Modal';
import { useHasPermission } from '@/hooks/useHasPermission';
import { useCompany } from '@/contexts/CompanyContext';
import toast from 'react-hot-toast';
import { getRanks } from '@/services/employeesService'; // Pour récupérer les rôles/rangs

// Helper pour formater une date en YYYYMMDDTHHMMSSZ
const toRruleDate = (date) => {
    if (!date) return '';
    const pad = (num) => num.toString().padStart(2, '0');
    return `${date.getUTCFullYear()}${pad(date.getUTCMonth() + 1)}${pad(date.getUTCDate())}T${pad(date.getUTCHours())}${pad(date.getUTCMinutes())}${pad(date.getUTCSeconds())}Z`;
};

const AddEventModal = ({ isOpen, onClose, onSave, dateInfo, eventToEdit, categories, durationOnly = false }) => {
    const [title, setTitle] = useState('');
    const [description, setDescription] = useState('');
    const [categoryId, setCategoryId] = useState('');
    const [isAllDay, setIsAllDay] = useState(true);
    const [startTime, setStartTime] = useState('');
    const [endTime, setEndTime] = useState('');
    const [isSystemEvent, setIsSystemEvent] = useState(false);
    const [rrule, setRrule] = useState('');
    const [untilDate, setUntilDate] = useState('');
    const [scope, setScope] = useState('PERSONAL'); // PERSONAL, COMPANY, ROLE
    const [targetRoleId, setTargetRoleId] = useState('');
    const [companyRoles, setCompanyRoles] = useState([]);
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');

    const { selectedCompany } = useCompany();
    const canManageAllCalendar = useHasPermission(selectedCompany ? `CALENDAR.${selectedCompany.id}.MANAGE_ALL` : '');
    const canManageAdmin = useHasPermission('ADMIN.CALENDAR.MANAGE');
    const isEditing = !!eventToEdit;

    useEffect(() => {
        if (isOpen) {
            // Logique de pré-remplissage ou de réinitialisation
            if (isEditing) {
                const start = new Date(eventToEdit.startTime);
                const end = eventToEdit.endTime ? new Date(eventToEdit.endTime) : null;

                setTitle(eventToEdit.title || '');
                setDescription(eventToEdit.description || '');
                setCategoryId(eventToEdit.categoryId || '');
                setIsAllDay(eventToEdit.isAllDay || false);
                setStartTime(start.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }));
                setEndTime(end ? end.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }) : '');
                setIsSystemEvent(eventToEdit.createdBySystem || false);

                const rruleParts = (eventToEdit.rrule || '').split(';UNTIL=');
                setRrule(rruleParts[0] || '');
                if (rruleParts[1]) {
                    const untilIso = rruleParts[1].replace(/(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})Z/, '$1-$2-$3T$4:$5:$6.000Z');
                    const until = new Date(untilIso);
                    setUntilDate(until.toISOString().split('T')[0]);
                } else {
                    setUntilDate('');
                }

                setScope(eventToEdit.companyId ? (eventToEdit.targetRoleId ? 'ROLE' : 'COMPANY') : 'PERSONAL');
                setTargetRoleId(eventToEdit.targetRoleId || '');
                setStartDate(new Date(eventToEdit.startTime).toISOString().split('T')[0]);
                if (eventToEdit.endTime) {
                    setEndDate(new Date(eventToEdit.endTime).toISOString().split('T')[0]);
                } else {
                    setEndDate(new Date(eventToEdit.startTime).toISOString().split('T')[0]);
                }

            } else { // Création
                const start = dateInfo?.date ? new Date(dateInfo.date) : new Date();
                const end = dateInfo?.date ? new Date(start.getTime() + 60 * 60 * 1000) : new Date(start.getTime() + 60 * 60 * 1000);

                setTitle('');
                setDescription('');
                setCategoryId('');
                setIsAllDay(dateInfo?.allDay || true);
                setStartTime(start.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }));
                setEndTime(end.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }));
                setIsSystemEvent(false);
                setRrule('');
                setUntilDate('');
                setScope(selectedCompany ? 'COMPANY' : 'PERSONAL');
                setTargetRoleId('');
                setStartDate(start.toISOString().split('T')[0]);
                setEndDate(end.toISOString().split('T')[0]);
            }

            // CORRECTION : Assurer l'initialisation et le chargement des rôles
            setCompanyRoles([]); // Toujours réinitialiser
            if (selectedCompany && (canManageAllCalendar || canManageAdmin)) {
                getRanks(selectedCompany.id)
                    .then(res => setCompanyRoles(res.data || [])) // Utiliser [] par défaut
                    .catch(() => {
                        toast.error("Erreur chargement des rôles/rangs");
                        setCompanyRoles([]); // Assurer que c'est un tableau vide en cas d'erreur
                    });
            }
        }
    }, [isOpen, eventToEdit, dateInfo, selectedCompany, canManageAllCalendar, isEditing, canManageAdmin]);

    const handleSave = () => {
        if (!title) {
            toast.error('Le titre est obligatoire.');
            return;
        }

        let dateStart = new Date(startDate + 'T00:00:00');
        let dateEnd = null;

        if (!isAllDay) {
            const [startHour, startMinute] = startTime.split(':');
            dateStart.setHours(parseInt(startHour), parseInt(startMinute), 0, 0);
            
            if (endTime) {
                dateEnd = new Date(endDate + 'T00:00:00');
                const [endHour, endMinute] = endTime.split(':');
                dateEnd.setHours(parseInt(endHour), parseInt(endMinute), 0, 0);
            }
        } else {
            // All day event: set to midnight UTC
            dateStart = new Date(Date.UTC(dateStart.getFullYear(), dateStart.getMonth(), dateStart.getDate()));
            dateEnd = null;
        }

        let finalRrule = rrule || null;
        if (finalRrule && untilDate) {
            const [year, month, day] = untilDate.split('-').map(Number);
            const until = new Date(Date.UTC(year, month - 1, day, 23, 59, 59, 999));
            finalRrule += `;UNTIL=${toRruleDate(until)}`;
        }

        const eventData = {
            title,
            description,
            categoryId: categoryId ? parseInt(categoryId) : null,
            startTime: dateStart.toISOString(),
            endTime: dateEnd ? dateEnd.toISOString() : null,
            isAllDay,
            createdBySystem: isSystemEvent,
            rrule: finalRrule,
            companyId: scope === 'PERSONAL' ? null : selectedCompany?.id,
            targetRoleId: scope === 'ROLE' ? (targetRoleId ? parseInt(targetRoleId) : null) : null,
        };

        onSave(eventData);
        onClose();
    };

    const recurrenceOptions = [
        { label: 'Ne se répète pas', value: '' },
        { label: 'Toutes les semaines', value: 'FREQ=WEEKLY;INTERVAL=1' },
        { label: 'Toutes les 2 semaines', value: 'FREQ=WEEKLY;INTERVAL=2' },
        { label: 'Toutes les 4 semaines', value: 'FREQ=WEEKLY;INTERVAL=4' },
        { label: 'Tous les mois', value: 'FREQ=MONTHLY;INTERVAL=1' },
    ];

    return (
        <Modal isOpen={isOpen} onClose={onClose} title={isEditing ? "Modifier l'événement" : "Nouvel événement"}>
            <div className="space-y-6 p-6 text-cca-textSecondary max-h-[80vh] overflow-y-auto glass-scroll">
                <div>
                    <label className="block text-[10px] font-bold uppercase tracking-widest text-cca-textSecondary/50 ml-1 mb-1.5">Titre de l'événement</label>
                    <input 
                        type="text" 
                        placeholder="Ex: Réunion de chantier..."
                        value={title} 
                        onChange={(e) => setTitle(e.target.value)} 
                        className="w-full rounded-xl bg-cca-base border border-cca-border px-4 py-2.5 text-sm text-cca-textPrimary focus:border-brand-primary focus:ring-4 focus:ring-brand-primary/10 transition-all outline-none shadow-sm"
                        disabled={durationOnly}
                    />
                </div>

                {!durationOnly && (
                    <>
                        <div>
                            <label className="block text-[10px] font-bold uppercase tracking-widest text-cca-textSecondary/50 ml-1 mb-1.5">Description (Optionnel)</label>
                            <textarea 
                                value={description} 
                                onChange={(e) => setDescription(e.target.value)} 
                                placeholder="Détails supplémentaires..."
                                rows="3" 
                                className="w-full rounded-xl bg-cca-base border border-cca-border px-4 py-2.5 text-sm text-cca-textPrimary focus:border-brand-primary focus:ring-4 focus:ring-brand-primary/10 transition-all outline-none shadow-sm resize-none"
                            />
                        </div>
                        <div>
                            <label className="block text-[10px] font-bold uppercase tracking-widest text-cca-textSecondary/50 ml-1 mb-1.5">Catégorie</label>
                            <div className="flex gap-2">
                                <select 
                                    value={categoryId} 
                                    onChange={(e) => setCategoryId(e.target.value)} 
                                    className="flex-grow rounded-xl bg-cca-base border border-cca-border px-4 py-2.5 text-sm text-cca-textPrimary focus:border-brand-primary transition-all outline-none shadow-sm appearance-none"
                                >
                                    <option value="">Aucune catégorie</option>
                                    {categories.map(cat => (
                                        <option key={cat.id} value={cat.id}>{cat.name}</option>
                                    ))}
                                </select>
                                <button className="px-4 bg-cca-surface border border-cca-border hover:bg-cca-base rounded-xl text-xs font-bold uppercase tracking-widest text-cca-textSecondary transition-all">Gérer</button>
                            </div>
                        </div>

                        {/* Scope Selection */}
                        {(canManageAllCalendar || canManageAdmin) && (
                            <div>
                                <label className="block text-[10px] font-bold uppercase tracking-widest text-cca-textSecondary/50 ml-1 mb-1.5">Portée de l'événement</label>
                                <select
                                    value={scope}
                                    onChange={(e) => {
                                        setScope(e.target.value);
                                        if (e.target.value !== 'ROLE') setTargetRoleId('');
                                    }}
                                    className="w-full rounded-xl bg-cca-base border border-cca-border px-4 py-2.5 text-sm text-cca-textPrimary focus:border-brand-primary transition-all outline-none shadow-sm"
                                    disabled={!selectedCompany && !canManageAdmin}
                                >
                                    <option value="PERSONAL">🔐 Personnel</option>
                                    {selectedCompany && <option value="COMPANY">🏢 Entreprise</option>}
                                    {selectedCompany && <option value="ROLE">👥 Rôle spécifique</option>}
                                </select>
                            </div>
                        )}

                        {/* Role Selection */}
                        {selectedCompany && scope === 'ROLE' && (
                            <div className="animate-in slide-in-from-top-2 duration-300">
                                <label className="block text-[10px] font-bold uppercase tracking-widest text-cca-textSecondary/50 ml-1 mb-1.5">Sélection du Rôle</label>
                                <select
                                    value={targetRoleId}
                                    onChange={(e) => setTargetRoleId(e.target.value)}
                                    className="w-full rounded-xl bg-cca-base border border-cca-border px-4 py-2.5 text-sm text-cca-textPrimary focus:border-brand-primary transition-all outline-none shadow-sm"
                                    required={scope === 'ROLE'}
                                >
                                    <option value="">-- Sélectionner un rôle --</option>
                                    {companyRoles.map(role => (
                                        <option key={role.id} value={role.id}>{role.name}</option>
                                    ))}
                                </select>
                            </div>
                        )}

                        {/* Recurrence Selection */}
                        <div>
                            <label className="block text-[10px] font-bold uppercase tracking-widest text-cca-textSecondary/50 ml-1 mb-1.5">Récurrence</label>
                            <div className="flex gap-4 items-center">
                                <select 
                                    value={rrule} 
                                    onChange={(e) => setRrule(e.target.value)} 
                                    className="flex-1 rounded-xl bg-cca-base border border-cca-border px-4 py-2.5 text-sm text-cca-textPrimary focus:border-brand-primary transition-all outline-none shadow-sm"
                                >
                                    {recurrenceOptions.map(opt => (
                                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                                    ))}
                                </select>
                                {rrule && (
                                    <div className="flex items-center gap-3 animate-in fade-in slide-in-from-left-2 duration-500">
                                        <span className="text-[10px] font-bold uppercase tracking-widest text-cca-textSecondary/50">Jusqu'au</span>
                                        <input 
                                            type="date" 
                                            value={untilDate} 
                                            onChange={e => setUntilDate(e.target.value)} 
                                            className="rounded-xl bg-cca-base border border-cca-border px-4 py-2 text-sm text-cca-textPrimary focus:border-brand-primary transition-all outline-none shadow-sm"
                                        />
                                    </div>
                                )}
                            </div>
                        </div>
                    </>
                )}

                {/* All Day Checkbox */}
                {!durationOnly && (
                    <div className="flex items-center gap-3 p-3 rounded-2xl bg-cca-base/30 border border-cca-border/50">
                        <input 
                            id="all-day-checkbox" 
                            type="checkbox" 
                            checked={isAllDay} 
                            onChange={(e) => setIsAllDay(e.target.checked)} 
                            className="h-5 w-5 rounded-lg border-cca-border bg-cca-base text-brand-primary focus:ring-brand-primary/20 transition-all cursor-pointer"
                        />
                        <label htmlFor="all-day-checkbox" className="text-sm font-bold text-cca-textPrimary cursor-pointer">Événement sur toute la journée</label>
                    </div>
                )}

                {/* Time Inputs */}
                {(!isAllDay || durationOnly) && (
                    <div className="space-y-4 animate-in zoom-in-95 duration-300">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label className="block text-[10px] font-bold uppercase tracking-widest text-cca-textSecondary/50 ml-1 mb-1.5">Date & Heure de début</label>
                                <div className="flex gap-2">
                                    <input 
                                        type="date" 
                                        value={startDate} 
                                        onChange={(e) => setStartDate(e.target.value)} 
                                        className="w-2/3 rounded-xl bg-cca-base border border-cca-border px-4 py-2.5 text-sm text-cca-textPrimary focus:border-brand-primary transition-all outline-none shadow-sm"
                                    />
                                    <input 
                                        type="time" 
                                        value={startTime} 
                                        onChange={e => setStartTime(e.target.value)} 
                                        className="w-1/3 rounded-xl bg-cca-base border border-cca-border px-4 py-2.5 text-sm text-cca-textPrimary focus:border-brand-primary transition-all outline-none shadow-sm"
                                    />
                                </div>
                            </div>
                            <div>
                                <label className="block text-[10px] font-bold uppercase tracking-widest text-cca-textSecondary/50 ml-1 mb-1.5">Date & Heure de fin</label>
                                <div className="flex gap-2">
                                    <input 
                                        type="date" 
                                        value={endDate} 
                                        onChange={(e) => setEndDate(e.target.value)} 
                                        className="w-2/3 rounded-xl bg-cca-base border border-cca-border px-4 py-2.5 text-sm text-cca-textPrimary focus:border-brand-primary transition-all outline-none shadow-sm"
                                    />
                                    <input 
                                        type="time" 
                                        value={endTime} 
                                        onChange={e => setEndTime(e.target.value)} 
                                        className="w-1/3 rounded-xl bg-cca-base border border-cca-border px-4 py-2.5 text-sm text-cca-textPrimary focus:border-brand-primary transition-all outline-none shadow-sm"
                                    />
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* System Event Checkbox (Admin only) */}
                {canManageAdmin && !durationOnly && (
                    <div className="flex items-center gap-3 p-3 rounded-2xl bg-brand-primary/5 border border-brand-primary/20">
                        <input 
                            id="system-event-checkbox" 
                            type="checkbox" 
                            checked={isSystemEvent} 
                            onChange={(e) => setIsSystemEvent(e.target.checked)} 
                            className="h-5 w-5 rounded-lg border-brand-primary/30 bg-cca-base text-brand-primary focus:ring-brand-primary/20 transition-all cursor-pointer"
                        />
                        <label htmlFor="system-event-checkbox" className="text-sm font-bold text-brand-primary cursor-pointer uppercase tracking-tighter">Événement Système (Admin)</label>
                    </div>
                )}

                {/* Action Buttons */}
                <div className="flex justify-end gap-3 pt-6 border-t border-cca-border mt-4">
                    <button 
                        onClick={onClose} 
                        className="px-6 py-2.5 rounded-xl bg-cca-base border border-cca-border text-cca-textSecondary font-bold text-xs uppercase tracking-widest hover:bg-cca-surface transition-all active:scale-95"
                    >
                        Annuler
                    </button>
                    <button 
                        onClick={handleSave} 
                        className="px-8 py-2.5 rounded-xl bg-brand-primary text-white font-bold text-xs uppercase tracking-widest hover:bg-brand-dark shadow-lg shadow-brand-primary/20 transition-all active:scale-95"
                    >
                        {isEditing ? "Mettre à jour" : "Enregistrer"}
                    </button>
                </div>
            </div>
        </Modal>
    );
};

export default AddEventModal;