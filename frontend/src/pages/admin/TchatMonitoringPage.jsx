import React, { useState, useEffect, useCallback } from 'react';
import { Activity, RefreshCcw, MessageSquare, Wifi, Upload, Database } from 'lucide-react';
import apiClient from '@/services/api';
import toast from 'react-hot-toast';

const REFRESH_INTERVAL_MS = 15_000;

function MetricCard({ label, value, sub, icon: Icon, color = 'text-brand-primary' }) {
    return (
        <div className="bg-cca-surface rounded-lg p-5 border border-cca-border flex flex-col gap-2">
            <div className="flex items-center justify-between">
                <span className="text-xs font-semibold uppercase tracking-wider text-cca-textSecondary">{label}</span>
                <Icon size={18} className={color} />
            </div>
            <span className="text-3xl font-bold text-cca-textPrimary">
                {value === null || value === undefined ? '—' : value}
            </span>
            {sub && <span className="text-xs text-cca-textSecondary">{sub}</span>}
        </div>
    );
}

export default function TchatMonitoringPage() {
    const [metrics, setMetrics]   = useState(null);
    const [loading, setLoading]   = useState(true);
    const [lastFetch, setLastFetch] = useState(null);

    const fetchMetrics = useCallback(async () => {
        try {
            const { data } = await apiClient.get('/tchatv2/monitoring/metrics/json');
            setMetrics(data);
            setLastFetch(new Date());
        } catch (err) {
            toast.error('Impossible de charger les métriques tchatv2');
            console.error('monitoring fetch', err);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchMetrics();
        const id = setInterval(fetchMetrics, REFRESH_INTERVAL_MS);
        return () => clearInterval(id);
    }, [fetchMetrics]);

    const hitRatio = metrics?.cache_hit_ratio !== null && metrics?.cache_hit_ratio !== undefined
        ? `${(metrics.cache_hit_ratio * 100).toFixed(1)} %`
        : null;

    const hitSub = metrics
        ? `${metrics.cache_hits_total} hits · ${metrics.cache_misses_total} misses`
        : undefined;

    return (
        <div className="p-6 max-w-5xl mx-auto">
            <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                    <Activity size={22} className="text-brand-primary" />
                    <h1 className="text-xl font-bold text-cca-textPrimary">Tchat Monitoring</h1>
                </div>
                <div className="flex items-center gap-3">
                    {lastFetch && (
                        <span className="text-xs text-cca-textSecondary">
                            Mis à jour {lastFetch.toLocaleTimeString('fr-FR')}
                        </span>
                    )}
                    <button
                        onClick={fetchMetrics}
                        disabled={loading}
                        className="flex items-center gap-2 px-3 py-1.5 text-sm rounded-md bg-cca-base
                                   text-cca-textPrimary hover:bg-cca-border transition-colors disabled:opacity-50"
                    >
                        <RefreshCcw size={14} className={loading ? 'animate-spin' : ''} />
                        Actualiser
                    </button>
                </div>
            </div>

            {loading && !metrics ? (
                <div className="flex justify-center py-16 text-cca-textSecondary">Chargement…</div>
            ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    <MetricCard
                        label="Messages créés"
                        value={metrics?.messages_created_total?.toLocaleString('fr-FR') ?? '—'}
                        sub="total depuis démarrage"
                        icon={MessageSquare}
                        color="text-indigo-500"
                    />
                    <MetricCard
                        label="Connexions WS actives"
                        value={metrics?.ws_connections ?? '—'}
                        sub="namespace /v2"
                        icon={Wifi}
                        color="text-emerald-500"
                    />
                    <MetricCard
                        label="Presigns générés"
                        value={metrics?.presign_requests_total?.toLocaleString('fr-FR') ?? '—'}
                        sub="uploads R2 demandés"
                        icon={Upload}
                        color="text-amber-500"
                    />
                    <MetricCard
                        label="Cache hit ratio"
                        value={hitRatio ?? '—'}
                        sub={hitSub}
                        icon={Database}
                        color="text-sky-500"
                    />
                </div>
            )}

            <p className="mt-8 text-xs text-cca-textSecondary">
                Actualisation automatique toutes les {REFRESH_INTERVAL_MS / 1000} s.
                Format Prometheus disponible sur{' '}
                <code className="bg-cca-base px-1 py-0.5 rounded text-xs">/api/tchatv2/monitoring/metrics</code>.
            </p>
        </div>
    );
}
