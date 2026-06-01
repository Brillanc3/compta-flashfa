import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { AlertTriangle, CheckCircle2, Eraser, PenLine, RefreshCcw, Save } from 'lucide-react';
import { getMyElectronicSignature, updateMyElectronicSignature } from '@/services/userService.js';
import Spinner from '@/components/ui/Spinner.jsx';

const CANVAS_HEIGHT = 180;
const SVG_WIDTH = 600;
const SVG_HEIGHT = 180;
const HISTORY_LIMIT = 5;

function formatDateTime(value) {
    if (!value) return '—';

    try {
        return new Intl.DateTimeFormat('fr-FR', {
            dateStyle: 'medium',
            timeStyle: 'short',
        }).format(new Date(value));
    } catch {
        return value;
    }
}

function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
}

function buildPolylinePoints(points, width, height) {
    return points
        .map((point) => `${(point.x * width).toFixed(2)},${(point.y * height).toFixed(2)}`)
        .join(' ');
}

function serializeSignatureSvg(strokes) {
    if (!Array.isArray(strokes) || strokes.length === 0) {
        return '';
    }

    const polylines = strokes
        .filter((stroke) => Array.isArray(stroke) && stroke.length > 0)
        .map((stroke) => {
            if (stroke.length === 1) {
                const cx = (stroke[0].x * SVG_WIDTH).toFixed(2);
                const cy = (stroke[0].y * SVG_HEIGHT).toFixed(2);
                return `<circle cx="${cx}" cy="${cy}" r="1.8" fill="#0f172a" />`;
            }

            return `<polyline points="${buildPolylinePoints(stroke, SVG_WIDTH, SVG_HEIGHT)}" fill="none" stroke="#0f172a" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round" />`;
        })
        .join('');

    return `<?xml version="1.0" encoding="UTF-8"?><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${SVG_WIDTH} ${SVG_HEIGHT}" width="${SVG_WIDTH}" height="${SVG_HEIGHT}"><g>${polylines}</g></svg>`;
}

function countMeaningfulPoints(strokes) {
    return (strokes || []).reduce((total, stroke) => total + (Array.isArray(stroke) ? stroke.length : 0), 0);
}

function renderCanvas(canvas, strokes) {
    if (!canvas) return;

    const parentWidth = canvas.parentElement?.clientWidth || SVG_WIDTH;
    const cssWidth = Math.max(280, Math.floor(parentWidth));
    const cssHeight = CANVAS_HEIGHT;
    const dpr = Math.max(window.devicePixelRatio || 1, 1);

    if (canvas.width !== Math.floor(cssWidth * dpr) || canvas.height !== Math.floor(cssHeight * dpr)) {
        canvas.width = Math.floor(cssWidth * dpr);
        canvas.height = Math.floor(cssHeight * dpr);
        canvas.style.width = `${cssWidth}px`;
        canvas.style.height = `${cssHeight}px`;
    }

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, cssWidth, cssHeight);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, cssWidth, cssHeight);

    ctx.strokeStyle = '#0f172a';
    ctx.lineWidth = 2.6;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.imageSmoothingEnabled = true;

    strokes.forEach((stroke) => {
        if (!Array.isArray(stroke) || stroke.length === 0) return;

        if (stroke.length === 1) {
            const point = stroke[0];
            ctx.beginPath();
            ctx.arc(point.x * cssWidth, point.y * cssHeight, 1.8, 0, Math.PI * 2);
            ctx.fillStyle = '#0f172a';
            ctx.fill();
            return;
        }

        ctx.beginPath();
        stroke.forEach((point, index) => {
            const x = point.x * cssWidth;
            const y = point.y * cssHeight;
            if (index === 0) {
                ctx.moveTo(x, y);
            } else {
                ctx.lineTo(x, y);
            }
        });
        ctx.stroke();
    });
}

function SignaturePreview({ svg, emptyText }) {
    return (
        <div className="rounded-lg border border-slate-700 bg-white min-h-[150px] flex items-center justify-center overflow-hidden p-3">
            {svg ? (
                <div
                    className="w-full h-full [&_svg]:w-full [&_svg]:h-auto [&_svg]:max-h-[150px]"
                    dangerouslySetInnerHTML={{ __html: svg }}
                />
            ) : (
                <p className="text-sm text-slate-500 text-center">{emptyText}</p>
            )}
        </div>
    );
}

export default function ElectronicSignatureCard() {
    const canvasRef = useRef(null);
    const currentStrokeRef = useRef([]);
    const [signatureState, setSignatureState] = useState(null);
    const [strokes, setStrokes] = useState([]);
    const [isDrawing, setIsDrawing] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [isRefreshing, setIsRefreshing] = useState(false);

    const loadSignature = useCallback(async ({ silent = false } = {}) => {
        try {
            if (silent) {
                setIsRefreshing(true);
            } else {
                setIsLoading(true);
            }

            const payload = await getMyElectronicSignature();
            setSignatureState(payload);
        } catch (error) {
            toast.error(error.message || 'Erreur lors du chargement de la signature électronique.');
        } finally {
            setIsLoading(false);
            setIsRefreshing(false);
        }
    }, []);

    useEffect(() => {
        loadSignature();
    }, [loadSignature]);

    useEffect(() => {
        renderCanvas(canvasRef.current, strokes);
    }, [strokes]);

    useEffect(() => {
        const handleResize = () => renderCanvas(canvasRef.current, strokes);
        window.addEventListener('resize', handleResize);
        handleResize();
        return () => window.removeEventListener('resize', handleResize);
    }, [strokes]);

    const draftSvg = useMemo(() => serializeSignatureSvg(strokes), [strokes]);
    const hasMeaningfulDraft = useMemo(() => countMeaningfulPoints(strokes) >= 2, [strokes]);

    const beginStroke = useCallback((event) => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        const rect = canvas.getBoundingClientRect();
        if (!rect.width || !rect.height) return;

        const normalizedPoint = {
            x: clamp((event.clientX - rect.left) / rect.width, 0, 1),
            y: clamp((event.clientY - rect.top) / rect.height, 0, 1),
        };

        currentStrokeRef.current = [normalizedPoint];
        setStrokes((previous) => [...previous, [normalizedPoint]]);
        setIsDrawing(true);
    }, []);

    const extendStroke = useCallback((event) => {
        if (!isDrawing) return;

        const canvas = canvasRef.current;
        if (!canvas) return;

        const rect = canvas.getBoundingClientRect();
        if (!rect.width || !rect.height) return;

        const nextPoint = {
            x: clamp((event.clientX - rect.left) / rect.width, 0, 1),
            y: clamp((event.clientY - rect.top) / rect.height, 0, 1),
        };

        const currentStroke = currentStrokeRef.current || [];
        const lastPoint = currentStroke[currentStroke.length - 1];

        if (lastPoint && Math.abs(lastPoint.x - nextPoint.x) < 0.001 && Math.abs(lastPoint.y - nextPoint.y) < 0.001) {
            return;
        }

        const updatedStroke = [...currentStroke, nextPoint];
        currentStrokeRef.current = updatedStroke;

        setStrokes((previous) => {
            if (previous.length === 0) return [updatedStroke];
            const next = previous.slice();
            next[next.length - 1] = updatedStroke;
            return next;
        });
    }, [isDrawing]);

    const endStroke = useCallback(() => {
        currentStrokeRef.current = [];
        setIsDrawing(false);
    }, []);

    const handleClear = useCallback(() => {
        currentStrokeRef.current = [];
        setIsDrawing(false);
        setStrokes([]);
    }, []);

    const handleSave = useCallback(async () => {
        if (!hasMeaningfulDraft || !draftSvg) {
            toast.error('Dessine une signature exploitable avant de sauvegarder.');
            return;
        }

        try {
            setIsSaving(true);
            const payload = await updateMyElectronicSignature({ svg: draftSvg });
            setSignatureState(payload);
            setStrokes([]);
            toast.success('Signature électronique enregistrée.');
        } catch (error) {
            toast.error(error.message || 'Erreur lors de l’enregistrement de la signature électronique.');
        } finally {
            setIsSaving(false);
        }
    }, [draftSvg, hasMeaningfulDraft]);

    const activeSignature = signatureState?.activeSignature || null;
    const history = Array.isArray(signatureState?.history) ? signatureState.history.slice(0, HISTORY_LIMIT) : [];
    const canChangeNow = Boolean(signatureState?.canChangeNow);
    const nextChangeAllowedAt = signatureState?.nextChangeAllowedAt || null;
    const cooldownDays = signatureState?.cooldownDays || 30;
    const daysUntilNextChange = signatureState?.daysUntilNextChange || 0;

    if (isLoading) {
        return (
            <div className="bg-slate-800 rounded-lg shadow-md p-6 min-h-[240px] flex items-center justify-center">
                <Spinner />
            </div>
        );
    }

    return (
        <div className="bg-slate-800 rounded-lg shadow-md p-6 space-y-6">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                <div>
                    <h2 className="text-xl font-bold text-white flex items-center gap-2">
                        <PenLine size={20} className="text-indigo-400" />
                        Signature électronique
                    </h2>
                    <p className="mt-2 text-sm text-slate-400 max-w-3xl">
                        Cette signature est utilisée pour la signature des contrats. Chaque nouvelle signature crée une nouvelle version immuable.
                        Les contrats déjà signés conservent leur ancienne version.
                    </p>
                </div>

                <button
                    type="button"
                    onClick={() => loadSignature({ silent: true })}
                    disabled={isRefreshing || isSaving}
                    className="inline-flex items-center justify-center gap-2 rounded-md border border-slate-600 bg-slate-700 px-3 py-2 text-sm font-medium text-slate-100 transition-colors hover:bg-slate-600 disabled:cursor-not-allowed disabled:opacity-60"
                >
                    <RefreshCcw size={16} className={isRefreshing ? 'animate-spin' : ''} />
                    Actualiser
                </button>
            </div>

            <div className={`rounded-lg border p-4 ${canChangeNow ? 'border-emerald-600/40 bg-emerald-500/10' : 'border-amber-600/40 bg-amber-500/10'}`}>
                <div className="flex items-start gap-3">
                    {canChangeNow ? (
                        <CheckCircle2 className="mt-0.5 h-5 w-5 text-emerald-400" />
                    ) : (
                        <AlertTriangle className="mt-0.5 h-5 w-5 text-amber-400" />
                    )}
                    <div className="space-y-1 text-sm">
                        <p className="font-semibold text-white">
                            {canChangeNow
                                ? 'Vous pouvez créer une nouvelle version immédiatement.'
                                : 'Le délai de changement de 30 jours n’est pas encore écoulé.'}
                        </p>
                        <p className="text-slate-300">
                            Délai actuel : {cooldownDays} jours.{' '}
                            {canChangeNow
                                ? 'La prochaine sauvegarde créera une nouvelle version active.'
                                : `Prochain changement autorisé le ${formatDateTime(nextChangeAllowedAt)} (${daysUntilNextChange} jour${daysUntilNextChange > 1 ? 's' : ''} restant${daysUntilNextChange > 1 ? 's' : ''}).`}
                        </p>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                <div className="space-y-4">
                    <div>
                        <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-300">Signature active</h3>
                        <p className="mt-1 text-sm text-slate-400">
                            {activeSignature
                                ? `Version active enregistrée le ${formatDateTime(activeSignature.createdAt)}.`
                                : 'Aucune signature électronique enregistrée pour le moment.'}
                        </p>
                    </div>
                    <SignaturePreview
                        svg={activeSignature?.svg || ''}
                        emptyText="Aucune signature active. Dessine et sauvegarde une première signature."
                    />
                </div>

                <div className="space-y-4">
                    <div>
                        <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-300">Nouvelle version</h3>
                        <p className="mt-1 text-sm text-slate-400">
                            Dessine ta signature dans la zone ci-dessous. La sauvegarde est bloquée tant que le délai de 30 jours n’est pas écoulé.
                        </p>
                    </div>

                    <div className="rounded-lg border border-slate-700 bg-slate-900/40 p-3">
                        <div className="rounded-md border border-dashed border-slate-600 bg-white overflow-hidden">
                            <canvas
                                ref={canvasRef}
                                className="block w-full touch-none cursor-crosshair"
                                onPointerDown={beginStroke}
                                onPointerMove={extendStroke}
                                onPointerUp={endStroke}
                                onPointerLeave={endStroke}
                                onPointerCancel={endStroke}
                            />
                        </div>
                        <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                            <p className="text-xs text-slate-400">
                                Utilise la souris ou le tactile. Une simple pression sans tracé sera ignorée au moment de la sauvegarde.
                            </p>
                            <button
                                type="button"
                                onClick={handleClear}
                                disabled={isSaving || strokes.length === 0}
                                className="inline-flex items-center justify-center gap-2 rounded-md border border-slate-600 bg-slate-700 px-3 py-2 text-sm font-medium text-slate-100 transition-colors hover:bg-slate-600 disabled:cursor-not-allowed disabled:opacity-60"
                            >
                                <Eraser size={16} />
                                Effacer
                            </button>
                        </div>
                    </div>

                    <div>
                        <h4 className="text-sm font-semibold text-slate-300 mb-2">Aperçu de la version à enregistrer</h4>
                        <SignaturePreview
                            svg={hasMeaningfulDraft ? draftSvg : ''}
                            emptyText="Le brouillon apparaîtra ici dès que le tracé sera suffisamment exploitable."
                        />
                    </div>

                    <div className="flex justify-end">
                        <button
                            type="button"
                            onClick={handleSave}
                            disabled={isSaving || !canChangeNow || !hasMeaningfulDraft}
                            className="inline-flex items-center justify-center gap-2 rounded-md bg-indigo-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-indigo-700 disabled:cursor-not-allowed disabled:bg-indigo-400"
                        >
                            <Save size={16} />
                            {isSaving ? 'Enregistrement...' : 'Enregistrer la signature'}
                        </button>
                    </div>
                </div>
            </div>

            <div className="rounded-lg border border-slate-700 bg-slate-900/30 p-4">
                <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-300">Historique récent</h3>
                <div className="mt-3 space-y-2">
                    {history.length === 0 ? (
                        <p className="text-sm text-slate-400">Aucune version enregistrée pour le moment.</p>
                    ) : (
                        history.map((item, index) => (
                            <div
                                key={item.id}
                                className="flex flex-col gap-1 rounded-md border border-slate-700 bg-slate-800/70 px-3 py-2 sm:flex-row sm:items-center sm:justify-between"
                            >
                                <div>
                                    <p className="text-sm font-medium text-white">
                                        Version #{history.length - index === 0 ? 1 : history.length - index}
                                        {item.isActive ? ' · active' : ''}
                                    </p>
                                    <p className="text-xs text-slate-400">Créée le {formatDateTime(item.createdAt)}</p>
                                </div>
                                {item.isActive ? (
                                    <span className="inline-flex w-fit items-center rounded-full bg-emerald-500/15 px-2.5 py-1 text-xs font-medium text-emerald-300">
                                        Utilisée pour les prochaines signatures
                                    </span>
                                ) : (
                                    <span className="inline-flex w-fit items-center rounded-full bg-slate-700 px-2.5 py-1 text-xs font-medium text-slate-300">
                                        Historique immuable
                                    </span>
                                )}
                            </div>
                        ))
                    )}
                </div>
            </div>
        </div>
    );
}
