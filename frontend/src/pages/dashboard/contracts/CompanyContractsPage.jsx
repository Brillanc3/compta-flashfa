import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { api } from '@/services/api';
import toast from 'react-hot-toast';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { Copy, Link2, Lock, PenLine, Power, Trash2 } from 'lucide-react';
import useWebSocketListener from '@/hooks/useWebSocketListener';
import Spinner from '@/components/ui/Spinner';
import ConfirmationModal from '@/components/ui/ConfirmationModal';
import Modal from '@/components/Modal';
import A4Preview from '@/components/contracts/A4Preview.jsx';
import { usePermissions } from '@/contexts/PermissionsContext';
import { useCompany } from '@/contexts/CompanyContext';
import ContractShareManagerModal from '@/components/contracts/ContractShareManagerModal.jsx';
import { copyText } from '@/utils/clipboard';
import {
    deleteContractShare,
    getAssignedContractById,
    listContractShares,
} from '@/services/contractService';

const ContractFilterBar = ({ onFilterChange }) => {
    const [filters, setFilters] = useState({
        status: '',
        search: '',
    });

    const handleChange = (event) => {
        const { name, value } = event.target;
        setFilters((previous) => ({ ...previous, [name]: value }));
    };

    const apply = () => onFilterChange(filters);

    const reset = () => {
        const nextFilters = { status: '', search: '' };
        setFilters(nextFilters);
        onFilterChange(nextFilters);
    };

    return (
        <div className="relative mb-6 overflow-hidden rounded-xl border border-slate-700/70 bg-gradient-to-r from-slate-900/80 via-slate-800/90 to-slate-900/80 shadow-lg shadow-slate-900/40">
            <div className="pointer-events-none absolute inset-0 opacity-40 mix-blend-screen [background:radial-gradient(circle_at_top,_rgba(79,70,229,0.35),_transparent_55%),radial-gradient(circle_at_bottom,_rgba(8,47,73,0.6),_transparent_55%)]" />

            <div className="relative space-y-4 p-4 md:p-5">
                <h2 className="flex items-center gap-2 text-sm font-semibold tracking-wide text-slate-200">
                    <span className="inline-flex h-6 w-6 items-center justify-center rounded-full border border-indigo-500/40 bg-indigo-500/20 text-xs text-indigo-300">📄</span>
                    Filtres des contrats
                </h2>

                <div className="grid grid-cols-1 gap-4 md:grid-cols-3 lg:grid-cols-5">
                    <div className="md:col-span-2">
                        <label className="mb-1 block text-[11px] uppercase text-slate-400">Recherche</label>
                        <input
                            name="search"
                            value={filters.search}
                            onChange={handleChange}
                            placeholder="Nom employé, titre contrat..."
                            className="w-full rounded-lg border border-slate-700/80 bg-slate-900/60 px-3 py-2.5 text-sm text-slate-100 placeholder:text-slate-500 outline-none transition hover:border-slate-500/80 focus:border-indigo-400 focus:ring-2 focus:ring-indigo-500/40"
                        />
                    </div>

                    <div>
                        <label className="mb-1 block text-[11px] uppercase text-slate-400">Statut</label>
                        <select
                            name="status"
                            value={filters.status}
                            onChange={handleChange}
                            className="w-full rounded-lg border border-slate-700/80 bg-slate-900/60 px-3 py-2.5 text-sm text-slate-100 outline-none hover:border-slate-500/80 focus:border-indigo-400 focus:ring-2"
                        >
                            <option value="">Tous</option>
                            <option value="PENDING">En attente</option>
                            <option value="SIGNED">Signé</option>
                            <option value="REJECTED">Refusé</option>
                        </select>
                    </div>
                </div>

                <div className="flex justify-end gap-3">
                    <button onClick={reset} className="rounded-lg border border-slate-600/80 bg-slate-900/50 px-3 py-1.5 text-xs text-slate-200 transition active:scale-95 hover:bg-slate-800/80">Réinitialiser</button>
                    <button onClick={apply} className="rounded-lg bg-indigo-600 px-4 py-1.5 text-xs text-white transition active:scale-95 hover:bg-indigo-500">Appliquer</button>
                </div>
            </div>
        </div>
    );
};

const statusChips = {
    PENDING: { text: 'En attente', color: 'bg-yellow-500/20 text-yellow-300' },
    SIGNED: { text: 'Signé', color: 'bg-green-500/20 text-green-300' },
    REJECTED: { text: 'Refusé', color: 'bg-red-500/20 text-red-300' },
};

function safeParseJson(value) {
    if (!value) return {};

    if (typeof value === 'string') {
        try {
            const parsed = JSON.parse(value);
            return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
        } catch {
            return {};
        }
    }

    return typeof value === 'object' && !Array.isArray(value) ? value : {};
}

function applyTemplateVars(markdown, values) {
    if (!markdown) return '';
    const map = values && typeof values === 'object' ? values : {};

    return String(markdown).replace(/{{\s*([^}]+?)\s*}}/g, (_, rawKey) => {
        const key = String(rawKey || '').trim();
        const found = map[key];
        if (found === null || found === undefined) return '';
        return String(found);
    });
}

function buildSelectionKey(ids) {
    return [...new Set((ids || []).map(Number).filter((id) => Number.isInteger(id) && id > 0))]
        .sort((a, b) => a - b)
        .join('-');
}

function getShareSelectionKey(share) {
    return buildSelectionKey((share?.contracts || []).map((contract) => contract.id));
}

function ShareStatusBadge({ share }) {
    return (
        <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ${share?.isRevoked ? 'bg-red-500/15 text-red-300' : 'bg-emerald-500/15 text-emerald-300'}`}>
            {share?.isRevoked ? 'Désactivé' : 'Actif'}
        </span>
    );
}

function getSignatureByRole(contract, role) {
    const direct = role === 'SENDER' ? contract?.senderSignature : contract?.recipientSignature;
    if (direct) return direct;

    const signatures = Array.isArray(contract?.signatures) ? contract.signatures : [];
    return signatures.find((item) => item?.role === role) || null;
}

function getCurrentUserRoles(contract) {
    if (Array.isArray(contract?.currentUserRoles)) {
        return contract.currentUserRoles.filter(Boolean);
    }
    return contract?.currentUserRole ? [contract.currentUserRole] : [];
}

function getSigningProgress(contract) {
    const senderSignature = getSignatureByRole(contract, 'SENDER');
    const recipientSignature = getSignatureByRole(contract, 'RECIPIENT');
    const completedCount = Number(Boolean(senderSignature)) + Number(Boolean(recipientSignature));
    const provided = contract?.signingProgress;

    return {
        completedCount: provided?.completedCount ?? completedCount,
        totalRequired: provided?.totalRequired ?? 2,
        isSenderSigned: provided?.isSenderSigned ?? Boolean(senderSignature),
        isRecipientSigned: provided?.isRecipientSigned ?? Boolean(recipientSignature),
        isFullySigned: provided?.isFullySigned ?? (Boolean(senderSignature) && Boolean(recipientSignature)),
    };
}

function canCurrentUserSignAsSender(contract) {
    return contract?.status === 'PENDING'
        && getCurrentUserRoles(contract).includes('SENDER')
        && !getSignatureByRole(contract, 'SENDER');
}

function SignatureStatePill({ signed, label }) {
    return (
        <span className={`inline-flex items-center rounded-full px-2 py-1 text-[11px] font-medium ${signed ? 'bg-emerald-500/15 text-emerald-300' : 'bg-slate-700/70 text-slate-300'}`}>
            {label} {signed ? 'signé' : 'en attente'}
        </span>
    );
}

function ContractSignatureSummary({ contract, compact = false }) {
    const progress = getSigningProgress(contract);

    if (compact) {
        return (
            <div className="flex flex-wrap items-center gap-2">
                <SignatureStatePill signed={progress.isSenderSigned} label="Expéditeur" />
                <SignatureStatePill signed={progress.isRecipientSigned} label="Destinataire" />
            </div>
        );
    }

    return (
        <div className="space-y-2">
            <div className="text-xs font-medium text-slate-300">{progress.completedCount}/{progress.totalRequired} signatures</div>
            <div className="flex flex-wrap gap-2">
                <SignatureStatePill signed={progress.isSenderSigned} label="Expéditeur" />
                <SignatureStatePill signed={progress.isRecipientSigned} label="Destinataire" />
            </div>
        </div>
    );
}

export default function CompanyContractsPage() {
    const [contracts, setContracts] = useState([]);
    const [loading, setLoading] = useState(true);
    const [filters, setFilters] = useState({});

    const [isPreviewOpen, setIsPreviewOpen] = useState(false);
    const [previewContractId, setPreviewContractId] = useState(null);
    const [previewContract, setPreviewContract] = useState(null);
    const [previewLoading, setPreviewLoading] = useState(false);

    const permissions = usePermissions();
    const { activeCompanyId } = useCompany();

    const [selectedContractIds, setSelectedContractIds] = useState([]);
    const [contractShares, setContractShares] = useState([]);
    const [sharesLoading, setSharesLoading] = useState(false);
    const [isShareModalOpen, setIsShareModalOpen] = useState(false);
    const [managedShareId, setManagedShareId] = useState(null);
    const [confirmModal, setConfirmModal] = useState({ isOpen: false, message: '', onConfirm: null });

    const fetchContracts = useCallback(async () => {
        try {
            setLoading(true);
            const response = await api.get('/contracts/assigned');
            let list = Array.isArray(response.data) ? response.data : [];

            if (filters.search) {
                const query = filters.search.toLowerCase();
                list = list.filter((contract) => {
                    const title = (contract.snapshotTitle || contract.template?.title || '').toLowerCase();
                    const userName = (contract.assignedToUser?.name || '').toLowerCase();
                    const senderName = (contract.senderUser?.name || '').toLowerCase();
                    return title.includes(query) || userName.includes(query) || senderName.includes(query);
                });
            }

            if (filters.status) {
                list = list.filter((contract) => contract.status === filters.status);
            }

            setContracts(list);
        } catch {
            toast.error('Erreur de chargement des contrats.');
        } finally {
            setLoading(false);
        }
    }, [filters]);

    const canShareContracts = useMemo(() => {
        if (!activeCompanyId || !permissions?.isReady) return false;
        return permissions.has('CONTRACTS.SHARES');
    }, [activeCompanyId, permissions]);

    const fetchShares = useCallback(async () => {
        if (!canShareContracts) {
            setContractShares([]);
            return;
        }

        try {
            setSharesLoading(true);
            const data = await listContractShares({}, { companyScoped: true });
            setContractShares(Array.isArray(data) ? data : []);
        } catch {
            toast.error('Erreur de chargement des partages.');
        } finally {
            setSharesLoading(false);
        }
    }, [canShareContracts]);

    const loadPreviewContract = useCallback(async (contractId, { silent = false } = {}) => {
        if (!contractId) return null;

        if (!silent) {
            setPreviewLoading(true);
        }

        try {
            const data = await getAssignedContractById(contractId);
            setPreviewContract(data);
            return data;
        } catch (error) {
            if (!silent) {
                toast.error(error?.message || 'Impossible de charger le contrat.');
            }
            throw error;
        } finally {
            if (!silent) {
                setPreviewLoading(false);
            }
        }
    }, []);

    useEffect(() => {
        fetchContracts();
    }, [fetchContracts]);

    useEffect(() => {
        fetchShares();
    }, [fetchShares]);

    useWebSocketListener('CONTRACT_ASSIGNED', () => fetchContracts());
    useWebSocketListener('CONTRACT_SIGNED', () => {
        fetchContracts();
        if (previewContractId) {
            loadPreviewContract(previewContractId, { silent: true }).catch(() => {});
        }
    });
    useWebSocketListener('CONTRACT_REJECTED', () => {
        fetchContracts();
        if (previewContractId) {
            loadPreviewContract(previewContractId, { silent: true }).catch(() => {});
        }
    });

    const openPreview = useCallback(async (contract) => {
        setIsPreviewOpen(true);
        setPreviewContractId(contract?.id || null);
        setPreviewContract(null);

        if (contract?.id) {
            await loadPreviewContract(contract.id).catch(() => {
                setIsPreviewOpen(false);
                setPreviewContractId(null);
            });
        }
    }, [loadPreviewContract]);

    const closePreview = useCallback(() => {
        setIsPreviewOpen(false);
        setPreviewContractId(null);
        setPreviewContract(null);
        setPreviewLoading(false);
    }, []);

    const reloadPreviewAndList = useCallback(async () => {
        try {
            await fetchContracts();
            if (previewContractId) {
                await loadPreviewContract(previewContractId, { silent: true });
            }
        } catch {
            toast.error('Impossible de recharger le contrat après l’action.');
        }
    }, [fetchContracts, loadPreviewContract, previewContractId]);

    const toggleContractSelection = useCallback((contractId) => {
        setSelectedContractIds((previous) => (
            previous.includes(contractId)
                ? previous.filter((id) => id !== contractId)
                : [...previous, contractId]
        ));
    }, []);

    useEffect(() => {
        setSelectedContractIds((previous) => previous.filter((id) => contracts.some((contract) => contract.id === id)));
    }, [contracts]);

    const preview = useMemo(() => {
        if (!previewContract) return { title: '', markdown: '', bg: '' };

        const values = safeParseJson(previewContract.fieldValues);
        const baseMarkdown = previewContract.snapshotMarkdown || previewContract.markdown || previewContract.template?.markdown || previewContract.template?.content || '';
        const compiled = applyTemplateVars(baseMarkdown, values);
        const bg = previewContract.backgroundImageUrl || previewContract.template?.backgroundImageUrl || '';
        const title = previewContract.snapshotTitle || previewContract.title || previewContract.template?.title || 'Aperçu du contrat';

        return { title, markdown: compiled, bg };
    }, [previewContract]);

    const selectedContracts = useMemo(() => {
        if (!selectedContractIds.length) return [];
        const selectedSet = new Set(selectedContractIds);
        return contracts.filter((contract) => selectedSet.has(contract.id));
    }, [contracts, selectedContractIds]);

    const selectedSelectionKey = useMemo(() => buildSelectionKey(selectedContractIds), [selectedContractIds]);

    const exactSelectionShare = useMemo(() => {
        if (!selectedSelectionKey) return null;
        return contractShares.find((share) => getShareSelectionKey(share) === selectedSelectionKey) || null;
    }, [contractShares, selectedSelectionKey]);

    const shareModalTitle = useMemo(() => {
        if (selectedContracts.length === 1) {
            return selectedContracts[0]?.snapshotTitle || selectedContracts[0]?.template?.title || 'Contrat';
        }

        return `${selectedContracts.length} contrats sélectionnés`;
    }, [selectedContracts]);

    const shareCountByContractId = useMemo(() => {
        const map = new Map();
        contractShares.forEach((share) => {
            (share.contracts || []).forEach((contract) => {
                map.set(contract.id, (map.get(contract.id) || 0) + 1);
            });
        });
        return map;
    }, [contractShares]);

    const allVisibleContractIds = useMemo(() => contracts.map((contract) => contract.id), [contracts]);

    const areAllVisibleSelected = useMemo(() => {
        if (!allVisibleContractIds.length) return false;
        return allVisibleContractIds.every((id) => selectedContractIds.includes(id));
    }, [allVisibleContractIds, selectedContractIds]);

    const toggleSelectAllVisible = useCallback(() => {
        setSelectedContractIds((previous) => {
            if (!allVisibleContractIds.length) return previous;

            const allSelected = allVisibleContractIds.every((id) => previous.includes(id));
            if (allSelected) {
                return previous.filter((id) => !allVisibleContractIds.includes(id));
            }

            return [...new Set([...previous, ...allVisibleContractIds])];
        });
    }, [allVisibleContractIds]);

    const openCreateShareModal = useCallback(() => {
        if (!selectedContractIds.length) {
            toast.error('Sélectionnez au moins un contrat.');
            return;
        }

        setManagedShareId(exactSelectionShare?.id || null);
        setIsShareModalOpen(true);
    }, [exactSelectionShare, selectedContractIds]);

    const openManageShareModal = useCallback((share) => {
        setManagedShareId(share.id);
        setSelectedContractIds((share.contracts || []).map((contract) => contract.id));
        setIsShareModalOpen(true);
    }, []);

    const closeShareModal = useCallback(() => {
        setIsShareModalOpen(false);
        setManagedShareId(null);
    }, []);

    const handleCopyShare = useCallback(async (share) => {
        const publicPath = share?.publicPath;
        if (!publicPath || typeof window === 'undefined') return;

        const result = await copyText(`${window.location.origin}${publicPath}`);
        if (result?.ok) {
            toast.success('Lien copié.');
            return;
        }

        toast.error('Impossible de copier le lien.');
    }, []);

    const handleDeleteShare = useCallback((share) => {
        if (!share?.id) return;

        setConfirmModal({
            isOpen: true,
            message: `Supprimer définitivement le partage #${share.id} ?`,
            onConfirm: async () => {
                setConfirmModal(p => ({ ...p, isOpen: false }));
                try {
                    await deleteContractShare(share.id, { companyScoped: true });
                    toast.success('Partage supprimé.');
                    fetchShares();
                } catch (error) {
                    toast.error(error?.error || error?.message || 'Impossible de supprimer le partage.');
                }
            },
        });
    }, [fetchShares]);

    return (
        <div className="space-y-6 p-4">
            <h1 className="text-3xl font-bold text-white">Contrats de l&apos;entreprise</h1>

            <ContractFilterBar onFilterChange={setFilters} />

            <Modal isOpen={isPreviewOpen} onClose={closePreview} title={preview.title} showCloseButton>
                {previewLoading || !previewContract ? (
                    <div className="flex justify-center py-10">
                        <Spinner />
                    </div>
                ) : (
                    <div className="space-y-4">
                        <div className="flex flex-col gap-3 rounded-xl border border-slate-700/60 bg-slate-900/50 p-4 lg:flex-row lg:items-start lg:justify-between">
                            <div className="space-y-2">
                                <div className="flex flex-wrap items-center gap-2">
                                    <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ${statusChips[previewContract.status]?.color || 'bg-slate-700 text-slate-200'}`}>
                                        {statusChips[previewContract.status]?.text || previewContract.status}
                                    </span>
                                    <span className="inline-flex items-center rounded-full border border-indigo-500/30 bg-indigo-500/10 px-2.5 py-1 text-xs font-semibold text-indigo-200">
                                        {getSigningProgress(previewContract).completedCount}/2 signatures
                                    </span>
                                    {canCurrentUserSignAsSender(previewContract) ? (
                                        <span className="inline-flex items-center gap-1 rounded-full border border-amber-500/30 bg-amber-500/10 px-2.5 py-1 text-xs font-semibold text-amber-200">
                                            <PenLine className="h-3.5 w-3.5" /> Signature expéditeur disponible
                                        </span>
                                    ) : null}
                                </div>

                                <div className="space-y-1 text-sm text-slate-300">
                                    <div>
                                        Destinataire : <span className="font-medium text-slate-100">{previewContract.assignedToUser?.name || 'Utilisateur supprimé'}</span>
                                    </div>
                                    <div>
                                        Expéditeur : <span className="font-medium text-slate-100">{previewContract.senderUser?.name || 'Utilisateur introuvable'}</span>
                                    </div>
                                    <ContractSignatureSummary contract={previewContract} compact />
                                </div>
                            </div>
                        </div>

                        {preview.markdown?.trim() ? (
                            <A4Preview
                                contract={previewContract}
                                markdown={preview.markdown}
                                backgroundImageUrl={preview.bg}
                                onAfterAction={reloadPreviewAndList}
                            />
                        ) : (
                            <div className="text-slate-300">Aucun contenu à afficher pour ce contrat.</div>
                        )}
                    </div>
                )}
            </Modal>

            <ContractShareManagerModal
                isOpen={isShareModalOpen}
                onClose={closeShareModal}
                assignedContractIds={selectedContractIds}
                contractTitle={shareModalTitle}
                initialShareId={managedShareId}
                companyScoped
                onShareChange={() => {
                    fetchShares();
                    fetchContracts();
                }}
            />

            {canShareContracts ? (
                <div className="space-y-4">
                    <div className="flex flex-col gap-3 rounded-xl border border-slate-700/60 bg-slate-900/70 px-4 py-3 md:flex-row md:items-center md:justify-between">
                        <div className="flex flex-wrap items-center gap-3">
                            <label className="inline-flex cursor-pointer items-center gap-2 text-sm text-slate-200">
                                <input
                                    type="checkbox"
                                    checked={areAllVisibleSelected}
                                    onChange={toggleSelectAllVisible}
                                    className="h-4 w-4 rounded border-slate-600 bg-slate-900 text-indigo-600 focus:ring-indigo-500"
                                />
                                <span>Tout sélectionner</span>
                            </label>

                            <span className="text-sm text-slate-400">
                                {selectedContractIds.length} sélectionné{selectedContractIds.length > 1 ? 's' : ''}
                            </span>
                        </div>

                        <button
                            type="button"
                            onClick={openCreateShareModal}
                            disabled={!selectedContractIds.length}
                            className="inline-flex items-center justify-center rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                            {exactSelectionShare ? 'Gérer le partage' : 'Partager la sélection'}
                        </button>
                    </div>

                    <div className="rounded-xl border border-slate-700/60 bg-slate-900/50 p-4">
                        <div className="mb-4 flex items-center justify-between gap-3">
                            <div>
                                <h2 className="text-lg font-semibold text-white">Partages existants</h2>
                                <p className="text-sm text-slate-400">Contrats déjà partagés, avec gestion du mot de passe et de l&apos;activation.</p>
                            </div>
                            {sharesLoading ? <Spinner /> : null}
                        </div>

                        {contractShares.length ? (
                            <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
                                {contractShares.map((share) => (
                                    <div key={share.id} className="space-y-4 rounded-xl border border-slate-800 bg-slate-950/60 p-4">
                                        <div className="flex items-start justify-between gap-3">
                                            <div className="min-w-0">
                                                <div className="flex items-center gap-2 text-sm font-medium text-white">
                                                    <Link2 className="h-4 w-4 text-indigo-300" />
                                                    Partage #{share.id}
                                                </div>
                                                <div className="mt-1 text-xs text-slate-400">
                                                    Créé par {share.createdByUser?.name || 'Utilisateur'} • {share.contracts?.length || 0} contrat{(share.contracts?.length || 0) > 1 ? 's' : ''}
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                {share.isPasswordProtected ? (
                                                    <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/15 px-2.5 py-1 text-xs text-amber-300">
                                                        <Lock className="h-3.5 w-3.5" /> Mot de passe
                                                    </span>
                                                ) : null}
                                                <ShareStatusBadge share={share} />
                                            </div>
                                        </div>

                                        <div className="flex flex-wrap gap-2">
                                            {(share.contracts || []).map((contract) => (
                                                <span key={contract.id} className="inline-flex items-center rounded-full bg-slate-800 px-2.5 py-1 text-xs text-slate-200">
                                                    {contract.snapshotTitle || `Contrat #${contract.id}`}
                                                </span>
                                            ))}
                                        </div>

                                        <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
                                            <button
                                                type="button"
                                                onClick={() => handleDeleteShare(share)}
                                                className="inline-flex items-center justify-center gap-2 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-2 text-sm text-red-300 hover:bg-red-500/15"
                                            >
                                                <Trash2 className="h-4 w-4" /> Supprimer
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => handleCopyShare(share)}
                                                disabled={share.isRevoked}
                                                className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-700 bg-slate-800 px-4 py-2 text-sm text-white hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-60"
                                            >
                                                <Copy className="h-4 w-4" /> Copier
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => openManageShareModal(share)}
                                                className="inline-flex items-center justify-center gap-2 rounded-lg border border-indigo-500/30 bg-indigo-500/10 px-4 py-2 text-sm text-indigo-200 hover:bg-indigo-500/15"
                                            >
                                                <Power className="h-4 w-4" /> Gérer
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="text-sm text-slate-400">Aucun partage de contrats pour cette entreprise.</div>
                        )}
                    </div>
                </div>
            ) : null}

            <div className="relative overflow-hidden rounded-xl border border-slate-700/60 bg-gradient-to-br from-slate-900/70 via-slate-800/70 to-slate-900/70 shadow-2xl shadow-black/40 backdrop-blur-xl">
                <div className="pointer-events-none absolute inset-0 opacity-25 mix-blend-soft-light [background:radial-gradient(circle_at_top_left,rgba(99,102,241,0.18),transparent_55%),radial-gradient(circle_at_bottom_right,rgba(8,47,73,0.40),transparent_55%)]" />

                {loading ? (
                    <div className="flex justify-center py-10"><Spinner /></div>
                ) : (
                    <div className="relative">
                        <div className="space-y-3 p-4 md:hidden">
                            {contracts.length > 0 ? (
                                contracts.map((contract) => {
                                    const shareCount = shareCountByContractId.get(contract.id) || 0;
                                    const title = contract.snapshotTitle || contract.template?.title;

                                    return (
                                        <div key={contract.id} className="rounded-xl border border-slate-700/60 bg-slate-900/40 p-4 shadow-sm shadow-black/20 backdrop-blur-xl">
                                            <div className="flex items-start gap-3">
                                                {canShareContracts ? (
                                                    <label className="pt-0.5">
                                                        <input
                                                            type="checkbox"
                                                            checked={selectedContractIds.includes(contract.id)}
                                                            onChange={() => toggleContractSelection(contract.id)}
                                                            className="h-4 w-4 rounded border-slate-600 bg-slate-900 text-indigo-600 focus:ring-indigo-500"
                                                        />
                                                    </label>
                                                ) : null}
                                                <div className="min-w-0 flex-1 space-y-2">
                                                    <div className="break-words whitespace-normal text-sm font-semibold text-slate-100">
                                                        {title}
                                                    </div>
                                                    <div className="text-xs text-slate-400">
                                                        Employé : <span className="text-slate-200">{contract.assignedToUser?.name ?? 'Utilisateur supprimé'}</span>
                                                    </div>
                                                    <div className="text-xs text-slate-400">
                                                        Expéditeur : <span className="text-slate-200">{contract.senderUser?.name ?? 'Utilisateur introuvable'}</span>
                                                    </div>
                                                    <ContractSignatureSummary contract={contract} compact />
                                                    {shareCount ? (
                                                        <div className="text-xs text-indigo-300">{shareCount} partage{shareCount > 1 ? 's' : ''}</div>
                                                    ) : null}
                                                </div>

                                                <span className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-semibold leading-none whitespace-nowrap ${statusChips[contract.status]?.color || 'bg-slate-700 text-slate-200'}`}>
                                                    {statusChips[contract.status]?.text || contract.status}
                                                </span>
                                            </div>

                                            <div className="mt-3 flex items-center justify-between gap-3">
                                                <div className="min-w-0 text-xs text-slate-400">
                                                    Assigné le <span className="text-slate-200">{contract.assignedAt ? format(new Date(contract.assignedAt), 'd MMM yyyy HH:mm', { locale: fr }) : '—'}</span>
                                                </div>

                                                <div className="flex items-center gap-2">
                                                    {canShareContracts ? (
                                                        <button
                                                            type="button"
                                                            onClick={() => toggleContractSelection(contract.id)}
                                                            className="shrink-0 rounded-lg border border-slate-600 px-3 py-1.5 text-xs text-slate-200 transition active:scale-95 hover:bg-slate-800"
                                                        >
                                                            {selectedContractIds.includes(contract.id) ? 'Désélectionner' : 'Sélectionner'}
                                                        </button>
                                                    ) : null}

                                                    <button
                                                        type="button"
                                                        onClick={() => openPreview(contract)}
                                                        className="shrink-0 rounded-lg bg-indigo-600 px-3 py-1.5 text-xs text-white transition active:scale-95 hover:bg-indigo-500"
                                                    >
                                                        {canCurrentUserSignAsSender(contract) ? 'Voir / signer' : 'Voir'}
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })
                            ) : (
                                <div className="py-10 text-center text-slate-400">Aucun contrat ne correspond aux filtres.</div>
                            )}
                        </div>

                        <div className="hidden overflow-x-auto glass-scroll md:block">
                            <table className="min-w-full text-sm text-slate-100">
                                <thead className="border-b border-slate-700/70 bg-slate-900/60 backdrop-blur-lg">
                                <tr>
                                    {canShareContracts ? (
                                        <th className="w-[56px] border-r border-slate-700/40 px-4 py-3 text-[11px] uppercase tracking-wide">
                                            <input
                                                type="checkbox"
                                                checked={areAllVisibleSelected}
                                                onChange={toggleSelectAllVisible}
                                                className="h-4 w-4 rounded border-slate-600 bg-slate-900 text-indigo-600 focus:ring-indigo-500"
                                            />
                                        </th>
                                    ) : null}
                                    <th className="border-r border-slate-700/40 px-4 py-3 text-[11px] uppercase tracking-wide">Employé</th>
                                    <th className="border-r border-slate-700/40 px-4 py-3 text-[11px] uppercase tracking-wide">Titre</th>
                                    <th className="border-r border-slate-700/40 px-4 py-3 text-[11px] uppercase tracking-wide">Statut</th>
                                    <th className="border-r border-slate-700/40 px-4 py-3 text-[11px] uppercase tracking-wide">Signatures</th>
                                    <th className="border-r border-slate-700/40 px-4 py-3 text-[11px] uppercase tracking-wide">Partages</th>
                                    <th className="border-r border-slate-700/40 px-4 py-3 text-[11px] uppercase tracking-wide">Assigné le</th>
                                    <th className="px-4 py-3 text-[11px] uppercase tracking-wide">Actions</th>
                                </tr>
                                </thead>

                                <tbody className="divide-y divide-slate-700/50 backdrop-blur-xl">
                                {contracts.length > 0 ? (
                                    contracts.map((contract) => {
                                        const shareCount = shareCountByContractId.get(contract.id) || 0;

                                        return (
                                            <tr key={contract.id} className="group transition-all hover:bg-slate-800/50 hover:backdrop-blur-lg hover:[background:linear-gradient(to_right,rgba(99,102,241,0.08),transparent)]">
                                                {canShareContracts ? (
                                                    <td className="px-4 py-3 text-center">
                                                        <input
                                                            type="checkbox"
                                                            checked={selectedContractIds.includes(contract.id)}
                                                            onChange={() => toggleContractSelection(contract.id)}
                                                            className="h-4 w-4 rounded border-slate-600 bg-slate-900 text-indigo-600 focus:ring-indigo-500"
                                                        />
                                                    </td>
                                                ) : null}

                                                <td className="px-4 py-3">{contract.assignedToUser?.name ?? 'Utilisateur supprimé'}</td>
                                                <td className="px-4 py-3">{contract.snapshotTitle || contract.template?.title}</td>
                                                <td className="px-4 py-3">
                                                        <span className={`rounded-full px-2 py-1 text-xs font-semibold ${statusChips[contract.status]?.color || 'bg-slate-700 text-slate-200'}`}>
                                                            {statusChips[contract.status]?.text || contract.status}
                                                        </span>
                                                </td>
                                                <td className="px-4 py-3">
                                                    <ContractSignatureSummary contract={contract} />
                                                    {canCurrentUserSignAsSender(contract) ? (
                                                        <div className="mt-2 inline-flex items-center gap-1 rounded-full border border-amber-500/30 bg-amber-500/10 px-2 py-1 text-[11px] font-medium text-amber-200">
                                                            <PenLine className="h-3 w-3" /> Signature expéditeur disponible
                                                        </div>
                                                    ) : null}
                                                </td>
                                                <td className="px-4 py-3">
                                                    {shareCount ? (
                                                        <span className="inline-flex items-center rounded-full bg-indigo-500/15 px-2.5 py-1 text-xs text-indigo-300">
                                                                {shareCount} partage{shareCount > 1 ? 's' : ''}
                                                            </span>
                                                    ) : (
                                                        <span className="text-slate-500">—</span>
                                                    )}
                                                </td>
                                                <td className="px-4 py-3">
                                                    {contract.assignedAt ? format(new Date(contract.assignedAt), 'd MMM yyyy HH:mm', { locale: fr }) : '—'}
                                                </td>
                                                <td className="px-4 py-3 text-right">
                                                    <button
                                                        type="button"
                                                        onClick={() => openPreview(contract)}
                                                        className="rounded-lg bg-indigo-600 px-3 py-1.5 text-white transition active:scale-95 hover:bg-indigo-500"
                                                    >
                                                        {canCurrentUserSignAsSender(contract) ? 'Voir / signer' : 'Voir'}
                                                    </button>
                                                </td>
                                            </tr>
                                        );
                                    })
                                ) : (
                                    <tr>
                                        <td colSpan={canShareContracts ? 8 : 7} className="py-8 text-center text-slate-400">
                                            Aucun contrat ne correspond aux filtres.
                                        </td>
                                    </tr>
                                )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}
            </div>
            <ConfirmationModal
                isOpen={confirmModal.isOpen}
                onClose={() => setConfirmModal(p => ({ ...p, isOpen: false }))}
                onConfirm={confirmModal.onConfirm}
                message={confirmModal.message}
            />
        </div>
    );
}
