// frontend/src/components/dashboard/WidgetGrid.jsx

import React, { useEffect, useMemo, useState, useCallback } from 'react';
import { Responsive, WidthProvider } from 'react-grid-layout';
import 'react-grid-layout/css/styles.css';
import 'react-resizable/css/styles.css';
import toast from 'react-hot-toast';
import { Settings } from 'lucide-react';
import Modal from '../Modal';
import WidgetSelectorModal from './WidgetSelectorModal';
import WidgetContextMenu from './WidgetContextMenu';

// --- Imports widgets ---
import AdminContractAssignerWidget from './widgets/AdminContractAssignerWidget';
import AdminCompanyStatsWidget from './widgets/AdminCompanyStatsWidget';
import UserBillsByStatusWidget from './widgets/UserBillsByStatusWidget';
import TransactionLogWidget from './widgets/TransactionLogWidget';
import CompanyBalanceWidget from './widgets/CompanyBalanceWidget';
import BillJournalWidget from './widgets/BillJournalWidget';
import SendNotificationWidget from './widgets/SendNotificationWidget';
import CreateExpenseReportWidget from './widgets/CreateExpenseReportWidget';
import MyRecentExpenseReportsWidget from './widgets/MyRecentExpenseReportsWidget';
import ExpenseReportStatsWidget from './widgets/ExpenseReportStatsWidget';
import ExpenseReportApprovalWidget from './widgets/ExpenseReportApprovalWidget';
import MySalaryWidget from '@/components/widgets/MySalaryWidget.jsx';
import DeclareProductWidget from '@/components/products/DeclareProductWidget.jsx';
import InvitationsWidget from '@/modules/myCalendar/widgets/InvitationsWidget';

// ✅ correction d’import (quotes)
import DeclarePartnerServiceWidget from '@/components/widgets/DeclarePartnerServiceWidget.jsx';
import MyServiceWidget from '@/components/widgets/MyServiceWidget.jsx';

// --- Imports settings widgets ---
import TransactionLogSettings from './widgets/settings/TransactionLogSettings';
import BillJournalSettings from './widgets/settings/BillJournalSettings';
import UserDutyCounterWidget from '@/components/widgets/COMPANY/duty/UserDutyCounterWidget.jsx';
import UsersDutyCounterWidget from '@/components/widgets/COMPANY/duty/UsersDutyCounterWidget.jsx';
import UserDutyCounterSettings from '@/components/dashboard/widgets/settings/UserDutyCounterSettings.jsx';
import MyTurnoverWidget from '@/components/widgets/MyTurnoverWidget.jsx';
import PawnshopEmployeeRankingWidget from '@/components/widgets/PAWNSHOP/PawnshopEmployeeRankingWidget.jsx';
import MyTurnoverSettings from './widgets/settings/MyTurnoverSettings';
import PawnshopEmployeeRankingSettings from '@/components/dashboard/widgets/settings/PawnshopEmployeeRankingSettings.jsx';
import RepairKitWidget from '@/components/widgets/COMPANY/mecano/RepairKitWidget.jsx';

const ResponsiveGridLayout = WidthProvider(Responsive);

// ===== Responsive settings =====
const GRID_BREAKPOINTS = {
    lg: 1200,
    md: 996,
    sm: 768,
    xs: 480,
    xxs: 0,
};

const GRID_COLS = {
    lg: 12,
    md: 10,
    sm: 6,
    xs: 4,
    xxs: 2,
};

const ALL_BPS = Object.keys(GRID_BREAKPOINTS);

// Force minH=4 + visible default true
function normalizeLayouts(layouts) {
    const safe = layouts && typeof layouts === 'object' ? layouts : {};
    const out = {};

    for (const bp of ALL_BPS) {
        const arr = Array.isArray(safe[bp]) ? safe[bp] : [];
        out[bp] = arr.map((it) => {
            const minH = Math.max(4, Number.isFinite(it?.minH) ? Number(it.minH) : 4);
            const h = Math.max(minH, Number.isFinite(it?.h) ? Number(it.h) : minH);
            const visible = it?.visible !== false;
            return { ...it, minH, h, visible };
        });
    }

    const fallbackFrom = out.lg?.length ? 'lg' : (ALL_BPS.find((k) => out[k]?.length) || null);
    if (fallbackFrom) {
        for (const bp of ALL_BPS) {
            if (!out[bp] || out[bp].length === 0) out[bp] = out[fallbackFrom].map((x) => ({ ...x }));
        }
    }

    return out;
}

function filterLayoutsByVisible(masterLayouts) {
    const normalized = normalizeLayouts(masterLayouts);
    const filtered = {};
    for (const bp of ALL_BPS) {
        filtered[bp] = (normalized[bp] || []).filter((item) => item.visible !== false);
    }
    return filtered;
}

// Merge layouts visibles (issus du grid) dans le master (préserve cachés)
function mergeVisibleLayoutsIntoMaster(masterLayouts, nextLayoutsFromGrid) {
    const normalizedMaster = normalizeLayouts(masterLayouts);
    const normalizedNext = normalizeLayouts(nextLayoutsFromGrid);

    const merged = {};
    for (const bp of ALL_BPS) {
        const prevArr = Array.isArray(normalizedMaster[bp]) ? normalizedMaster[bp] : [];
        const nextArr = Array.isArray(normalizedNext[bp]) ? normalizedNext[bp] : [];
        const nextMap = new Map(nextArr.map((it) => [it.i, it]));

        merged[bp] = prevArr.map((oldItem) => {
            if (oldItem.visible !== false && nextMap.has(oldItem.i)) {
                const n = nextMap.get(oldItem.i);
                return { ...n, visible: oldItem.visible !== false };
            }
            return oldItem;
        });

        // Ajout d’éventuels items nouveaux (rare)
        for (const [id, it] of nextMap.entries()) {
            if (!merged[bp].some((x) => x.i === id)) merged[bp].push({ ...it, visible: true });
        }
    }

    return normalizeLayouts(merged);
}

// eslint-disable-next-line react-refresh/only-export-components
export const WIDGET_COMPONENTS = {
    USER_BILLS_BY_STATUS: UserBillsByStatusWidget,
    USER_DUTY_COUNTER: UserDutyCounterWidget,
    TRANSACTION_LOG: TransactionLogWidget,
    COMPANY_BALANCE: CompanyBalanceWidget,
    BILL_JOURNAL: BillJournalWidget,
    SEND_COMPANY_NOTIFICATION: SendNotificationWidget,
    CREATE_EXPENSE_REPORT: CreateExpenseReportWidget,
    MY_RECENT_EXPENSE_REPORTS: MyRecentExpenseReportsWidget,
    EXPENSE_REPORT_STATS: ExpenseReportStatsWidget,
    EXPENSE_REPORT_APPROVAL: ExpenseReportApprovalWidget,
    ADMIN_CONTRACT_ASSIGNER: AdminContractAssignerWidget,
    ADMIN_COMPANY_STATS: AdminCompanyStatsWidget,
    MY_SALARY: MySalaryWidget,
    DECLARE_PRODUCT: DeclareProductWidget,
    DECLARE_PARTNER_SERVICE: DeclarePartnerServiceWidget,
    MY_PARTNER_SERVICES: MyServiceWidget,
    USERS_DUTY_COUNTER: UsersDutyCounterWidget,
    MY_TURNOVER: MyTurnoverWidget,
    PAWNSHOP_EMPLOYEE_RANKING: PawnshopEmployeeRankingWidget,
    MY_CALENDAR_INVITATIONS: InvitationsWidget,
    REPAIR_KIT: RepairKitWidget,
};

const widgetSettingsComponents = {
    TRANSACTION_LOG: TransactionLogSettings,
    BILL_JOURNAL: BillJournalSettings,
    USER_DUTY_COUNTER: UserDutyCounterSettings,
    MY_TURNOVER: MyTurnoverSettings,
    PAWNSHOP_EMPLOYEE_RANKING: PawnshopEmployeeRankingSettings,
};

// UI nav (Personnaliser) : widgets cachés + breakpoints
const HiddenWidgetsNav = ({ isEditable, widgets, layouts, currentBreakpoint, onMakeVisible }) => {
    const [open, setOpen] = useState(true);
    const [selectedBp, setSelectedBp] = useState(currentBreakpoint || 'lg');

    useEffect(() => {
        setSelectedBp(currentBreakpoint || 'lg');
    }, [currentBreakpoint]);

    const normalized = useMemo(() => normalizeLayouts(layouts), [layouts]);

    const hiddenWidgets = useMemo(() => {
        const bp = selectedBp;
        const arr = normalized[bp] || [];
        const map = new Map(arr.map((it) => [it.i, it]));

        return widgets
            .map((w) => {
                const id = w.id.toString();
                const item = map.get(id);
                return { widget: w, item };
            })
            .filter(({ item }) => item && item.visible === false)
            .map(({ widget }) => widget);
    }, [widgets, normalized, selectedBp]);

    if (!isEditable) return null;

    return (
        <div className="bg-cca-surface/40 border border-cca-border/60 rounded-lg p-3">
            <div className="flex items-center justify-between gap-3">
                <div className="text-sm font-semibold text-cca-textPrimary">Widgets masqués</div>

                <button
                    type="button"
                    onClick={() => setOpen((v) => !v)}
                    className="text-xs px-2 py-1 rounded-md border border-cca-border/60 text-cca-textPrimary hover:bg-cca-base/50"
                >
                    {open ? 'Réduire' : 'Afficher'}
                </button>
            </div>

            {open && (
                <div className="mt-3 space-y-3">
                    <div className="flex flex-wrap gap-2">
                        {ALL_BPS.map((bp) => (
                            <button
                                key={bp}
                                type="button"
                                onClick={() => setSelectedBp(bp)}
                                className={[
                                    'text-xs px-2 py-1 rounded-md border',
                                    selectedBp === bp
                                        ? 'border-brand-primary bg-brand-primary/20 text-cca-textPrimary'
                                        : 'border-cca-border/60 text-cca-textSecondary hover:bg-cca-base/50',
                                ].join(' ')}
                            >
                                {bp}
                            </button>
                        ))}
                    </div>

                    {hiddenWidgets.length === 0 ? (
                        <div className="text-xs text-cca-textSecondary">
                            Aucun widget masqué sur <span className="text-cca-textPrimary font-semibold">{selectedBp}</span>.
                        </div>
                    ) : (
                        <div className="space-y-2">
                            {hiddenWidgets.map((w) => (
                                <div
                                    key={w.id.toString()}
                                    className="flex items-center justify-between gap-3 bg-cca-base/30 border border-cca-border/60 rounded-md px-3 py-2"
                                >
                                    <div className="min-w-0">
                                        <div className="text-sm text-cca-textPrimary truncate">
                                            {w?.widgetDefinition?.name || w?.widgetDefinition?.type || 'Widget'}
                                        </div>
                                        <div className="text-[11px] text-cca-textSecondary truncate">
                                            {w?.widgetDefinition?.type || ''}
                                        </div>
                                    </div>

                                    <button
                                        type="button"
                                        onClick={() => onMakeVisible(w.id, selectedBp)}
                                        className="text-[9px] font-black uppercase tracking-widest px-3 py-1.5 rounded-lg bg-emerald-500/80 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-500/10 transition-all active:scale-[0.98]"
                                    >
                                        Rétablir
                                    </button>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

const WidgetGrid = ({
                        isEditable,
                        widgets,
                        layouts,
                        handleLayoutChange,
                        handleDeleteWidget,
                        handleAddWidget,
                        handleUpdateWidgetConfig,
                        handleSetWidgetVisibleByBreakpoint,
                        fetchAvailableWidgets,
                    }) => {
    const [isSelectorOpen, setIsSelectorOpen] = useState(false);
    const [availableWidgets, setAvailableWidgets] = useState([]);
    const [isSettingsOpen, setIsSettingsOpen] = useState(false);
    const [widgetToConfigure, setWidgetToConfigure] = useState(null);
    const [contextMenu, setContextMenu] = useState({ visible: false, x: 0, y: 0, widget: null });

    const [currentBreakpoint, setCurrentBreakpoint] = useState('lg');
    const isMobile = currentBreakpoint === 'xxs' || currentBreakpoint === 'xs';
    const isTablet = currentBreakpoint === 'sm' || currentBreakpoint === 'md';
    const isTouch = isMobile || isTablet;

    const masterLayouts = useMemo(() => normalizeLayouts(layouts), [layouts]);
    const gridLayouts = useMemo(() => filterLayoutsByVisible(masterLayouts), [masterLayouts]);

    const onMakeVisible = useCallback(
        (widgetId, bp) => {
            if (typeof handleSetWidgetVisibleByBreakpoint !== 'function') return;
            handleSetWidgetVisibleByBreakpoint(widgetId, { [bp]: true });
        },
        [handleSetWidgetVisibleByBreakpoint],
    );

    const widgetsToRender = useMemo(() => {
        const visibleIds = new Set((gridLayouts[currentBreakpoint] || []).map((l) => l.i));
        return widgets.filter((w) => visibleIds.has(w.id.toString()));
    }, [widgets, gridLayouts, currentBreakpoint]);

    useEffect(() => {
        const handleClick = () => setContextMenu((prev) => ({ ...prev, visible: false }));
        if (contextMenu.visible) window.addEventListener('click', handleClick);
        return () => window.removeEventListener('click', handleClick);
    }, [contextMenu.visible]);

    const handleOpenSelector = async () => {
        try {
            const available = await fetchAvailableWidgets();
            setAvailableWidgets(available);
            setIsSelectorOpen(true);
        } catch {
            toast.error('Impossible de charger la liste des widgets.');
            toast.error("Vous êtes probablement sur un compte client et non employé. Rapprochez vous de votre responsable.");
        }
    };

    const handleOpenSettings = (widget) => {
        setWidgetToConfigure(widget);
        setIsSettingsOpen(true);
    };

    const handleSaveSettings = (newConfig) => {
        handleUpdateWidgetConfig(widgetToConfigure.id, newConfig);
    };

    const handleContextMenu = (event, widget) => {
        event.preventDefault();
        event.stopPropagation();
        setContextMenu({ visible: true, x: event.clientX, y: event.clientY, widget });
    };

    const SettingsComponent = widgetToConfigure ? widgetSettingsComponents[widgetToConfigure.widgetDefinition.type] : null;
    const currentWidgetTypes = widgets.map((w) => w.widgetDefinition.type);

    const gridMargin = useMemo(() => {
        if (isMobile) return [10, 10];
        if (isTablet) return [12, 12];
        return [16, 16];
    }, [isMobile, isTablet]);

    const gridContainerPadding = useMemo(() => {
        if (isMobile) return [8, 8];
        if (isTablet) return [10, 10];
        return [12, 12];
    }, [isMobile, isTablet]);

    // ✅ IMPORTANT : drag sur mobile/tactile activé en mode Personnaliser
    // Déplacement uniquement via la poignée => limite les conflits de scroll
    const effectiveIsEditable = Boolean(isEditable);
    const enableDrag = effectiveIsEditable;
    const enableResize = effectiveIsEditable;

    const onLayoutChangeSafe = useCallback(
        (currentLayout, allLayouts) => {
            if (!effectiveIsEditable) return;
            const mergedMaster = mergeVisibleLayoutsIntoMaster(masterLayouts, allLayouts || {});
            handleLayoutChange(currentLayout, mergedMaster);
        },
        [handleLayoutChange, effectiveIsEditable, masterLayouts],
    );

    return (
        <div className="space-y-4">
            {isEditable && (
                <button onClick={handleOpenSelector} className="px-6 py-3 bg-brand-primary text-white font-black text-xs uppercase tracking-[0.2em] rounded-xl shadow-xl shadow-brand-primary/20 hover:scale-[1.02] active:scale-[0.98] transition-all">
                    INSTALLATION NOUVEAU MODULE
                </button>
            )}

            <HiddenWidgetsNav
                isEditable={isEditable}
                widgets={widgets}
                layouts={masterLayouts}
                currentBreakpoint={currentBreakpoint}
                onMakeVisible={onMakeVisible}
            />

            <WidgetSelectorModal
                isOpen={isSelectorOpen}
                onClose={() => setIsSelectorOpen(false)}
                availableWidgets={availableWidgets}
                onAddWidget={handleAddWidget}
                currentWidgetTypes={currentWidgetTypes}
            />

            <Modal isOpen={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} title={`Configurer : ${widgetToConfigure?.widgetDefinition.name || ''}`}>
                {SettingsComponent ? (
                    <SettingsComponent
                        config={widgetToConfigure?.config || {}}
                        onUpdateConfig={handleSaveSettings}
                        onCancel={() => setIsSettingsOpen(false)}
                        widgetDefinition={widgetToConfigure.widgetDefinition}
                    />
                ) : (
                    <p className="text-cca-textSecondary">Ce widget n'a pas d'options.</p>
                )}
            </Modal>

            {contextMenu.visible && (
                <WidgetContextMenu
                    x={contextMenu.x}
                    y={contextMenu.y}
                    onClose={() => setContextMenu((prev) => ({ ...prev, visible: false }))}
                    onConfigure={() => handleOpenSettings(contextMenu.widget)}
                    onDelete={() => handleDeleteWidget(contextMenu.widget.id)}
                    canConfigure={!!widgetSettingsComponents[contextMenu.widget.widgetDefinition.type]}
                />
            )}

            <div className={isEditable ? 'bg-[radial-gradient(rgb(var(--border-color-rgb))_1px,transparent_1px)] [background-size:2rem_2rem] min-h-[400px]' : ''}>
                <ResponsiveGridLayout
                    layouts={gridLayouts}
                    breakpoints={GRID_BREAKPOINTS}
                    cols={GRID_COLS}
                    onLayoutChange={enableDrag || enableResize ? onLayoutChangeSafe : undefined}
                    onBreakpointChange={(bp) => setCurrentBreakpoint(bp)}
                    isDraggable={enableDrag}
                    isResizable={enableResize}
                    draggableHandle=".widget-drag-handle"
                    draggableCancel=".widget-content, button, a, input, textarea, select, option, .no-drag, .react-resizable-handle"
                    // tactile : un seul handle, plus stable
                    resizeHandles={isTouch ? ['se'] : ['se', 's', 'e']}
                    rowHeight={30}
                    margin={gridMargin}
                    containerPadding={gridContainerPadding}
                    className="layout"
                    compactType="vertical"
                    preventCollision={false}
                    isBounded
                    useCSSTransforms
                >
                    {widgetsToRender.map((widget) => {
                        const WidgetComponent = WIDGET_COMPONENTS[widget.widgetDefinition.type];
                        const widgetName = widget?.widgetDefinition?.name || 'Widget';

                        return (
                            <div
                                key={widget.id.toString()}
                                className="bg-cca-surface/10 backdrop-blur-2xl rounded-lg shadow-xl flex flex-col group overflow-hidden relative border border-cca-border/20"
                                style={{ height: '100%', width: '100%' }}
                                onContextMenu={(e) => handleContextMenu(e, widget)}
                            >
                                {isEditable && (
                                    <div
                                        className="widget-drag-handle flex items-center justify-between px-3 py-2 bg-cca-base/40 border-b border-cca-border/30 select-none"
                                        style={{ touchAction: 'none' }} // ✅ essentiel pour le drag tactile
                                    >
                                        <div className="text-xs text-cca-textPrimary truncate pr-6">{widgetName}</div>

                                        <div className="absolute top-2 right-2 z-10 p-1 bg-cca-base/50 rounded-full text-cca-textSecondary opacity-0 group-hover:opacity-100 transition-opacity">
                                            <Settings onClick={() => handleOpenSettings(widget)} className="cursor-pointer" size={16} />
                                        </div>
                                    </div>
                                )}

                                <div className="widget-content p-4 flex-1 flex flex-col overflow-y-auto min-h-0">
                                    {WidgetComponent ? (
                                        <WidgetComponent config={widget.config} />
                                    ) : (
                                        <div className="text-center text-cca-textSecondary">
                                            <p>
                                                Widget : <span className="font-bold">{widgetName}</span>
                                            </p>
                                            <p className="text-xs mt-2">(Composant non implémenté)</p>
                                        </div>
                                    )}
                                </div>

                                {/* Zone visuelle (et utile sur tactile) pour indiquer le resize */}
                                {isEditable && (
                                    <div
                                        className="pointer-events-none absolute bottom-2 right-2 h-9 w-9 rounded-md bg-cca-base/40 border border-cca-border/60"
                                        aria-hidden="true"
                                    />
                                )}
                            </div>
                        );
                    })}
                </ResponsiveGridLayout>
            </div>
        </div>
    );
};

export default WidgetGrid;
