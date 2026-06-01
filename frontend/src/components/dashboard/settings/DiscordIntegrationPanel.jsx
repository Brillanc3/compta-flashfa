// frontend/src/components/dashboard/settings/DiscordIntegrationPanel.jsx
import React, { useState, useEffect, useCallback } from 'react';
import toast from 'react-hot-toast';
import {
    getDiscordConfig,
    saveDiscordConfig,
    deleteDiscordConfig,
    getGuildRoles,
    verifyBot,
    syncAllDiscord,
} from '@/services/discordService';
import { getRanks } from '@/services/employeesService';
import Spinner from '@/components/ui/Spinner';
import { useConfirmation } from '@/contexts/ConfirmationContext';

function StepBadge({ n, done }) {
    return (
        <span className={`inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold shrink-0 ${done ? 'bg-indigo-600 text-white' : 'bg-slate-700 text-slate-300'}`}>
            {done ? '✓' : n}
        </span>
    );
}

function SectionTitle({ step, done, title }) {
    return (
        <div className="flex items-center gap-3 mb-4">
            <StepBadge n={step} done={done} />
            <h4 className="text-sm font-semibold text-slate-200 uppercase tracking-wide leading-6">{title}</h4>
        </div>
    );
}

export default function DiscordIntegrationPanel() {
    const { confirm } = useConfirmation();

    const [config, setConfig]           = useState(null);
    const [clientId, setClientId]       = useState(null);
    const [ranks, setRanks]             = useState([]);
    const [guildRoles, setGuildRoles]   = useState([]);
    const [loading, setLoading]         = useState(true);
    const [saving, setSaving]           = useState(false);
    const [verifying, setVerifying]     = useState(false);
    const [syncing, setSyncing]         = useState(false);
    const [rolesLoading, setRolesLoading] = useState(false);

    const [guildId, setGuildId]         = useState('');
    const [enabled, setEnabled]         = useState(false);
    const [rankRoleMap, setRankRoleMap] = useState({});
    const [guildInfo, setGuildInfo]     = useState(null); // { id, name, icon }
    const [botVerified, setBotVerified] = useState(false);

    // Add/edit mapping wizard state
    const [addingMapping, setAddingMapping] = useState(false);
    const [editingRankId, setEditingRankId] = useState(null);
    const [newRankId, setNewRankId]         = useState('');
    const [newRoleIds, setNewRoleIds]       = useState([]);

    const loadRoles = useCallback(async (id) => {
        setRolesLoading(true);
        try {
            const roles = await getGuildRoles(id ?? null);
            setGuildRoles(roles ?? []);
        } catch {
            // silently fail
        } finally {
            setRolesLoading(false);
        }
    }, []);

    const load = useCallback(async () => {
        setLoading(true);
        try {
            const [{ config: cfg, clientId: cid }, ranksData] = await Promise.all([getDiscordConfig(), getRanks()]);
            setConfig(cfg);
            setClientId(cid);
            setRanks(ranksData ?? []);
            if (cfg?.guildId) {
                setGuildId(cfg.guildId);
                setEnabled(cfg.enabled ?? false);
                setRankRoleMap(cfg.rankRoleMap ?? {});
                setBotVerified(true);
                if (cfg.guildName) {
                    setGuildInfo({ id: cfg.guildId, name: cfg.guildName, icon: cfg.guildIcon ?? null });
                }
                loadRoles(cfg.guildId);
            }
        } catch {
            toast.error('Erreur lors du chargement de la configuration Discord.');
        } finally {
            setLoading(false);
        }
    }, [loadRoles]);

    useEffect(() => { load(); }, [load]);

    const handleVerifyBot = async () => {
        if (!guildId.trim()) {
            toast.error("Renseignez l'ID du serveur Discord d'abord.");
            return;
        }
        setVerifying(true);
        try {
            const { inGuild, guild } = await verifyBot(guildId.trim());
            if (inGuild) {
                setBotVerified(true);
                setGuildInfo(guild);
                await loadRoles(guildId.trim());
                toast.success('Bot détecté — rôles chargés.');
            } else {
                toast.error('Bot absent du serveur. Ajoutez-le via le lien ci-dessus.');
            }
        } catch {
            toast.error('Vérification impossible.');
        } finally {
            setVerifying(false);
        }
    };

    const handleSave = async () => {
        setSaving(true);
        try {
            const data = await saveDiscordConfig({
                guildId: guildId.trim() || null,
                enabled,
                rankRoleMap,
                guildName: guildInfo?.name ?? null,
                guildIcon: guildInfo?.icon ?? null,
            });
            setConfig(data);
            toast.success('Configuration Discord sauvegardée.');
        } catch (err) {
            toast.error(err?.message || 'Erreur lors de la sauvegarde.');
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async () => {
        try {
            await confirm({
                title: "Supprimer l'intégration Discord ?",
                message: "Les synchronisations automatiques seront désactivées. Les rôles existants dans Discord ne seront pas retirés.",
            });
            await deleteDiscordConfig();
            setConfig(null);
            setGuildId('');
            setEnabled(false);
            setRankRoleMap({});
            setGuildRoles([]);
            setGuildInfo(null);
            setBotVerified(false);
            setAddingMapping(false);
            setEditingRankId(null);
            setNewRankId('');
            setNewRoleIds([]);
            toast.success('Intégration Discord supprimée.');
        } catch {
            // annulation
        }
    };

    const handleChangeServer = () => {
        setBotVerified(false);
        setGuildInfo(null);
        setGuildRoles([]);
        setAddingMapping(false);
        setEditingRankId(null);
        setNewRankId('');
        setNewRoleIds([]);
    };

    const handleEditMapping = (rankId) => {
        const current = rankRoleMap[rankId];
        const roleArr = Array.isArray(current) ? current : (current ? [current] : []);
        setEditingRankId(rankId);
        setNewRankId(rankId);
        setNewRoleIds(roleArr);
        setAddingMapping(true);
    };

    const handleConfirmMapping = () => {
        if (!newRankId || newRoleIds.length === 0) return;
        setRankRoleMap(prev => {
            const next = { ...prev };
            if (editingRankId && editingRankId !== newRankId) delete next[editingRankId];
            next[newRankId] = newRoleIds;
            return next;
        });
        setEditingRankId(null);
        setNewRankId('');
        setNewRoleIds([]);
        setAddingMapping(false);
    };

    const handleCancelMapping = () => {
        setAddingMapping(false);
        setEditingRankId(null);
        setNewRankId('');
        setNewRoleIds([]);
    };

    const handleRemoveMapping = (rankId) => {
        setRankRoleMap(prev => {
            const { [String(rankId)]: _removed, ...rest } = prev;
            return rest;
        });
    };

    const toggleNewRole = (roleId) => {
        setNewRoleIds(prev =>
            prev.includes(roleId) ? prev.filter(r => r !== roleId) : [...prev, roleId]
        );
    };

    const handleSync = async () => {
        try {
            await confirm({
                title: 'Synchroniser les rôles Discord ?',
                message: 'Tous les employés actifs avec un compte Discord lié seront analysés. Leurs rôles Discord seront réinitialisés puis réattribués selon les correspondances actuelles.',
            });
            setSyncing(true);
            const result = await syncAllDiscord();
            toast.success(`Sync terminée — ${result.synced} synchronisé(s), ${result.skipped} sans Discord, ${result.errors} erreur(s).`);
        } catch {
            // annulation ou erreur déjà toastée
        } finally {
            setSyncing(false);
        }
    };

    if (loading) {
        return (
            <div className="flex justify-center items-center py-16">
                <Spinner />
            </div>
        );
    }

    const sortedRoles = [...guildRoles]
        .filter(r => !r.managed && r.name !== '@everyone')
        .sort((a, b) => b.position - a.position);

    const mappedEntries = Object.entries(rankRoleMap);
    const unmappedRanks = ranks.filter(r => !rankRoleMap[String(r.id)]);

    const guildIconUrl = guildInfo?.icon
        ? `https://cdn.discordapp.com/icons/${guildInfo.id}/${guildInfo.icon}.webp?size=64`
        : null;

    return (
        <div className="rounded-xl border border-slate-700 bg-slate-800 shadow-lg overflow-hidden">

            {/* Header */}
            <div className="flex items-center justify-between px-6 py-5 border-b border-slate-700 bg-slate-800/80">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center text-xl">
                        🎮
                    </div>
                    <div>
                        <h3 className="text-base font-semibold text-white">Intégration Discord</h3>
                        <p className="text-xs text-slate-400 mt-0.5">
                            Synchronise les rôles Discord lors des embauches, licenciements et changements de rang.
                        </p>
                    </div>
                </div>
                {config && (
                    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${enabled ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30' : 'bg-slate-700 text-slate-400 border border-slate-600'}`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${enabled ? 'bg-emerald-400' : 'bg-slate-500'}`} />
                        {enabled ? 'Activé' : 'Désactivé'}
                    </span>
                )}
            </div>

            {!botVerified ? (
                /* ── SETUP PHASE ─────────────────────────────────── */
                <div className="divide-y divide-slate-700/60">

                    {/* Step 1: Invite bot */}
                    <div className="px-6 py-5">
                        <SectionTitle step={1} done={false} title="Ajouter le bot à votre serveur" />
                        {clientId ? (
                            <div className="space-y-3 pl-9">
                                <a
                                    href={`https://discord.com/oauth2/authorize?client_id=${clientId}&permissions=268435456&scope=bot`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="inline-flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 text-white font-medium py-2 px-4 rounded-lg text-sm transition-colors"
                                >
                                    Inviter le bot dans votre serveur →
                                </a>
                                <p className="text-xs text-slate-500">
                                    Permission requise : <span className="text-slate-400">Gérer les rôles</span>. Son rôle doit être placé au-dessus des rôles qu'il attribue.
                                </p>
                            </div>
                        ) : (
                            <div className="pl-9">
                                <div className="flex items-center gap-2 text-sm text-amber-400 bg-amber-400/10 border border-amber-400/20 rounded-lg px-3 py-2">
                                    ⚠ Bot non configuré — contactez l'administrateur de la plateforme.
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Step 2: Guild ID */}
                    <div className="px-6 py-5">
                        <SectionTitle step={2} done={false} title="ID du serveur Discord" />
                        <div className="space-y-3 pl-9">
                            <div className="flex gap-2">
                                <input
                                    type="text"
                                    value={guildId}
                                    onChange={(e) => setGuildId(e.target.value)}
                                    onKeyDown={(e) => e.key === 'Enter' && handleVerifyBot()}
                                    placeholder="Ex: 123456789012345678"
                                    className="flex-1 min-w-0 bg-slate-900/60 border border-slate-600 text-white rounded-lg px-3 py-2 text-sm placeholder-slate-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/50 transition-colors"
                                />
                                <button
                                    onClick={handleVerifyBot}
                                    disabled={verifying || !guildId.trim()}
                                    className="shrink-0 bg-slate-700 hover:bg-slate-600 disabled:opacity-40 disabled:cursor-not-allowed text-white font-medium py-2 px-4 rounded-lg text-sm transition-colors"
                                >
                                    {verifying ? (
                                        <span className="flex items-center gap-2">
                                            <span className="w-3.5 h-3.5 border-2 border-slate-400 border-t-transparent rounded-full animate-spin" />
                                            Vérification…
                                        </span>
                                    ) : 'Vérifier le bot'}
                                </button>
                            </div>
                            <p className="text-xs text-slate-500">
                                Activez le <span className="text-slate-400">Mode développeur</span> dans Discord (Paramètres → Avancé), puis clic droit sur votre serveur → Copier l'identifiant.
                            </p>
                        </div>
                    </div>

                </div>
            ) : (
                /* ── CONFIGURED PHASE ────────────────────────────── */
                <div className="divide-y divide-slate-700/60">

                    {/* Guild info card */}
                    <div className="px-6 py-4">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                {guildIconUrl ? (
                                    <img
                                        src={guildIconUrl}
                                        alt=""
                                        className="w-10 h-10 rounded-full object-cover"
                                        onError={(e) => { e.target.style.display = 'none'; }}
                                    />
                                ) : (
                                    <div className="w-10 h-10 rounded-full bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center text-slate-300 text-base font-bold">
                                        {(guildInfo?.name ?? guildId)?.[0]?.toUpperCase() ?? '#'}
                                    </div>
                                )}
                                <div>
                                    <p className="text-sm font-semibold text-white">{guildInfo?.name ?? guildId}</p>
                                    <p className="text-xs text-slate-500 font-mono">{guildId}</p>
                                </div>
                            </div>
                            <button
                                onClick={handleChangeServer}
                                className="text-xs text-slate-500 hover:text-slate-300 transition-colors underline"
                            >
                                Changer de serveur
                            </button>
                        </div>
                    </div>

                    {/* Step 3: Rank mapping */}
                    <div className="px-6 py-5">
                        <SectionTitle step={3} done={mappedEntries.length > 0} title="Correspondance rang → rôle Discord" />

                        <div className={`grid gap-5 ${mappedEntries.length > 0 ? 'md:grid-cols-2' : 'grid-cols-1'}`}>

                            {/* Left: add/edit form */}
                            <div>
                                {!addingMapping ? (
                                    <button
                                        onClick={() => setAddingMapping(true)}
                                        disabled={unmappedRanks.length === 0}
                                        className="w-full border border-dashed border-slate-600 hover:border-indigo-500/60 hover:bg-indigo-600/5 disabled:opacity-40 disabled:cursor-not-allowed text-slate-400 hover:text-indigo-400 rounded-lg py-3.5 text-sm font-medium transition-all"
                                    >
                                        + Ajouter une correspondance
                                    </button>
                                ) : (
                                    <div className="bg-slate-900/60 border border-slate-700 rounded-lg p-4 space-y-4">
                                        <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide">
                                            {editingRankId ? 'Modifier la correspondance' : 'Nouvelle correspondance'}
                                        </p>

                                        {/* Select rank */}
                                        <div>
                                            <label className="block text-xs font-medium text-slate-500 mb-1.5">Rang</label>
                                            <select
                                                value={newRankId}
                                                onChange={(e) => { setNewRankId(e.target.value); if (!editingRankId) setNewRoleIds([]); }}
                                                className="w-full bg-slate-900 border border-slate-700 text-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-500 transition-colors"
                                            >
                                                <option value="">Sélectionner un rang…</option>
                                                {[
                                                    ...unmappedRanks,
                                                    ...(editingRankId ? ranks.filter(r => String(r.id) === editingRankId) : []),
                                                ].map(r => (
                                                    <option key={r.id} value={String(r.id)}>{r.name}</option>
                                                ))}
                                            </select>
                                        </div>

                                        {/* Select roles — only after rank chosen */}
                                        {newRankId && (
                                            <div>
                                                <label className="block text-xs font-medium text-slate-500 mb-1.5">
                                                    Rôles Discord
                                                    {newRoleIds.length > 0 && (
                                                        <span className="ml-2 text-indigo-400">{newRoleIds.length} sélectionné(s)</span>
                                                    )}
                                                </label>
                                                {rolesLoading ? (
                                                    <div className="flex items-center gap-2 text-xs text-slate-500 py-1">
                                                        <span className="w-3 h-3 border-2 border-slate-500 border-t-transparent rounded-full animate-spin" />
                                                        Chargement…
                                                    </div>
                                                ) : sortedRoles.length === 0 ? (
                                                    <p className="text-xs text-slate-500 italic">Aucun rôle disponible.</p>
                                                ) : (
                                                    <div className="flex flex-wrap gap-1.5 max-h-40 overflow-y-auto pr-1">
                                                        {sortedRoles.map(role => {
                                                            const sel = newRoleIds.includes(role.id);
                                                            return (
                                                                <button
                                                                    key={role.id}
                                                                    type="button"
                                                                    onClick={() => toggleNewRole(role.id)}
                                                                    className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${
                                                                        sel
                                                                            ? 'bg-indigo-600 text-white'
                                                                            : 'bg-slate-800 text-slate-300 hover:bg-slate-700 border border-slate-700'
                                                                    }`}
                                                                >
                                                                    {role.name}
                                                                </button>
                                                            );
                                                        })}
                                                    </div>
                                                )}
                                            </div>
                                        )}

                                        <div className="flex items-center justify-between pt-1">
                                            <button
                                                onClick={handleCancelMapping}
                                                className="text-sm text-slate-500 hover:text-slate-300 transition-colors"
                                            >
                                                Annuler
                                            </button>
                                            <button
                                                onClick={handleConfirmMapping}
                                                disabled={!newRankId || newRoleIds.length === 0}
                                                className="bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 disabled:opacity-40 disabled:cursor-not-allowed text-white font-medium py-1.5 px-4 rounded-lg text-sm transition-colors"
                                            >
                                                Confirmer
                                            </button>
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* Right: configured mappings */}
                            {mappedEntries.length > 0 && (
                                <div className="space-y-2">
                                    <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">Configuré</p>
                                    {mappedEntries.map(([rankId, roleIds]) => {
                                        const rank = ranks.find(r => String(r.id) === rankId);
                                        const roleArr = Array.isArray(roleIds) ? roleIds : [roleIds];
                                        const isEditing = editingRankId === rankId;
                                        return (
                                            <div key={rankId} className={`flex items-start justify-between gap-2 border rounded-lg px-3 py-2.5 transition-colors ${isEditing ? 'bg-indigo-600/10 border-indigo-500/40' : 'bg-slate-900/50 border-slate-700/50'}`}>
                                                <div className="min-w-0">
                                                    <p className="text-sm font-medium text-slate-200 truncate">
                                                        {rank?.name ?? `Rang #${rankId}`}
                                                    </p>
                                                    <div className="flex flex-wrap gap-1 mt-1">
                                                        {roleArr.map(roleId => {
                                                            const role = sortedRoles.find(r => r.id === roleId);
                                                            return (
                                                                <span key={roleId} className="text-xs bg-indigo-600/25 text-indigo-300 border border-indigo-500/25 px-1.5 py-0.5 rounded">
                                                                    {role?.name ?? roleId}
                                                                </span>
                                                            );
                                                        })}
                                                    </div>
                                                </div>
                                                <div className="shrink-0 flex items-center gap-2 mt-0.5">
                                                    <button
                                                        onClick={() => handleEditMapping(rankId)}
                                                        disabled={addingMapping && !isEditing}
                                                        className="text-xs text-slate-500 hover:text-indigo-400 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                                                        title="Modifier"
                                                    >
                                                        Modifier
                                                    </button>
                                                    <button
                                                        onClick={() => handleRemoveMapping(rankId)}
                                                        disabled={isEditing}
                                                        className="text-slate-600 hover:text-red-400 disabled:opacity-30 disabled:cursor-not-allowed transition-colors text-base leading-none"
                                                        title="Supprimer"
                                                    >
                                                        ×
                                                    </button>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Footer */}
                    <div className="px-6 py-4 bg-slate-800/60 flex items-center justify-between gap-4 flex-wrap">
                        <button
                            type="button"
                            onClick={() => setEnabled(v => !v)}
                            className="flex items-center gap-3 group"
                        >
                            <div className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${enabled ? 'bg-indigo-600' : 'bg-slate-600'}`}>
                                <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform ${enabled ? 'translate-x-4.5' : 'translate-x-0.5'}`} />
                            </div>
                            <span className="text-sm text-slate-300 group-hover:text-white transition-colors">
                                {enabled ? 'Synchronisation activée' : 'Synchronisation désactivée'}
                            </span>
                        </button>

                        <div className="flex items-center gap-3">
                            {config && (
                                <>
                                    <button
                                        onClick={handleSync}
                                        disabled={syncing || !enabled}
                                        title={!enabled ? 'Activez la synchronisation pour forcer un sync' : 'Réattribue les rôles Discord de tous les employés actifs'}
                                        className="text-sm text-slate-400 hover:text-slate-200 disabled:opacity-40 disabled:cursor-not-allowed transition-colors flex items-center gap-1.5"
                                    >
                                        {syncing ? (
                                            <span className="w-3.5 h-3.5 border-2 border-slate-400 border-t-transparent rounded-full animate-spin" />
                                        ) : (
                                            <span className="text-base leading-none">↺</span>
                                        )}
                                        {syncing ? 'Sync…' : 'Sync'}
                                    </button>
                                    <button
                                        onClick={handleDelete}
                                        className="text-sm text-red-400 hover:text-red-300 transition-colors"
                                    >
                                        Supprimer
                                    </button>
                                </>
                            )}
                            <button
                                onClick={handleSave}
                                disabled={saving}
                                className="bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold py-2 px-5 rounded-lg text-sm transition-colors"
                            >
                                {saving ? 'Sauvegarde…' : 'Sauvegarder'}
                            </button>
                        </div>
                    </div>

                </div>
            )}

        </div>
    );
}
