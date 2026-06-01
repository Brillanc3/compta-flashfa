// /frontend/src/pages/dashboard/CalendarPage.jsx
import React, { useEffect, useState, useCallback, useRef } from 'react';
import { useCompany } from '@/contexts/CompanyContext';
import { getEvents, createEvent, updateEvent, deleteEvent, getCategories } from '@/services/calendarService';
import toast from 'react-hot-toast';
import { useConfirmation } from '@/contexts/ConfirmationContext';

import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';
import listPlugin from '@fullcalendar/list';
import interactionPlugin from '@fullcalendar/interaction';
import { useMediaQuery } from 'react-responsive';

import AddEventModal from '@/components/calendar/AddEventModal';
import CalendarContextMenu from '@/components/calendar/CalendarContextMenu';

import tippy from 'tippy.js';
import 'tippy.js/dist/tippy.css';
import '@/styles/calendarOverrides.css'; // ✅ fichier CSS qu’on va créer plus bas

const CalendarPage = () => {
    const calendarRef = useRef(null);
    const { selectedCompany, userPermissions } = useCompany();
    const { confirmAction } = useConfirmation();
    const isMobile = useMediaQuery({ maxWidth: 768 });

    const [events, setEvents] = useState([]);
    const [categories, setCategories] = useState([]);
    const [loading, setLoading] = useState(true);
    const [contextMenu, setContextMenu] = useState({ visible: false, x: 0, y: 0, data: null });
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [eventToEdit, setEventToEdit] = useState(null);

    const canViewAll =
        userPermissions?.some((p) =>
            /CALENDAR\.\d+\.(VIEW_ALL|MANAGE_ALL|MANAGE_CATEGORIES)/.test(p)
        ) || false;

    // 🧩 Chargement des événements
    const fetchEvents = useCallback(async () => {
        const companyIdParam = selectedCompany ? selectedCompany.id : null;
        const calendarApi = calendarRef.current?.getApi();
        if (!calendarApi) return;

        setLoading(true);
        try {
            const view = calendarApi.view;
            const response = await getEvents(companyIdParam, {
                startDate: view.activeStart.toISOString(),
                endDate: view.activeEnd.toISOString(),
            });

            const formattedEvents = response.data
                .filter((ev) => canViewAll || ev.userId === selectedCompany?.userId || ev.createdBySystem)
                .map((event) => ({
                    id: event.id.toString(),
                    title: event.title,
                    start: new Date(event.startTime),
                    end: event.endTime ? new Date(event.endTime) : null,
                    backgroundColor: event.category?.color || (event.createdBySystem ? '#E53935' : '#3B82F6'),
                    borderColor: event.category?.color || (event.createdBySystem ? '#E53935' : '#3B82F6'),
                    textColor: '#fff',
                    allDay: event.isAllDay,
                    extendedProps: { original: event },
                }));

            setEvents(formattedEvents);
        } catch (error) {
            console.error('[Calendar] Fetch error:', error);
            toast.error("Impossible de charger les événements.");
        } finally {
            setLoading(false);
        }
    }, [selectedCompany, canViewAll]);

    // 🧩 Initialisation
    useEffect(() => {
        setLoading(true);
        if (selectedCompany) {
            getCategories(selectedCompany.id)
                .then((res) => setCategories(res.data))
                .catch(() => toast.error("Impossible de charger les catégories."));
        } else {
            setCategories([]);
        }

        if (calendarRef.current) fetchEvents();
        else setLoading(false);
    }, [selectedCompany, fetchEvents]);

    // 🖱️ Menu contextuel
    const handleDayCellMount = (arg) => {
        if (isMobile) return;
        arg.el.addEventListener('contextmenu', (jsEvent) => {
            jsEvent.preventDefault();
            setContextMenu({
                visible: true,
                x: jsEvent.pageX,
                y: jsEvent.pageY,
                data: { date: arg.date, dateStr: arg.date.toISOString(), allDay: true },
            });
        });
    };

    const handleEventMount = (arg) => {
        if (isMobile) return;
        arg.el.addEventListener('contextmenu', (jsEvent) => {
            jsEvent.preventDefault();
            jsEvent.stopPropagation();
            setContextMenu({
                visible: true,
                x: jsEvent.pageX,
                y: jsEvent.pageY,
                data: arg.event,
            });
        });
    };

    // 💾 CRUD
    const openAddModal = () => {
        setEventToEdit(null);
        setIsModalOpen(true);
    };
    const openEditModal = () => {
        setEventToEdit(contextMenu.data);
        setIsModalOpen(true);
    };
    const handleDelete = () => {
        const originalEventId = contextMenu.data?.extendedProps?.original?.id;
        if (!originalEventId) return toast.error("Impossible de trouver l'ID de l'événement.");

        confirmAction({
            title: "Confirmer la suppression",
            message: `Voulez-vous vraiment supprimer "${contextMenu.data.title}" ?`,
            onConfirm: async () => {
                try {
                    await deleteEvent(originalEventId);
                    toast.success("Événement supprimé.");
                    fetchEvents();
                } catch (error) {
                    toast.error(error.response?.data?.message || "Erreur lors de la suppression.");
                }
            },
        });
    };
    const handleSave = async (eventData) => {
        const isEditing = !!eventToEdit;
        const originalEventId = eventToEdit?.extendedProps?.original?.id;
        try {
            if (isEditing && originalEventId) {
                await updateEvent(originalEventId, eventData);
                toast.success("Événement mis à jour !");
            } else {
                await createEvent(eventData);
                toast.success("Événement ajouté !");
            }
            fetchEvents();
        } catch (error) {
            toast.error(error.response?.data?.message || "Erreur lors de la sauvegarde.");
        }
    };

    // 📱 Click sur mobile
    const handleDateClick = (arg) => {
        if (isMobile) {
            setContextMenu({ visible: false, x: 0, y: 0, data: { date: arg.date } });
            openAddModal();
        }
    };

    // 🎨 Tooltip
    const handleTooltip = (info) => {
        tippy(info.el, {
            content: `<b>${info.event.title}</b><br/>
                      ${info.event.extendedProps.original?.description || ''}`,
            allowHTML: true,
            theme: 'light-border',
            placement: 'top',
        });
    };

    return (
        <div className="space-y-6 h-full flex flex-col">
            <h1 className="text-3xl font-bold text-white flex-shrink-0">Calendrier</h1>
            <small>ℹ️ Cette page va prochainement changer pour afficher les services de manière plus pro.</small>
            {loading && (
                <div className="absolute inset-0 bg-slate-900 bg-opacity-70 flex items-center justify-center z-20">
                    <p className="text-slate-400">Chargement...</p>
                </div>
            )}

            {!isMobile && contextMenu.visible && (
                <CalendarContextMenu
                    x={contextMenu.x}
                    y={contextMenu.y}
                    event={contextMenu.data?.title ? contextMenu.data : null}
                    onClose={() => setContextMenu({ ...contextMenu, visible: false })}
                    onAddEvent={openAddModal}
                    onEditEvent={openEditModal}
                    onDeleteEvent={handleDelete}
                />
            )}

            <AddEventModal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                onSave={handleSave}
                eventToEdit={eventToEdit?.extendedProps?.original}
                dateInfo={!eventToEdit ? contextMenu.data : null}
                categories={categories}
            />

            <div className="bg-slate-800 rounded-lg p-4 flex-grow text-white relative overflow-hidden">
                <FullCalendar
                    key={selectedCompany ? selectedCompany.id : 'personal'}
                    ref={calendarRef}
                    plugins={[dayGridPlugin, timeGridPlugin, listPlugin, interactionPlugin]}
                    initialView={isMobile ? 'listWeek' : 'timeGridWeek'}
                    headerToolbar={{
                        left: isMobile ? 'prev,next' : 'prev,next today',
                        center: 'title',
                        right: isMobile ? 'listWeek' : 'dayGridMonth,timeGridWeek,timeGridDay',
                    }}
                    slotMinTime="00:00:00"
                    slotMaxTime="24:00:00"
                    slotEventOverlap={false} // ✅ plus de superposition
                    eventContent={(arg) => ({
                        html: `
                            <div class="fc-custom-event truncate text-xs px-1">
                                <b>${arg.timeText}</b><br/>
                                ${arg.event.title}
                            </div>
                        `,
                    })}
                    eventDidMount={(info) => {
                        handleTooltip(info);
                        handleEventMount(info);
                    }}
                    dateClick={handleDateClick}
                    dayCellDidMount={handleDayCellMount}
                    datesSet={fetchEvents}
                    events={events}
                    locale="fr"
                    height="100%"
                    moreLinkText="autres"
                    eventDisplay="block"
                    displayEventTime={!isMobile}
                />
            </div>
        </div>
    );
};

export default CalendarPage;
