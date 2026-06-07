// src/pages/admin/CompanyDetailsPage.jsx

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import {
    Activity,
    BadgeDollarSign,
    Building2,
    FileText,
    ListChecks,
    ScrollText,
    Settings2,
    Shield,
    Users,
    Plus,
    Trash2,
    Pencil,
    RefreshCcw,
    ArrowUp,
    ArrowDown,
    Star,
} from 'lucide-react';

import Modal from '@/components/Modal';
import Spinner from '@/components/ui/Spinner';
import Pagination from '@/components/ui/Pagination';
import { useConfirmation } from '@/contexts/ConfirmationContext';

import ManageContactsModal from '@/components/admin/company/ManageContactsModal';
import apiClient from '@/services/api';

import {
    getCompanyDetails,
    updateCompanyAdmin,
    updateCompanyAccountingPrice,
    setAccountingSuspension,

    getAllModules,
    assignCompanyModules,
    removeCompanyModule,

    listCompanyEmployees,
    resetEmployeeAccount,
    updateEmployeeUserProfile,
    updateEmployeeStatus,

    listCompanyBills,
    updateBillStatus,

    listCompanyTransactions,
    updateTransactionCategory,

    listCompanyClients,
    createCompanyClient,
    updateCompanyClient,
    deleteCompanyClient,

    listCompanyLogs,
    retryLog,

    listCompanyRanks,
    createCompanyRank,
    updateCompanyRank,
    deleteCompanyRank,

    updateCompanyRankOrder,

    listPermissionTemplates,

    listBillableContacts,

    removeBillableContact,

    setBillableContactPrio,
    regenerateOnboardingKey,
    regenerateApiKey,
    listCompanyFullUsers,
    listUsers,
    setCompanyFullAccess,
} from '@/services/adminService';

const formatUSD = (n) =>
    new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 2 })
        .format(Number.isFinite(+n) ? +n : 0);


const normalizePaged = (resp, fallbackPage = 1, fallbackPageSize = 10) => {
    const items = Array.isArray(resp?.items)
        ? resp.items
        : (Array.isArray(resp?.data) ? resp.data : (Array.isArray(resp) ? resp : []));

    const total = Number(resp?.total ?? resp?.pagination?.totalCount ?? resp?.pagination?.total ?? items.length ?? 0);
    const page = Number(resp?.page ?? resp?.pagination?.currentPage ?? fallbackPage);
    const pageSize = Number(resp?.pageSize ?? resp?.pagination?.pageSize ?? fallbackPageSize);
    const totalPages = Number(resp?.totalPages ?? resp?.pagination?.totalPages ?? Math.max(1, Math.ceil(total / Math.max(1, pageSize))));

    return { items, total, page, pageSize, totalPages };
};

const safeJsonStringify = (value) => {
    if (value === null || value === undefined) return '';

    if (typeof value === 'string') {
        const s = value.trim();
        if (!s) return '';
        try {
            return JSON.stringify(JSON.parse(s), null, 2);
        } catch {
            return value;
        }
    }

    try {
        return JSON.stringify(value, null, 2);
    } catch {
        return String(value);
    }
};

const safeJsonParse = (text) => {
    const s = String(text ?? '').trim();
    if (!s) return null;
    return JSON.parse(s);
};


function TabButton({ active, icon: Icon, label, onClick }) {
    return (
        <button
            type="button"
            onClick={onClick}
            className={[
                'shrink-0 inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm',
                active
                    ? 'border-indigo-500 bg-indigo-600 text-white'
                    : 'border-slate-700 bg-slate-900/40 text-slate-200 hover:bg-slate-800',
            ].join(' ')}
        >
            {Icon ? <Icon size={16} /> : null}
            <span>{label}</span>
        </button>
    );
}

function Card({ title, right = null, children }) {
    return (
        <div className="rounded-xl bg-slate-800/60 border border-slate-700 shadow-md">
            <div className="px-4 py-3 border-b border-slate-700 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div className="text-slate-100 font-semibold">{title}</div>
                {right}
            </div>
            <div className="p-4">{children}</div>
        </div>
    );
}

function Field({ label, children }) {
    return (
        <div>
            <div className="text-xs text-slate-400 mb-1">{label}</div>
            <div className="text-sm text-slate-100">{children}</div>
        </div>
    );
}

function Table({ children }) {
    return (
        <div className="overflow-x-auto -mx-2 px-2">
            <div className="min-w-[700px]">{children}</div>
        </div>
    );
}

function StatusPill({ value }) {
    const v = String(value || '').toUpperCase();
    const cls =
        v === 'ACTIVE' ? 'bg-emerald-500/20 text-emerald-200 border-emerald-500/30' :
            v === 'PENDING_LINK' ? 'bg-amber-500/20 text-amber-200 border-amber-500/30' :
                v === 'FIRE' ? 'bg-red-500/20 text-red-200 border-red-500/30' :
                    v === 'RESIGNED' ? 'bg-slate-500/20 text-slate-200 border-slate-500/30' :
                        'bg-slate-500/20 text-slate-200 border-slate-500/30';

    const label =
        v === 'ACTIVE' ? 'Active' :
            v === 'PENDING_LINK' ? 'Pending' :
                v === 'FIRE' ? 'Fired' :
                    v === 'RESIGNED' ? 'Resigned' : v;

    return (
        <span className={`inline-flex items-center px-2 py-0.5 text-xs rounded border ${cls}`}>{label}</span>
    );
}

function EmployeeEditModal({ open, onClose, companyId, employee, onSaved }) {
    const { confirmAction } = useConfirmation();

    const [saving, setSaving] = useState(false);
    const [form, setForm] = useState({
        name: '',
        discordId: '',
        characterId: '',
        phoneNumber: '',
        iban: '',
        status: 'ACTIVE',
    });

    useEffect(() => {
        if (!open || !employee) return;
        setForm({
            name: employee?.user?.name || '',
            discordId: employee?.user?.discordId || '',
            characterId: employee?.user?.characterId != null ? String(employee.user.characterId) : '',
            phoneNumber: employee?.user?.phoneNumber || '',
            iban: employee?.user?.iban || '',
            status: employee?.status || 'ACTIVE',
        });
    }, [open, employee]);

    const resetAccount = () => {
        confirmAction({
            title: 'Reset compte employé',
            message: "Cette action va réinitialiser le compte (mot de passe / identifiants selon backend). Continuer ?",
            onConfirm: async () => {
                try {
                    setSaving(true);
                    await resetEmployeeAccount(companyId, employee.id);
                    toast.success('Compte réinitialisé.');
                } catch (e) {
                    toast.error(e?.message || 'Échec reset compte.');
                } finally {
                    setSaving(false);
                }
            },
        });
    };

    const save = async () => {
        if (!employee) return;
        try {
            setSaving(true);
            await updateEmployeeUserProfile(companyId, employee.id, {
                name: form.name,
                discordId: form.discordId || null,
                characterId: form.characterId ? Number(form.characterId) : null,
                phoneNumber: form.phoneNumber || null,
                iban: form.iban || null,
            });

            if (form.status && form.status !== employee.status) {
                await updateEmployeeStatus(companyId, employee.id, form.status);
            }

            toast.success('Employé mis à jour.');
            onSaved?.();
            onClose?.();
        } catch (e) {
            toast.error(e?.message || 'Échec mise à jour employé.');
        } finally {
            setSaving(false);
        }
    };

    if (!open || !employee) return null;

    return (
        <Modal isOpen={open} onClose={onClose} title={`Employé — ${employee?.user?.name || employee?.user?.username || employee?.id}`}>
            <div className="space-y-4">
                <div className="grid sm:grid-cols-2 gap-3">
                    <div>
                        <div className="text-xs text-slate-400 mb-1">Nom</div>
                        <input
                            value={form.name}
                            onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
                            className="w-full rounded-md border border-slate-700 bg-slate-900/60 px-3 py-2 text-sm text-slate-200"
                        />
                    </div>
                    <div>
                        <div className="text-xs text-slate-400 mb-1">Discord ID</div>
                        <input
                            value={form.discordId}
                            onChange={(e) => setForm((p) => ({ ...p, discordId: e.target.value }))}
                            className="w-full rounded-md border border-slate-700 bg-slate-900/60 px-3 py-2 text-sm text-slate-200"
                        />
                    </div>
                    <div>
                        <div className="text-xs text-slate-400 mb-1">Character ID</div>
                        <input
                            value={form.characterId}
                            onChange={(e) => setForm((p) => ({ ...p, characterId: e.target.value }))}
                            inputMode="numeric"
                            className="w-full rounded-md border border-slate-700 bg-slate-900/60 px-3 py-2 text-sm text-slate-200"
                        />
                    </div>
                    <div>
                        <div className="text-xs text-slate-400 mb-1">Téléphone</div>
                        <input
                            value={form.phoneNumber}
                            onChange={(e) => setForm((p) => ({ ...p, phoneNumber: e.target.value }))}
                            className="w-full rounded-md border border-slate-700 bg-slate-900/60 px-3 py-2 text-sm text-slate-200"
                        />
                    </div>
                    <div className="sm:col-span-2">
                        <div className="text-xs text-slate-400 mb-1">IBAN</div>
                        <input
                            value={form.iban}
                            onChange={(e) => setForm((p) => ({ ...p, iban: e.target.value }))}
                            className="w-full rounded-md border border-slate-700 bg-slate-900/60 px-3 py-2 text-sm text-slate-200"
                        />
                    </div>
                    <div className="sm:col-span-2">
                        <div className="text-xs text-slate-400 mb-1">Statut</div>
                        <select
                            value={form.status}
                            onChange={(e) => setForm((p) => ({ ...p, status: e.target.value }))}
                            className="w-full rounded-md border border-slate-700 bg-slate-900/60 px-3 py-2 text-sm text-slate-200"
                        >
                            <option value="PENDING_LINK">PENDING_LINK</option>
                            <option value="ACTIVE">ACTIVE</option>
                            <option value="FIRE">FIRE</option>
                            <option value="RESIGNED">RESIGNED</option>
                        </select>
                    </div>
                </div>

                <div className="flex flex-col sm:flex-row gap-2 sm:justify-between">
                    <button
                        type="button"
                        onClick={resetAccount}
                        disabled={saving}
                        className="px-4 py-2 rounded-md border border-slate-700 bg-slate-800 text-slate-200 hover:bg-slate-700 disabled:opacity-50"
                    >
                        Reset compte
                    </button>

                    <div className="flex gap-2 justify-end">
                        <button
                            type="button"
                            onClick={onClose}
                            disabled={saving}
                            className="px-4 py-2 rounded-md border border-slate-700 bg-slate-900/60 text-slate-200 hover:bg-slate-800 disabled:opacity-50"
                        >
                            Annuler
                        </button>
                        <button
                            type="button"
                            onClick={save}
                            disabled={saving}
                            className="px-4 py-2 rounded-md bg-indigo-600 text-white hover:bg-indigo-500 disabled:opacity-50"
                        >
                            {saving ? 'Sauvegarde…' : 'Sauvegarder'}
                        </button>
                    </div>
                </div>
            </div>
        </Modal>
    );
}

function ClientEditModal({ open, onClose, onSaved, initial, companyId }) {
    const { confirmAction } = useConfirmation();
    const [saving, setSaving] = useState(false);
    const [form, setForm] = useState({
        name: '',
        phoneNumber: '',
        address: '',
        cni: '',
        iban: '',
    });

    useEffect(() => {
        if (!open) return;
        setForm({
            name: initial?.name || '',
            phoneNumber: initial?.phoneNumber || '',
            address: initial?.address || '',
            cni: initial?.cni || '',
            iban: initial?.iban || '',
        });
    }, [open, initial]);

    const isEdit = !!initial?.id;

    const save = async () => {
        try {
            setSaving(true);
            if (isEdit) {
                await updateCompanyClient(companyId, initial.id, form);
            } else {
                await createCompanyClient(companyId, form);
            }
            toast.success(isEdit ? 'Client mis à jour.' : 'Client créé.');
            onSaved?.();
            onClose?.();
        } catch (e) {
            toast.error(e?.message || 'Échec sauvegarde client.');
        } finally {
            setSaving(false);
        }
    };

    const remove = () => {
        if (!isEdit) return;
        confirmAction({
            title: 'Supprimer client',
            message: 'Supprimer ce client ? Cette action est irréversible.',
            onConfirm: async () => {
                try {
                    setSaving(true);
                    await deleteCompanyClient(companyId, initial.id);
                    toast.success('Client supprimé.');
                    onSaved?.();
                    onClose?.();
                } catch (e) {
                    toast.error(e?.message || 'Échec suppression client.');
                } finally {
                    setSaving(false);
                }
            },
        });
    };

    if (!open) return null;

    return (
        <Modal isOpen={open} onClose={onClose} title={isEdit ? 'Modifier client' : 'Nouveau client'}>
            <div className="space-y-4">
                <div className="grid sm:grid-cols-2 gap-3">
                    <div className="sm:col-span-2">
                        <div className="text-xs text-slate-400 mb-1">Nom</div>
                        <input
                            value={form.name}
                            onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
                            className="w-full rounded-md border border-slate-700 bg-slate-900/60 px-3 py-2 text-sm text-slate-200"
                        />
                    </div>
                    <div>
                        <div className="text-xs text-slate-400 mb-1">Téléphone</div>
                        <input
                            value={form.phoneNumber}
                            onChange={(e) => setForm((p) => ({ ...p, phoneNumber: e.target.value }))}
                            className="w-full rounded-md border border-slate-700 bg-slate-900/60 px-3 py-2 text-sm text-slate-200"
                        />
                    </div>
                    <div>
                        <div className="text-xs text-slate-400 mb-1">CNI</div>
                        <input
                            value={form.cni}
                            onChange={(e) => setForm((p) => ({ ...p, cni: e.target.value }))}
                            className="w-full rounded-md border border-slate-700 bg-slate-900/60 px-3 py-2 text-sm text-slate-200"
                        />
                    </div>
                    <div className="sm:col-span-2">
                        <div className="text-xs text-slate-400 mb-1">Adresse</div>
                        <input
                            value={form.address}
                            onChange={(e) => setForm((p) => ({ ...p, address: e.target.value }))}
                            className="w-full rounded-md border border-slate-700 bg-slate-900/60 px-3 py-2 text-sm text-slate-200"
                        />
                    </div>
                    <div className="sm:col-span-2">
                        <div className="text-xs text-slate-400 mb-1">IBAN</div>
                        <input
                            value={form.iban}
                            onChange={(e) => setForm((p) => ({ ...p, iban: e.target.value }))}
                            className="w-full rounded-md border border-slate-700 bg-slate-900/60 px-3 py-2 text-sm text-slate-200"
                        />
                    </div>
                </div>

                <div className="flex flex-col sm:flex-row gap-2 sm:justify-between">
                    {isEdit ? (
                        <button
                            type="button"
                            onClick={remove}
                            disabled={saving}
                            className="px-4 py-2 rounded-md border border-red-500/30 bg-red-500/10 text-red-200 hover:bg-red-500/20 disabled:opacity-50"
                        >
                            Supprimer
                        </button>
                    ) : <div />}

                    <div className="flex gap-2 justify-end">
                        <button
                            type="button"
                            onClick={onClose}
                            disabled={saving}
                            className="px-4 py-2 rounded-md border border-slate-700 bg-slate-900/60 text-slate-200 hover:bg-slate-800 disabled:opacity-50"
                        >
                            Annuler
                        </button>
                        <button
                            type="button"
                            onClick={save}
                            disabled={saving || !form.name.trim()}
                            className="px-4 py-2 rounded-md bg-indigo-600 text-white hover:bg-indigo-500 disabled:opacity-50"
                        >
                            {saving ? 'Sauvegarde…' : 'Sauvegarder'}
                        </button>
                    </div>
                </div>
            </div>
        </Modal>
    );
}

export default function CompanyDetailsPage() {
    const { companyId } = useParams();
    const navigate = useNavigate();
    const { confirmAction } = useConfirmation();

    const cId = Number(companyId);

    const [activeTab, setActiveTab] = useState('overview');

    const [company, setCompany] = useState(null);
    const [loadingCompany, setLoadingCompany] = useState(true);

    const [isContactsOpen, setIsContactsOpen] = useState(false);

    // Settings (API + accounting)
    const [apiActive, setApiActive] = useState(true);
    const [apiReason, setApiReason] = useState('');
    const [accountingPrice, setAccountingPrice] = useState('');
    const [groupId, setGroupId] = useState('');
    const [suspensionInput, setSuspensionInput] = useState('');

    // Modules
    const [allModules, setAllModules] = useState([]);
    const [modulesLoading, setModulesLoading] = useState(false);
    const [selectedModuleId, setSelectedModuleId] = useState('');

    // Employees
    const [empQ, setEmpQ] = useState('');
    const [empPage, setEmpPage] = useState(1);
    const [empPageSize, setEmpPageSize] = useState(10);
    const [empData, setEmpData] = useState({ items: [], total: 0, page: 1, pageSize: 10, totalPages: 1 });
    const [empLoading, setEmpLoading] = useState(false);
    const [empEdit, setEmpEdit] = useState(null);

    // Bills
    const [billQ, setBillQ] = useState('');
    const [billPage, setBillPage] = useState(1);
    const [billPageSize, setBillPageSize] = useState(10);
    const [billData, setBillData] = useState({ items: [], total: 0, page: 1, pageSize: 10, totalPages: 1 });
    const [billLoading, setBillLoading] = useState(false);

    // Transactions
    const [txQ, setTxQ] = useState('');
    const [txPage, setTxPage] = useState(1);
    const [txPageSize, setTxPageSize] = useState(10);
    const [txData, setTxData] = useState({ items: [], total: 0, page: 1, pageSize: 10, totalPages: 1 });
    const [txLoading, setTxLoading] = useState(false);
    const [txCategoriesCache, setTxCategoriesCache] = useState([]);

    // Clients
    const [clientQ, setClientQ] = useState('');
    const [clientPage, setClientPage] = useState(1);
    const [clientPageSize, setClientPageSize] = useState(10);
    const [clientData, setClientData] = useState({ items: [], total: 0, page: 1, pageSize: 10, totalPages: 1 });
    const [clientLoading, setClientLoading] = useState(false);
    const [clientEdit, setClientEdit] = useState(null);
    const [clientModalOpen, setClientModalOpen] = useState(false);

    // Logs
    const [logQ, setLogQ] = useState('');
    const [logCategory, setLogCategory] = useState('');
    const [logType, setLogType] = useState('');
    const [logPage, setLogPage] = useState(1);
    const [logPageSize, setLogPageSize] = useState(10);
    const [logData, setLogData] = useState({ items: [], total: 0, page: 1, pageSize: 10, totalPages: 1 });
    const [logLoading, setLogLoading] = useState(false);
    const [logView, setLogView] = useState(null);
    const [retryingLogId, setRetryingLogId] = useState(null);

    // Ranks
    const [ranks, setRanks] = useState([]);
    const [ranksLoading, setRanksLoading] = useState(false);
    const [newRankName, setNewRankName] = useState('');

    const [rankEdit, setRankEdit] = useState(null);
    const [rankForm, setRankForm] = useState({
        name: '',
        position: '',
        salaryCap: '',
        groupRankId: '',
        remunerationJson: '',
        permissionTemplateIds: [],
    });

    const [permissionTemplates, setPermissionTemplates] = useState([]);
    const [permLoading, setPermLoading] = useState(false);

    // Billable contacts
    const [billableContacts, setBillableContacts] = useState([]);
    const [billableLoading, setBillableLoading] = useState(false);

    // Full access (COMPANY.{companyId}.*)
    const [fullUsers, setFullUsers] = useState([]);
    const [fullUsersLoading, setFullUsersLoading] = useState(false);
    const [fullUserSearch, setFullUserSearch] = useState('');
    const [availableUsers, setAvailableUsers] = useState([]);
    const [availableUsersLoading, setAvailableUsersLoading] = useState(false);
    const [selectedFullUserId, setSelectedFullUserId] = useState('');
    const [assigningFullUser, setAssigningFullUser] = useState(false);
    const [revokingUserId, setRevokingUserId] = useState(null);

    // Technical keys
    const [apiKeyValue, setApiKeyValue] = useState('');
    const [onboardingKeyValue, setOnboardingKeyValue] = useState('');
    const [savingApiKey, setSavingApiKey] = useState(false);
    const [savingOnboardingKey, setSavingOnboardingKey] = useState(false);
    const [regeneratingApiKey, setRegeneratingApiKey] = useState(false);
    const [regeneratingOnboardingKey, setRegeneratingOnboardingKey] = useState(false);

    const refreshCompany = useCallback(async () => {
        if (!Number.isFinite(cId)) return;
        setLoadingCompany(true);
        try {
            const data = await getCompanyDetails(cId);
            setCompany(data);
            setApiActive(data?.isApiActive ?? true);
            setApiReason(data?.apiDeactivationReason || '');
            setAccountingPrice(data?.accountingPrice != null ? String(data.accountingPrice) : '');
            setGroupId(data?.groupId != null ? String(data.groupId) : '');
            setSuspensionInput(data?.accountingSuspendedAt ? new Date(data.accountingSuspendedAt).toISOString().slice(0, 16) : '');
            setApiKeyValue(data?.apiKey ? String(data.apiKey) : '');
            setOnboardingKeyValue(data?.onboardingKey ? String(data.onboardingKey) : '');
        } catch (e) {
            toast.error(e?.message || "Impossible de charger l'entreprise.");
        } finally {
            setLoadingCompany(false);
        }
    }, [cId]);



    const ensurePermissionTemplatesLoaded = useCallback(async () => {
        if (permissionTemplates.length > 0) return;
        setPermLoading(true);
        try {
            const data = await listPermissionTemplates();
            setPermissionTemplates(Array.isArray(data) ? data : []);
        } catch (e) {
            toast.error(e?.message || 'Impossible de charger les permissions.');
            setPermissionTemplates([]);
        } finally {
            setPermLoading(false);
        }
    }, [permissionTemplates.length]);

    const fetchBillableContacts = useCallback(async () => {
        if (!Number.isFinite(cId)) return;
        setBillableLoading(true);
        try {
            const data = await listBillableContacts(cId);
            setBillableContacts(Array.isArray(data) ? data : []);
        } catch (e) {
            toast.error(e?.message || 'Impossible de charger les contacts facturables.');
            setBillableContacts([]);
        } finally {
            setBillableLoading(false);
        }
    }, [cId]);

    const companyFullPermissionAction = useMemo(() => `COMPANY.${cId}.*`, [cId]);

    const apiEndpoint = useMemo(() => {
        const origin = typeof window !== 'undefined' ? window.location.origin : '';
        const key = String(apiKeyValue || company?.apiKey || '{apiKey}');
        return `${origin}/api/ingest/${cId}/${key}`;
    }, [apiKeyValue, company?.apiKey, cId]);

    const onboardingEndpoint = useMemo(() => {
        const origin = typeof window !== 'undefined' ? window.location.origin : '';
        const key = encodeURIComponent(String(onboardingKeyValue || company?.onboardingKey || '{onboardingKey}'));
        return `${origin}/onboarding?onboardingKey=${key}&ig_character_id={ig_character_id}&ig_discord_id={ig_discord_id}`;
    }, [onboardingKeyValue, company?.onboardingKey]);

    const fetchFullUsers = useCallback(async () => {
        if (!Number.isFinite(cId)) return;
        setFullUsersLoading(true);
        try {
            const rows = await listCompanyFullUsers(cId);
            const nextRows = Array.isArray(rows) ? rows : [];
            const currentIds = new Set(nextRows.map((row) => Number(row.id)));

            setFullUsers(nextRows);
            setAvailableUsers((prev) => prev.filter((user) => !currentIds.has(Number(user.id))));
        } catch (e) {
            toast.error(e?.message || 'Impossible de charger les accès entreprise.');
            setFullUsers([]);
        } finally {
            setFullUsersLoading(false);
        }
    }, [cId]);

    const searchAvailableFullUsers = useCallback(async () => {
        const search = String(fullUserSearch || '').trim();
        if (!search) {
            setAvailableUsers([]);
            setSelectedFullUserId('');
            return;
        }

        setAvailableUsersLoading(true);
        try {
            const rows = await listUsers({ search });
            const currentIds = new Set((fullUsers || []).map((user) => Number(user.id)));
            const filtered = (Array.isArray(rows) ? rows : []).filter((user) => !currentIds.has(Number(user.id)));

            setAvailableUsers(filtered);
            if (filtered.length === 0) {
                setSelectedFullUserId('');
            } else if (!filtered.some((user) => String(user.id) === String(selectedFullUserId))) {
                setSelectedFullUserId(String(filtered[0].id));
            }
        } catch (e) {
            toast.error(e?.message || 'Impossible de rechercher les utilisateurs.');
            setAvailableUsers([]);
            setSelectedFullUserId('');
        } finally {
            setAvailableUsersLoading(false);
        }
    }, [fullUserSearch, fullUsers, selectedFullUserId]);

    const assignFullUser = async () => {
        if (!selectedFullUserId) return;

        try {
            setAssigningFullUser(true);
            await setCompanyFullAccess(cId, Number(selectedFullUserId), true);
            toast.success('Accès entreprise ajouté.');
            await fetchFullUsers();
            setFullUserSearch('');
            setAvailableUsers([]);
            setSelectedFullUserId('');
        } catch (e) {
            toast.error(e?.message || "Impossible d'ajouter l'acces entreprise.");
        } finally {
            setAssigningFullUser(false);
        }
    };

    const revokeFullUser = (user) => {
        if (!user?.id) return;

        confirmAction({
            title: 'Retirer accès entreprise',
            message: `Retirer ${user?.name || user?.username || 'cet utilisateur'} de ${companyFullPermissionAction} ?`,
            onConfirm: async () => {
                try {
                    setRevokingUserId(Number(user.id));
                    await setCompanyFullAccess(cId, Number(user.id), false);
                    toast.success('Accès entreprise retiré.');
                    await fetchFullUsers();
                    if (fullUserSearch.trim()) {
                        await searchAvailableFullUsers();
                    }
                } catch (e) {
                    toast.error(e?.message || "Impossible de retirer l'acces entreprise.");
                } finally {
                    setRevokingUserId(null);
                }
            },
        });
    };

    const saveApiKeyValue = async () => {
        const key = String(apiKeyValue || '').trim();
        if (!key) {
            toast.error('API key requise.');
            return;
        }

        try {
            setSavingApiKey(true);
            await apiClient.patch(`/admin/companies/${cId}/api-key`, { key });
            toast.success('API key mise à jour.');
            await refreshCompany();
        } catch (e) {
            toast.error(e?.message || "Impossible de mettre a jour l'API key.");
        } finally {
            setSavingApiKey(false);
        }
    };

    const regenerateApiKeyValue = async () => {
        try {
            setRegeneratingApiKey(true);
            await regenerateApiKey(cId);
            toast.success('API key régénérée.');
            await refreshCompany();
        } catch (e) {
            toast.error(e?.message || "Impossible de regenerer l'API key.");
        } finally {
            setRegeneratingApiKey(false);
        }
    };

    const saveOnboardingKeyValue = async () => {
        const key = String(onboardingKeyValue || '').trim();
        if (!key) {
            toast.error('Clé onboarding requise.');
            return;
        }

        try {
            setSavingOnboardingKey(true);
            await apiClient.patch(`/admin/companies/${cId}/onboarding-key`, { key });
            toast.success('Clé onboarding mise à jour.');
            await refreshCompany();
        } catch (e) {
            toast.error(e?.message || 'Impossible de mettre à jour la clé onboarding.');
        } finally {
            setSavingOnboardingKey(false);
        }
    };

    const regenerateOnboardingKeyValue = async () => {
        try {
            setRegeneratingOnboardingKey(true);
            await regenerateOnboardingKey(cId);
            toast.success('Clé onboarding régénérée.');
            await refreshCompany();
        } catch (e) {
            toast.error(e?.message || 'Impossible de régénérer la clé onboarding.');
        } finally {
            setRegeneratingOnboardingKey(false);
        }
    };

    const moveRank = async (rankId, direction) => {
        const ids = (ranks || []).map((r) => r.id);
        const idx = ids.indexOf(rankId);
        const nextIdx = idx + direction;
        if (idx < 0 || nextIdx < 0 || nextIdx >= ids.length) return;

        const next = ids.slice();
        const tmp = next[idx];
        next[idx] = next[nextIdx];
        next[nextIdx] = tmp;

        try {
            await updateCompanyRankOrder(cId, next);
            toast.success('Ordre des rangs mis à jour.');
            await fetchRanks();
        } catch (e) {
            toast.error(e?.message || 'Échec réorganisation rangs.');
        }
    };

    const openRankConfig = (rank) => {
        setRankEdit(rank);
        setRankForm({
            name: rank?.name ?? '',
            position: rank?.position ?? '',
            salaryCap: rank?.salaryCap ?? '',
            groupRankId: rank?.groupRankId ?? '',
            remunerationJson: safeJsonStringify(rank?.remunerationConfig ?? {}),
            permissionTemplateIds: (rank?.permissionTemplates || []).map((p) => p.id),
        });
    };

    const closeRankConfig = () => {
        setRankEdit(null);
        setRankForm({
            name: '',
            position: '',
            salaryCap: '',
            groupRankId: '',
            remunerationJson: '',
            permissionTemplateIds: [],
        });
    };

    const toggleRankPermission = (permId) => {
        setRankForm((prev) => {
            const set = new Set(prev.permissionTemplateIds || []);
            if (set.has(permId)) set.delete(permId);
            else set.add(permId);
            return { ...prev, permissionTemplateIds: Array.from(set) };
        });
    };

    const saveRankConfig = async () => {
        if (!rankEdit?.id) return;
        const name = String(rankForm.name || '').trim();
        if (!name) {
            toast.error('Nom du rang requis.');
            return;
        }

        let remunerationConfig = {};
        try {
            const parsed = safeJsonParse(rankForm.remunerationJson || '{}');
            remunerationConfig = parsed ?? {};
        } catch {
            toast.error('Rémunération JSON invalide.');
            return;
        }

        const position = rankForm.position === '' ? null : Number(rankForm.position);
        if (position !== null && !Number.isFinite(position)) {
            toast.error('Position invalide.');
            return;
        }

        const salaryCap = rankForm.salaryCap === '' ? null : Number(rankForm.salaryCap);
        if (salaryCap !== null && !Number.isFinite(salaryCap)) {
            toast.error('Salaire max invalide.');
            return;
        }

        const groupRankId = rankForm.groupRankId === '' ? null : Number(rankForm.groupRankId);
        if (groupRankId !== null && !Number.isFinite(groupRankId)) {
            toast.error('GroupRankId invalide.');
            return;
        }

        try {
            await updateCompanyRank(cId, rankEdit.id, {
                name,
                position,
                salaryCap,
                groupRankId,
                remunerationConfig,
                permissionTemplateIds: rankForm.permissionTemplateIds || [],
            });
            toast.success('Rang mis à jour.');
            closeRankConfig();
            await fetchRanks();
        } catch (e) {
            toast.error(e?.message || 'Échec mise à jour rang.');
        }
    };
    useEffect(() => { refreshCompany(); }, [refreshCompany]);

    // Garde via ref (et non [allModules.length]) : sinon le chargement des
    // modules change l'identité du callback, ce qui relance le useEffect de
    // l'onglet "overview" et refait partir fetchFullUsers une 2e fois.
    const modulesLoadedRef = useRef(false);
    const ensureModulesLoaded = useCallback(async () => {
        if (modulesLoadedRef.current) return;
        modulesLoadedRef.current = true;
        setModulesLoading(true);
        try {
            const data = await getAllModules();
            setAllModules(Array.isArray(data) ? data : []);
        } catch (e) {
            modulesLoadedRef.current = false; // échec → autorise un nouvel essai
            toast.error(e?.message || 'Impossible de charger les modules.');
        } finally {
            setModulesLoading(false);
        }
    }, []);

    const fetchEmployees = useCallback(async () => {
        if (!Number.isFinite(cId)) return;
        setEmpLoading(true);
        try {
            const data = await listCompanyEmployees(cId, { page: empPage, pageSize: empPageSize, q: empQ });
            setEmpData(normalizePaged(data, empPage, empPageSize));
        } catch (e) {
            toast.error(e?.message || 'Impossible de charger les employés.');
        } finally {
            setEmpLoading(false);
        }
    }, [cId, empPage, empPageSize, empQ]);

    const fetchBills = useCallback(async () => {
        if (!Number.isFinite(cId)) return;
        setBillLoading(true);
        try {
            const data = await listCompanyBills(cId, { page: billPage, pageSize: billPageSize, q: billQ });
            setBillData(normalizePaged(data, billPage, billPageSize));
        } catch (e) {
            toast.error(e?.message || 'Impossible de charger les factures.');
        } finally {
            setBillLoading(false);
        }
    }, [cId, billPage, billPageSize, billQ]);

    const fetchTransactions = useCallback(async () => {
        if (!Number.isFinite(cId)) return;
        setTxLoading(true);
        try {
            const data = await listCompanyTransactions(cId, { page: txPage, pageSize: txPageSize, q: txQ });
            const paged = normalizePaged(data, txPage, txPageSize);
            setTxData(paged);

            // cache catégories observées
            const found = [];
            for (const t of paged.items || []) {
                if (t?.category?.id && t?.category?.name) {
                    found.push({ id: t.category.id, name: t.category.name, type: t.category.type });
                }
            }
            if (found.length) {
                setTxCategoriesCache((prev) => {
                    const map = new Map((prev || []).map((c) => [c.id, c]));
                    for (const f of found) map.set(f.id, f);
                    return Array.from(map.values()).sort((a, b) => String(a.name).localeCompare(String(b.name)));
                });
            }
        } catch (e) {
            toast.error(e?.message || 'Impossible de charger les transactions.');
        } finally {
            setTxLoading(false);
        }
    }, [cId, txPage, txPageSize, txQ]);

    const fetchClients = useCallback(async () => {
        if (!Number.isFinite(cId)) return;
        setClientLoading(true);
        try {
            const data = await listCompanyClients(cId, { page: clientPage, pageSize: clientPageSize, q: clientQ });
            setClientData(normalizePaged(data, clientPage, clientPageSize));
        } catch (e) {
            toast.error(e?.message || 'Impossible de charger les clients.');
        } finally {
            setClientLoading(false);
        }
    }, [cId, clientPage, clientPageSize, clientQ]);

    const fetchLogs = useCallback(async () => {
        if (!Number.isFinite(cId)) return;
        setLogLoading(true);
        try {
            const params = {
                page: logPage,
                pageSize: logPageSize,
                includeData: true,
            };
            if (logQ) params.q = logQ;
            if (logCategory) params.category = logCategory;
            if (logType) params.logType = logType;

            const data = await listCompanyLogs(cId, params);
            setLogData(normalizePaged(data, logPage, logPageSize));
        } catch (e) {
            toast.error(e?.message || 'Impossible de charger les logs.');
        } finally {
            setLogLoading(false);
        }
    }, [cId, logPage, logPageSize, logQ, logCategory, logType]);

    const handleRetryLog = async (logId) => {
        try {
            setRetryingLogId(logId);
            await retryLog(logId);
            toast.success('Log relancé avec succès.');
            fetchLogs();
        } catch (e) {
            toast.error(e?.message || 'Erreur lors de la relance du log.');
        } finally {
            setRetryingLogId(null);
        }
    };

    const fetchRanks = useCallback(async () => {
        if (!Number.isFinite(cId)) return;
        setRanksLoading(true);
        try {
            const data = await listCompanyRanks(cId);
            const rows = Array.isArray(data) ? data : [];
            rows.sort((a, b) => (a.position ?? 0) - (b.position ?? 0));
            setRanks(rows);
        } catch (e) {
            toast.error(e?.message || 'Impossible de charger les rangs.');
        } finally {
            setRanksLoading(false);
        }
    }, [cId]);

    useEffect(() => {
        if (activeTab === 'employees') fetchEmployees();
        if (activeTab === 'bills') fetchBills();
        if (activeTab === 'transactions') fetchTransactions();
        if (activeTab === 'clients') fetchClients();
        if (activeTab === 'logs') fetchLogs();
        if (activeTab === 'ranks') { fetchRanks(); ensurePermissionTemplatesLoaded(); }
        if (activeTab === 'contacts') fetchBillableContacts();
        if (activeTab === 'overview') {
            ensureModulesLoaded();
            fetchFullUsers();
        }
    }, [activeTab, fetchEmployees, fetchBills, fetchTransactions, fetchClients, fetchLogs, fetchRanks, ensurePermissionTemplatesLoaded, fetchBillableContacts, ensureModulesLoaded, fetchFullUsers]);

    const saveApiStatus = async () => {
        try {
            await updateCompanyAdmin(cId, {
                isApiActive: !!apiActive,
                apiDeactivationReason: apiActive ? null : (apiReason || null),
            });
            toast.success('Statut API mis à jour.');
            await refreshCompany();
        } catch (e) {
            toast.error(e?.message || 'Échec mise à jour API.');
        }
    };

    const saveAccountingPrice = async () => {
        try {
            const value = accountingPrice === '' ? null : Number(accountingPrice);
            await updateCompanyAccountingPrice(cId, value);
            toast.success('Prix compta mis à jour.');
            await refreshCompany();
        } catch (e) {
            toast.error(e?.message || 'Échec mise à jour prix compta.');
        }
    };

    const saveSuspension = async () => {
        try {
            const suspendedAt = suspensionInput ? new Date(suspensionInput).toISOString() : null;
            await setAccountingSuspension(cId, suspendedAt);
            toast.success(suspendedAt ? 'Suspension programmée.' : 'Suspension annulée.');
            await refreshCompany();
        } catch (e) {
            toast.error(e?.message || 'Échec mise à jour suspension.');
        }
    };

    const saveGroupId = async () => {
        try {
            const value = groupId === '' ? null : Number(groupId);
            await updateCompanyAdmin(cId, { groupId: value });
            toast.success('Group ID mis à jour.');
            await refreshCompany();
        } catch (e) {
            toast.error(e?.message || 'Échec mise à jour Group ID.');
        }
    };

    const addModule = async () => {
        if (!selectedModuleId) return;
        try {
            await assignCompanyModules(cId, [Number(selectedModuleId)]);
            toast.success('Module ajouté.');
            setSelectedModuleId('');
            await refreshCompany();
        } catch (e) {
            toast.error(e?.message || 'Échec ajout module.');
        }
    };

    const removeModule = async (moduleId) => {
        confirmAction({
            title: 'Retirer module',
            message: "Retirer ce module de l'entreprise ?"
            ,
            onConfirm: async () => {
                try {
                    await removeCompanyModule(cId, Number(moduleId));
                    toast.success('Module retiré.');
                    await refreshCompany();
                } catch (e) {
                    toast.error(e?.message || 'Échec retrait module.');
                }
            },
        });
    };

    const changeBillStatus = async (billId, nextStatus) => {
        try {
            await updateBillStatus(cId, billId, nextStatus);
            toast.success('Statut facture mis à jour.');
            await fetchBills();
        } catch (e) {
            toast.error(e?.message || 'Échec update statut facture.');
        }
    };

    const changeTxCategory = async (txId, nextCategoryId) => {
        try {
            await updateTransactionCategory(cId, txId, Number(nextCategoryId));
            toast.success('Catégorie transaction mise à jour.');
            await fetchTransactions();
        } catch (e) {
            toast.error(e?.message || 'Échec update catégorie transaction.');
        }
    };

    const createRank = async () => {
        const name = newRankName.trim();
        if (!name) return;
        try {
            await createCompanyRank(cId, { name });
            toast.success('Rang créé.');
            setNewRankName('');
            await fetchRanks();
        } catch (e) {
            toast.error(e?.message || 'Échec création rang.');
        }
    };


    const removeRank = async (rank) => {
        if (!rank?.id) return;
        confirmAction({
            title: 'Supprimer rang',
            message: "Supprimer ce rang ? (refuse si des employes l'utilisent)",
            onConfirm: async () => {
                try {
                    await deleteCompanyRank(cId, rank.id);
                    toast.success('Rang supprimé.');
                    await fetchRanks();
                } catch (e) {
                    toast.error(e?.message || 'Échec suppression rang.');
                }
            },
        });
    };

    const openNewClient = () => {
        setClientEdit(null);
        setClientModalOpen(true);
    };

    const openEditClient = (c) => {
        setClientEdit(c);
        setClientModalOpen(true);
    };

    const onClientSaved = async () => {
        await fetchClients();
    };

    const openLogData = (log) => {
        setLogView(log);
    };

    const companyName = company?.name || `Company #${companyId}`;

    const tabs = useMemo(() => ([
        { key: 'overview', label: 'Aperçu', icon: Building2 },
        { key: 'employees', label: 'Employés', icon: Users },
        { key: 'ranks', label: 'Rangs', icon: Shield },
        { key: 'bills', label: 'Factures', icon: FileText },
        { key: 'transactions', label: 'Transactions', icon: Activity },
        { key: 'clients', label: 'Clients', icon: ListChecks },
        { key: 'logs', label: 'Logs', icon: ScrollText },
        { key: 'contacts', label: 'Contacts', icon: Settings2 },
    ]), []);

    if (!Number.isFinite(cId)) {
        return (
            <div className="p-4 text-slate-200">
                ID entreprise invalide.
            </div>
        );
    }

    return (
        <div className="p-3 sm:p-6 space-y-4">
            <div className="flex items-start justify-between gap-3">
                <div>
                    <div className="text-xl sm:text-2xl font-semibold text-slate-100">{companyName}</div>
                    <div className="text-sm text-slate-400">ID: {companyId}</div>
                </div>
                <div className="flex gap-2">
                    <button
                        type="button"
                        onClick={() => navigate('/admin/companies')}
                        className="px-3 py-2 rounded-md border border-slate-700 bg-slate-900/60 text-slate-200 hover:bg-slate-800"
                    >
                        Retour
                    </button>
                    <button
                        type="button"
                        onClick={refreshCompany}
                        className="px-3 py-2 rounded-md bg-indigo-600 text-white hover:bg-indigo-500 inline-flex items-center gap-2"
                    >
                        <RefreshCcw size={16} />
                        Rafraîchir
                    </button>
                </div>
            </div>

            <div className="flex gap-2 overflow-x-auto pb-1">
                {tabs.map((t) => (
                    <TabButton
                        key={t.key}
                        active={activeTab === t.key}
                        icon={t.icon}
                        label={t.label}
                        onClick={() => setActiveTab(t.key)}
                    />
                ))}
            </div>

            {loadingCompany ? (
                <div className="rounded-xl bg-slate-800/60 border border-slate-700 p-6 flex justify-center">
                    <Spinner />
                </div>
            ) : null}

            {/* ------------------------- OVERVIEW ------------------------- */}
            {activeTab === 'overview' && (
                <div className="space-y-4">
                    <Card title="Résumé" right={<StatusPill value={company?.isApiActive ? 'ACTIVE' : 'FIRE'} />}>
                        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
                            <Field label="Employés">{company?.stats?.totalEmployees ?? company?._count?.employees ?? '—'}</Field>
                            <Field label="Clients">{company?.stats?.totalClients ?? company?._count?.clients ?? '—'}</Field>
                            <Field label="Factures">{company?.stats?.totalBills ?? company?._count?.bills ?? '—'}</Field>
                            <Field label="Transactions">{company?.stats?.totalTransactions ?? company?._count?.transactions ?? '—'}</Field>
                        </div>
                    </Card>

                    <Card title="Paramètres API / Comptabilité" right={<BadgeDollarSign size={18} className="text-indigo-300" />}>
                        <div className="grid lg:grid-cols-2 gap-4">
                            <div className="rounded-lg border border-slate-700 bg-slate-900/40 p-3 space-y-3">
                                <div className="text-sm font-medium text-slate-100">API</div>
                                <label className="flex items-center justify-between gap-3 rounded-md border border-slate-700 bg-slate-900/40 px-3 py-2">
                                    <span className="text-sm text-slate-200">Entreprise active (API)</span>
                                    <input
                                        type="checkbox"
                                        checked={!!apiActive}
                                        onChange={(e) => setApiActive(e.target.checked)}
                                    />
                                </label>
                                {!apiActive ? (
                                    <div>
                                        <div className="text-xs text-slate-400 mb-1">Raison de désactivation</div>
                                        <input
                                            value={apiReason}
                                            onChange={(e) => setApiReason(e.target.value)}
                                            className="w-full rounded-md border border-slate-700 bg-slate-900/60 px-3 py-2 text-sm text-slate-200"
                                        />
                                    </div>
                                ) : null}
                                <button
                                    type="button"
                                    onClick={saveApiStatus}
                                    className="px-4 py-2 rounded-md bg-indigo-600 text-white hover:bg-indigo-500"
                                >
                                    Sauvegarder
                                </button>
                            </div>

                            <div className="rounded-lg border border-slate-700 bg-slate-900/40 p-3 space-y-3">
                                <div className="text-sm font-medium text-slate-100">Prix compta (USD)</div>
                                <div className="text-xs text-slate-400">Actuel : {formatUSD(company?.accountingPrice)}</div>
                                <input
                                    value={accountingPrice}
                                    onChange={(e) => setAccountingPrice(e.target.value)}
                                    inputMode="decimal"
                                    className="w-full rounded-md border border-slate-700 bg-slate-900/60 px-3 py-2 text-sm text-slate-200"
                                    placeholder="Ex: 99.99"
                                />
                                <button
                                    type="button"
                                    onClick={saveAccountingPrice}
                                    className="px-4 py-2 rounded-md bg-indigo-600 text-white hover:bg-indigo-500"
                                >
                                    Sauvegarder
                                </button>
                            </div>

                            <div className={[
                                'rounded-lg border p-3 space-y-3',
                                company?.accountingSuspendedAt && new Date(company.accountingSuspendedAt) <= new Date()
                                    ? 'border-red-500/60 bg-red-900/20'
                                    : company?.accountingSuspendedAt
                                        ? 'border-amber-500/60 bg-amber-900/20'
                                        : 'border-slate-700 bg-slate-900/40',
                            ].join(' ')}>
                                <div className="text-sm font-medium text-slate-100">Suspension compta</div>
                                {company?.accountingSuspendedAt ? (
                                    <div className={[
                                        'text-xs font-medium',
                                        new Date(company.accountingSuspendedAt) <= new Date() ? 'text-red-400' : 'text-amber-400',
                                    ].join(' ')}>
                                        {new Date(company.accountingSuspendedAt) <= new Date()
                                            ? `⛔ Suspendue depuis le ${new Date(company.accountingSuspendedAt).toLocaleString('fr-FR')}`
                                            : `⏳ Suspension prévue le ${new Date(company.accountingSuspendedAt).toLocaleString('fr-FR')}`}
                                    </div>
                                ) : (
                                    <div className="text-xs text-slate-400">Aucune suspension programmée</div>
                                )}
                                <input
                                    type="datetime-local"
                                    value={suspensionInput}
                                    onChange={(e) => setSuspensionInput(e.target.value)}
                                    className="w-full rounded-md border border-slate-700 bg-slate-900/60 px-3 py-2 text-sm text-slate-200"
                                />
                                <div className="flex gap-2 flex-wrap">
                                    {suspensionInput && (
                                        <button
                                            type="button"
                                            onClick={saveSuspension}
                                            className="px-4 py-2 rounded-md bg-red-700 text-white hover:bg-red-600 text-sm"
                                        >
                                            Programmer la suspension
                                        </button>
                                    )}
                                    {company?.accountingSuspendedAt && (
                                        <button
                                            type="button"
                                            onClick={async () => {
                                                try {
                                                    await setAccountingSuspension(cId, null);
                                                    setSuspensionInput('');
                                                    toast.success('Suspension annulée.');
                                                    await refreshCompany();
                                                } catch (e) {
                                                    toast.error(e?.message || 'Echec annulation suspension.');
                                                }
                                            }}
                                            className="px-4 py-2 rounded-md bg-slate-600 text-white hover:bg-slate-500 text-sm"
                                        >
                                            Annuler la suspension
                                        </button>
                                    )}
                                </div>
                            </div>

                            <div className="rounded-lg border border-slate-700 bg-slate-900/40 p-3 space-y-3">
                                <div className="text-sm font-medium text-slate-100">Group ID (jeu)</div>
                                <div className="text-xs text-slate-400">Actuel : {company?.groupId ?? '—'}</div>
                                <input
                                    value={groupId}
                                    onChange={(e) => setGroupId(e.target.value)}
                                    inputMode="numeric"
                                    className="w-full rounded-md border border-slate-700 bg-slate-900/60 px-3 py-2 text-sm text-slate-200"
                                    placeholder="Ex: 42"
                                />
                                <button
                                    type="button"
                                    onClick={saveGroupId}
                                    className="px-4 py-2 rounded-md bg-indigo-600 text-white hover:bg-indigo-500"
                                >
                                    Sauvegarder
                                </button>
                            </div>
                        </div>
                    </Card>

                    <Card title="Clés techniques" right={<Shield size={18} className="text-indigo-300" />}>
                        <div className="grid lg:grid-cols-2 gap-4">
                            <div className="rounded-lg border border-slate-700 bg-slate-900/40 p-3 space-y-3">
                                <div className="text-sm font-medium text-slate-100">API key</div>
                                <div className="text-xs text-slate-400">
                                    Modifie la clé utilisée par l'endpoint d'ingest.
                                </div>
                                <input
                                    value={apiKeyValue}
                                    onChange={(e) => setApiKeyValue(e.target.value)}
                                    className="w-full rounded-md border border-slate-700 bg-slate-900/60 px-3 py-2 text-sm text-slate-200"
                                    placeholder="API key"
                                />
                                <div className="text-xs text-slate-500 break-all">
                                    Endpoint API : {apiEndpoint}
                                </div>
                                <div className="flex flex-wrap gap-2">
                                    <button
                                        type="button"
                                        onClick={saveApiKeyValue}
                                        disabled={savingApiKey || regeneratingApiKey || !apiKeyValue.trim()}
                                        className="px-4 py-2 rounded-md bg-indigo-600 text-white hover:bg-indigo-500 disabled:opacity-50"
                                    >
                                        {savingApiKey ? 'Sauvegarde…' : 'Sauvegarder'}
                                    </button>
                                    <button
                                        type="button"
                                        onClick={regenerateApiKeyValue}
                                        disabled={savingApiKey || regeneratingApiKey}
                                        className="px-4 py-2 rounded-md border border-slate-700 bg-slate-900/60 text-slate-200 hover:bg-slate-800 disabled:opacity-50"
                                    >
                                        {regeneratingApiKey ? 'Régénération…' : 'Régénérer'}
                                    </button>
                                </div>
                            </div>

                            <div className="rounded-lg border border-slate-700 bg-slate-900/40 p-3 space-y-3">
                                <div className="text-sm font-medium text-slate-100">Clé onboarding</div>
                                <div className="text-xs text-slate-400">
                                    Modifie la clé utilisée sur la page d'onboarding entreprise.
                                </div>
                                <input
                                    value={onboardingKeyValue}
                                    onChange={(e) => setOnboardingKeyValue(e.target.value)}
                                    className="w-full rounded-md border border-slate-700 bg-slate-900/60 px-3 py-2 text-sm text-slate-200"
                                    placeholder="Onboarding key"
                                />
                                <div className="text-xs text-slate-500 break-all">
                                    URL onboarding : {onboardingEndpoint}
                                </div>
                                <div className="flex flex-wrap gap-2">
                                    <button
                                        type="button"
                                        onClick={saveOnboardingKeyValue}
                                        disabled={savingOnboardingKey || regeneratingOnboardingKey || !onboardingKeyValue.trim()}
                                        className="px-4 py-2 rounded-md bg-indigo-600 text-white hover:bg-indigo-500 disabled:opacity-50"
                                    >
                                        {savingOnboardingKey ? 'Sauvegarde…' : 'Sauvegarder'}
                                    </button>
                                    <button
                                        type="button"
                                        onClick={regenerateOnboardingKeyValue}
                                        disabled={savingOnboardingKey || regeneratingOnboardingKey}
                                        className="px-4 py-2 rounded-md border border-slate-700 bg-slate-900/60 text-slate-200 hover:bg-slate-800 disabled:opacity-50"
                                    >
                                        {regeneratingOnboardingKey ? 'Régénération…' : 'Régénérer'}
                                    </button>
                                </div>
                            </div>
                        </div>
                    </Card>

                    <Card title="Accès entreprise" right={<Users size={18} className="text-indigo-300" />}>
                        <div className="space-y-4">
                            <div className="rounded-lg border border-slate-700 bg-slate-900/40 p-3 space-y-3">
                                <div className="text-sm font-medium text-slate-100">Permission directe</div>
                                <div className="text-xs text-slate-400 break-all">{companyFullPermissionAction}</div>

                                <div className="flex flex-col lg:flex-row gap-2">
                                    <input
                                        value={fullUserSearch}
                                        onChange={(e) => {
                                            setFullUserSearch(e.target.value);
                                            setSelectedFullUserId('');
                                            setAvailableUsers([]);
                                        }}
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter') {
                                                e.preventDefault();
                                                searchAvailableFullUsers();
                                            }
                                        }}
                                        className="flex-1 rounded-md border border-slate-700 bg-slate-900/60 px-3 py-2 text-sm text-slate-200"
                                        placeholder="Rechercher un user par nom ou username"
                                    />
                                    <button
                                        type="button"
                                        onClick={searchAvailableFullUsers}
                                        disabled={availableUsersLoading}
                                        className="px-4 py-2 rounded-md border border-slate-700 bg-slate-900/60 text-slate-200 hover:bg-slate-800 disabled:opacity-50"
                                    >
                                        {availableUsersLoading ? 'Recherche…' : 'Rechercher'}
                                    </button>
                                </div>

                                <div className="flex flex-col lg:flex-row gap-2">
                                    <select
                                        value={selectedFullUserId}
                                        onChange={(e) => setSelectedFullUserId(e.target.value)}
                                        className="flex-1 rounded-md border border-slate-700 bg-slate-900/60 px-3 py-2 text-sm text-slate-200"
                                    >
                                        <option value="">— Sélectionner un utilisateur —</option>
                                        {availableUsers.map((user) => (
                                            <option key={user.id} value={user.id}>
                                                {user.name || user.username || `User #${user.id}`}{user.username ? ` (@${user.username})` : ''}
                                            </option>
                                        ))}
                                    </select>
                                    <button
                                        type="button"
                                        onClick={assignFullUser}
                                        disabled={!selectedFullUserId || assigningFullUser}
                                        className="px-4 py-2 rounded-md bg-indigo-600 text-white hover:bg-indigo-500 disabled:opacity-50 inline-flex items-center gap-2"
                                    >
                                        <Plus size={16} />
                                        {assigningFullUser ? 'Ajout…' : 'Ajouter'}
                                    </button>
                                </div>

                                {fullUserSearch.trim() && !availableUsersLoading && availableUsers.length === 0 ? (
                                    <div className="text-xs text-slate-500">
                                        Aucun utilisateur disponible pour cette recherche.
                                    </div>
                                ) : null}
                            </div>

                            <div>
                                <div className="text-sm font-medium text-slate-100 mb-3">Utilisateurs autorisés</div>

                                {fullUsersLoading ? (
                                    <div className="py-8 flex justify-center"><Spinner /></div>
                                ) : fullUsers.length === 0 ? (
                                    <div className="text-sm text-slate-400">Aucun utilisateur avec accès direct.</div>
                                ) : (
                                    <div className="space-y-2">
                                        {fullUsers.map((user) => (
                                            <div
                                                key={user.id}
                                                className="rounded-lg border border-slate-700 bg-slate-900/40 p-3 flex flex-col sm:flex-row sm:items-center gap-2"
                                            >
                                                <div className="flex-1 min-w-0">
                                                    <div className="text-sm font-medium text-slate-100 truncate">
                                                        {user.name || user.username || `User #${user.id}`}
                                                    </div>
                                                    <div className="text-xs text-slate-400 truncate">
                                                        {user.username ? `@${user.username}` : `User #${user.id}`}
                                                    </div>
                                                </div>

                                                <button
                                                    type="button"
                                                    onClick={() => revokeFullUser(user)}
                                                    disabled={revokingUserId === Number(user.id)}
                                                    className="px-3 py-2 rounded-md border border-red-500/30 bg-red-500/10 text-red-200 hover:bg-red-500/20 disabled:opacity-50 inline-flex items-center gap-2"
                                                >
                                                    <Trash2 size={16} />
                                                    {revokingUserId === Number(user.id) ? 'Retrait…' : 'Retirer'}
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>
                    </Card>

                    <Card title="Modules actifs" right={modulesLoading ? <Spinner size="sm" /> : <Settings2 size={18} className="text-indigo-300" />}>
                        <div className="flex flex-col sm:flex-row gap-2 sm:items-center">
                            <select
                                value={selectedModuleId}
                                onChange={(e) => setSelectedModuleId(e.target.value)}
                                className="flex-1 rounded-md border border-slate-700 bg-slate-900/60 px-3 py-2 text-sm text-slate-200"
                            >
                                <option value="">— Ajouter un module —</option>
                                {allModules.map((m) => (
                                    <option key={m.id} value={m.id}>{m.name}</option>
                                ))}
                            </select>
                            <button
                                type="button"
                                onClick={addModule}
                                disabled={!selectedModuleId}
                                className="px-4 py-2 rounded-md bg-indigo-600 text-white hover:bg-indigo-500 disabled:opacity-50 inline-flex items-center gap-2"
                            >
                                <Plus size={16} />
                                Ajouter
                            </button>
                        </div>

                        <div className="mt-3 flex flex-wrap gap-2">
                            {(company?.activeModules || []).map((cm) => (
                                <span
                                    key={cm?.module?.id || cm?.moduleId}
                                    className="inline-flex items-center gap-2 rounded-full border border-slate-700 bg-slate-900/40 px-3 py-1 text-sm text-slate-200"
                                >
                                    {cm?.module?.name || `Module #${cm?.moduleId}`}
                                    <button
                                        type="button"
                                        onClick={() => removeModule(cm?.module?.id || cm?.moduleId)}
                                        className="text-red-300 hover:text-red-200"
                                        title="Retirer"
                                    >
                                        <Trash2 size={14} />
                                    </button>
                                </span>
                            ))}
                            {(company?.activeModules || []).length === 0 ? (
                                <div className="text-sm text-slate-400">Aucun module actif.</div>
                            ) : null}
                        </div>
                    </Card>
                </div>
            )}

            {/* ------------------------- EMPLOYEES ------------------------- */}
            {activeTab === 'employees' && (
                <Card
                    title="Employés"
                    right={(
                        <div className="flex gap-2 items-center">
                            <input
                                value={empQ}
                                onChange={(e) => { setEmpQ(e.target.value); setEmpPage(1); }}
                                className="w-56 max-w-[55vw] rounded-md border border-slate-700 bg-slate-900/60 px-3 py-2 text-sm text-slate-200"
                                placeholder="Rechercher…"
                            />
                            <button
                                type="button"
                                onClick={fetchEmployees}
                                className="px-3 py-2 rounded-md border border-slate-700 bg-slate-900/60 text-slate-200 hover:bg-slate-800"
                            >
                                <RefreshCcw size={16} />
                            </button>
                        </div>
                    )}
                >
                    {empLoading ? (
                        <div className="py-10 flex justify-center"><Spinner /></div>
                    ) : (
                        <>
                            <Table>
                                <table className="w-full text-sm">
                                    <thead className="text-slate-400">
                                    <tr className="border-b border-slate-700">
                                        <th className="text-left py-2">User</th>
                                        <th className="text-left py-2">Rang</th>
                                        <th className="text-left py-2">Statut</th>
                                        <th className="text-right py-2">Actions</th>
                                    </tr>
                                    </thead>
                                    <tbody className="text-slate-200">
                                    {(empData.items || []).map((e) => (
                                        <tr key={e.id} className="border-b border-slate-800">
                                            <td className="py-2">
                                                <div className="font-medium">{e.user?.name || '—'}</div>
                                                <div className="text-xs text-slate-400">@{e.user?.username || '—'}</div>
                                            </td>
                                            <td className="py-2">{e.rank?.name || '—'}</td>
                                            <td className="py-2"><StatusPill value={e.status} /></td>
                                            <td className="py-2 text-right">
                                                <button
                                                    type="button"
                                                    onClick={() => setEmpEdit(e)}
                                                    className="inline-flex items-center gap-2 px-3 py-1.5 rounded-md border border-slate-700 bg-slate-900/60 hover:bg-slate-800"
                                                >
                                                    <Pencil size={14} />
                                                    Modifier
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                    {(!empData.items || empData.items.length === 0) ? (
                                        <tr><td colSpan={4} className="py-6 text-center text-slate-400">Aucun employé</td></tr>
                                    ) : null}
                                    </tbody>
                                </table>
                            </Table>

                            <div className="mt-3">
                                <Pagination
                                    page={empData.page}
                                    totalPages={empData.totalPages}
                                    totalItems={empData.total}
                                    pageSize={empData.pageSize}
                                    onPageChange={setEmpPage}
                                    onPageSizeChange={(n) => { setEmpPageSize(n); setEmpPage(1); }}
                                />
                            </div>
                        </>
                    )}

                    <EmployeeEditModal
                        open={!!empEdit}
                        onClose={() => setEmpEdit(null)}
                        companyId={cId}
                        employee={empEdit}
                        onSaved={fetchEmployees}
                    />
                </Card>
            )}

            {/* ------------------------- RANKS ------------------------- */}
            {activeTab === 'ranks' && (
                <Card
                    title="Rangs"
                    right={(
                        <button
                            type="button"
                            onClick={() => { fetchRanks(); ensurePermissionTemplatesLoaded(); }}
                            className="px-3 py-2 rounded-md border border-slate-700 bg-slate-900/60 text-slate-200 hover:bg-slate-800"
                        >
                            <RefreshCcw size={16} />
                        </button>
                    )}
                >
                    <div className="flex flex-col sm:flex-row gap-2 sm:items-center">
                        <input
                            value={newRankName}
                            onChange={(e) => setNewRankName(e.target.value)}
                            className="flex-1 rounded-md border border-slate-700 bg-slate-900/60 px-3 py-2 text-sm text-slate-200"
                            placeholder="Nom du rang"
                        />
                        <button
                            type="button"
                            onClick={createRank}
                            disabled={!newRankName.trim()}
                            className="px-4 py-2 rounded-md bg-indigo-600 text-white hover:bg-indigo-500 disabled:opacity-50 inline-flex items-center gap-2"
                        >
                            <Plus size={16} />
                            Créer
                        </button>
                    </div>

                    {ranksLoading ? (
                        <div className="py-10 flex justify-center"><Spinner /></div>
                    ) : (
                        <div className="mt-3 space-y-2">
                            {ranks.map((r) => (
                                <div key={r.id} className="rounded-lg border border-slate-700 bg-slate-900/40 p-3 flex flex-col gap-3">
                                    <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                                        <div className="flex-1 min-w-0">
                                            <div className="text-sm font-medium text-slate-100 truncate">{r.name}</div>
                                            <div className="mt-1 flex flex-wrap gap-2 text-xs text-slate-400">
                                                <span className="inline-flex items-center rounded border border-slate-700 bg-slate-900/60 px-2 py-0.5">Pos: {r.position ?? '—'}</span>
                                                <span className="inline-flex items-center rounded border border-slate-700 bg-slate-900/60 px-2 py-0.5">Salaire max: {r.salaryCap != null ? formatUSD(r.salaryCap) : '—'}</span>
                                                <span className="inline-flex items-center rounded border border-slate-700 bg-slate-900/60 px-2 py-0.5">Permissions: {(r.permissionTemplates || []).length}</span>
                                            </div>
                                        </div>

                                        <div className="flex flex-wrap gap-2">
                                            <button
                                                type="button"
                                                onClick={() => moveRank(r.id, -1)}
                                                className="px-3 py-2 rounded-md border border-slate-700 bg-slate-900/60 text-slate-200 hover:bg-slate-800 inline-flex items-center gap-2"
                                                title="Monter"
                                            >
                                                <ArrowUp size={16} />
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => moveRank(r.id, +1)}
                                                className="px-3 py-2 rounded-md border border-slate-700 bg-slate-900/60 text-slate-200 hover:bg-slate-800 inline-flex items-center gap-2"
                                                title="Descendre"
                                            >
                                                <ArrowDown size={16} />
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => openRankConfig(r)}
                                                className="px-3 py-2 rounded-md border border-indigo-500/30 bg-indigo-500/10 text-indigo-200 hover:bg-indigo-500/20 inline-flex items-center gap-2"
                                            >
                                                <Pencil size={16} />
                                                Configurer
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => removeRank(r)}
                                                className="px-3 py-2 rounded-md border border-red-500/30 bg-red-500/10 text-red-200 hover:bg-red-500/20 inline-flex items-center gap-2"
                                            >
                                                <Trash2 size={16} />
                                                Supprimer
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            ))}
                            {ranks.length === 0 ? (
                                <div className="text-sm text-slate-400">Aucun rang.</div>
                            ) : null}
                        </div>
                    )}

                    <Modal isOpen={!!rankEdit} onClose={closeRankConfig} title={rankEdit ? `Configurer — ${rankEdit.name}` : 'Configurer rang'}>
                        <div className="space-y-4">
                            <div className="grid sm:grid-cols-2 gap-3">
                                <div>
                                    <div className="text-xs text-slate-400 mb-1">Nom</div>
                                    <input
                                        value={rankForm.name}
                                        onChange={(e) => setRankForm((p) => ({ ...p, name: e.target.value }))}
                                        className="w-full rounded-md border border-slate-700 bg-slate-900/60 px-3 py-2 text-sm text-slate-200"
                                    />
                                </div>
                                <div>
                                    <div className="text-xs text-slate-400 mb-1">Position</div>
                                    <input
                                        value={rankForm.position}
                                        onChange={(e) => setRankForm((p) => ({ ...p, position: e.target.value }))}
                                        inputMode="numeric"
                                        className="w-full rounded-md border border-slate-700 bg-slate-900/60 px-3 py-2 text-sm text-slate-200"
                                        placeholder="ex: 1"
                                    />
                                </div>
                                <div>
                                    <div className="text-xs text-slate-400 mb-1">Salaire max (USD)</div>
                                    <input
                                        value={rankForm.salaryCap}
                                        onChange={(e) => setRankForm((p) => ({ ...p, salaryCap: e.target.value }))}
                                        inputMode="decimal"
                                        className="w-full rounded-md border border-slate-700 bg-slate-900/60 px-3 py-2 text-sm text-slate-200"
                                        placeholder="ex: 2500"
                                    />
                                </div>
                                <div>
                                    <div className="text-xs text-slate-400 mb-1">GroupRankId (optionnel)</div>
                                    <input
                                        value={rankForm.groupRankId}
                                        onChange={(e) => setRankForm((p) => ({ ...p, groupRankId: e.target.value }))}
                                        inputMode="numeric"
                                        className="w-full rounded-md border border-slate-700 bg-slate-900/60 px-3 py-2 text-sm text-slate-200"
                                        placeholder="ex: 2"
                                    />
                                </div>
                            </div>

                            <div>
                                <div className="text-xs text-slate-400 mb-1">Rémunération (JSON)</div>
                                <textarea
                                    value={rankForm.remunerationJson}
                                    onChange={(e) => setRankForm((p) => ({ ...p, remunerationJson: e.target.value }))}
                                    className="w-full min-h-[160px] rounded-md border border-slate-700 bg-slate-900/60 px-3 py-2 text-xs text-slate-200 font-mono"
                                />
                            </div>

                            <div>
                                <div className="flex items-center justify-between gap-2">
                                    <div className="text-xs text-slate-400">Permissions</div>
                                    {permLoading ? <span className="text-xs text-slate-400">Chargement…</span> : null}
                                </div>
                                <div className="mt-2 max-h-[320px] overflow-y-auto rounded-md border border-slate-700 bg-slate-900/40 p-3">
                                    {(permissionTemplates || []).length === 0 ? (
                                        <div className="text-sm text-slate-400">Aucune permission.</div>
                                    ) : (
                                        <div className="space-y-3">
                                            {Object.entries(
                                                (permissionTemplates || []).reduce((acc, p) => {
                                                    const key = p?.module?.name || p?.module?.description || `Module #${p.moduleId}`;
                                                    acc[key] = acc[key] || [];
                                                    acc[key].push(p);
                                                    return acc;
                                                }, {})
                                            ).map(([moduleName, perms]) => (
                                                <div key={moduleName} className="rounded-md border border-slate-700 bg-slate-950/30">
                                                    <div className="px-3 py-2 border-b border-slate-700 text-sm text-slate-200 font-medium">{moduleName}</div>
                                                    <div className="p-3 grid sm:grid-cols-2 gap-2">
                                                        {perms
                                                            .slice()
                                                            .sort((a, b) => String(a.action).localeCompare(String(b.action)))
                                                            .map((p) => {
                                                                const checked = (rankForm.permissionTemplateIds || []).includes(p.id);
                                                                const label = p.action;
                                                                return (
                                                                    <label key={p.id} className="flex items-start gap-2 text-sm text-slate-200">
                                                                        <input
                                                                            type="checkbox"
                                                                            checked={checked}
                                                                            onChange={() => toggleRankPermission(p.id)}
                                                                        />
                                                                        <span className="leading-snug break-words">{label}</span>
                                                                    </label>
                                                                );
                                                            })}
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </div>

                            <div className="flex flex-col sm:flex-row gap-2 sm:justify-end">
                                <button
                                    type="button"
                                    onClick={closeRankConfig}
                                    className="px-4 py-2 rounded-md border border-slate-700 bg-slate-900/60 text-slate-200 hover:bg-slate-800"
                                >
                                    Annuler
                                </button>
                                <button
                                    type="button"
                                    onClick={saveRankConfig}
                                    className="px-4 py-2 rounded-md bg-indigo-600 text-white hover:bg-indigo-500"
                                >
                                    Sauvegarder
                                </button>
                            </div>
                        </div>
                    </Modal>
                </Card>
            )}

            {/* ------------------------- BILLS ------------------------- */}
            {activeTab === 'bills' && (
                <Card
                    title="Factures"
                    right={(
                        <div className="flex gap-2 items-center">
                            <input
                                value={billQ}
                                onChange={(e) => { setBillQ(e.target.value); setBillPage(1); }}
                                className="w-56 max-w-[55vw] rounded-md border border-slate-700 bg-slate-900/60 px-3 py-2 text-sm text-slate-200"
                                placeholder="Rechercher…"
                            />
                            <button
                                type="button"
                                onClick={fetchBills}
                                className="px-3 py-2 rounded-md border border-slate-700 bg-slate-900/60 text-slate-200 hover:bg-slate-800"
                            >
                                <RefreshCcw size={16} />
                            </button>
                        </div>
                    )}
                >
                    {billLoading ? (
                        <div className="py-10 flex justify-center"><Spinner /></div>
                    ) : (
                        <>
                            <Table>
                                <table className="w-full text-sm">
                                    <thead className="text-slate-400">
                                    <tr className="border-b border-slate-700">
                                        <th className="text-left py-2">ID</th>
                                        <th className="text-left py-2">Date</th>
                                        <th className="text-left py-2">Client</th>
                                        <th className="text-left py-2">Raison</th>
                                        <th className="text-right py-2">Montant</th>
                                        <th className="text-left py-2">Statut</th>
                                    </tr>
                                    </thead>
                                    <tbody className="text-slate-200">
                                    {(billData.items || []).map((b) => (
                                        <tr key={b.id} className="border-b border-slate-800">
                                            <td className="py-2">#{b.id}</td>
                                            <td className="py-2">{b.date ? new Date(b.date).toLocaleString() : '—'}</td>
                                            <td className="py-2">{b.client?.name || '—'}</td>
                                            <td className="py-2 max-w-[18rem] truncate">{b.reason || '—'}</td>
                                            <td className="py-2 text-right">{formatUSD(b.amount)}</td>
                                            <td className="py-2">
                                                <select
                                                    value={b.status}
                                                    onChange={(e) => changeBillStatus(b.id, e.target.value)}
                                                    className="rounded-md border border-slate-700 bg-slate-900/60 px-2 py-1 text-sm text-slate-200"
                                                >
                                                    <option value="UNPAID">UNPAID</option>
                                                    <option value="PAID_CASH">PAID_CASH</option>
                                                    <option value="PAID_CARD">PAID_CARD</option>
                                                    <option value="CANCELED">CANCELED</option>
                                                </select>
                                            </td>
                                        </tr>
                                    ))}
                                    {(!billData.items || billData.items.length === 0) ? (
                                        <tr><td colSpan={6} className="py-6 text-center text-slate-400">Aucune facture</td></tr>
                                    ) : null}
                                    </tbody>
                                </table>
                            </Table>

                            <div className="mt-3">
                                <Pagination
                                    page={billData.page}
                                    totalPages={billData.totalPages}
                                    totalItems={billData.total}
                                    pageSize={billData.pageSize}
                                    onPageChange={setBillPage}
                                    onPageSizeChange={(n) => { setBillPageSize(n); setBillPage(1); }}
                                />
                            </div>
                        </>
                    )}
                </Card>
            )}

            {/* ------------------------- TRANSACTIONS ------------------------- */}
            {activeTab === 'transactions' && (
                <Card
                    title="Transactions"
                    right={(
                        <div className="flex gap-2 items-center">
                            <input
                                value={txQ}
                                onChange={(e) => { setTxQ(e.target.value); setTxPage(1); }}
                                className="w-56 max-w-[55vw] rounded-md border border-slate-700 bg-slate-900/60 px-3 py-2 text-sm text-slate-200"
                                placeholder="Rechercher…"
                            />
                            <button
                                type="button"
                                onClick={fetchTransactions}
                                className="px-3 py-2 rounded-md border border-slate-700 bg-slate-900/60 text-slate-200 hover:bg-slate-800"
                            >
                                <RefreshCcw size={16} />
                            </button>
                        </div>
                    )}
                >
                    {txLoading ? (
                        <div className="py-10 flex justify-center"><Spinner /></div>
                    ) : (
                        <>
                            <Table>
                                <table className="w-full text-sm">
                                    <thead className="text-slate-400">
                                    <tr className="border-b border-slate-700">
                                        <th className="text-left py-2">Date</th>
                                        <th className="text-left py-2">Description</th>
                                        <th className="text-right py-2">Montant</th>
                                        <th className="text-left py-2">Catégorie</th>
                                    </tr>
                                    </thead>
                                    <tbody className="text-slate-200">
                                    {(txData.items || []).map((t) => (
                                        <tr key={t.id} className="border-b border-slate-800">
                                            <td className="py-2">{t.date ? new Date(t.date).toLocaleString() : '—'}</td>
                                            <td className="py-2 max-w-[26rem] truncate">{t.description || '—'}</td>
                                            <td className="py-2 text-right">{formatUSD(t.amount)}</td>
                                            <td className="py-2">
                                                <select
                                                    value={t.categoryId}
                                                    onChange={(e) => changeTxCategory(t.id, e.target.value)}
                                                    className="rounded-md border border-slate-700 bg-slate-900/60 px-2 py-1 text-sm text-slate-200"
                                                >
                                                    {/* Options issues du cache (observées) + fallback current */}
                                                    {!txCategoriesCache.find((c) => c.id === t.categoryId) ? (
                                                        <option value={t.categoryId}>{t.category?.name || `Category #${t.categoryId}`}</option>
                                                    ) : null}
                                                    {txCategoriesCache.map((c) => (
                                                        <option key={c.id} value={c.id}>{c.name}</option>
                                                    ))}
                                                </select>
                                            </td>
                                        </tr>
                                    ))}
                                    {(!txData.items || txData.items.length === 0) ? (
                                        <tr><td colSpan={4} className="py-6 text-center text-slate-400">Aucune transaction</td></tr>
                                    ) : null}
                                    </tbody>
                                </table>
                            </Table>

                            <div className="mt-3">
                                <Pagination
                                    page={txData.page}
                                    totalPages={txData.totalPages}
                                    totalItems={txData.total}
                                    pageSize={txData.pageSize}
                                    onPageChange={setTxPage}
                                    onPageSizeChange={(n) => { setTxPageSize(n); setTxPage(1); }}
                                />
                            </div>

                            <div className="mt-2 text-xs text-slate-400">
                                Note: la liste des catégories est dérivée des transactions déjà chargées (lot suivant = endpoint dédié catégories).
                            </div>
                        </>
                    )}
                </Card>
            )}

            {/* ------------------------- CLIENTS ------------------------- */}
            {activeTab === 'clients' && (
                <Card
                    title="Clients"
                    right={(
                        <div className="flex gap-2 items-center">
                            <input
                                value={clientQ}
                                onChange={(e) => { setClientQ(e.target.value); setClientPage(1); }}
                                className="w-56 max-w-[55vw] rounded-md border border-slate-700 bg-slate-900/60 px-3 py-2 text-sm text-slate-200"
                                placeholder="Rechercher…"
                            />
                            <button
                                type="button"
                                onClick={openNewClient}
                                className="px-3 py-2 rounded-md bg-indigo-600 text-white hover:bg-indigo-500 inline-flex items-center gap-2"
                            >
                                <Plus size={16} />
                                Nouveau
                            </button>
                            <button
                                type="button"
                                onClick={fetchClients}
                                className="px-3 py-2 rounded-md border border-slate-700 bg-slate-900/60 text-slate-200 hover:bg-slate-800"
                            >
                                <RefreshCcw size={16} />
                            </button>
                        </div>
                    )}
                >
                    {clientLoading ? (
                        <div className="py-10 flex justify-center"><Spinner /></div>
                    ) : (
                        <>
                            <Table>
                                <table className="w-full text-sm">
                                    <thead className="text-slate-400">
                                    <tr className="border-b border-slate-700">
                                        <th className="text-left py-2">Nom</th>
                                        <th className="text-left py-2">Téléphone</th>
                                        <th className="text-left py-2">Adresse</th>
                                        <th className="text-right py-2">Actions</th>
                                    </tr>
                                    </thead>
                                    <tbody className="text-slate-200">
                                    {(clientData.items || []).map((c) => (
                                        <tr key={c.id} className="border-b border-slate-800">
                                            <td className="py-2 font-medium">{c.name}</td>
                                            <td className="py-2">{c.phoneNumber || '—'}</td>
                                            <td className="py-2 max-w-[22rem] truncate">{c.address || '—'}</td>
                                            <td className="py-2 text-right">
                                                <button
                                                    type="button"
                                                    onClick={() => openEditClient(c)}
                                                    className="inline-flex items-center gap-2 px-3 py-1.5 rounded-md border border-slate-700 bg-slate-900/60 hover:bg-slate-800"
                                                >
                                                    <Pencil size={14} />
                                                    Modifier
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                    {(!clientData.items || clientData.items.length === 0) ? (
                                        <tr><td colSpan={4} className="py-6 text-center text-slate-400">Aucun client</td></tr>
                                    ) : null}
                                    </tbody>
                                </table>
                            </Table>

                            <div className="mt-3">
                                <Pagination
                                    page={clientData.page}
                                    totalPages={clientData.totalPages}
                                    totalItems={clientData.total}
                                    pageSize={clientData.pageSize}
                                    onPageChange={setClientPage}
                                    onPageSizeChange={(n) => { setClientPageSize(n); setClientPage(1); }}
                                />
                            </div>
                        </>
                    )}

                    <ClientEditModal
                        open={clientModalOpen}
                        onClose={() => setClientModalOpen(false)}
                        onSaved={onClientSaved}
                        initial={clientEdit}
                        companyId={cId}
                    />
                </Card>
            )}

            {/* ------------------------- LOGS ------------------------- */}
            {activeTab === 'logs' && (
                <Card
                    title="Logs"
                    right={(
                        <div className="flex flex-wrap gap-2 items-center justify-end">
                            <input
                                value={logQ}
                                onChange={(e) => { setLogQ(e.target.value); setLogPage(1); }}
                                className="w-44 rounded-md border border-slate-700 bg-slate-900/60 px-3 py-2 text-sm text-slate-200"
                                placeholder="Search…"
                            />
                            <input
                                value={logCategory}
                                onChange={(e) => { setLogCategory(e.target.value); setLogPage(1); }}
                                className="w-36 rounded-md border border-slate-700 bg-slate-900/60 px-3 py-2 text-sm text-slate-200"
                                placeholder="Category"
                            />
                            <input
                                value={logType}
                                onChange={(e) => { setLogType(e.target.value); setLogPage(1); }}
                                className="w-36 rounded-md border border-slate-700 bg-slate-900/60 px-3 py-2 text-sm text-slate-200"
                                placeholder="LogType"
                            />
                            <button
                                type="button"
                                onClick={fetchLogs}
                                className="px-3 py-2 rounded-md border border-slate-700 bg-slate-900/60 text-slate-200 hover:bg-slate-800"
                            >
                                <RefreshCcw size={16} />
                            </button>
                        </div>
                    )}
                >
                    {logLoading ? (
                        <div className="py-10 flex justify-center"><Spinner /></div>
                    ) : (
                        <>
                            <Table>
                                <table className="w-full text-sm">
                                    <thead className="text-slate-400">
                                    <tr className="border-b border-slate-700">
                                        <th className="text-left py-2">Date</th>
                                        <th className="text-left py-2">Category</th>
                                        <th className="text-left py-2">Type</th>
                                        <th className="text-left py-2">Message</th>
                                        <th className="text-right py-2">Data</th>
                                    </tr>
                                    </thead>
                                    <tbody className="text-slate-200">
                                    {(logData.items || []).map((l) => (
                                        <tr key={l.id} className="border-b border-slate-800">
                                            <td className="py-2">{l.createdAt ? new Date(l.createdAt).toLocaleString() : (l.date || '—')}</td>
                                            <td className="py-2">{l.category || '—'}</td>
                                            <td className="py-2">{l.logType || '—'}</td>
                                            <td className="py-2 max-w-[28rem]">
                                                <div className="truncate">{l.message || l.text || '—'}</div>
                                                {(!l.isProcessed && l.processingError) && (
                                                    <div className="text-xs text-red-400 mt-1 break-words">
                                                        Erreur: {l.processingError}
                                                    </div>
                                                )}
                                            </td>
                                            <td className="py-2 text-right">
                                                <div className="flex justify-end gap-2">
                                                    {(!l.isProcessed && l.processingError) && (
                                                        <button
                                                            type="button"
                                                            onClick={() => handleRetryLog(l.id)}
                                                            disabled={retryingLogId === l.id}
                                                            className="px-3 py-1.5 rounded-md border border-amber-500/30 bg-amber-500/10 text-amber-200 hover:bg-amber-500/20 disabled:opacity-50 flex items-center gap-1.5"
                                                        >
                                                            {retryingLogId === l.id ? <Spinner size={14} /> : <RefreshCcw size={14} />}
                                                            <span>Relancer</span>
                                                        </button>
                                                    )}
                                                    <button
                                                        type="button"
                                                        onClick={() => openLogData(l)}
                                                        className="px-3 py-1.5 rounded-md border border-slate-700 bg-slate-900/60 hover:bg-slate-800"
                                                    >
                                                        Voir
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                    {(!logData.items || logData.items.length === 0) ? (
                                        <tr><td colSpan={5} className="py-6 text-center text-slate-400">Aucun log</td></tr>
                                    ) : null}
                                    </tbody>
                                </table>
                            </Table>

                            <div className="mt-3">
                                <Pagination
                                    page={logData.page}
                                    totalPages={logData.totalPages}
                                    totalItems={logData.total}
                                    pageSize={logData.pageSize}
                                    onPageChange={setLogPage}
                                    onPageSizeChange={(n) => { setLogPageSize(n); setLogPage(1); }}
                                />
                            </div>
                        </>
                    )}

                    <Modal isOpen={!!logView} onClose={() => setLogView(null)} title="Log data">
                        <pre className="text-xs text-slate-200 whitespace-pre-wrap break-words">
                            {safeJsonStringify(logView?.data ?? logView?.text ?? logView ?? {})}
                        </pre>
                    </Modal>
                </Card>
            )}

            {/* ------------------------- CONTACTS ------------------------- */}
            {activeTab === 'contacts' && (
                <Card
                    title="Contacts facturables"
                    right={(
                        <button
                            type="button"
                            onClick={() => setIsContactsOpen(true)}
                            className="px-4 py-2 rounded-md bg-indigo-600 text-white hover:bg-indigo-500"
                        >
                            Ajouter / Gérer
                        </button>
                    )}
                >
                    <div className="text-sm text-slate-300">
                        Ajoute/supprime des contacts facturables et définis un contact prioritaire.
                    </div>

                    <div className="mt-3">
                        {billableLoading ? (
                            <div className="py-10 flex justify-center"><Spinner /></div>
                        ) : billableContacts.length === 0 ? (
                            <div className="text-sm text-slate-400">Aucun contact facturable.</div>
                        ) : (
                            <div className="space-y-2">
                                {billableContacts
                                    .slice()
                                    .sort((a, b) => {
                                        const ap = a.isPrio ? 1 : 0;
                                        const bp = b.isPrio ? 1 : 0;
                                        if (ap !== bp) return bp - ap;
                                        return String(a.user?.name || '').localeCompare(String(b.user?.name || ''));
                                    })
                                    .map((bc) => (
                                        <div key={bc.userId || bc.user?.id} className="rounded-lg border border-slate-700 bg-slate-900/40 p-3 flex flex-col sm:flex-row sm:items-center gap-2">
                                            <div className="flex-1 min-w-0">
                                                <div className="text-sm text-slate-100 font-medium truncate">
                                                    {bc.user?.name || bc.user?.username || `User #${bc.userId}`}
                                                    {bc.isPrio ? (
                                                        <span className="ml-2 inline-flex items-center gap-1 rounded border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 text-xs text-amber-200">
                                                            <Star size={12} /> Prio
                                                        </span>
                                                    ) : null}
                                                </div>
                                                <div className="text-xs text-slate-400 truncate">{bc.user?.username ? `@${bc.user.username}` : ''}</div>
                                            </div>

                                            <div className="flex flex-wrap gap-2">
                                                <button
                                                    type="button"
                                                    onClick={async () => {
                                                        try {
                                                            await setBillableContactPrio(cId, bc.user?.id || bc.userId, !bc.isPrio);
                                                            toast.success(!bc.isPrio ? 'Contact prioritaire défini.' : 'Priorité retirée.');
                                                            await fetchBillableContacts();
                                                        } catch (e) {
                                                            toast.error(e?.message || 'Erreur priorité.');
                                                        }
                                                    }}
                                                    className="px-3 py-2 rounded-md border border-slate-700 bg-slate-900/60 text-slate-200 hover:bg-slate-800 inline-flex items-center gap-2"
                                                >
                                                    <Star size={16} />
                                                    {bc.isPrio ? 'Retirer prio' : 'Mettre prio'}
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        confirmAction({
                                                            title: 'Retirer contact',
                                                            message: `Retirer ${bc.user?.name || 'cet utilisateur'} des contacts facturables ?`,
                                                            onConfirm: async () => {
                                                                try {
                                                                    await removeBillableContact(cId, bc.user?.id || bc.userId);
                                                                    toast.success('Contact retiré.');
                                                                    await fetchBillableContacts();
                                                                } catch (e) {
                                                                    toast.error(e?.message || 'Erreur retrait.');
                                                                }
                                                            },
                                                        });
                                                    }}
                                                    className="px-3 py-2 rounded-md border border-red-500/30 bg-red-500/10 text-red-200 hover:bg-red-500/20 inline-flex items-center gap-2"
                                                >
                                                    <Trash2 size={16} />
                                                    Retirer
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                            </div>
                        )}
                    </div>

                    <ManageContactsModal
                        isOpen={isContactsOpen}
                        onClose={() => setIsContactsOpen(false)}
                        onComplete={async () => { await fetchBillableContacts(); await refreshCompany(); }}
                        company={{ id: cId, name: companyName }}
                    />
                </Card>
            )}
        </div>
    );
}
