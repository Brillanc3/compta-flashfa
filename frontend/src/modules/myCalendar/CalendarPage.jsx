// /frontend/src/modules/myCalendar/CalendarPage.jsx
import React, { useState, useEffect, useCallback, useRef } from 'react';
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';
import interactionPlugin from '@fullcalendar/interaction';
import frLocale from '@fullcalendar/core/locales/fr';
import { myCalendarService } from './services/myCalendar.services';
import { useAuth } from '@/contexts/AuthContext';
import { useCompany } from '@/contexts/CompanyContext';
import EventModal from './components/EventModal';
import CategoryManager from './components/CategoryManager';
import InvitationsWidget from './widgets/InvitationsWidget';
import { Button } from '@/components/ui/button';
import { Calendar as CalendarIcon, Plus, Filter, Tag, Bell, Settings, Search, LayoutGrid, List as ListIcon, ChevronLeft, ChevronRight, X } from 'lucide-react';
import { useMediaQuery } from 'react-responsive';
import toast from 'react-hot-toast';

const CalendarPage = () => {
    const { user } = useAuth();
    const { companyId } = useCompany();
    const [events, setEvents] = useState([]);
    const [categories, setCategories] = useState([]);
    const [_loading, setLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [selectedEvent, setSelectedEvent] = useState(null);
    const [view, setView] = useState('dayGridMonth');
    const [sidebarOpen, setSidebarOpen] = useState(true);
    const isMobile = useMediaQuery({ maxWidth: 768 });
    const calendarRef = useRef(null);

    useEffect(() => {
        if (calendarRef.current) {
            const calendarApi = calendarRef.current.getApi();
            calendarApi.changeView(view);
        }
    }, [view]);

    const fetchAll = useCallback(async () => {
        setLoading(true);
        try {
            const [eventsData, categoriesData] = await Promise.all([
                myCalendarService.getEvents(companyId),
                myCalendarService.getCategories(companyId)
            ]);
            setEvents(eventsData);
            setCategories(categoriesData);
        } catch (_error) {
            toast.error("Erreur lors de la récupération des données");
        } finally {
            setLoading(false);
        }
    }, [companyId]);

    useEffect(() => {
        fetchAll();
    }, [fetchAll]);

    const handleDateSelect = (selectInfo) => {
        setSelectedEvent({
            startTime: selectInfo.start,
            endTime: selectInfo.end,
            allDay: selectInfo.allDay
        });
        setIsModalOpen(true);
    };

    const handleEventClick = (clickInfo) => {
        const eventId = clickInfo.event.id;
        const originalEvent = events.find(e => e.id === parseInt(eventId));
        setSelectedEvent(originalEvent);
        setIsModalOpen(true);
    };

    const calendarEvents = events.map(e => ({
        id: e.id.toString(),
        title: e.title,
        start: e.startTime,
        end: e.endTime,
        backgroundColor: e.color || e.category?.color || '#3b82f6',
        borderColor: 'transparent',
        extendedProps: { ...e }
    }));

    return (
        <div className="flex flex-col md:flex-row h-full md:h-[calc(100vh-120px)] gap-4 md:gap-6 animate-in fade-in duration-500 relative">
            {/* Sidebar - Overlay on mobile, Side-by-side on desktop */}
            <aside className={`
                ${isMobile ? 'fixed inset-y-0 left-0 z-50 w-72 transform' : 'relative w-80'}
                ${sidebarOpen ? 'translate-x-0 opacity-100' : '-translate-x-full md:w-0 opacity-0'}
                transition-all duration-300 flex flex-col gap-6 bg-cca-base md:bg-transparent p-4 md:p-0 shadow-2xl md:shadow-none
            `}>
                {isMobile && (
                    <Button variant="ghost" size="icon" onClick={() => setSidebarOpen(false)} className="absolute top-2 right-2 md:hidden">
                        <X className="h-5 w-5" />
                    </Button>
                )}
                {/* Profile Card / Mini Info */}
                <div className="p-5 rounded-2xl bg-cca-surface border border-cca-border shadow-sm flex items-center gap-4">
                    <img src={user.imageUrl || `https://api.dicebear.com/7.x/avataaars/svg?seed=${user.username}`} alt="Avatar" className="w-12 h-12 rounded-xl object-cover border-2 border-brand-primary/20" />
                    <div>
                        <h3 className="font-bold text-cca-textPrimary leading-tight">Mon Calendrier</h3>
                        <p className="text-xs text-cca-textSecondary">Connecté en tant que <span className="text-brand-primary">@{user.username}</span></p>
                    </div>
                </div>

                {/* Categories Manager */}
                <div className="flex-1 rounded-2xl bg-cca-surface border border-cca-border shadow-sm overflow-hidden flex flex-col p-5">
                    <CategoryManager categories={categories} onUpdated={fetchAll} companyId={companyId} />
                </div>

                {/* Invitations Widget */}
                <div className="h-64">
                    <InvitationsWidget />
                </div>
            </aside>

            {/* Main Content */}
            <main className="flex-1 flex flex-col gap-4 min-w-0">
                {/* Header Actions */}
                <div className="flex flex-col sm:flex-row items-center justify-between bg-cca-surface border border-cca-border rounded-2xl p-3 px-4 md:px-6 shadow-sm gap-4">
                    <div className="flex items-center justify-between w-full sm:w-auto gap-4">
                        <Button variant="ghost" size="icon" onClick={() => setSidebarOpen(!sidebarOpen)} className="text-cca-textSecondary">
                            <LayoutGrid className="h-5 w-5" />
                        </Button>
                        <h2 className="text-lg md:text-xl font-heading font-bold text-cca-textPrimary truncate">Calendrier</h2>
                        
                        {isMobile && (
                            <Button 
                                size="sm"
                                onClick={() => { setSelectedEvent(null); setIsModalOpen(true); }}
                                className="bg-brand-primary text-white hover:bg-brand-primary/90 shadow-lg shadow-brand-primary/20 px-3 h-8 sm:hidden"
                            >
                                <Plus className="h-4 w-4" />
                            </Button>
                        )}
                    </div>

                    <div className="flex items-center justify-between sm:justify-end w-full sm:w-auto gap-2">
                        <div className="flex bg-cca-base rounded-lg p-0.5 border border-cca-border">
                            <button 
                                onClick={() => setView('dayGridMonth')}
                                className={`px-2 md:px-3 py-1 text-[10px] md:text-xs font-medium rounded-md transition-all ${view === 'dayGridMonth' ? 'bg-brand-primary text-white shadow-md' : 'text-cca-textSecondary hover:text-cca-textPrimary'}`}
                            >
                                {isMobile ? 'M' : 'Mois'}
                            </button>
                            <button 
                                onClick={() => setView('timeGridWeek')}
                                className={`px-2 md:px-3 py-1 text-[10px] md:text-xs font-medium rounded-md transition-all ${view === 'timeGridWeek' ? 'bg-brand-primary text-white shadow-md' : 'text-cca-textSecondary hover:text-cca-textPrimary'}`}
                            >
                                {isMobile ? 'S' : 'Semaine'}
                            </button>
                            <button 
                                onClick={() => setView('timeGridDay')}
                                className={`px-2 md:px-3 py-1 text-[10px] md:text-xs font-medium rounded-md transition-all ${view === 'timeGridDay' ? 'bg-brand-primary text-white shadow-md' : 'text-cca-textSecondary hover:text-cca-textPrimary'}`}
                            >
                                {isMobile ? 'J' : 'Jour'}
                            </button>
                        </div>
                        
                        {!isMobile && (
                            <Button 
                                onClick={() => { setSelectedEvent(null); setIsModalOpen(true); }}
                                className="bg-brand-primary text-white hover:bg-brand-primary/90 shadow-lg shadow-brand-primary/20 gap-2 px-6"
                            >
                                <Plus className="h-4 w-4" /> Nouvel Event
                            </Button>
                        )}
                    </div>
                </div>

                {/* Calendar Container */}
                <div className="flex-1 bg-cca-surface border border-cca-border rounded-2xl p-2 md:p-6 shadow-sm overflow-hidden relative premium-calendar">
                    <style>{`
                        .premium-calendar .fc {
                            --fc-border-color: rgba(var(--cca-border-rgb), 0.1);
                            --fc-today-bg-color: rgba(var(--brand-primary-rgb), 0.05);
                            --fc-event-bg-color: var(--brand-primary);
                            --fc-event-border-color: transparent;
                            height: 100%;
                            font-family: inherit;
                        }
                        .premium-calendar .fc-header-toolbar {
                            margin-bottom: 1rem !important;
                            flex-wrap: wrap;
                            gap: 0.5rem;
                        }
                        .premium-calendar .fc-toolbar-title {
                            font-size: 1rem !important;
                            md:font-size: 1.25rem !important;
                            font-weight: 800 !important;
                            color: var(--cca-textPrimary);
                        }
                        .premium-calendar .fc-button {
                            background: var(--cca-base) !important;
                            border: 1px solid var(--cca-border) !important;
                            color: var(--cca-textPrimary) !important;
                            text-transform: capitalize !important;
                            box-shadow: none !important;
                            transition: all 0.2s !important;
                            padding: 4px 8px !important;
                            font-size: 0.75rem !important;
                        }
                        .premium-calendar .fc-button:hover {
                            background: var(--cca-surface) !important;
                            border-color: var(--brand-primary) !important;
                        }
                        .premium-calendar .fc-button-active {
                            background: var(--brand-primary) !important;
                            border-color: var(--brand-primary) !important;
                            color: white !important;
                        }
                        .premium-calendar .fc-daygrid-day {
                            transition: background 0.2s;
                        }
                        .premium-calendar .fc-daygrid-day:hover {
                            background: rgba(var(--cca-base-rgb), 0.3);
                        }
                        .premium-calendar .fc-event {
                            border-radius: 4px !important;
                            padding: 1px 2px !important;
                            font-size: 0.7rem !important;
                            font-weight: 500 !important;
                            box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1) !important;
                            border: none !important;
                        }
                        @media (max-width: 640px) {
                            .premium-calendar .fc-toolbar {
                                flex-direction: column;
                                align-items: center;
                            }
                            .premium-calendar .fc-toolbar-chunk {
                                display: flex;
                                justify-content: center;
                                width: 100%;
                            }
                        }
                    `}</style>
                    <FullCalendar
                        ref={calendarRef}
                        plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
                        initialView={isMobile ? 'timeGridDay' : view}
                        locales={[frLocale]}
                        locale="fr"
                        headerToolbar={{
                            left: 'prev,next today',
                            center: 'title',
                            right: ''
                        }}
                        events={calendarEvents}
                        editable={true}
                        selectable={true}
                        selectMirror={true}
                        dayMaxEvents={true}
                        select={handleDateSelect}
                        eventClick={handleEventClick}
                        height="100%"
                    />
                </div>
            </main>

            {/* Modals */}
            <EventModal 
                isOpen={isModalOpen} 
                onClose={() => setIsModalOpen(false)} 
                event={selectedEvent} 
                companyId={companyId} 
                categories={categories}
                onSaved={fetchAll}
            />
        </div>
    );
};

export default CalendarPage;
