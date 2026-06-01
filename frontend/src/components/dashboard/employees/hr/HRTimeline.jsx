// frontend/src/components/dashboard/employees/hr/HRTimeline.jsx

import React, { useState, useEffect, useCallback } from 'react';
import { format, isPast } from 'date-fns';
import { fr } from 'date-fns/locale';
import { Plus, Trash2, Edit2, Paperclip, Download, Clock, ShieldAlert } from 'lucide-react';
import toast from 'react-hot-toast';
import { InfoCard } from '@/components/dashboard/employees/EmployeeInfoComponents';
import HREventBadge from './HREventBadge';
import HREventModal from './HREventModal';
import { listHREvents, deleteHREvent, getAttachmentUrl } from '@/services/employeesHrService';

const HRTimeline = ({ companyId, employeeId, canManage }) => {
    const [events, setEvents] = useState([]);
    const [loading, setLoading] = useState(true);
    const [modal, setModal] = useState(null);

    const load = useCallback(async () => {
        setLoading(true);
        try {
            const data = await listHREvents(companyId, employeeId);
            setEvents(data);
        } catch {
            toast.error("Impossible de charger le dossier RH.");
        } finally {
            setLoading(false);
        }
    }, [companyId, employeeId]);

    useEffect(() => { load(); }, [load]);

    const handleDelete = async (eventId) => {
        if (!window.confirm('Supprimer cet événement RH et ses pièces jointes ?')) return;
        try {
            await deleteHREvent(companyId, employeeId, eventId);
            toast.success('Événement supprimé.');
            load();
        } catch {
            toast.error('Erreur lors de la suppression.');
        }
    };

    return (
        <>
            <InfoCard
                icon={<ShieldAlert className="text-rose-400" />}
                title="Dossier RH"
                action={canManage && (
                    <button
                        onClick={() => setModal('create')}
                        className="flex items-center gap-1 px-3 py-1 bg-brand-primary/10 text-brand-primary rounded-xl text-[10px] font-black uppercase tracking-wider hover:bg-brand-primary/20 transition-colors border border-brand-primary/20"
                    >
                        <Plus size={12} />
                        Ajouter
                    </button>
                )}
            >
                {loading ? (
                    <p className="text-center text-cca-textSecondary/40 italic text-[10px] py-6">Chargement...</p>
                ) : events.length === 0 ? (
                    <p className="text-center text-cca-textSecondary/40 italic text-[10px] font-black uppercase tracking-widest py-6">
                        Aucun événement RH enregistré.
                    </p>
                ) : (
                    <div className="relative space-y-4">
                        <div className="absolute left-3 top-0 bottom-0 w-px bg-cca-border/30" />

                        {events.map(evt => {
                            const expired = evt.expiresAt && isPast(new Date(evt.expiresAt));
                            return (
                                <div key={evt.id} className="relative pl-8">
                                    <div className="absolute left-0 top-2 w-6 h-6 rounded-full bg-cca-base border-2 border-cca-border/50 flex items-center justify-center">
                                        <div className="w-2 h-2 rounded-full bg-cca-textSecondary/40" />
                                    </div>

                                    <div className={`p-4 rounded-2xl border ${expired ? 'border-cca-border/20 opacity-60' : 'border-cca-border/40'} bg-cca-base/20 hover:bg-cca-base/30 transition-colors`}>
                                        <div className="flex items-start justify-between gap-2 mb-2">
                                            <div className="flex items-center gap-2 flex-wrap">
                                                <HREventBadge type={evt.type} />
                                                {expired && (
                                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider border bg-slate-500/10 text-slate-400 border-slate-500/30">
                                                        <Clock size={10} />
                                                        Expiré
                                                    </span>
                                                )}
                                                {evt.type === 'PRIME' && evt.amount != null && (
                                                    <span className="text-[10px] font-black text-amber-400">
                                                        {parseFloat(evt.amount).toFixed(2)} $
                                                        {evt.isoWeek && ` · S${evt.isoWeek}/${evt.isoYear}`}
                                                    </span>
                                                )}
                                            </div>
                                            {canManage && (
                                                <div className="flex gap-1 shrink-0">
                                                    <button
                                                        onClick={() => setModal(evt)}
                                                        className="p-1.5 rounded-lg hover:bg-cca-base/60 text-cca-textSecondary hover:text-cca-textPrimary transition-colors"
                                                    >
                                                        <Edit2 size={12} />
                                                    </button>
                                                    <button
                                                        onClick={() => handleDelete(evt.id)}
                                                        className="p-1.5 rounded-lg hover:bg-red-500/10 text-cca-textSecondary hover:text-red-400 transition-colors"
                                                    >
                                                        <Trash2 size={12} />
                                                    </button>
                                                </div>
                                            )}
                                        </div>

                                        <p className="text-sm font-bold text-cca-textPrimary">{evt.title}</p>
                                        {evt.description && (
                                            <p className="text-xs text-cca-textSecondary mt-1 whitespace-pre-wrap">{evt.description}</p>
                                        )}

                                        <div className="flex flex-wrap gap-3 mt-2 text-[10px] text-cca-textSecondary/40 font-medium">
                                            <span>{format(new Date(evt.occurredAt), 'PPP', { locale: fr })}</span>
                                            {evt.expiresAt && (
                                                <span className={expired ? 'text-red-400/60' : 'text-orange-400/60'}>
                                                    Expire le {format(new Date(evt.expiresAt), 'PPP', { locale: fr })}
                                                </span>
                                            )}
                                            {evt.createdByEmployee?.user?.name && (
                                                <span>Par {evt.createdByEmployee.user.name}</span>
                                            )}
                                        </div>

                                        {evt.attachments?.length > 0 && (
                                            <div className="mt-3 space-y-1">
                                                {evt.attachments.map(att => (
                                                    <a
                                                        key={att.id}
                                                        href={getAttachmentUrl(att.publicId)}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        className="flex items-center gap-2 text-[11px] text-brand-primary hover:text-brand-primary/80 transition-colors"
                                                    >
                                                        <Paperclip size={10} />
                                                        {att.fileName}
                                                        <Download size={10} className="opacity-60" />
                                                    </a>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </InfoCard>

            {modal && (
                <HREventModal
                    companyId={companyId}
                    employeeId={employeeId}
                    event={modal === 'create' ? null : modal}
                    onClose={() => setModal(null)}
                    onSuccess={() => { setModal(null); load(); }}
                />
            )}
        </>
    );
};

export default HRTimeline;
