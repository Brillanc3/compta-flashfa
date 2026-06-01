import React, { useState, useEffect, useCallback, useRef } from 'react';
import { fetchAuditLogs } from '../../../api/client';

const ACTION_LABELS = {
    1: 'Serveur modifié', 10: 'Salon créé', 11: 'Salon modifié', 12: 'Salon supprimé',
    20: 'Membre expulsé', 22: 'Membre banni', 23: 'Membre débanni', 24: 'Membre modifié',
    30: 'Rôle créé', 31: 'Rôle modifié', 32: 'Rôle supprimé',
    40: 'Invitation créée', 42: 'Invitation supprimée',
    72: 'Message supprimé', 73: 'Messages supprimés',
};

const V2_EPOCH_MS = 1735689600000n;

function snowflakeToDate(id) {
    try {
        const ts = Number((BigInt(id) >> 22n) + V2_EPOCH_MS);
        return new Date(ts).toLocaleString('fr-FR');
    } catch { return '—'; }
}

export default function GuildLogsSection({ guild }) {
    const [logs,    setLogs]    = useState([]);
    const [loading, setLoading] = useState(true);
    const [error,   setError]   = useState(null);
    const [filter,  setFilter]  = useState('');
    const [hasMore, setHasMore] = useState(false);
    const beforeRef = useRef(null);

    const load = useCallback(async (reset = false) => {
        setLoading(true); setError(null);
        const params = { limit: 50 };
        if (filter) params.action_type = Number(filter);
        if (!reset && beforeRef.current) params.before = beforeRef.current;
        try {
            const data = await fetchAuditLogs(guild.id, params);
            const raw = data?.audit_log_entries ?? data?.entries ?? data;
            const entries = Array.isArray(raw) ? raw : [];
            setLogs(prev => reset ? entries : [...prev, ...entries]);
            setHasMore(entries.length === 50);
            if (entries.length) beforeRef.current = entries[entries.length - 1].id;
        } catch { setError('Erreur chargement logs'); }
        finally { setLoading(false); }
    }, [guild.id, filter]);

    useEffect(() => {
        beforeRef.current = null;
        load(true);
    }, [guild.id, filter]);

    return (
        <div className="tv2-settings-section">
            <h2 className="tv2-settings-section-title">Logs du serveur</h2>

            <div style={{ display: 'flex', gap: 12, marginBottom: 16, alignItems: 'center' }}>
                <select
                    className="tv2-settings-input"
                    style={{ width: 220 }}
                    value={filter}
                    onChange={e => { setFilter(e.target.value); beforeRef.current = null; }}
                >
                    <option value="">Toutes les actions</option>
                    {Object.entries(ACTION_LABELS).map(([k, v]) => (
                        <option key={k} value={k}>{v}</option>
                    ))}
                </select>
            </div>

            {error && <p className="tv2-settings-error">{error}</p>}

            <div className="tv2-logs-list">
                {logs.map(log => (
                    <div key={log.id} className="tv2-log-entry">
                        <span className="tv2-log-action">
                            {ACTION_LABELS[log.actionType ?? log.action_type] ?? `Action #${log.actionType ?? log.action_type}`}
                        </span>
                        <span className="tv2-log-actor">{log.user?.username ?? log.userId ?? '—'}</span>
                        <span className="tv2-log-time">{snowflakeToDate(log.id)}</span>
                    </div>
                ))}
                {!loading && !logs.length && <p className="tv2-settings-muted">Aucun log trouvé.</p>}
            </div>

            {hasMore && !loading && (
                <button className="tv2-btn-secondary" style={{ marginTop: 12 }} onClick={() => load(false)}>
                    Charger plus
                </button>
            )}
            {loading && <p className="tv2-settings-muted" style={{ marginTop: 8 }}>Chargement…</p>}
        </div>
    );
}
