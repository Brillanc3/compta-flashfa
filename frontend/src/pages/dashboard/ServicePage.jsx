// frontend/src/pages/dashboard/ServicePage.jsx

import React, { useState, useCallback, useRef, useMemo, useEffect } from 'react';
import FullCalendar from '@fullcalendar/react';
import resourceTimelinePlugin from '@fullcalendar/resource-timeline';
import interactionPlugin from '@fullcalendar/interaction';
import toast from 'react-hot-toast';
import { useMediaQuery } from 'react-responsive';
import { startOfWeek, addDays, addWeeks, format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { ChevronLeft, ChevronRight, Search, X, AlertTriangle, Clock } from 'lucide-react';

import { useCompany } from '@/contexts/CompanyContext';
import { getEvents, finishEvent, deleteEvent, updateEvent, getCategories } from '@/services/calendarService';
import CalendarContextMenu from '@/components/calendar/CalendarContextMenu';
import ActionConfirmationModal from '@/components/dashboard/employees/ActionConfirmationModal';
import AddEventModal from '@/components/calendar/AddEventModal';
import { useHasPermission } from '@/hooks/useHasPermission';

/**
 * ServicePage
 * - Backend retourne un ARRAY direct:
 *   [{ id, title, startTime, endTime, userId, author:{name}, ... }]
 *
 * Fix principal (events invisibles):
 * - Le "zoom" slotMinTime/slotMaxTime ne doit PAS produire une fenêtre horaire qui traverse minuit,
 *   sinon FullCalendar interprète slotMaxTime < slotMinTime (dans la journée) et n'affiche plus les events.
 * - Donc: si au moins un event traverse un changement de jour (start != end day), on désactive le zoom (00:00-24:00).
 *
 * Fix mobile:
 * - La timeline resourceTimelineWeek n'est pas exploitable sur petit écran.
 * - Sur mobile, on affiche une vue "liste" (cards) avec navigation semaine.
 */

const formatDuration = (start, end) => {
    const startDate = new Date(start);
    const endDate = end ? new Date(end) : new Date();
    const diffMs = Math.max(0, endDate - startDate);

    const totalMinutes = Math.floor(diffMs / 60000);
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;

    if (hours === 0) return `${minutes} min`;
    return `${hours}h${minutes.toString().padStart(2, '0')}`;
};

const formatTotalMinutes = (totalMinutes) => {
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    if (hours === 0) return `${minutes} min`;
    return `${hours}h${minutes.toString().padStart(2, '0')}`;
};

const formatTime = (date) =>
    new Date(date).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });

const floorToHour = (d) => {
    const x = new Date(d);
    x.setMinutes(0, 0, 0);
    return x;
};

const ceilToHour = (d) => {
    const x = new Date(d);
    if (x.getMinutes() === 0 && x.getSeconds() === 0 && x.getMilliseconds() === 0) {
        return x;
    }
    x.setHours(x.getHours() + 1, 0, 0, 0);
    return x;
};

const toHHMMSS = (d) => {
    const hh = String(d.getHours()).padStart(2, '0');
    const mm = String(d.getMinutes()).padStart(2, '0');
    return `${hh}:${mm}:00`;
};

const minutesOfDay = (d) => d.getHours() * 60 + d.getMinutes();

const isServiceOverdue = (svc) => {
    if (!svc?.startTime || svc?.endTime) return false;
    const elapsed = Date.now() - new Date(svc.startTime).getTime();
    return elapsed >= 24 * 60 * 60 * 1000;
};

const ServicePage = () => {
    const calendarRef = useRef(null);

    // Anti-spam fetch
    const lastFetchKeyRef = useRef('');

    // Anti-spam slot window option
    const lastSlotWindowKeyRef = useRef('');

    const { activeCompanyId } = useCompany();

    const isMobile = useMediaQuery({ maxWidth: 768 });

    const [resources, setResources] = useState([]);
    const [services, setServices] = useState([]);
    const [loading, setLoading] = useState(true);

    // Mobile week cursor (Monday -> next Monday)
    const [mobileWeekStart, setMobileWeekStart] = useState(() => startOfWeek(new Date(), { weekStartsOn: 1 }));
    const mobileWeekEnd = useMemo(() => addDays(mobileWeekStart, 7), [mobileWeekStart]);

    const [mobileSearch, setMobileSearch] = useState('');
    const [mobileEmployeeId, setMobileEmployeeId] = useState('ALL');

    // Context Menu State
    const [contextMenu, setContextMenu] = useState({ visible: false, x: 0, y: 0, event: null });
    const [confirmModal, setConfirmModal] = useState({ isOpen: false, type: '', eventId: null });
    const [isActionLoading, setIsActionLoading] = useState(false);

    // Edit Modal State
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [categories, setCategories] = useState([]);

    const canManageAll = useHasPermission('CALENDAR.MANAGE_ALL');

    const [overdueConfirm, setOverdueConfirm] = useState({ isOpen: false, serviceId: null, serviceName: '' });

    const overdueServices = useMemo(() => {
        return services
            .map((e) => e.extendedProps?.original)
            .filter(Boolean)
            .filter(isServiceOverdue);
    }, [services]);

    /**
     * Auto-zoom sur la plage horaire utile (sur la semaine chargée).
     * IMPORTANT: si un event traverse minuit (start day != end day), on désactive le zoom (00:00->24:00),
     * sinon FullCalendar peut ne plus afficher les events.
     */
    const applyUsefulTimeWindow = useCallback((eventsRaw) => {
        if (!calendarRef.current) return;
        if (!Array.isArray(eventsRaw) || eventsRaw.length === 0) return;

        const api = calendarRef.current.getApi();

        // Détecte les events qui traversent un changement de jour (ex: 23:47 -> 00:25)
        const crossesMidnight = eventsRaw.some((e) => {
            if (!e?.startTime || !e?.endTime) return false;
            const s = new Date(e.startTime);
            const en = new Date(e.endTime);
            if (Number.isNaN(s.getTime()) || Number.isNaN(en.getTime())) return false;
            return s.toDateString() !== en.toDateString();
        });

        // Si traverse minuit: fenêtre complète, sinon tu risques slotMaxTime < slotMinTime dans la journée
        if (crossesMidnight) {
            const windowKey = `FULL_DAY`;
            if (lastSlotWindowKeyRef.current === windowKey) return;
            lastSlotWindowKeyRef.current = windowKey;

            api.setOption('slotMinTime', '00:00:00');
            api.setOption('slotMaxTime', '24:00:00');
            return;
        }

        // Sinon: calcule une fenêtre "utile" dans la journée (local time) + padding 1h
        const validStarts = eventsRaw
            .map((e) => new Date(e.startTime))
            .filter((d) => !Number.isNaN(d.getTime()));

        const validEnds = eventsRaw
            .map((e) => new Date(e.endTime || e.startTime))
            .filter((d) => !Number.isNaN(d.getTime()));

        if (validStarts.length === 0 || validEnds.length === 0) return;

        // Trouve min/max "dans la journée" en minutes (pas en timestamp) car on reste intra-jour
        let minM = 24 * 60;
        let maxM = 0;

        for (const d of validStarts) minM = Math.min(minM, minutesOfDay(d));
        for (const d of validEnds) maxM = Math.max(maxM, minutesOfDay(d));

        // Padding 60 minutes
        minM = Math.max(0, minM - 60);
        maxM = Math.min(24 * 60, maxM + 60);

        // Arrondi aux heures
        const minDate = floorToHour(new Date(2000, 0, 1, Math.floor(minM / 60), minM % 60));
        const maxDate = ceilToHour(new Date(2000, 0, 1, Math.floor(maxM / 60), maxM % 60));

        const minTime = toHHMMSS(minDate);
        const maxTime = toHHMMSS(maxDate);

        // Garde-fou: si max <= min (ça peut arriver si tout est à la même minute), fallback journée complète
        const minMinutes = minutesOfDay(minDate);
        const maxMinutes = minutesOfDay(maxDate);
        if (maxMinutes <= minMinutes) {
            const windowKey = `FULL_DAY`;
            if (lastSlotWindowKeyRef.current === windowKey) return;
            lastSlotWindowKeyRef.current = windowKey;

            api.setOption('slotMinTime', '00:00:00');
            api.setOption('slotMaxTime', '24:00:00');
            return;
        }

        const windowKey = `${minTime}|${maxTime}`;
        if (lastSlotWindowKeyRef.current === windowKey) return;
        lastSlotWindowKeyRef.current = windowKey;

        api.setOption('slotMinTime', minTime);
        api.setOption('slotMaxTime', maxTime);
    }, []);

    /**
     * Fetch events for a known [start, end] week window.
     * Backend returns ARRAY direct: response.data = [{...}, {...}]
     */
    const fetchServices = useCallback(
        async (start, end) => {
            if (!activeCompanyId) return;

            setLoading(true);
            try {
                const response = await getEvents(activeCompanyId, {
                    startDate: start.toISOString(),
                    endDate: end.toISOString(),
                });

                const raw = response?.data;
                const data = Array.isArray(raw) ? raw : [];

                // Resources (employees)
                const resourceMap = new Map();
                data.forEach((svc) => {
                    const userId = svc?.userId;
                    if (userId == null) return;

                    if (!resourceMap.has(userId)) {
                        resourceMap.set(userId, {
                            id: String(userId),
                            title: svc?.author?.name || 'Employé',
                        });
                    }
                });
                setResources(Array.from(resourceMap.values()));

                // Events
                const mapped = data
                    .filter((svc) => svc?.startTime && svc?.userId != null)
                    .map((svc) => ({
                        id: String(svc.id),
                        resourceId: String(svc.userId),
                        title: svc.title || `Service - ${svc?.author?.name || 'Employé'}`,
                        start: svc.startTime,
                        end: svc.endTime || undefined,
                        display: 'block',
                        backgroundColor: svc.endTime ? '#3b82f6' : '#22c55e',
                        borderColor: svc.endTime ? '#2563eb' : '#16a34a',
                        extendedProps: { original: svc },
                    }));

                setServices(mapped);

                // Zoom horaire (protégé contre les events qui traversent minuit)
                applyUsefulTimeWindow(data);
            } catch (err) {
                console.error('[ServicePage] fetch error', err);
                toast.error('Impossible de charger les services.');
                setResources([]);
                setServices([]);
            } finally {
                setLoading(false);
            }
        },
        [activeCompanyId, applyUsefulTimeWindow]
    );

    useEffect(() => {
        if (activeCompanyId) {
            getCategories(activeCompanyId).then(res => setCategories(res.data || []));
        }
    }, [activeCompanyId]);

    const handleEventContextMenu = useCallback((info) => {
        if (!canManageAll) return;
        info.jsEvent.preventDefault();
        setContextMenu({
            visible: true,
            x: info.jsEvent.clientX,
            y: info.jsEvent.clientY,
            event: info.event.extendedProps?.original
        });
    }, [canManageAll]);

    const handleFinishService = async () => {
        if (!contextMenu.event?.id) return;
        setIsActionLoading(true);
        try {
            await finishEvent(contextMenu.event.id);
            toast.success('Service terminé avec succès.');
            setContextMenu({ ...contextMenu, visible: false });
            // Refresh
            if (calendarRef.current) {
                const api = calendarRef.current.getApi();
                fetchServices(api.view.currentStart, api.view.currentEnd);
            }
        } catch {
            toast.error('Erreur lors de la clôture du service.');
        } finally {
            setIsActionLoading(false);
        }
    };

    const handleConfirmCancel = async () => {
        if (!confirmModal.eventId) return;
        setIsActionLoading(true);
        try {
            await deleteEvent(confirmModal.eventId);
            toast.success('Service annulé.');
            setConfirmModal({ isOpen: false, type: '', eventId: null });
            // Refresh
            if (calendarRef.current) {
                const api = calendarRef.current.getApi();
                fetchServices(api.view.currentStart, api.view.currentEnd);
            }
        } catch {
            toast.error("Erreur lors de l'annulation du service.");
        } finally {
            setIsActionLoading(false);
        }
    };

    const handleConfirmOverdueCancel = async () => {
        if (!overdueConfirm.serviceId) return;
        setIsActionLoading(true);
        try {
            await deleteEvent(overdueConfirm.serviceId);
            toast.success('Service annulé.');
            setOverdueConfirm({ isOpen: false, serviceId: null, serviceName: '' });
            if (calendarRef.current) {
                const api = calendarRef.current.getApi();
                fetchServices(api.view.currentStart, api.view.currentEnd);
            } else if (isMobile) {
                fetchServices(mobileWeekStart, mobileWeekEnd);
            }
        } catch {
            toast.error("Erreur lors de l'annulation du service.");
        } finally {
            setIsActionLoading(false);
        }
    };

    const handleSaveDuration = async (data) => {
        if (!contextMenu.event?.id) return;
        try {
            // On ne garde que startTime et endTime pour la modification de durée
            await updateEvent(contextMenu.event.id, {
                startTime: data.startTime,
                endTime: data.endTime
            });
            toast.success('Durée du service mise à jour.');
            setIsEditModalOpen(false);
            // Refresh
            if (calendarRef.current) {
                const api = calendarRef.current.getApi();
                fetchServices(api.view.currentStart, api.view.currentEnd);
            }
        } catch {
            toast.error('Erreur lors de la modification de la durée.');
        }
    };

    /**
     * datesSet is called multiple times by FullCalendar.
     * With resourceTimelineWeek, currentStart/currentEnd are aligned to the week.
     */
    const handleDatesSet = useCallback(
        (arg) => {
            if (!activeCompanyId) return;

            const start = arg.view.currentStart;
            const end = arg.view.currentEnd;

            const key = `${activeCompanyId}|${start.toISOString()}|${end.toISOString()}`;
            if (lastFetchKeyRef.current === key) return;
            lastFetchKeyRef.current = key;

            // reset slot-window key per week to ensure options can be updated
            lastSlotWindowKeyRef.current = '';

            fetchServices(start, end);
        },
        [activeCompanyId, fetchServices]
    );

    // Mobile fetch (FullCalendar n'est pas monté en <md)
    useEffect(() => {
        if (!isMobile) return;
        if (!activeCompanyId) return;

        const start = mobileWeekStart;
        const end = mobileWeekEnd;

        const key = `${activeCompanyId}|${start.toISOString()}|${end.toISOString()}`;
        if (lastFetchKeyRef.current === key) return;
        lastFetchKeyRef.current = key;

        lastSlotWindowKeyRef.current = '';
        fetchServices(start, end);
    }, [isMobile, activeCompanyId, mobileWeekStart, mobileWeekEnd, fetchServices]);

    /**
     * Memoized views to avoid FullCalendar reconfigure loops.
     */
    const calendarViews = useMemo(
        () => ({
            resourceTimelineWeek: {
                type: 'resourceTimelineWeek',
                slotDuration: { hours: 1 },
                slotLabelInterval: { hours: 1 },
                dateAlignment: 'week',
                dateIncrement: { days: 7 },
            },
        }),
        []
    );

    /**
     * Weekly total per employee from displayed events (no extra API call).
     */
    const totalByEmployee = useMemo(() => {
        const totals = {};
        services.forEach((event) => {
            const svc = event.extendedProps?.original;
            if (!svc?.startTime || svc?.userId == null) return;

            const start = new Date(svc.startTime);
            const end = svc.endTime ? new Date(svc.endTime) : new Date();
            const minutes = Math.max(0, Math.floor((end.getTime() - start.getTime()) / 60000));

            totals[svc.userId] = (totals[svc.userId] || 0) + minutes;
        });
        return totals;
    }, [services]);

    const resourceTitleById = useMemo(() => {
        const map = {};
        resources.forEach((r) => {
            map[r.id] = r.title;
        });
        return map;
    }, [resources]);

    const mobileFlatItems = useMemo(() => {
        if (!isMobile) return [];

        return services
            .map((event) => {
                const svc = event.extendedProps?.original;
                if (!svc?.startTime) return null;

                const start = new Date(svc.startTime);
                const end = svc.endTime ? new Date(svc.endTime) : null;

                if (Number.isNaN(start.getTime())) return null;

                const employeeName =
                    resourceTitleById[String(svc.userId)] || svc?.author?.name || 'Employé';

                const effectiveEnd = end || new Date();
                const minutes = Math.max(0, Math.floor((effectiveEnd.getTime() - start.getTime()) / 60000));

                return {
                    id: String(svc.id ?? event.id),
                    userId: svc.userId,
                    employeeName,
                    title: svc.title || 'Service',
                    start,
                    end,
                    startLabel: formatTime(start),
                    endLabel: end ? formatTime(end) : 'En cours',
                    minutes,
                    durationLabel: formatDuration(start, end),
                };
            })
            .filter(Boolean)
            .sort((a, b) => a.start.getTime() - b.start.getTime());
    }, [isMobile, services, resourceTitleById]);

    const mobileFilteredItems = useMemo(() => {
        const employeeFilter = mobileEmployeeId && mobileEmployeeId !== 'ALL' ? String(mobileEmployeeId) : null;
        const q = mobileSearch.trim().toLowerCase();

        return mobileFlatItems.filter((it) => {
            if (employeeFilter && String(it.userId) !== employeeFilter) return false;

            if (!q) return true;

            const hay = `${it.employeeName} ${it.title} ${it.startLabel} ${it.endLabel}`.toLowerCase();
            return hay.includes(q);
        });
    }, [mobileFlatItems, mobileEmployeeId, mobileSearch]);

    const mobileItemsByDay = useMemo(() => {
        if (!isMobile) return [];

        const byDay = new Map();
        for (const it of mobileFilteredItems) {
            const key = format(it.start, 'yyyy-MM-dd');
            if (!byDay.has(key)) byDay.set(key, []);
            byDay.get(key).push(it);
        }

        return Array.from(byDay.entries()).map(([dayKey, dayItems]) => {
            const dayDate = new Date(`${dayKey}T00:00:00`);
            return {
                key: dayKey,
                date: dayDate,
                label: format(dayDate, 'EEEE d MMMM', { locale: fr }),
                items: dayItems,
            };
        });
    }, [isMobile, mobileFilteredItems]);

    const mobileFilteredSummary = useMemo(() => {
        const totalMinutes = mobileFilteredItems.reduce((acc, it) => acc + (it.minutes || 0), 0);
        return {
            count: mobileFilteredItems.length,
            totalMinutes,
        };
    }, [mobileFilteredItems]);

    const mobileWeekLabel = useMemo(() => {
        const startLabel = format(mobileWeekStart, 'dd MMM', { locale: fr });
        const endLabel = format(addDays(mobileWeekEnd, -1), 'dd MMM', { locale: fr });
        return `${startLabel} – ${endLabel}`;
    }, [mobileWeekStart, mobileWeekEnd]);

    return (
        <div className="space-y-6">
            <style>
                {`
                /* ===== FullCalendar dark polish (scoped) ===== */
                .services-calendar .fc {
                    --fc-border-color: var(--border-color);
                    --fc-page-bg-color: transparent;
                    --fc-neutral-bg-color: var(--bg-surface);
                    --fc-today-bg-color: rgba(99, 102, 241, 0.08);
                }

                .services-calendar .fc .fc-toolbar-title {
                    color: var(--text-primary);
                    font-size: 1.05rem;
                    font-weight: 700;
                    letter-spacing: 0.2px;
                }

                .services-calendar .fc .fc-button {
                    background: var(--bg-surface);
                    border: 1px solid var(--border-color);
                    color: var(--text-secondary);
                }
                .services-calendar .fc .fc-button:hover {
                    background: rgba(var(--bg-surface-rgb) / 0.8);
                }
                .services-calendar .fc .fc-button:disabled {
                    opacity: 0.6;
                }

                .services-calendar .fc .fc-timeline-header-row-chrono th,
                .services-calendar .fc .fc-col-header-cell {
                    background: rgba(var(--bg-base-rgb) / 0.30);
                    backdrop-filter: blur(6px);
                }

                .services-calendar .fc .fc-timeline-slot-cushion {
                    color: var(--text-secondary);
                    font-weight: 600;
                    font-size: 12px;
                }

                .services-calendar .fc .fc-resource {
                    color: var(--text-primary);
                }

                .services-calendar .fc .fc-event {
                    border-radius: 10px;
                    box-shadow: 0 10px 24px rgba(0,0,0,0.25);
                    overflow: hidden;
                }

                .services-calendar .fc .fc-event .svc-line {
                    white-space: nowrap;
                    overflow: hidden;
                    text-overflow: ellipsis;
                }
                `}
            </style>

            {/* HEADER */}
            <div>
                <h1 className="text-3xl font-bold text-cca-textPrimary">Services</h1>
                <p className="text-sm text-cca-textSecondary">Vue hebdomadaire – Lundi à Dimanche, total par employé</p>
            </div>

            {/* SERVICES EN RETARD (+24h) */}
            {canManageAll && overdueServices.length > 0 && (
                <div className="rounded-xl border border-red-500/40 bg-red-500/10 p-4 space-y-3">
                    <div className="flex items-center gap-2 text-red-400">
                        <AlertTriangle className="h-4 w-4 shrink-0" />
                        <span className="text-sm font-semibold">
                            {overdueServices.length} service{overdueServices.length > 1 ? 's' : ''} bloqué{overdueServices.length > 1 ? 's' : ''} depuis plus de 24h
                        </span>
                    </div>
                    <div className="space-y-2">
                        {overdueServices.map((svc) => {
                            const employeeName = svc?.author?.name || 'Employé inconnu';
                            const startLabel = formatTime(svc.startTime);
                            const elapsedH = Math.floor((Date.now() - new Date(svc.startTime).getTime()) / 3600000);
                            return (
                                <div
                                    key={svc.id}
                                    className="flex items-center justify-between gap-3 rounded-lg border border-red-500/20 bg-red-500/5 px-3 py-2"
                                >
                                    <div className="min-w-0">
                                        <div className="text-sm font-semibold text-cca-textPrimary truncate">{employeeName}</div>
                                        <div className="flex items-center gap-1 text-xs text-red-400">
                                            <Clock className="h-3 w-3 shrink-0" />
                                            <span>Démarré à {startLabel} — {elapsedH}h en cours</span>
                                        </div>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() =>
                                            setOverdueConfirm({
                                                isOpen: true,
                                                serviceId: svc.id,
                                                serviceName: `${employeeName} (démarré à ${startLabel})`,
                                            })
                                        }
                                        className="shrink-0 rounded-lg bg-red-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-red-700 active:scale-[0.98]"
                                    >
                                        Annuler
                                    </button>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* MOBILE VIEW */}
            <div className="md:hidden">
                <div className="flex items-center justify-between gap-3">
                    <button
                        type="button"
                        className="inline-flex items-center justify-center rounded-lg border border-cca-border bg-cca-surface p-2 text-cca-textPrimary active:scale-[0.99]"
                        onClick={() => setMobileWeekStart((d) => startOfWeek(addWeeks(d, -1), { weekStartsOn: 1 }))}
                        aria-label="Semaine précédente"
                    >
                        <ChevronLeft className="h-5 w-5" />
                    </button>

                    <div className="min-w-0 flex-1">
                        <div className="text-sm font-semibold text-cca-textPrimary truncate">{mobileWeekLabel}</div>
                        <div className="text-xs text-cca-textSecondary truncate">Semaine</div>
                    </div>

                    <button
                        type="button"
                        className="inline-flex items-center justify-center rounded-lg border border-cca-border bg-cca-surface p-2 text-cca-textPrimary active:scale-[0.99]"
                        onClick={() => setMobileWeekStart((d) => startOfWeek(addWeeks(d, 1), { weekStartsOn: 1 }))}
                        aria-label="Semaine suivante"
                    >
                        <ChevronRight className="h-5 w-5" />
                    </button>
                </div>

                {/* Recherche + filtres */}
                <div className="mt-3 space-y-2">
                    <div className="relative">
                        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-cca-textSecondary" />
                        <input
                            type="text"
                            value={mobileSearch}
                            onChange={(e) => setMobileSearch(e.target.value)}
                            placeholder="Rechercher (employé, service…)"
                            className="w-full rounded-lg border border-cca-border bg-cca-surface py-2 pl-9 pr-9 text-sm text-cca-textPrimary placeholder:text-cca-textSecondary focus:outline-none focus:ring-2 focus:ring-cca-border/60"
                        />
                        {mobileSearch ? (
                            <button
                                type="button"
                                onClick={() => setMobileSearch('')}
                                className="absolute right-2 top-1/2 inline-flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-md border border-cca-border bg-cca-base text-cca-textPrimary active:scale-[0.99]"
                                aria-label="Effacer la recherche"
                            >
                                <X className="h-4 w-4" />
                            </button>
                        ) : null}
                    </div>

                    <div className="flex items-center gap-2">
                        <select
                            value={mobileEmployeeId}
                            onChange={(e) => setMobileEmployeeId(e.target.value)}
                            className="flex-1 rounded-lg border border-cca-border bg-cca-surface px-3 py-2 text-sm text-cca-textPrimary focus:outline-none focus:ring-2 focus:ring-cca-border/60"
                        >
                            <option value="ALL">Tous les employés</option>
                            {resources.map((r) => (
                                <option key={r.id} value={r.id}>
                                    {r.title}
                                </option>
                            ))}
                        </select>

                        {mobileEmployeeId !== 'ALL' || mobileSearch ? (
                            <button
                                type="button"
                                onClick={() => {
                                    setMobileEmployeeId('ALL');
                                    setMobileSearch('');
                                }}
                                className="rounded-lg border border-cca-border bg-cca-base px-3 py-2 text-xs font-semibold text-cca-textPrimary active:scale-[0.99]"
                            >
                                Réinitialiser
                            </button>
                        ) : null}
                    </div>

                    <div className="text-xs text-cca-textSecondary">
                        {mobileFilteredSummary.count} service{mobileFilteredSummary.count > 1 ? 's' : ''} •{' '}
                        {formatTotalMinutes(mobileFilteredSummary.totalMinutes)}
                    </div>
                </div>

                {/* Totaux employés */}
                <div className="mt-4 rounded-xl border border-cca-border bg-cca-surface p-3">
                    <div className="text-xs font-semibold text-cca-textPrimary">Total par employé</div>
                    <div className="mt-2 flex flex-wrap gap-2">
                        {(() => {
                            const totalsResources =
                                mobileEmployeeId !== 'ALL'
                                    ? resources.filter((r) => String(r.id) === String(mobileEmployeeId))
                                    : resources;

                            if (totalsResources.length === 0 && !loading) {
                                return (
                                    <span className="text-sm text-cca-textSecondary">
                                        Aucun employé trouvé sur cette semaine.
                                    </span>
                                );
                            }

                            return totalsResources.map((r) => (
                                <span
                                    key={r.id}
                                    className="inline-flex items-center gap-2 rounded-full border border-cca-border bg-cca-base px-3 py-1 text-xs text-cca-textPrimary"
                                >
                                    <span className="max-w-[160px] truncate">{r.title}</span>
                                    <span className="text-cca-textSecondary">•</span>
                                    <span className="font-semibold text-cca-textPrimary">
                                        {formatTotalMinutes(totalByEmployee[r.id] || 0)}
                                    </span>
                                </span>
                            ));
                        })()}
                    </div>
                </div>

                {/* Liste services */}
                <div className="mt-4 space-y-4">
                    {loading && (
                        <div className="rounded-xl border border-cca-border bg-cca-surface p-4 text-sm text-cca-textPrimary">
                            Chargement des services…
                        </div>
                    )}

                    {!loading && mobileItemsByDay.length === 0 && (
                        <div className="rounded-xl border border-cca-border bg-cca-surface p-4 text-sm text-cca-textPrimary">
                            Aucun service sur cette semaine.
                        </div>
                    )}

                    {!loading &&
                        mobileItemsByDay.map((day) => (
                            <div key={day.key} className="space-y-2">
                                <div className="text-xs font-semibold text-cca-textSecondary capitalize">{day.label}</div>
                                <div className="space-y-2">
                                    {day.items.map((it) => (
                                        <div
                                            key={it.id}
                                            className="rounded-xl border border-cca-border bg-cca-surface p-3"
                                        >
                                            <div className="flex items-start justify-between gap-3">
                                                <div className="min-w-0">
                                                    <div className="text-sm font-semibold text-cca-textPrimary truncate">
                                                        {it.employeeName}
                                                    </div>
                                                    <div className="text-xs text-cca-textSecondary truncate">{it.title}</div>
                                                </div>
                                                <div className="text-right">
                                                    <div className="text-sm font-semibold text-cca-textPrimary">
                                                        {it.durationLabel}
                                                    </div>
                                                    <div className="text-xs text-cca-textSecondary">
                                                        {it.startLabel} – {it.endLabel}
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        ))}
                </div>
            </div>

            {/* DESKTOP VIEW */}
            <div className="hidden md:block">
                {/* CONTAINER */}
                <div
                    className="relative overflow-hidden rounded-xl
                           bg-cca-surface
                           border border-cca-border backdrop-blur-xl
                           shadow-2xl shadow-black/40"
                >
                    <div
                        className="pointer-events-none absolute inset-0 opacity-25 mix-blend-soft-light
                                [background:
                                    radial-gradient(circle_at_top_left, rgba(99,102,241,0.18), transparent 55%),
                                    radial-gradient(circle_at_bottom_right, rgba(8,47,73,0.40), transparent 55%)
                                ]"
                    />

                    {loading && (
                        <div className="absolute inset-0 z-20 flex items-center justify-center bg-cca-base/60 backdrop-blur">
                            <p className="text-cca-textPrimary text-sm">Chargement des services…</p>
                        </div>
                    )}

                    <div className="services-calendar relative h-[75vh]">
                        <FullCalendar
                            ref={calendarRef}
                            plugins={[resourceTimelinePlugin, interactionPlugin]}
                            schedulerLicenseKey="GPL-My-Project-Is-Open-Source"
                            height="100%"
                            locale="fr"
                            initialView="resourceTimelineWeek"
                            firstDay={1}
                            views={calendarViews}
                            datesSet={handleDatesSet}
                            headerToolbar={{
                                left: 'prev,next today',
                                center: 'title',
                                right: '',
                            }}
                            slotLabelFormat={[
                                { weekday: 'short', day: '2-digit', month: '2-digit' },
                                { hour: '2-digit', minute: '2-digit', hour12: false },
                            ]}
                            slotMinWidth={64}
                            scrollTime="06:00:00"
                            nowIndicator={true}
                            expandRows={true}
                            eventOverlap={false}
                            resourceAreaHeaderContent="Employés"
                            resourceAreaWidth="300px"
                            resourceLaneContentHeight={72}
                            eventMinHeight={48}
                            resources={resources}
                            events={services}
                            resourceLabelContent={(arg) => {
                                const userId = arg.resource.id;
                                const totalMinutes = totalByEmployee[userId] || 0;

                                return (
                                    <div className="flex flex-col">
                                        <span className="font-semibold text-cca-textPrimary text-sm">{arg.resource.title}</span>
                                        <span className="text-xs text-cca-textSecondary">
                                            {formatTotalMinutes(totalMinutes)} sur la semaine
                                        </span>
                                    </div>
                                );
                            }}
                            eventDidMount={(info) => {
                                // Tooltip / Title
                                const svc = info.event.extendedProps?.original;
                                if (!svc?.startTime) return;

                                const startLabel = formatTime(svc.startTime);
                                const endLabel = svc.endTime ? formatTime(svc.endTime) : 'En cours';
                                const durationLabel = formatDuration(svc.startTime, svc.endTime);

                                info.el.title = `${startLabel} – ${endLabel} • ${durationLabel}`;

                                // Context Menu
                                info.el.addEventListener('contextmenu', (jsEvent) => {
                                    handleEventContextMenu({ jsEvent, event: info.event });
                                });
                            }}
                            eventContent={(arg) => {
                                const svc = arg.event.extendedProps?.original;
                                if (!svc?.startTime) return null;

                                const startLabel = formatTime(svc.startTime);
                                const endLabel = svc.endTime ? formatTime(svc.endTime) : 'En cours';
                                const durationLabel = formatDuration(svc.startTime, svc.endTime);

                                return (
                                    <div className="flex flex-col justify-center h-full px-2 py-1 leading-tight">
                                        <span className="svc-line text-xs font-semibold text-white">
                                            {startLabel} – {endLabel}
                                        </span>
                                        <span className="svc-line text-[11px] text-white/90">{durationLabel}</span>
                                    </div>
                                );
                            }}
                        />
                    </div>
                </div>
            </div>

            {/* Modals & Context Menu */}
            {contextMenu.visible && (
                <CalendarContextMenu
                    x={contextMenu.x}
                    y={contextMenu.y}
                    event={contextMenu.event}
                    onClose={() => setContextMenu({ ...contextMenu, visible: false })}
                    onFinishEvent={handleFinishService}
                    onEditEvent={() => {
                        setContextMenu({ ...contextMenu, visible: false });
                        setIsEditModalOpen(true);
                    }}
                    onDeleteEvent={() => {
                        const eventId = contextMenu.event.id;
                        setContextMenu({ ...contextMenu, visible: false });
                        setConfirmModal({
                            isOpen: true,
                            type: 'CANCEL',
                            eventId: eventId
                        });
                    }}
                />
            )}

            <ActionConfirmationModal
                isOpen={confirmModal.isOpen}
                onClose={() => setConfirmModal({ isOpen: false, type: '', eventId: null })}
                onConfirm={handleConfirmCancel}
                loading={isActionLoading}
                title="Annuler le service"
                message="Êtes-vous sûr de vouloir annuler ce service ? Cette action est irréversible. Si vous avez besoin d'un backup, veuillez prévenir la CCA avant de confirmer."
                variant="danger"
            />

            <ActionConfirmationModal
                isOpen={overdueConfirm.isOpen}
                onClose={() => setOverdueConfirm({ isOpen: false, serviceId: null, serviceName: '' })}
                onConfirm={handleConfirmOverdueCancel}
                loading={isActionLoading}
                title="Annuler le service bloqué"
                message={`Ce service est en cours depuis plus de 24h (${overdueConfirm.serviceName}). Confirmer l'annulation ? Cette action est irréversible.`}
                variant="danger"
            />

            {isEditModalOpen && (
                <AddEventModal
                    isOpen={isEditModalOpen}
                    onClose={() => setIsEditModalOpen(false)}
                    onSave={handleSaveDuration}
                    eventToEdit={contextMenu.event}
                    categories={categories}
                    durationOnly={true}
                />
            )}
        </div>
    );
};

export default ServicePage;
