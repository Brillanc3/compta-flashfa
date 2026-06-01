// /frontend/src/modules/myCalendar/widgets/InvitationsWidget.jsx
import React, { useState, useEffect } from 'react';
import { myCalendarService } from '../services/myCalendar.services';
import { Button } from '@/components/ui/button';
import toast from 'react-hot-toast';
import { Calendar, Check, X, Loader2, Bell } from 'lucide-react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

const InvitationsWidget = () => {
    const [invitations, setInvitations] = useState([]);
    const [loading, setLoading] = useState(true);

    const fetchInvitations = async () => {
        try {
            const data = await myCalendarService.getInvitations();
            setInvitations(data);
        } catch (error) {
            console.error("Erreur lors de la récupération des invitations", error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchInvitations();
    }, []);

    const handleResponse = async (id, status) => {
        try {
            await myCalendarService.respondToInvitation(id, status);
            toast.success(status === 'ACCEPTED' ? "Invitation acceptée" : "Invitation refusée");
            fetchInvitations();
        } catch (_error) {
            toast.error("Une erreur est survenue");
        }
    };

    if (loading) return (
        <div className="flex items-center justify-center h-full p-6">
            <Loader2 className="h-6 w-6 animate-spin text-brand-primary" />
        </div>
    );

    if (invitations.length === 0) return (
        <div className="flex flex-col items-center justify-center h-full p-6 text-cca-textSecondary opacity-60">
            <Bell className="h-8 w-8 mb-2 opacity-20" />
            <p className="text-sm italic">Aucune invitation en attente</p>
        </div>
    );

    return (
        <div className="flex flex-col h-full bg-cca-surface rounded-xl border border-cca-border overflow-hidden shadow-lg">
            <div className="p-4 border-b border-cca-border bg-cca-base/30 flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <Calendar className="h-4 w-4 text-brand-primary" />
                    <h3 className="font-semibold text-cca-textPrimary">Invitations</h3>
                </div>
                <span className="bg-brand-primary text-white text-[10px] font-bold px-2 py-0.5 rounded-full">
                    {invitations.length}
                </span>
            </div>
            
            <div className="flex-1 overflow-y-auto p-2 space-y-2">
                {invitations.map(inv => (
                    <div key={inv.id} className="p-3 rounded-lg bg-cca-base border border-cca-border hover:border-brand-primary/30 transition-all flex flex-col gap-2">
                        <div className="flex justify-between items-start gap-2">
                            <div>
                                <h4 className="text-sm font-bold text-cca-textPrimary leading-tight">{inv.event.title}</h4>
                                <p className="text-[10px] text-cca-textSecondary">
                                    Par <span className="text-brand-primary font-medium">@{inv.event.author.username}</span>
                                </p>
                            </div>
                            <div className="text-right">
                                <p className="text-[10px] font-medium text-cca-textSecondary">
                                    {format(new Date(inv.event.startTime), "d MMM", { locale: fr })}
                                </p>
                                <p className="text-[10px] opacity-60">
                                    {format(new Date(inv.event.startTime), "HH:mm")}
                                </p>
                            </div>
                        </div>

                        <div className="flex gap-2 mt-1">
                            <Button
                                size="sm"
                                className="flex-1 bg-green-500/10 text-green-500 hover:bg-green-500 hover:text-white border border-green-500/20 text-[10px] py-1 h-7"
                                onClick={() => handleResponse(inv.id, 'ACCEPTED')}
                            >
                                <Check className="h-3 w-3 mr-1" /> Accepter
                            </Button>
                            <Button
                                size="sm"
                                variant="outline"
                                className="flex-1 text-red-500 border-red-500/20 hover:bg-red-500 hover:text-white text-[10px] py-1 h-7"
                                onClick={() => handleResponse(inv.id, 'REFUSED')}
                            >
                                <X className="h-3 w-3 mr-1" /> Refuser
                            </Button>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default InvitationsWidget;
