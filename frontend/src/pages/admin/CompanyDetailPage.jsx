// frontend/src/pages/admin/CompanyDetailsPage.jsx

import React, { useCallback, useEffect, useMemo, useState, Suspense, lazy } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { toast } from 'react-hot-toast';
import {
    Building2, Puzzle, Users, Activity, ListChecks, FileText, RefreshCcw, Save,
    KeySquare, Shield, ChevronDown, ChevronRight, Search, MessageSquare, Send, Trash2, Edit2, UserPlus, UserMinus
} from 'lucide-react';
import { startOfWeek, endOfWeek, formatISO } from 'date-fns';
import { useConfirmation } from '@/contexts/ConfirmationContext';

import {
    getCompanyDetails,
    updateCompanyName,
    deleteCompany,
    regenerateApiKey,
    regenerateOnboardingKey,
    getAllModules,
    assignCompanyModules,
    removeCompanyModule,
    listCompanyFullUsers,
    getEmployeeAdminProfile,
    uploadUserAvatar,
    updateEmployeeStatus,
    assignEmployeeRank,
    removeEmployeeRank,
    addEmployeeRankHistory,

    // ✅ nouveaux services (présents dans ton adminService.js fusionné)
    listCompanyConversations,
    listConversationMessages,
    editMessage as apiEditMessage,
    deleteMessage as apiDeleteMessage,
    sendSystemMessage as apiSendSystemMessage,
    addConversationMember,
    removeConversationMember,
    listEmployeeBills,
    setCompanyFullAccess,
} from '@/services/adminService';

import usePagination from '@/hooks/usePagination';
import Pagination from '@/components/ui/Pagination';
import ConfirmationModal from '@/components/ui/ConfirmationModal';

const TransactionCharts = lazy(() => import('@/components/accounting/TransactionCharts'));

/* ---------- UI utils ---------- */
const formatUSD = (n) =>
    new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 2 })
        .format(Number.isFinite(+n) ? +n : 0);

function Section({ title, icon: Icon, defaultOpen = false, right = null, children }) {
    const [open, setOpen] = useState(!!defaultOpen);
    return (
        <div className="rounded-xl bg-slate-800/60 border border-slate-700 shadow-md">
            <button
                type="button"
                onClick={() => setOpen((o) => !o)}
                className="w-full px-4 py-3 flex items-center justify-between"
            >
                <div className="flex items-center gap-2 text-slate-200 font-medium">
                    {Icon ? <Icon size={16} className="text-indigo-300" /> : null}
                    {title}
                </div>
                <div className="flex items-center gap-3">
                    {right}
                    {open ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                </div>
            </button>
            {open && <div className="p-4 pt-0">{children}</div>}
        </div>
    );
}

/* ---------- Modal employé (FACTURES paginées + profil) ---------- */
function EmployeeAdminModal({ open, onClose, companyId, employee, companyRanks }) {
    const [loading, setLoading] = useState(false);
    const [profile, setProfile] = useState(null);
    const [status, setStatus] = useState('ACTIVE');
    const [rankId, setRankId] = useState(null);
    const [note, setNote] = useState('');

    // pagination côté backend (évite super long modal)
    const [billPage, setBillPage] = useState(1);
    const [billPageSize, setBillPageSize] = useState(10);
    const [billData, setBillData] = useState({ items: [], total: 0, totalPages: 0, page: 1, pageSize: 10 });
    const [billLoading, setBillLoading] = useState(false);

    const refresh = useCallback(async () => {
        if (!open || !employee?.id) return;
        try {
            setLoading(true);
            const p = await getEmployeeAdminProfile(companyId, employee.id);
            setProfile(p);
            setStatus(p?.status || 'ACTIVE');
            setRankId(p?.rankId || p?.rank?.id || null);
        } catch (e) {
            toast.error(e?.message || 'Impossible de charger le profil employé.');
        } finally {
            setLoading(false);
        }
    }, [open, employee?.id, companyId]);

    const fetchBills = useCallback(async () => {
        if (!open || !employee?.id) return;
        try {
            setBillLoading(true);
            const resp = await listEmployeeBills(employee.id, { page: billPage, pageSize: billPageSize });
            setBillData({
                items: Array.isArray(resp?.items) ? resp.items : [],
                total: Number(resp?.total || 0),
                totalPages: Number(resp?.totalPages || 0),
                page: Number(resp?.page || billPage),
                pageSize: Number(resp?.pageSize || billPageSize),
            });
        } catch (e) {
            toast.error(e?.message || 'Impossible de charger les factures.');
        } finally {
            setBillLoading(false);
        }
    }, [open, employee?.id, billPage, billPageSize]);

    useEffect(() => { refresh(); }, [refresh]);
    useEffect(() => { fetchBills(); }, [fetchBills]);

    if (!open) return null;

    const onUploadAvatar = async (file) => {
        try {
            if (!file) return;
            await uploadUserAvatar(companyId, profile?.user?.id, file);
            toast.success('Avatar mis à jour.');
            await refresh();
        } catch (e) {
            toast.error(e?.message || "Échec de l'upload d'avatar.");
        }
    };

    const onSaveStatus = async () => {
        try {
            await updateEmployeeStatus(companyId, employee.id, status);
            toast.success('Statut enregistré.');
            await refresh();
        } catch (e) {
            toast.error(e?.message || 'Échec mise à jour statut.');
        }
    };

    const onAssignRank = async () => {
        if (!rankId) return;
        try {
            await assignEmployeeRank(companyId, employee.id, Number(rankId));
            toast.success('Rang attribué.');
            await refresh();
        } catch (e) {
            toast.error(e?.message || 'Échec assign rang.');
        }
    };

    const onRemoveRank = async () => {
        if (!rankId) return;
        try {
            await removeEmployeeRank(companyId, employee.id, Number(rankId));
            toast.success('Rang retiré.');
            await refresh();
        } catch (e) {
            toast.error(e?.message || 'Échec retrait rang.');
        }
    };

    const onAddRankHistory = async () => {
        if (!rankId) return;
        try {
            await addEmployeeRankHistory(companyId, employee.id, Number(rankId), note || '');
            toast.success('Historique ajouté.');
            setNote('');
            await refresh();
        } catch (e) {
            toast.error(e?.message || 'Échec ajout historique.');
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
            <div className="w-full max-w-3xl rounded-xl bg-slate-900 border border-slate-700 max-h-[85vh] overflow-hidden flex flex-col">
                <div className="px-4 py-3 border-b border-slate-700 flex items-center justify-between">
                    <div className="font-semibold text-slate-100">
                        Profil employé — {profile?.user?.name || employee?.user?.name || '—'}
                    </div>
                    <button onClick={onClose} className="text-slate-300 hover:text-white">✕</button>
                </div>

                <div className="p-4 space-y-4 overflow-y-auto">
                    {loading ? (
                        <div className="h-40 bg-slate-800 animate-pulse rounded" />
                    ) : (
                        <>
                            <div className="flex flex-col sm:flex-row gap-4 items-center sm:items-stretch">
                                <div className="w-20 h-20 rounded-full overflow-hidden bg-slate-800 border border-slate-700 shrink-0">
                                    {profile?.user?.imageUrl ? (
                                        <img src={profile.user.imageUrl} alt="" className="w-full h-full object-cover" />
                                    ) : null}
                                </div>
                                <div className="flex-1 w-full">
                                    <div className="text-slate-100 font-medium">{profile?.user?.name || '—'}</div>
                                    <div className="text-xs text-slate-400">@{profile?.user?.username || '—'}</div>
                                    <div className="mt-2 flex flex-wrap gap-2">
                                        <label className="inline-flex items-center gap-2 text-sm px-3 py-2 rounded border border-slate-700 bg-slate-800 cursor-pointer">
                                            Changer avatar
                                            <input type="file" accept="image/*" className="hidden" onChange={(e) => onUploadAvatar(e.target.files?.[0])} />
                                        </label>
                                    </div>
                                </div>
                            </div>

                            <div className="grid md:grid-cols-2 gap-3">
                                <div className="rounded-lg border border-slate-700 p-3">
                                    <div className="text-sm text-slate-300 mb-2">Statut</div>
                                    <select
                                        value={status}
                                        onChange={(e) => setStatus(e.target.value)}
                                        className="w-full rounded-md border border-slate-700 bg-slate-900/60 px-3 py-2 text-sm text-slate-200"
                                    >
                                        <option value="ACTIVE">Actif</option>
                                        <option value="RESIGNED">Démission</option>
                                        <option value="FIRED">Viré</option>
                                    </select>
                                    <button onClick={onSaveStatus} className="mt-2 text-sm px-3 py-1.5 rounded bg-indigo-600 text-white">
                                        Enregistrer
                                    </button>
                                </div>

                                <div className="rounded-lg border border-slate-700 p-3">
                                    <div className="text-sm text-slate-300 mb-2">Rang</div>
                                    <div className="flex gap-2">
                                        <select
                                            value={rankId ?? ''}
                                            onChange={(e) => setRankId(e.target.value ? Number(e.target.value) : null)}
                                            className="flex-1 rounded-md border border-slate-700 bg-slate-900/60 px-3 py-2 text-sm text-slate-200"
                                        >
                                            <option value="">— Sélectionner —</option>
                                            {(companyRanks || []).map(r => (
                                                <option key={r.id} value={r.id}>{r.name}</option>
                                            ))}
                                        </select>
                                        <button onClick={onAssignRank} className="text-sm px-3 py-1.5 rounded bg-green-600 text-white">Assigner</button>
                                        <button onClick={onRemoveRank} className="text-sm px-3 py-1.5 rounded bg-red-600 text-white">Retirer</button>
                                    </div>
                                    <div className="mt-2 flex gap-2">
                                        <input
                                            value={note}
                                            onChange={(e) => setNote(e.target.value)}
                                            placeholder="Note historique (optionnel)"
                                            className="flex-1 rounded-md border border-slate-700 bg-slate-900/60 px-3 py-2 text-sm text-slate-200"
                                        />
                                        <button onClick={onAddRankHistory} className="text-sm px-3 py-1.5 rounded bg-slate-800 border border-slate-700">
                                            Ajouter historique
                                        </button>
                                    </div>
                                </div>
                            </div>

                            {/* Factures paginées */}
                            <div className="rounded-lg border border-slate-700">
                                <div className="px-3 py-2 text-sm text-slate-300 border-b border-slate-700">Factures (auteur) — pagination serveur</div>
                                <div className="p-3">
                                    {billLoading ? (
                                        <div className="h-24 bg-slate-800 animate-pulse rounded" />
                                    ) : billData.items?.length ? (
                                        <>
                                            <div className="overflow-auto">
                                                <table className="min-w-full text-sm">
                                                    <thead>
                                                    <tr className="text-slate-300">
                                                        <th className="text-left py-2 pr-3">Date</th>
                                                        <th className="text-left py-2 pr-3">Raison</th>
                                                        <th className="text-right py-2">Montant</th>
                                                    </tr>
                                                    </thead>
                                                    <tbody className="divide-y divide-slate-700">
                                                    {billData.items.map(b => (
                                                        <tr key={b.id}>
                                                            <td className="py-2 pr-3">{new Date(b.date).toLocaleString('fr-FR')}</td>
                                                            <td className="py-2 pr-3">{b.reason || '—'}</td>
                                                            <td className="py-2 text-right">{formatUSD(b.amount)}</td>
                                                        </tr>
                                                    ))}
                                                    </tbody>
                                                </table>
                                            </div>
                                            <Pagination
                                                className="mt-3"
                                                page={billData.page}
                                                totalPages={billData.totalPages}
                                                totalItems={billData.total}
                                                pageSize={billData.pageSize}
                                                onPageChange={(p) => setBillPage(p)}
                                                onPageSizeChange={(s) => { setBillPageSize(s); setBillPage(1); }}
                                            />
                                        </>
                                    ) : (
                                        <div className="text-sm text-slate-400">Aucune facture.</div>
                                    )}
                                </div>
                            </div>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
}

/* ---------- Discussions (Conversations + Messages) ---------- */
function ConversationModal({ open, onClose, conversation }) {
    const [loading, setLoading] = useState(false);
    const [page, setPage] = useState(1);
    const [pageSize, setPageSize] = useState(30);
    const [data, setData] = useState({ items: [], total: 0, totalPages: 0 });

    const [editId, setEditId] = useState(null);
    const [editContent, setEditContent] = useState('');
    const [systemContent, setSystemContent] = useState('');

    const [memberUserId, setMemberUserId] = useState('');
    const [memberRoleId, setMemberRoleId] = useState('');
    const [confirmModal, setConfirmModal] = useState({ isOpen: false, message: '', onConfirm: null });

    const reload = useCallback(async () => {
        if (!open || !conversation?.id) return;
        try {
            setLoading(true);
            const resp = await listConversationMessages(conversation.id, { page, pageSize });
            setData(resp || { items: [], page, pageSize, total: 0, totalPages: 0 });
        } catch (e) {
            toast.error(e?.message || 'Impossible de charger les messages.');
        } finally {
            setLoading(false);
        }
    }, [open, conversation?.id, page, pageSize]);

    useEffect(() => { reload(); }, [reload]);

    if (!open) return null;

    const onStartEdit = (m) => {
        setEditId(m.id);
        setEditContent(m.content || '');
    };
    const onCancelEdit = () => {
        setEditId(null);
        setEditContent('');
    };
    const onSaveEdit = async () => {
        try {
            await apiEditMessage(editId, editContent);
            toast.success('Message modifié.');
            onCancelEdit();
            await reload();
        } catch (e) {
            toast.error(e?.message || 'Échec modification.');
        }
    };
    const onDelete = (m) => {
        setConfirmModal({
            isOpen: true,
            message: 'Supprimer ce message ?',
            onConfirm: async () => {
                setConfirmModal(p => ({ ...p, isOpen: false }));
                try {
                    await apiDeleteMessage(m.id);
                    toast.success('Message supprimé.');
                    await reload();
                } catch (e) {
                    toast.error(e?.message || 'Échec suppression.');
                }
            },
        });
    };
    const onSendSystem = async () => {
        try {
            if (!systemContent.trim()) return;
            await apiSendSystemMessage(conversation.id, systemContent.trim());
            setSystemContent('');
            toast.success('Message système envoyé.');
            await reload();
        } catch (e) {
            toast.error(e?.message || 'Échec envoi système.');
        }
    };
    const onAddMember = async () => {
        try {
            const payload = {};
            if (memberUserId) payload.userId = Number(memberUserId);
            if (memberRoleId) payload.roleId = Number(memberRoleId);
            if (!payload.userId && !payload.roleId) return;
            await addConversationMember(conversation.id, payload);
            setMemberUserId('');
            setMemberRoleId('');
            toast.success('Membre ajouté.');
        } catch (e) {
            toast.error(e?.message || 'Échec ajout membre.');
        }
    };
    const onRemoveMember = async () => {
        try {
            const payload = {};
            if (memberUserId) payload.userId = Number(memberUserId);
            if (memberRoleId) payload.roleId = Number(memberRoleId);
            if (!payload.userId && !payload.roleId) return;
            await removeConversationMember(conversation.id, payload);
            setMemberUserId('');
            setMemberRoleId('');
            toast.success('Membre retiré.');
        } catch (e) {
            toast.error(e?.message || 'Échec retrait membre.');
        }
    };

    return (
        <>
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
            <div className="w-full max-w-4xl rounded-xl bg-slate-900 border border-slate-700 max-h-[85vh] overflow-hidden flex flex-col">
                <div className="px-4 py-3 border-b border-slate-700 flex items-center justify-between">
                    <div className="font-semibold text-slate-100 flex items-center gap-2">
                        <MessageSquare size={16} className="text-indigo-300" />
                        {conversation?.title || `Conversation #${conversation?.id}`}
                    </div>
                    <button onClick={onClose} className="text-slate-300 hover:text-white">✕</button>
                </div>

                <div className="p-3 flex-1 overflow-auto">
                    {loading ? (
                        <div className="h-40 bg-slate-800 animate-pulse rounded" />
                    ) : data.items?.length ? (
                        <ul className="space-y-2">
                            {data.items.map((m) => (
                                <li key={m.id} className="bg-slate-800/60 border border-slate-700 rounded p-2">
                                    <div className="flex items-center justify-between">
                                        <div className="text-xs text-slate-400">{m.author?.name || `#${m.authorId}`} • {new Date(m.createdAt).toLocaleString('fr-FR')}</div>
                                        <div className="flex items-center gap-2 text-slate-300">
                                            <button title="Modifier" onClick={() => onStartEdit(m)} className="hover:text-white"><Edit2 size={14} /></button>
                                            <button title="Supprimer" onClick={() => onDelete(m)} className="hover:text-rose-400"><Trash2 size={14} /></button>
                                        </div>
                                    </div>
                                    {editId === m.id ? (
                                        <div className="mt-2">
                      <textarea
                          className="w-full rounded border border-slate-700 bg-slate-900/60 p-2 text-sm text-slate-200"
                          value={editContent}
                          onChange={(e) => setEditContent(e.target.value)}
                          rows={3}
                      />
                                            <div className="mt-2 flex gap-2">
                                                <button onClick={onSaveEdit} className="px-3 py-1.5 rounded bg-indigo-600 text-white text-sm">Sauver</button>
                                                <button onClick={onCancelEdit} className="px-3 py-1.5 rounded border border-slate-700 text-sm">Annuler</button>
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="mt-1 text-slate-200 whitespace-pre-wrap">{m.content}</div>
                                    )}
                                </li>
                            ))}
                        </ul>
                    ) : (
                        <div className="text-sm text-slate-400">Aucun message.</div>
                    )}
                </div>

                <div className="px-3 pb-3">
                    <Pagination
                        page={data.page || page}
                        totalPages={data.totalPages || 0}
                        totalItems={data.total || 0}
                        pageSize={data.pageSize || pageSize}
                        onPageChange={setPage}
                        onPageSizeChange={(s) => { setPageSize(s); setPage(1); }}
                    />
                </div>

                <div className="px-3 pb-3 border-t border-slate-700">
                    <div className="text-sm text-slate-300 mb-1">Envoyer un message système</div>
                    <div className="flex gap-2">
                        <input
                            value={systemContent}
                            onChange={(e) => setSystemContent(e.target.value)}
                            placeholder="Contenu…"
                            className="flex-1 rounded-md border border-slate-700 bg-slate-900/60 px-3 py-2 text-sm text-slate-200"
                        />
                        <button onClick={onSendSystem} className="px-3 py-2 rounded bg-slate-800 border border-slate-700 text-sm inline-flex items-center gap-2">
                            <Send size={14} /> Envoyer
                        </button>
                    </div>

                    <div className="mt-3 grid sm:grid-cols-2 gap-2">
                        <div className="rounded-md border border-slate-700 p-2">
                            <div className="text-xs text-slate-400 mb-1">Gérer membres — User ID</div>
                            <div className="flex gap-2">
                                <input value={memberUserId} onChange={(e) => setMemberUserId(e.target.value)} className="flex-1 rounded-md border border-slate-700 bg-slate-900/60 px-3 py-2 text-sm text-slate-200" />
                                <button onClick={onAddMember} className="px-3 py-2 rounded bg-green-700 text-white text-sm inline-flex items-center gap-2"><UserPlus size={14}/>Ajouter</button>
                                <button onClick={onRemoveMember} className="px-3 py-2 rounded bg-rose-700 text-white text-sm inline-flex items-center gap-2"><UserMinus size={14}/>Retirer</button>
                            </div>
                        </div>
                        <div className="rounded-md border border-slate-700 p-2">
                            <div className="text-xs text-slate-400 mb-1">Gérer membres — Role ID</div>
                            <div className="flex gap-2">
                                <input value={memberRoleId} onChange={(e) => setMemberRoleId(e.target.value)} className="flex-1 rounded-md border border-slate-700 bg-slate-900/60 px-3 py-2 text-sm text-slate-200" />
                                <button onClick={onAddMember} className="px-3 py-2 rounded bg-green-700 text-white text-sm inline-flex items-center gap-2"><UserPlus size={14}/>Ajouter</button>
                                <button onClick={onRemoveMember} className="px-3 py-2 rounded bg-rose-700 text-white text-sm inline-flex items-center gap-2"><UserMinus size={14}/>Retirer</button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
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

function ConversationsPanel({ companyId }) {
    const [search, setSearch] = useState('');
    const [page, setPage] = useState(1);
    const [pageSize, setPageSize] = useState(10);
    const [loading, setLoading] = useState(false);
    const [data, setData] = useState({ items: [], total: 0, totalPages: 0 });

    const [modal, setModal] = useState({ open: false, conv: null });

    const load = useCallback(async () => {
        try {
            setLoading(true);
            const resp = await listCompanyConversations(companyId, { page, pageSize, search });
            setData(resp || { items: [], page, pageSize, total: 0, totalPages: 0 });
        } catch (e) {
            toast.error(e?.message || 'Impossible de charger les discussions.');
        } finally {
            setLoading(false);
        }
    }, [companyId, page, pageSize, search]);

    useEffect(() => { load(); }, [load]);

    return (
        <div className="space-y-3">
            <div className="flex items-center gap-2">
                <div className="relative flex-1">
                    <Search size={14} className="absolute left-2 top-2.5 text-slate-500" />
                    <input
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        placeholder="Rechercher par titre…"
                        className="w-full rounded-md border border-slate-700 bg-slate-900/60 pl-8 pr-3 py-2 text-sm text-slate-200 outline-none focus:ring-1 focus:ring-indigo-500"
                    />
                </div>
                <button onClick={() => { setPage(1); load(); }} className="px-3 py-2 text-sm rounded bg-slate-800 border border-slate-700">Rechercher</button>
            </div>

            {loading ? (
                <div className="h-24 bg-slate-800 animate-pulse rounded" />
            ) : data.items?.length ? (
                <>
                    <ul className="space-y-2">
                        {data.items.map((c) => (
                            <li key={c.id} className="bg-slate-800/60 border border-slate-700 rounded p-3">
                                <div className="flex items-center justify-between">
                                    <div className="text-slate-200 font-medium">{c.title || `Conversation #${c.id}`}</div>
                                    <div className="text-xs text-slate-400">{new Date(c.lastActivityAt).toLocaleString('fr-FR')}</div>
                                </div>
                                <div className="text-xs text-slate-400 mt-1">
                                    {c.kind} • messages: {c.messageCount} • reports: {c.reportCount}
                                </div>
                                <div className="mt-2">
                                    <button
                                        onClick={() => setModal({ open: true, conv: c })}
                                        className="inline-flex items-center gap-2 px-3 py-1.5 rounded bg-slate-800 border border-slate-700 text-sm"
                                    >
                                        <MessageSquare size={14} /> Ouvrir
                                    </button>
                                </div>
                            </li>
                        ))}
                    </ul>
                    <Pagination
                        className="mt-3"
                        page={data.page || page}
                        totalPages={data.totalPages || 0}
                        totalItems={data.total || 0}
                        pageSize={data.pageSize || pageSize}
                        onPageChange={setPage}
                        onPageSizeChange={(s) => { setPageSize(s); setPage(1); }}
                    />
                </>
            ) : (
                <div className="text-sm text-slate-400">Aucune discussion.</div>
            )}

            <ConversationModal
                open={modal.open}
                onClose={() => setModal({ open: false, conv: null })}
                conversation={modal.conv}
            />
        </div>
    );
}

/* ---------- FULL users (ajout: toggle FULL par userId) ---------- */
function FullUsersPanel({ companyId }) {
    const [q, setQ] = useState('');
    const [loading, setLoading] = useState(false);
    const [rows, setRows] = useState([]);

    // toggle section
    const [userId, setUserId] = useState('');
    const [enable, setEnable] = useState(true);
    const [saving, setSaving] = useState(false);

    const search = useCallback(async () => {
        try {
            setLoading(true);
            const data = await listCompanyFullUsers(companyId, q);
            setRows(Array.isArray(data) ? data : []);
        } catch (e) {
            toast.error(e?.message || 'Erreur chargement FULL users.');
        } finally {
            setLoading(false);
        }
    }, [companyId, q]);

    useEffect(() => { search(); }, [search]);

    const onToggleFull = async () => {
        if (!userId) return;
        try {
            setSaving(true);
            const resp = await setCompanyFullAccess(companyId, Number(userId), !!enable);
            if (resp?.granted) toast.success('FULL accordé.');
            else toast.success('FULL retiré.');
            setUserId('');
            await search();
        } catch (e) {
            toast.error(e?.message || 'Échec mise à jour FULL.');
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="space-y-3">
            <div className="flex gap-2">
                <div className="relative flex-1">
                    <Search size={14} className="absolute left-2 top-2.5 text-slate-500" />
                    <input
                        value={q}
                        onChange={(e) => setQ(e.target.value)}
                        placeholder="Rechercher par nom ou username…"
                        className="w-full rounded-md border border-slate-700 bg-slate-900/60 pl-8 pr-3 py-2 text-sm text-slate-200 outline-none focus:ring-1 focus:ring-indigo-500"
                    />
                </div>
                <button onClick={search} className="px-3 py-2 text-sm rounded bg-slate-800 border border-slate-700">Rechercher</button>
            </div>

            {/* Toggle FULL par userId pour cette company */}
            <div className="rounded-lg border border-slate-700 p-3">
                <div className="text-sm text-slate-300 mb-2">FULL access — COMPANY.{companyId}.*</div>
                <div className="flex flex-col sm:flex-row gap-2">
                    <input
                        value={userId}
                        onChange={(e) => setUserId(e.target.value)}
                        placeholder="User ID"
                        className="flex-1 rounded-md border border-slate-700 bg-slate-900/60 px-3 py-2 text-sm text-slate-200"
                    />
                    <select
                        value={enable ? '1' : '0'}
                        onChange={(e) => setEnable(e.target.value === '1')}
                        className="rounded-md border border-slate-700 bg-slate-900/60 px-3 py-2 text-sm text-slate-200"
                    >
                        <option value="1">Donner le FULL</option>
                        <option value="0">Retirer le FULL</option>
                    </select>
                    <button
                        disabled={!userId || saving}
                        onClick={onToggleFull}
                        className="px-3 py-2 text-sm rounded bg-indigo-600 text-white disabled:opacity-50"
                    >
                        {saving ? 'Mise à jour…' : 'Valider'}
                    </button>
                </div>
            </div>

            {loading ? (
                <div className="h-24 bg-slate-800 animate-pulse rounded" />
            ) : rows.length === 0 ? (
                <div className="text-sm text-slate-400">Aucun utilisateur FULL pour cette entreprise.</div>
            ) : (
                <ul className="text-sm space-y-1">
                    {rows.map(u => (
                        <li key={u.id} className="flex items-center justify-between bg-slate-800/60 border border-slate-700 rounded px-3 py-2">
                            <div className="text-slate-200">{u.name} <span className="text-slate-500">@{u.username || '—'}</span></div>
                            <div className="text-xs text-slate-500">ID: {u.id}</div>
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
}

/* ---------- PAGE ---------- */
export default function CompanyDetailsPage() {
    const navigate = useNavigate();
    const { confirmAction } = useConfirmation();
    const { companyId: companyIdParam } = useParams();
    const companyId = Number(companyIdParam);

    const [company, setCompany] = useState(null);
    const [loading, setLoading] = useState(true);
    const [pageError, setPageError] = useState('');

    const [filters, setFilters] = useState(() => {
        const start = formatISO(startOfWeek(new Date(), { weekStartsOn: 1 }));
        const end = formatISO(endOfWeek(new Date(), { weekStartsOn: 1 }));
        return { startDate: start, endDate: end, reason: '', user: '', minPrice: '', maxPrice: '' };
    });

    const [editedName, setEditedName] = useState('');
    const [regenLoading, setRegenLoading] = useState({ api: false, onboard: false });

    // Modules
    const [allModules, setAllModules] = useState([]);
    const [modulesLoading, setModulesLoading] = useState(true);
    const [moduleSearch, setModuleSearch] = useState('');
    const [moduleSaving, setModuleSaving] = useState(false);

    // Paniers de changements (AJOUTS / RETRAITS) à valider
    const [pendingAdds, setPendingAdds] = useState(() => new Set());
    const [pendingRemovals, setPendingRemovals] = useState(() => new Set());

    // Recherches locales / pagination
    const [txQuery, setTxQuery] = useState('');
    const [billQuery, setBillQuery] = useState('');
    const [employeeQuery, setEmployeeQuery] = useState('');
    const [clientQuery, setClientQuery] = useState('');
    const [employeeModal, setEmployeeModal] = useState({ open: false, employee: null });

    const fetchDetails = useCallback(async () => {
        try {
            setLoading(true);
            setPageError('');
            const data = await getCompanyDetails(companyId, {
                startDate: filters.startDate,
                endDate: filters.endDate,
                reason: filters.reason || undefined,
                user: filters.user || undefined,
                minAmount: filters.minPrice || undefined,
                maxAmount: filters.maxPrice || undefined,
            });
            setCompany(data);
            setEditedName(data?.name || '');
        } catch (e) {
            const msg = e?.message || 'Entreprise introuvable.';
            setPageError(msg);
            toast.error(msg);
        } finally {
            setLoading(false);
        }
    }, [companyId, filters]);

    const fetchAllModules = useCallback(async () => {
        try {
            setModulesLoading(true);
            const mods = await getAllModules();
            setAllModules(mods || []);
        } catch (e) {
            toast.error(e?.message || 'Impossible de charger les modules.');
        } finally {
            setModulesLoading(false);
        }
    }, []);


    const onDeleteCompany = useCallback(() => {
        confirmAction({
            title: "Supprimer l’entreprise",
            message: `Cette action supprimera définitivement l’entreprise "${company?.name || `#${companyId}`}" ainsi que toutes les données qui lui sont reliées (sauf l’historique de rang archivé).`,
            onConfirm: async () => {
                try {
                    await deleteCompany(companyId);
                    toast.success('Entreprise supprimée.');
                    navigate('/admin/companies');
                } catch (e) {
                    toast.error(e?.message || "Échec suppression de l’entreprise.");
                }
            },
        });
    }, [confirmAction, companyId, company?.name, navigate]);

    useEffect(() => { fetchDetails(); }, [fetchDetails]);
    useEffect(() => { fetchAllModules(); }, [fetchAllModules]);

    /* ---------- Dérivés ---------- */
    const activeModules = useMemo(() => company?.activeModules || [], [company?.activeModules]);
    const activeModuleIds = useMemo(() => new Set(activeModules.map((m) => m.module?.id ?? m.moduleId)), [activeModules]);

    const filteredModules = useMemo(() => {
        const base = Array.isArray(allModules) ? allModules : [];
        if (!moduleSearch.trim()) return base;
        const q = moduleSearch.toLowerCase();
        return base.filter(m => (m.name || '').toLowerCase().includes(q) || String(m.id).includes(q));
    }, [allModules, moduleSearch]);

    // Transactions, factures, employés, clients
    const filteredTransactions = useMemo(() => {
        const src = company?.transactions || [];
        const f = filters;
        const q = (txQuery || '').toLowerCase();
        return src.filter((t) => {
            const d = t.createdAt ? new Date(t.createdAt) : (t.date ? new Date(t.date) : null);
            const okStart = f.startDate ? (d && d >= new Date(f.startDate)) : true;
            const okEnd = f.endDate ? (d && d <= new Date(f.endDate)) : true;
            const S = (t.reason || t.description || '').toLowerCase();
            const okReason = f.reason ? S.includes(f.reason.toLowerCase()) : true;
            const okUser = f.user ? String(t.user?.name || '').toLowerCase().includes(f.user.toLowerCase()) : true;
            const okQ = q ? (S.includes(q) || String(t.user?.name || '').toLowerCase().includes(q)) : true;
            const amt = Number(t.amount);
            const okMin = f.minPrice !== '' ? amt >= Number(f.minPrice) : true;
            const okMax = f.maxPrice !== '' ? amt <= Number(f.maxPrice) : true;
            return okStart && okEnd && okReason && okUser && okQ && okMin && okMax;
        });
    }, [company, filters, txQuery]);

    const transactionsForChart = useMemo(() => {
        const base = filteredTransactions || [];
        return base.map((t) => ({
            date: t.date || t.createdAt,
            amount: Number(t.amount) || 0,
            category: t.category || {
                type: t.type || (Number(t.amount) >= 0 ? 'REVENUE' : 'EXPENSE'),
                isDeductible: !!t?.category?.isDeductible,
            },
        }));
    }, [filteredTransactions]);

    const filteredBills = useMemo(() => {
        const src = company?.bills || [];
        const f = filters;
        const q = (billQuery || '').toLowerCase();
        return src.filter((b) => {
            const d = b.date ? new Date(b.date) : null;
            const okStart = f.startDate ? (d && d >= new Date(f.startDate)) : true;
            const okEnd = f.endDate ? (d && d <= new Date(f.endDate)) : true;
            const okReason = f.reason ? String(b.reason || '').toLowerCase().includes(f.reason.toLowerCase()) : true;
            const okUser = f.user ? String(b.payerName || b.receiverName || '').toLowerCase().includes(f.user.toLowerCase()) : true;
            const okQ = q ? (String(b.reason || '').toLowerCase().includes(q) || String(b.payerName || '').toLowerCase().includes(q) || String(b.receiverName || '').toLowerCase().includes(q)) : true;
            const amt = Number(b.amount);
            const okMin = f.minPrice !== '' ? amt >= Number(f.minPrice) : true;
            const okMax = f.maxPrice !== '' ? amt <= Number(f.maxPrice) : true;
            return okStart && okEnd && okReason && okUser && okQ && okMin && okMax;
        });
    }, [company, filters, billQuery]);

    const filteredEmployees = useMemo(() => {
        const src = company?.employees || [];
        const q = (employeeQuery || '').toLowerCase();
        return src.filter((e) =>
            (e.user?.name || '').toLowerCase().includes(q) ||
            (e.rank?.name || '').toLowerCase().includes(q)
        );
    }, [company, employeeQuery]);

    const filteredClients = useMemo(() => {
        const src = company?.clients || [];
        const q = (clientQuery || '').toLowerCase();
        return src.filter((c) => (c.name || '').toLowerCase().includes(q));
    }, [company, clientQuery]);

    const txPage = usePagination(filteredTransactions || [], { pageSize: 10 });
    const billsPage = usePagination(filteredBills || [], { pageSize: 10 });
    const employeesPage = usePagination(filteredEmployees || [], { pageSize: 12 });
    const clientsPage = usePagination(filteredClients || [], { pageSize: 12 });

    /* ---------- Actions entreprise ---------- */
    const onSaveName = async () => {
        if (!editedName || editedName === company?.name) return;
        try {
            const updated = await updateCompanyName(companyId, editedName);
            setCompany((c) => ({ ...c, name: updated?.name || editedName }));
            toast.success('Nom mis à jour.');
        } catch (e) {
            toast.error(e?.message || 'Impossible de mettre à jour le nom.');
        }
    };

    const onRegenApiKey = async () => {
        try {
            setRegenLoading(s => ({ ...s, api: true }));
            const res = await regenerateApiKey(companyId);
            setCompany((c) => ({ ...c, apiKey: res?.apiKey || c?.apiKey }));
            toast.success('Clé API régénérée.');
        } catch (e) {
            toast.error(e?.message || 'Échec régénération clé API.');
        } finally {
            setRegenLoading(s => ({ ...s, api: false }));
        }
    };

    const onRegenOnboarding = async () => {
        try {
            setRegenLoading(s => ({ ...s, onboard: true }));
            const res = await regenerateOnboardingKey(companyId);
            setCompany((c) => ({ ...c, onboardingKey: res?.onboardingKey || c?.onboardingKey }));
            toast.success("Clé d'onboarding régénérée.");
        } catch (e) {
            toast.error(e?.message || "Échec régénération clé d'onboarding.");
        } finally {
            setRegenLoading(s => ({ ...s, onboard: false }));
        }
    };

    /* ---------- Modules: TAG UI + validation différée ---------- */
    const isActive = useCallback((mid) => activeModuleIds.has(mid), [activeModuleIds]);
    const isMarkedAdd = useCallback((mid) => pendingAdds.has(mid), [pendingAdds]);
    const isMarkedRemove = useCallback((mid) => pendingRemovals.has(mid), [pendingRemovals]);

    const toggleModule = (mid) => {
        if (isActive(mid)) {
            const copy = new Set(pendingRemovals);
            if (copy.has(mid)) copy.delete(mid); else copy.add(mid);
            setPendingAdds((prev) => { const s = new Set(prev); s.delete(mid); return s; });
            setPendingRemovals(copy);
            return;
        }
        const addCopy = new Set(pendingAdds);
        if (addCopy.has(mid)) addCopy.delete(mid); else addCopy.add(mid);
        setPendingRemovals((prev) => { const s = new Set(prev); s.delete(mid); return s; });
        setPendingAdds(addCopy);
    };

    const applyModuleChanges = async () => {
        if (!pendingAdds.size && !pendingRemovals.size) return;
        try {
            setModuleSaving(true);
            if (pendingAdds.size) await assignCompanyModules(companyId, Array.from(pendingAdds));
            for (const mid of pendingRemovals) {
                if (!activeModuleIds.has(mid)) continue;
                await removeCompanyModule(companyId, mid);
            }
            toast.success('Modules mis à jour.');
            setPendingAdds(new Set());
            setPendingRemovals(new Set());
            await fetchDetails();
            await fetchAllModules();
        } catch (e) {
            toast.error(e?.message || 'Échec mise à jour des modules.');
        } finally {
            setModuleSaving(false);
        }
    };

    const cancelModuleChanges = () => {
        setPendingAdds(new Set());
        setPendingRemovals(new Set());
    };

    const tagClass = (m) => {
        const mid = m.id;
        if (isActive(mid) && !isMarkedRemove(mid)) return 'bg-emerald-700 text-white border-emerald-600';
        if (isActive(mid) && isMarkedRemove(mid)) return 'bg-red-900/30 text-red-300 border-red-700';
        if (!isActive(mid) && isMarkedAdd(mid)) return 'bg-indigo-700 text-white border-indigo-600';
        return 'bg-slate-800 text-slate-200 border-slate-700 hover:bg-slate-700';
    };

    const hasPending = pendingAdds.size > 0 || pendingRemovals.size > 0;

    /* ---------- Render ---------- */

    if (loading) {
        return (
            <div className="p-6 space-y-4">
                <div className="h-8 w-64 bg-slate-800 animate-pulse rounded" />
                <div className="grid md:grid-cols-2 gap-4">
                    <div className="h-60 bg-slate-800 animate-pulse rounded" />
                    <div className="h-60 bg-slate-800 animate-pulse rounded" />
                </div>
            </div>
        );
    }
    if (pageError || !company) {
        return (
            <div className="p-6 text-slate-300">
                {pageError || 'Entreprise introuvable.'}
                <div>
                    <button onClick={() => navigate(-1)} className="mt-3 text-sm px-3 py-1.5 rounded bg-slate-800 border border-slate-700">
                        ← Retour
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="p-6 space-y-4">
            {/* Header */}
            <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2 text-slate-100">
                    <Building2 size={18} className="text-indigo-300" />
                    <span className="font-semibold">{company.name}</span>
                    <span className="text-xs text-slate-500">#{company.id}</span>
                </div>
                <div className="flex items-center gap-2">
                    <button onClick={fetchDetails} className="inline-flex items-center gap-2 rounded-md border border-slate-700 bg-slate-900/60 px-3 py-1.5 text-sm hover:bg-slate-800" title="Rafraîchir">
                        <RefreshCcw size={14} /> Rafraîchir
                    </button>
                    <button
                        onClick={onDeleteCompany}
                        className="inline-flex items-center gap-2 rounded-md border border-rose-700/60 bg-rose-900/30 px-3 py-1.5 text-sm text-rose-200 hover:bg-rose-900/50"
                        title="Supprimer l’entreprise"
                    >
                        <Trash2 size={14} /> Supprimer
                    </button>
                </div>
            </div>

            {/* Identité + clés */}
            <div className="grid xl:grid-cols-2 gap-4">
                <div className="rounded-xl bg-slate-800/60 border border-slate-700 p-4 shadow-md">
                    <div className="text-slate-300 text-sm mb-2">Nom de l’entreprise</div>
                    <div className="flex gap-2">
                        <input
                            value={editedName}
                            onChange={(e) => setEditedName(e.target.value)}
                            className="flex-1 rounded-md border border-slate-700 bg-slate-900/60 px-3 py-2 text-sm text-slate-200 outline-none focus:ring-1 focus:ring-indigo-500"
                        />
                        <button
                            disabled={editedName === company.name}
                            onClick={onSaveName}
                            className="inline-flex items-center gap-2 rounded-md border border-slate-700 bg-indigo-600 px-3 py-2 text-sm text-white disabled:opacity-60"
                        >
                            <Save size={14} /> Sauver
                        </button>
                    </div>
                </div>

                <div className="rounded-xl bg-slate-800/60 border border-slate-700 p-4 shadow-md">
                    <div className="grid md:grid-cols-2 gap-3">
                        <div>
                            <div className="text-slate-300 text-sm mb-2">Clé API</div>
                            <div className="flex gap-2">
                                <input readOnly value={company.apiKey || '—'} className="flex-1 rounded-md border border-slate-700 bg-slate-900/60 px-3 py-2 text-sm text-slate-200" />
                                <button disabled={regenLoading.api} onClick={onRegenApiKey} className="inline-flex items-center gap-2 rounded-md border border-slate-700 bg-slate-900/60 px-3 py-2 text-sm hover:bg-slate-800">
                                    <KeySquare size={14} /> Régénérer
                                </button>
                            </div>
                        </div>
                        <div>
                            <div className="text-slate-300 text-sm mb-2">Clé Onboarding</div>
                            <div className="flex gap-2">
                                <input readOnly value={company.onboardingKey || '—'} className="flex-1 rounded-md border border-slate-700 bg-slate-900/60 px-3 py-2 text-sm text-slate-200" />
                                <button disabled={regenLoading.onboard} onClick={onRegenOnboarding} className="inline-flex items-center gap-2 rounded-md border border-slate-700 bg-slate-900/60 px-3 py-2 text-sm hover:bg-slate-800">
                                    <KeySquare size={14} /> Régénérer
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* ======= MODULES TAG UI ======= */}
            <Section
                title="Modules de l’entreprise"
                icon={Puzzle}
                right={
                    <div className="flex items-center gap-2">
                        <div className="relative">
                            <Search size={14} className="absolute left-2 top-2.5 text-slate-500" />
                            <input
                                placeholder="Rechercher un module…"
                                value={moduleSearch}
                                onChange={(e) => setModuleSearch(e.target.value)}
                                className="pl-7 rounded-md border border-slate-700 bg-slate-900/60 px-3 py-2 text-sm text-slate-200 outline-none focus:ring-1 focus:ring-indigo-500"
                            />
                        </div>
                    </div>
                }
            >
                {/* Légende */}
                <div className="flex flex-wrap gap-3 text-xs text-slate-400 mb-3">
          <span className="inline-flex items-center gap-2">
            <span className="inline-block w-3 h-3 rounded bg-emerald-600 border border-emerald-500" /> Actif
          </span>
                    <span className="inline-flex items-center gap-2">
            <span className="inline-block w-3 h-3 rounded bg-red-900/30 border border-red-700" /> Retrait en attente
          </span>
                    <span className="inline-flex items-center gap-2">
            <span className="inline-block w-3 h-3 rounded bg-indigo-600 border border-indigo-500" /> Ajout en attente
          </span>
                    <span className="inline-flex items-center gap-2">
            <span className="inline-block w-3 h-3 rounded bg-slate-700 border border-slate-600" /> Disponible
          </span>
                </div>

                {/* Tags */}
                <div className="rounded-lg border border-slate-700 p-2">
                    {modulesLoading ? (
                        <div className="h-24 bg-slate-800 animate-pulse rounded" />
                    ) : (
                        <div className="flex flex-wrap gap-2">
                            {filteredModules.map((m) => (
                                <button
                                    key={m.id}
                                    onClick={() => toggleModule(m.id)}
                                    className={`px-3 py-1.5 text-xs rounded-full border focus:outline-none ${tagClass(m)}`}
                                    title={m.description || ''}
                                >
                                    {m.name || `Module #${m.id}`}
                                </button>
                            ))}
                            {!filteredModules.length && (
                                <div className="text-sm text-slate-400">Aucun module.</div>
                            )}
                        </div>
                    )}
                </div>

                {/* Barre d'action */}
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mt-3 gap-2">
                    <div className="text-xs text-slate-400">
                        {hasPending ? (
                            <>
                                <span className="mr-3">Ajouts: <span className="text-indigo-300 font-medium">{pendingAdds.size}</span></span>
                                <span>Retraits: <span className="text-rose-300 font-medium">{pendingRemovals.size}</span></span>
                            </>
                        ) : (
                            <span>Aucune modification en attente.</span>
                        )}
                    </div>
                    <div className="flex items-center gap-2">
                        <button
                            onClick={cancelModuleChanges}
                            disabled={!hasPending || moduleSaving}
                            className="px-3 py-1.5 text-sm rounded border border-slate-700 bg-slate-900/60 disabled:opacity-50"
                        >
                            Annuler
                        </button>
                        <button
                            onClick={applyModuleChanges}
                            disabled={!hasPending || moduleSaving}
                            className="px-3 py-1.5 text-sm rounded bg-indigo-600 text-white disabled:opacity-50"
                        >
                            {moduleSaving ? 'Validation…' : 'Valider les modifications'}
                        </button>
                    </div>
                </div>
            </Section>

            {/* FULL */}
            <Section title="FULL (COMPANY.*) — recherche & gestion" icon={Shield}>
                <FullUsersPanel companyId={company.id} />
            </Section>

            {/* Discussions */}
            <Section title="Discussions" icon={MessageSquare}>
                <ConversationsPanel companyId={company.id} />
            </Section>

            {/* Transactions + Graph */}
            <Section
                title="Transactions & Graphique"
                icon={Activity}
                right={
                    <div className="hidden sm:flex items-center gap-2 text-xs text-slate-400">
                        <span>Période:</span>
                        <input
                            type="date"
                            value={filters.startDate.slice(0,10)}
                            onChange={(e) => setFilters((f) => ({ ...f, startDate: e.target.value ? new Date(e.target.value).toISOString() : '' }))}
                            className="rounded-md border border-slate-700 bg-slate-900/60 px-2 py-1"
                        />
                        <input
                            type="date"
                            value={filters.endDate.slice(0,10)}
                            onChange={(e) => setFilters((f) => ({ ...f, endDate: e.target.value ? new Date(e.target.value).toISOString() : '' }))}
                            className="rounded-md border border-slate-700 bg-slate-900/60 px-2 py-1"
                        />
                    </div>
                }
            >
                <div className="rounded-lg border border-slate-700 bg-slate-900/40 p-3 mb-4">
                    {transactionsForChart.length === 0 ? (
                        <p className="text-sm text-slate-400">Aucune transaction sur la période.</p>
                    ) : (
                        <Suspense fallback={<div className="h-48 bg-slate-800 animate-pulse rounded" />}>
                            <TransactionCharts transactions={transactionsForChart} />
                        </Suspense>
                    )}
                </div>

                <div className="flex items-center gap-2 mb-3">
                    <input
                        type="text"
                        value={txQuery}
                        onChange={(e) => { setTxQuery(e.target.value); txPage.goTo(1); }}
                        placeholder="Recherche: raison, utilisateur..."
                        className="w-full rounded-md border border-slate-700 bg-slate-900/60 px-3 py-2 text-sm text-slate-200 outline-none focus:ring-1 focus:ring-indigo-500"
                    />
                </div>
                <div className="overflow-auto">
                    <table className="min-w-full text-sm">
                        <thead>
                        <tr className="text-slate-300">
                            <th className="text-left py-2 pr-3">Date</th>
                            <th className="text-left py-2 pr-3">Utilisateur</th>
                            <th className="text-left py-2 pr-3">Raison</th>
                            <th className="text-right py-2">Montant</th>
                        </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-700">
                        {txPage.slice.map((t) => (
                            <tr key={t.id} className="hover:bg-slate-800/60">
                                <td className="py-2 pr-3">{new Date(t.createdAt || t.date).toLocaleString('fr-FR')}</td>
                                <td className="py-2 pr-3">{t.user?.name || '—'}</td>
                                <td className="py-2 pr-3">{t.reason || t.description || '—'}</td>
                                <td className="py-2 text-right font-medium">{formatUSD(t.amount)}</td>
                            </tr>
                        ))}
                        </tbody>
                    </table>
                </div>
                <Pagination
                    className="mt-3"
                    page={txPage.page}
                    totalPages={txPage.totalPages}
                    totalItems={txPage.totalItems}
                    pageSize={txPage.pageSize}
                    onPageChange={txPage.goTo}
                    onPageSizeChange={txPage.setPageSize}
                />
            </Section>

            {/* Factures (liste company) */}
            <Section title="Factures" icon={FileText}>
                <div className="flex items-center gap-2 mb-3">
                    <input
                        type="text"
                        value={billQuery}
                        onChange={(e) => { setBillQuery(e.target.value); billsPage.goTo(1); }}
                        placeholder="Recherche: raison, payer, receveur..."
                        className="w-full rounded-md border border-slate-700 bg-slate-900/60 px-3 py-2 text-sm text-slate-200 outline-none focus:ring-1 focus:ring-indigo-500"
                    />
                </div>
                {billsPage.totalItems === 0 ? (
                    <p className="text-sm text-slate-400">Aucune facture.</p>
                ) : (
                    <>
                        <div className="overflow-auto">
                            <table className="min-w-full text-sm">
                                <thead>
                                <tr className="text-slate-300">
                                    <th className="text-left py-2 pr-3">Date</th>
                                    <th className="text-left py-2 pr-3">Raison</th>
                                    <th className="text-left py-2 pr-3">Payer</th>
                                    <th className="text-left py-2 pr-3">Receveur</th>
                                    <th className="text-right py-2">Montant</th>
                                </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-700">
                                {billsPage.slice.map((b) => (
                                    <tr key={b.id} className="hover:bg-slate-800/60">
                                        <td className="py-2 pr-3">{new Date(b.date).toLocaleString('fr-FR')}</td>
                                        <td className="py-2 pr-3">{b.reason || '—'}</td>
                                        <td className="py-2 pr-3">{b.payerName || '—'}</td>
                                        <td className="py-2 pr-3">{b.receiverName || '—'}</td>
                                        <td className="py-2 text-right font-medium">{formatUSD(b.amount)}</td>
                                    </tr>
                                ))}
                                </tbody>
                            </table>
                        </div>
                        <Pagination
                            className="mt-3"
                            page={billsPage.page}
                            totalPages={billsPage.totalPages}
                            totalItems={billsPage.totalItems}
                            pageSize={billsPage.pageSize}
                            onPageChange={billsPage.goTo}
                            onPageSizeChange={billsPage.setPageSize}
                        />
                    </>
                )}
            </Section>

            {/* Employés */}
            <Section title="Employés" icon={Users}>
                <div className="flex items-center gap-2 mb-3">
                    <input
                        type="text"
                        value={employeeQuery}
                        onChange={(e) => { setEmployeeQuery(e.target.value); employeesPage.goTo(1); }}
                        placeholder="Recherche: nom, rang..."
                        className="w-full rounded-md border border-slate-700 bg-slate-900/60 px-3 py-2 text-sm text-slate-200 outline-none focus:ring-1 focus:ring-indigo-500"
                    />
                </div>
                {employeesPage.totalItems === 0 ? (
                    <p className="text-sm text-slate-400">Aucun employé.</p>
                ) : (
                    <>
                        <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-2">
                            {employeesPage.slice.map((e) => (
                                <button
                                    key={e.id}
                                    onClick={() => setEmployeeModal({ open: true, employee: e })}
                                    className="text-left bg-slate-800/60 border border-slate-700 rounded-lg p-3 hover:bg-slate-800"
                                >
                                    <div className="font-semibold text-sm text-slate-100">{e.user?.name || '—'}</div>
                                    <div className="text-xs text-slate-400">Rang: {e.rank?.name || '—'}</div>
                                    <div className="text-xs text-slate-400">Téléphone: {e.user?.phoneNumber || '—'}</div>
                                </button>
                            ))}
                        </div>
                        <Pagination
                            className="mt-3"
                            page={employeesPage.page}
                            totalPages={employeesPage.totalPages}
                            totalItems={employeesPage.totalItems}
                            pageSize={employeesPage.pageSize}
                            onPageChange={employeesPage.goTo}
                            onPageSizeChange={employeesPage.setPageSize}
                        />
                    </>
                )}
            </Section>

            {/* Clients */}
            <Section title="Clients" icon={Users}>
                <div className="flex items-center gap-2 mb-3">
                    <input
                        type="text"
                        value={clientQuery}
                        onChange={(e) => { setClientQuery(e.target.value); clientsPage.goTo(1); }}
                        placeholder="Recherche: nom du client..."
                        className="w-full rounded-md border border-slate-700 bg-slate-900/60 px-3 py-2 text-sm text-slate-200 outline-none focus:ring-1 focus:ring-indigo-500"
                    />
                </div>
                {clientsPage.totalItems === 0 ? (
                    <p className="text-sm text-slate-400">Aucun client.</p>
                ) : (
                    <>
                        <ul className="text-sm space-y-1">
                            {clientsPage.slice.map((cl) => (
                                <li key={cl.id} className="bg-slate-800/60 border border-slate-700 rounded px-3 py-2 flex items-center justify-between">
                                    <span>{cl.name}</span>
                                    <span className="text-xs text-slate-500">
                    {cl.createdAt ? new Date(cl.createdAt).toLocaleDateString('fr-FR') : ''}
                  </span>
                                </li>
                            ))}
                        </ul>
                        <Pagination
                            className="mt-3"
                            page={clientsPage.page}
                            totalPages={clientsPage.totalPages}
                            totalItems={clientsPage.totalItems}
                            pageSize={clientsPage.pageSize}
                            onPageChange={clientsPage.goTo}
                            onPageSizeChange={clientsPage.setPageSize}
                        />
                    </>
                )}
            </Section>

            {/* Logs */}
            <Section title="Logs" icon={ListChecks}>
                {company.logs?.length ? (
                    <ul className="text-sm space-y-1">
                        {company.logs.slice(0, 200).map((lg) => (
                            <LogRow key={lg.id} log={lg} />
                        ))}
                    </ul>
                ) : (
                    <p className="text-sm text-slate-400">Aucun log.</p>
                )}
            </Section>

            {/* Modal employé */}
            <EmployeeAdminModal
                open={employeeModal.open}
                onClose={() => setEmployeeModal({ open: false, employee: null })}
                companyId={companyId}
                employee={employeeModal.employee}
                companyRanks={company?.ranks || []}
            />
        </div>
    );
}

/* Log row */
function LogRow({ log }) {
    const [open, setOpen] = useState(false);
    const pretty = useMemo(() => {
        try {
            if (typeof log.data === 'string') {
                try { return JSON.stringify(JSON.parse(log.data), null, 2); } catch { return log.data; }
            }
            return JSON.stringify(log.data ?? {}, null, 2);
        } catch { return String(log.data ?? ''); }
    }, [log.data]);

    return (
        <li className="bg-slate-800/60 border border-slate-700 rounded">
            <button onClick={() => setOpen(o => !o)} className="w-full px-3 py-2 flex items-center justify-between">
                <div className="text-slate-300">{log.category} — {log.logType}</div>
                <div className="text-xs text-slate-500">{new Date(log.createdAt).toLocaleString('fr-FR')}</div>
            </button>
            {open && (
                <div className="px-3 pb-3">
          <pre className="text-xs text-slate-300 bg-slate-900/80 border border-slate-700 rounded p-2 overflow-auto">
            {pretty}
          </pre>
                </div>
            )}
        </li>
    );
}
