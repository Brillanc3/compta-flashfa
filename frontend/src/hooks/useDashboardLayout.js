// frontend/src/hooks/useDashboardLayout.js
import { useState, useEffect, useCallback, useMemo } from 'react';
import {
    getUserDashboardLayout,
    saveUserDashboardLayout,
    getAvailableWidgets
} from '@/services/dashboardService';
import toast from 'react-hot-toast';

// Breakpoints (doit matcher WidgetGrid.jsx)
const BREAKPOINTS = ['lg', 'md', 'sm', 'xs', 'xxs'];

const DEFAULTS_BY_BP = {
    lg:  { w: 4, h: 4 },
    md:  { w: 4, h: 4 },
    sm:  { w: 6, h: 4 },
    xs:  { w: 4, h: 4 },
    xxs: { w: 2, h: 4 }
};

const sanitize = (val, fallback = 0) => {
    if (val === null || val === undefined || Number.isNaN(val)) return fallback;
    return val;
};

// Force minH=4 et h>=minH ; visible default true
const enforceMinH = (layoutItem) => {
    if (!layoutItem) return null;

    const minH = Math.max(4, sanitize(layoutItem.minH, 4));
    const h = Math.max(minH, sanitize(layoutItem.h, minH));
    const visible = layoutItem.visible !== false;

    return { ...layoutItem, minH, h, visible };
};

// Normalise un objet layouts pour contenir tous les breakpoints + fallback
const normalizeLayouts = (rawLayouts) => {
    const safe = rawLayouts && typeof rawLayouts === 'object' ? rawLayouts : {};
    const out = {};

    for (const bp of BREAKPOINTS) {
        const arr = Array.isArray(safe[bp]) ? safe[bp] : [];
        out[bp] = arr.map(enforceMinH).filter(Boolean);
    }

    // Fallback: si un breakpoint est vide, dupliquer depuis lg ou le premier non vide
    const fallbackFrom =
        out.lg.length ? 'lg' : (BREAKPOINTS.find((bp) => out[bp]?.length) || null);

    if (fallbackFrom) {
        for (const bp of BREAKPOINTS) {
            if (!out[bp] || out[bp].length === 0) {
                out[bp] = out[fallbackFrom].map((x) => ({ ...x }));
            }
        }
    }

    return out;
};

export const useDashboardLayout = (contextId, contextType) => {
    const [isLoading, setIsLoading] = useState(true);
    const [widgets, setWidgets] = useState([]);
    const [layouts, setLayouts] = useState(() => normalizeLayouts({}));

    const emptyLayouts = useMemo(() => normalizeLayouts({}), []);

    // --- Chargement du layout ---
    const fetchLayout = useCallback(async () => {
        if (!contextId) {
            setWidgets([]);
            setLayouts(emptyLayouts);
            setIsLoading(false);
            return;
        }

        setIsLoading(true);
        try {
            const userWidgets = await getUserDashboardLayout(contextId, contextType);
            
            if (!Array.isArray(userWidgets)) {
                throw new Error("Invalid response from getUserDashboardLayout: expected an array");
            }

            setWidgets(userWidgets);
            
            const newLayouts = {};
            for (const bp of BREAKPOINTS) newLayouts[bp] = [];

            userWidgets.forEach(widget => {
                const id = widget.id.toString();

                // layout stocké en DB par widget : { lg:{...}, md:{...}, ... }
                const widgetLayout = widget.layout || {};

                const baseFallback = {
                    x: 0,
                    y: 0,
                    ...DEFAULTS_BY_BP.lg,
                    i: id,
                    minH: 4,
                    visible: true
                };

                // fallback si certains bp n'existent pas
                const firstExisting =
                    widgetLayout.lg || widgetLayout.md || widgetLayout.sm || widgetLayout.xs || widgetLayout.xxs || null;

                for (const bp of BREAKPOINTS) {
                    const bpDefault = DEFAULTS_BY_BP[bp] || DEFAULTS_BY_BP.lg;
                    const source = widgetLayout[bp] || firstExisting || baseFallback;

                    const merged = {
                        x: sanitize(source.x, 0),
                        y: sanitize(source.y, 0),
                        w: sanitize(source.w, bpDefault.w),
                        h: sanitize(source.h, bpDefault.h),
                        i: id,
                        minH: 4,
                        visible: source.visible !== false // default true
                    };

                    newLayouts[bp].push(enforceMinH(merged));
                }
            });

            setLayouts(normalizeLayouts(newLayouts));
        } catch (error) {
            console.error('[useDashboardLayout] fetchLayout error:', error);
            toast.error('Impossible de charger le dashboard.');
            setWidgets([]);
            setLayouts(emptyLayouts);
        } finally {
            setIsLoading(false);
        }
    }, [contextId, contextType, emptyLayouts]);

    useEffect(() => {
        fetchLayout();
    }, [fetchLayout]);

    // --- Gestion des changements de layout ---
    // Ici, WidgetGrid envoie un "master allLayouts" déjà mergé (incluant hidden)
    const handleLayoutChange = (_, allLayouts) => {
        setLayouts(() => normalizeLayouts(allLayouts || {}));
    };

    // --- Sauvegarde ---
    const buildWidgetsToSave = useCallback((widgetsSource, layoutsSource) => {
        return (widgetsSource || []).map((widget) => {
            const widgetIdStr = widget.id.toString();

            const layoutByBp = {};
            let hasAny = false;

            for (const bp of BREAKPOINTS) {
                const item = layoutsSource?.[bp]?.find((l) => l.i === widgetIdStr);
                if (item) {
                    hasAny = true;
                    const enforced = enforceMinH(item);

                    layoutByBp[bp] = {
                        x: sanitize(enforced.x, 0),
                        y: sanitize(enforced.y, 0),
                        w: sanitize(enforced.w, DEFAULTS_BY_BP[bp]?.w ?? 4),
                        h: sanitize(enforced.h, DEFAULTS_BY_BP[bp]?.h ?? 4),
                        minH: 4,
                        visible: enforced.visible !== false,
                    };
                }
            }

            if (!hasAny) return null;

            const defId = widget.widgetDefinitionId ?? widget.widgetDefinition?.id ?? null;
            const defType = widget.widgetDefinitionType ?? widget.widgetDefinition?.type ?? null;

            return {
                id: typeof widget.id === 'number' ? widget.id : undefined,
                widgetDefinitionId: defId,
                widgetDefinitionType: defType,
                widgetDefinition: defType ? { type: defType } : undefined,
                config: widget.config || {},
                layout: layoutByBp,
            };
        }).filter(Boolean);
    }, []);

    // Optionnel : widgets/layouts override pour éviter les soucis de state async (ex: delete + save immédiat)
    const handleSaveLayout = async (overrides = {}) => {
        if (!contextId) return Promise.resolve();

        const widgetsSource = overrides.widgets ?? widgets;
        const layoutsSource = overrides.layouts ?? layouts;

        const promise = (async () => {
            const widgetsToSave = buildWidgetsToSave(widgetsSource, layoutsSource);
            await saveUserDashboardLayout(contextId, contextType, widgetsToSave);
            await fetchLayout();
        })();

        toast.promise(promise, {
            loading: 'Sauvegarde du layout...',
            success: 'Disposition sauvegardée !',
            error: 'Erreur lors de la sauvegarde.',
        });

        return promise;
    };

    // --- Suppression ---
    const handleDeleteWidget = (widgetId) => {
        const idStr = widgetId.toString();
        setWidgets(prev => prev.filter(w => w.id !== widgetId));
        setLayouts(prev => {
            const next = { ...prev };
            for (const bp of BREAKPOINTS) {
                next[bp] = (next[bp] || []).filter(l => l.i !== idStr);
            }
            return normalizeLayouts(next);
        });
    };

    // ✅ Suppression + sauvegarde atomique (évite le save avec un state pas encore à jour)
    const handleDeleteWidgetAndSave = async (widgetId) => {
        const idStr = widgetId.toString();

        const nextWidgets = (widgets || []).filter((w) => w.id !== widgetId);
        const nextLayoutsRaw = { ...layouts };
        for (const bp of BREAKPOINTS) {
            nextLayoutsRaw[bp] = (nextLayoutsRaw[bp] || []).filter((l) => l.i !== idStr);
        }
        const nextLayouts = normalizeLayouts(nextLayoutsRaw);

        // UI immédiate
        setWidgets(nextWidgets);
        setLayouts(nextLayouts);

        // Persistance avec snapshot cohérent
        return handleSaveLayout({ widgets: nextWidgets, layouts: nextLayouts });
    };

    // --- Ajout ---
    const handleAddWidget = (widgetDef) => {
        const widgetDefinitionId = widgetDef.widgetDefinitionId;
        const widgetDefinitionType = widgetDef.widgetDefinitionType;
        const definition = widgetDef.widgetDefinition;

        const tempId = `new-${widgetDefinitionType}-${Date.now()}`;

        const newWidget = {
            id: tempId,
            widgetDefinitionId,
            widgetDefinitionType,
            widgetDefinition: {
                id: widgetDefinitionId,
                type: widgetDefinitionType,
                name: definition?.name ?? '',
                description: definition?.description ?? ''
            },
            config: {}
        };

        const newLayoutsByBp = {};
        for (const bp of BREAKPOINTS) {
            const d = DEFAULTS_BY_BP[bp] || DEFAULTS_BY_BP.lg;
            newLayoutsByBp[bp] = { x: 0, y: 9999, w: d.w, h: d.h, i: tempId, minH: 4, visible: true };
        }

        setWidgets(prev => [...prev, newWidget]);
        setLayouts(prev => {
            const next = { ...prev };
            for (const bp of BREAKPOINTS) {
                next[bp] = [...(next[bp] || []), enforceMinH(newLayoutsByBp[bp])];
            }
            return normalizeLayouts(next);
        });
    };

    // --- Config widget ---
    const handleUpdateWidgetConfig = (widgetId, newConfig) => {
        setWidgets(prev =>
            prev.map(w => (w.id === widgetId ? { ...w, config: newConfig } : w))
        );
    };

    // ✅ Nouveau : visibilité stockée dans layout[bp].visible
    // bpPatch ex: { xs:false, xxs:false } ou { sm:true }
    // Quand on rend visible, on place en bas (y=9999) pour éviter collision.
    const handleSetWidgetVisibleByBreakpoint = (widgetId, bpPatch) => {
        const idStr = widgetId.toString();

        setLayouts(prev => {
            const next = { ...prev };

            for (const bp of BREAKPOINTS) {
                if (!Object.prototype.hasOwnProperty.call(bpPatch || {}, bp)) continue;

                const targetVisible = bpPatch[bp] !== false;

                next[bp] = (next[bp] || []).map((it) => {
                    if (it.i !== idStr) return it;

                    const wasHidden = it.visible === false;
                    if (targetVisible && wasHidden) {
                        // On remet visible et on place en bas
                        return enforceMinH({ ...it, visible: true, y: 9999 });
                    }
                    return enforceMinH({ ...it, visible: targetVisible });
                });
            }

            return normalizeLayouts(next);
        });
    };

    return {
        isLoading,
        widgets,
        layouts,
        handleLayoutChange,
        handleSaveLayout,
        handleDeleteWidget,
        handleDeleteWidgetAndSave,
        handleAddWidget,
        handleUpdateWidgetConfig,
        handleSetWidgetVisibleByBreakpoint,
        fetchAvailableWidgets: () => getAvailableWidgets(contextId, contextType),
    };
};