import React, { useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { X, Shield, Users, User, Folder, Hash, Link2, Link2Off, RefreshCw } from 'lucide-react';
import toast from 'react-hot-toast';

import apiClient from '@/services/api';
import { useChatStore } from '../store/useChatStore';
import { ChatEventsContext } from '@/contexts/ChatEventsContext';
import ConfirmationModal from '@/components/ui/ConfirmationModal';
import { getPermissionCatalog, getCategories, syncChannelToCategory } from '@/services/chatService';
import {
    normalizeCatalog, bitsToPermissionMap, permissionMapToBits,
    buildDefaultPermissionMap, buildApi,
} from './permissions/permissionsHelpers';
import PermissionsOverrideList from './permissions/PermissionsOverrideList';

export default function ChatPermissionsDrawer({ isOpen, onClose, conversation, category }) {
    const chatCompanyId = useChatStore((s) => s.initializedCompanyId);
    const updateChannelSynced = useChatStore((s) => s.updateChannelSynced);
    const { lastPermissionsEvent, lastCategoryPermissionsEvent } = useContext(ChatEventsContext);

    const categoryOnly = !conversation && !!category;
    const channelId = conversation?.id ?? null;
    const channelName = categoryOnly ? (category?.name ?? 'Catégorie') : (conversation?.name ?? 'Salon');
    const channelCategoryId = categoryOnly ? (category?.id ?? null) : (conversation?.categoryId ?? null);
    const initialSynced = conversation?.syncedWithCategory ?? true;

    const [scope, setScope] = useState(categoryOnly ? 'category' : 'channel');
    const [synced, setSynced] = useState(initialSynced);
    const [tab, setTab] = useState('ranks');
    const [loading, setLoading] = useState(false);
    const [catalog, setCatalog] = useState([]);
    const [rankOverrides, setRankOverrides] = useState([]);
    const [userOverrides, setUserOverrides] = useState([]);
    const [employees, setEmployees] = useState({ users: [], ranks: [] });
    const [categoryName, setCategoryName] = useState('');
    const [expandedRankId, setExpandedRankId] = useState(null);
    const [expandedUserId, setExpandedUserId] = useState(null);
    const [confirmModal, setConfirmModal] = useState({ isOpen: false, message: '', onConfirm: null });

    const scopeId = scope === 'category' ? channelCategoryId : channelId;
    const api = useMemo(() => buildApi(scope, scopeId), [scope, scopeId]);

    useEffect(() => { if (isOpen && categoryOnly) setScope('category'); }, [isOpen, categoryOnly]);

    useEffect(() => {
        if (!isOpen || !channelId) return;
        setSynced(initialSynced);
        setScope('channel');
    }, [isOpen, channelId, channelCategoryId, initialSynced]);

    useEffect(() => {
        if (!isOpen || !scopeId) return;
        async function loadAll() {
            try {
                setLoading(true);
                const promises = [
                    getPermissionCatalog(), api.getRanks(), api.getUsers(),
                    apiClient.get('/employees/users-for-chat', { headers: chatCompanyId ? { 'x-company-id': chatCompanyId } : {} }),
                ];
                if (scope === 'category') promises.push(getCategories().catch(() => []));
                const [catalogRes, rankRes, userRes, employeesRes, catsRes] = await Promise.all(promises);

                const cat = normalizeCatalog(catalogRes);
                cat.sort((a, b) => Number(a.bit) - Number(b.bit));
                const empData = employeesRes?.data || employeesRes || {};
                const allRanks = Array.isArray(empData.ranks) ? empData.ranks : [];
                const allUsers = Array.isArray(empData.users) ? empData.users : [];

                const rankOv = (Array.isArray(rankRes) ? rankRes : []).map((o) => ({
                    rankId: o.rankId, rankName: o.rank?.name ?? `Rôle ${o.rankId}`,
                    allowBits: o.allowBits ?? '0', denyBits: o.denyBits ?? '0',
                    permissions: bitsToPermissionMap(o.allowBits, o.denyBits, cat),
                }));

                const userOv = (Array.isArray(userRes) ? userRes : []).map((o) => {
                    const userId = o.userId;
                    const match = allUsers.find((u) => u.userId === userId) || {};
                    return {
                        userId, userName: o.user?.fullName || o.user?.name || match.fullName || `Utilisateur ${userId}`,
                        allowBits: o.allowBits ?? '0', denyBits: o.denyBits ?? '0',
                        permissions: bitsToPermissionMap(o.allowBits, o.denyBits, cat),
                    };
                });

                if (scope === 'category' && Array.isArray(catsRes)) {
                    const c = catsRes.find((x) => String(x.id) === String(channelCategoryId));
                    setCategoryName(c?.name ?? '');
                }

                setCatalog(cat);
                setEmployees({ users: allUsers, ranks: allRanks });
                setRankOverrides(rankOv);
                setUserOverrides(userOv);
                setExpandedRankId(rankOv[0]?.rankId ?? null);
                setExpandedUserId(userOv[0]?.userId ?? null);
            } catch (err) {
                console.error('[ChatPermissionsDrawer] loadAll error:', err);
                toast.error('Erreur lors du chargement des permissions.');
            } finally { setLoading(false); }
        }
        loadAll();
    }, [isOpen, scopeId, scope, channelCategoryId, api, chatCompanyId]);

    const availableRanks = useMemo(() => {
        const usedIds = new Set(rankOverrides.map((r) => r.rankId));
        return (employees.ranks || []).filter((r) => !usedIds.has(r.id));
    }, [employees, rankOverrides]);

    const availableUsers = useMemo(() => {
        const usedIds = new Set(userOverrides.map((u) => u.userId));
        return (employees.users || []).filter((u) => !usedIds.has(u.userId));
    }, [employees, userOverrides]);

    const reloadRanks = useCallback(async () => {
        const res = await api.getRanks();
        const list = (Array.isArray(res) ? res : []).map((o) => ({
            rankId: o.rankId, rankName: o.rank?.name ?? `Rôle ${o.rankId}`,
            allowBits: o.allowBits ?? '0', denyBits: o.denyBits ?? '0',
            permissions: bitsToPermissionMap(o.allowBits, o.denyBits, catalog),
        }));
        setRankOverrides(list);
    }, [api, catalog]);

    const reloadUsers = useCallback(async () => {
        const res = await api.getUsers();
        const allUsers = employees.users || [];
        const list = (Array.isArray(res) ? res : []).map((o) => {
            const id = o.userId;
            const match = allUsers.find((u) => u.userId === id) || {};
            return {
                userId: id, userName: o.user?.fullName || o.user?.name || match.fullName || `Utilisateur ${id}`,
                allowBits: o.allowBits ?? '0', denyBits: o.denyBits ?? '0',
                permissions: bitsToPermissionMap(o.allowBits, o.denyBits, catalog),
            };
        });
        setUserOverrides(list);
    }, [api, catalog, employees.users]);

    useEffect(() => {
        if (!isOpen || !lastPermissionsEvent || scope !== 'channel') return;
        if (String(lastPermissionsEvent.channelId) !== String(channelId)) return;
        reloadRanks(); reloadUsers();
    }, [lastPermissionsEvent, isOpen, scope, channelId, reloadRanks, reloadUsers]);

    useEffect(() => {
        if (!isOpen || !lastCategoryPermissionsEvent || scope !== 'category') return;
        if (String(lastCategoryPermissionsEvent.categoryId) !== String(channelCategoryId)) return;
        reloadRanks(); reloadUsers();
    }, [lastCategoryPermissionsEvent, isOpen, scope, channelCategoryId, reloadRanks, reloadUsers]);

    if (!isOpen) return null;
    if (!channelId && !categoryOnly) return null;
    if (categoryOnly && !channelCategoryId) return null;

    const handleAddRank = async (rankId) => {
        if (!catalog.length) return;
        try {
            await api.setRank(rankId, permissionMapToBits(buildDefaultPermissionMap(catalog), catalog));
            if (scope === 'channel') { setSynced(false); if (channelId) updateChannelSynced(channelId, false); }
            await reloadRanks();
            setExpandedRankId(rankId);
        } catch (err) { console.error('handleAddRank error', err); toast.error("Impossible d'ajouter ce rôle."); }
    };

    const handleChangeRankPerm = async (rankId, permKey, value) => {
        const idx = rankOverrides.findIndex((r) => r.rankId === rankId);
        if (idx === -1) return;
        const prev = rankOverrides[idx];
        const newPerms = { ...prev.permissions, [permKey]: value };
        const body = permissionMapToBits(newPerms, catalog);
        const optimistic = [...rankOverrides];
        optimistic[idx] = { ...prev, permissions: newPerms, ...body };
        setRankOverrides(optimistic);
        try {
            await api.setRank(rankId, body);
            if (scope === 'channel') { setSynced(false); if (channelId) updateChannelSynced(channelId, false); }
        } catch (err) {
            console.error('handleChangeRankPerm error', err);
            toast.error('Erreur lors de la mise à jour.');
            setRankOverrides(rankOverrides);
        }
    };

    const handleRemoveRank = async (rankId) => {
        try {
            await api.deleteRank(rankId);
            setRankOverrides((prev) => prev.filter((r) => r.rankId !== rankId));
            if (expandedRankId === rankId) setExpandedRankId(null);
        } catch (err) { console.error('handleRemoveRank error', err); toast.error('Impossible de retirer ce rôle.'); }
    };

    const handleAddUser = async (userId) => {
        if (!catalog.length) return;
        try {
            await api.setUser(userId, permissionMapToBits(buildDefaultPermissionMap(catalog), catalog));
            if (scope === 'channel') { setSynced(false); if (channelId) updateChannelSynced(channelId, false); }
            await reloadUsers();
            setExpandedUserId(userId);
        } catch (err) { console.error('handleAddUser error', err); toast.error("Impossible d'ajouter cet utilisateur."); }
    };

    const handleChangeUserPerm = async (userId, permKey, value) => {
        const idx = userOverrides.findIndex((u) => u.userId === userId);
        if (idx === -1) return;
        const prev = userOverrides[idx];
        const newPerms = { ...prev.permissions, [permKey]: value };
        const body = permissionMapToBits(newPerms, catalog);
        const optimistic = [...userOverrides];
        optimistic[idx] = { ...prev, permissions: newPerms, ...body };
        setUserOverrides(optimistic);
        try {
            await api.setUser(userId, body);
            if (scope === 'channel') { setSynced(false); if (channelId) updateChannelSynced(channelId, false); }
        } catch (err) {
            console.error('handleChangeUserPerm error', err);
            toast.error('Erreur lors de la mise à jour.');
            setUserOverrides(userOverrides);
        }
    };

    const handleRemoveUser = async (userId) => {
        try {
            await api.deleteUser(userId);
            setUserOverrides((prev) => prev.filter((u) => u.userId !== userId));
            if (expandedUserId === userId) setExpandedUserId(null);
        } catch (err) { console.error('handleRemoveUser error', err); toast.error('Impossible de retirer cet utilisateur.'); }
    };

    const handleResync = () => {
        if (!channelCategoryId) { toast.error("Ce salon n'a pas de catégorie parente."); return; }
        setConfirmModal({
            isOpen: true,
            message: 'Synchroniser ce salon avec sa catégorie supprimera tous ses overrides spécifiques. Continuer ?',
            onConfirm: async () => {
                setConfirmModal(p => ({ ...p, isOpen: false }));
                try {
                    await syncChannelToCategory(channelId);
                    setSynced(true); setRankOverrides([]); setUserOverrides([]);
                    if (channelCategoryId) setScope('category');
                    toast.success('Salon synchronisé avec sa catégorie.');
                } catch (err) { console.error('handleResync error', err); toast.error('Impossible de synchroniser le salon.'); }
            },
        });
    };

    const isChannelScope = scope === 'channel';
    const editingDisabledHint = isChannelScope && synced && channelCategoryId
        ? 'Ce salon est synchronisé avec sa catégorie. Modifier ses permissions le désynchronisera.'
        : null;

    return (
        <>
            <div className="fixed inset-0 z-50 flex justify-end">
                <div className="flex-1 bg-black/40 backdrop-blur-sm" onClick={onClose} />
                <aside className="w-full max-w-md h-full bg-cca-surface/90 backdrop-blur-3xl border-l border-cca-border shadow-2xl shadow-black/80 flex flex-col animate-in slide-in-from-right duration-300">
                    <div className="flex items-center justify-between px-4 py-4 border-b border-cca-border bg-cca-surface shadow-sm sticky top-0 z-10">
                        <div>
                            <div className="text-[10px] font-bold uppercase tracking-widest text-cca-textSecondary/60 mb-0.5">Gérer les Permissions</div>
                            <div className="text-sm font-bold font-heading text-cca-textPrimary flex items-center gap-2">
                                <Shield className="w-4 h-4 text-brand-primary" />{channelName}
                            </div>
                        </div>
                        <button onClick={onClose} className="p-2 rounded-xl bg-cca-base hover:bg-cca-surface border border-cca-border text-cca-textSecondary hover:text-cca-textPrimary transition-all active:scale-95">
                            <X className="w-5 h-5" />
                        </button>
                    </div>

                    {channelCategoryId && !categoryOnly && (
                        <div className="px-4 py-3 border-b border-cca-border bg-cca-surface/50 space-y-3">
                            <div className="inline-flex w-full rounded-xl bg-cca-base border border-cca-border p-1 gap-1">
                                <button type="button" onClick={() => setScope('category')}
                                    className={`flex-1 flex items-center justify-center gap-2 px-3 py-2 text-xs font-bold rounded-lg transition-all ${scope === 'category' ? 'bg-brand-primary text-white shadow-lg shadow-brand-primary/20' : 'text-cca-textSecondary hover:text-cca-textPrimary hover:bg-cca-surface'}`}>
                                    <Folder className="w-3.5 h-3.5" />Catégorie {categoryName ? `(${categoryName})` : ''}
                                </button>
                                <button type="button" onClick={() => setScope('channel')}
                                    className={`flex-1 flex items-center justify-center gap-2 px-3 py-2 text-xs font-bold rounded-lg transition-all ${scope === 'channel' ? 'bg-brand-primary text-white shadow-lg shadow-brand-primary/20' : 'text-cca-textSecondary hover:text-cca-textPrimary hover:bg-cca-surface'}`}>
                                    <Hash className="w-3.5 h-3.5" />Salon
                                </button>
                            </div>
                            {scope === 'channel' && (
                                <div className={`flex items-center justify-between gap-3 px-3 py-2 rounded-xl border text-xs ${synced ? 'bg-emerald-500/5 border-emerald-500/20 text-emerald-300' : 'bg-amber-500/5 border-amber-500/20 text-amber-300'}`}>
                                    <div className="flex items-center gap-2 font-semibold">
                                        {synced ? <><Link2 className="w-3.5 h-3.5" />Synchronisé avec la catégorie</> : <><Link2Off className="w-3.5 h-3.5" />Désynchronisé — overrides spécifiques</>}
                                    </div>
                                    {!synced && (
                                        <button type="button" onClick={handleResync}
                                            className="flex items-center gap-1 px-2 py-1 rounded-lg bg-cca-base hover:bg-cca-surface border border-cca-border text-cca-textPrimary font-bold transition-all active:scale-95">
                                            <RefreshCw className="w-3 h-3" />Resync
                                        </button>
                                    )}
                                </div>
                            )}
                            {editingDisabledHint && <p className="text-[11px] text-cca-textSecondary/70 italic px-1">{editingDisabledHint}</p>}
                        </div>
                    )}

                    <div className="px-4 py-3 border-b border-cca-border bg-cca-surface/50">
                        <div className="inline-flex w-full rounded-xl bg-cca-base border border-cca-border p-1 gap-1">
                            <button type="button" onClick={() => setTab('ranks')}
                                className={`flex-1 flex items-center justify-center gap-2 px-3 py-2 text-xs font-bold rounded-lg transition-all ${tab === 'ranks' ? 'bg-brand-primary text-white shadow-lg shadow-brand-primary/20' : 'text-cca-textSecondary hover:text-cca-textPrimary hover:bg-cca-surface'}`}>
                                <Users className="w-3.5 h-3.5" />Rôles
                            </button>
                            <button type="button" onClick={() => setTab('users')}
                                className={`flex-1 flex items-center justify-center gap-2 px-3 py-2 text-xs font-bold rounded-lg transition-all ${tab === 'users' ? 'bg-brand-primary text-white shadow-lg shadow-brand-primary/20' : 'text-cca-textSecondary hover:text-cca-textPrimary hover:bg-cca-surface'}`}>
                                <User className="w-3.5 h-3.5" />Utilisateurs
                            </button>
                        </div>
                    </div>

                    <div className="flex-1 overflow-y-auto px-4 py-3 space-y-6">
                        {loading && <div className="text-center text-cca-textSecondary animate-pulse text-sm pt-8">Chargement des permissions…</div>}
                        {!loading && tab === 'ranks' && (
                            <PermissionsOverrideList
                                overrides={rankOverrides} expandedId={expandedRankId}
                                onToggle={(id) => setExpandedRankId(expandedRankId === id ? null : id)}
                                onRemove={handleRemoveRank} catalog={catalog}
                                onChangePerm={handleChangeRankPerm}
                                idKey="rankId" nameKey="rankName" Icon={Shield}
                                availableItems={availableRanks} onAdd={handleAddRank}
                                placeholder="Ajouter un rôle" labelKey="name" valueKey="id"
                                scope={scope}
                            />
                        )}
                        {!loading && tab === 'users' && (
                            <PermissionsOverrideList
                                overrides={userOverrides} expandedId={expandedUserId}
                                onToggle={(id) => setExpandedUserId(expandedUserId === id ? null : id)}
                                onRemove={handleRemoveUser} catalog={catalog}
                                onChangePerm={handleChangeUserPerm}
                                idKey="userId" nameKey="userName" Icon={User}
                                availableItems={availableUsers} onAdd={handleAddUser}
                                placeholder="Ajouter un utilisateur" labelKey="fullName" valueKey="userId"
                                scope={scope}
                            />
                        )}
                    </div>
                </aside>
            </div>
            <ConfirmationModal
                isOpen={confirmModal.isOpen}
                onClose={() => setConfirmModal(p => ({ ...p, isOpen: false }))}
                onConfirm={confirmModal.onConfirm}
                message={confirmModal.message}
            />
        </>
    );
}
