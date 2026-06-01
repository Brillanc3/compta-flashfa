import React, { useCallback, useEffect, useMemo, useState } from 'react';
import Modal from '@/components/Modal';
import toast from 'react-hot-toast';

import A4Preview from '@/components/contracts/A4Preview.jsx';
import CopyRenderedHtmlButton from '@/components/contracts/CopyRenderedHtmlButton.jsx';
import Spinner from '@/components/ui/Spinner.jsx';

import { getAssignedContractById } from '@/services/contractService';
import { getMyElectronicSignature } from '@/services/userService.js';

function parseFieldValues(fieldValues) {
    if (!fieldValues) return {};

    if (typeof fieldValues === 'string') {
        try {
            const parsed = JSON.parse(fieldValues);
            return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
        } catch {
            return {};
        }
    }

    return typeof fieldValues === 'object' && !Array.isArray(fieldValues) ? fieldValues : {};
}

function applyFieldValues(markdown, fieldValues) {
    let content = String(markdown || '');
    const values = parseFieldValues(fieldValues);

    Object.entries(values).forEach(([key, value]) => {
        const safeKey = String(key || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const regex = new RegExp(`\\{\\{\\s*${safeKey}\\s*\\}\\}`, 'g');
        content = content.replace(regex, value == null ? '' : String(value));
    });

    return content;
}

function getSignatureByRole(contract, role) {
    if (!contract || typeof contract !== 'object') return null;

    const direct = role === 'SENDER' ? contract.senderSignature : contract.recipientSignature;
    if (direct) return direct;

    if (!Array.isArray(contract.signatures)) return null;
    return contract.signatures.find((item) => item?.role === role) || null;
}

function getCurrentUserRoles(contract) {
    if (!contract || typeof contract !== 'object') return [];
    if (Array.isArray(contract.currentUserRoles)) {
        return contract.currentUserRoles.filter(Boolean);
    }
    return contract.currentUserRole ? [contract.currentUserRole] : [];
}

function hasActiveSignature(signatureProfile) {
    return Boolean(signatureProfile?.activeSignature?.svg);
}

function getCanUserSignRoles(contract) {
    const currentUserRoles = getCurrentUserRoles(contract);
    if (!currentUserRoles.length || contract?.status !== 'PENDING') return [];

    return currentUserRoles.filter((role) => !getSignatureByRole(contract, role));
}

function getSigningProgress(contract) {
    const senderSigned = Boolean(getSignatureByRole(contract, 'SENDER'));
    const recipientSigned = Boolean(getSignatureByRole(contract, 'RECIPIENT'));
    const provided = contract?.signingProgress;

    const completedCount = provided?.completedCount ?? (Number(senderSigned) + Number(recipientSigned));

    return {
        totalRequired: provided?.totalRequired ?? 2,
        completedCount,
        remainingCount: provided?.remainingCount ?? Math.max(0, 2 - completedCount),
        isSenderSigned: provided?.isSenderSigned ?? senderSigned,
        isRecipientSigned: provided?.isRecipientSigned ?? recipientSigned,
        isFullySigned: provided?.isFullySigned ?? (senderSigned && recipientSigned),
    };
}

function getStatusBadge(status) {
    const map = {
        PENDING: 'bg-yellow-500/15 text-yellow-300 border-yellow-500/30',
        SIGNED: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
        REJECTED: 'bg-red-500/15 text-red-300 border-red-500/30',
        CANCELED: 'bg-slate-500/15 text-slate-300 border-slate-500/30',
    };

    const labels = {
        PENDING: 'En attente',
        SIGNED: 'Signé',
        REJECTED: 'Refusé',
        CANCELED: 'Annulé',
    };

    return {
        className: map[status] || map.CANCELED,
        label: labels[status] || status || 'Inconnu',
    };
}

function buildContractTitle(contract, titleOverride = null) {
    if (titleOverride) return titleOverride;
    return contract?.title || contract?.snapshotTitle || contract?.template?.title || 'Contrat';
}

function formatDateTime(value) {
    if (!value) return '—';

    try {
        return new Intl.DateTimeFormat('fr-FR', {
            dateStyle: 'medium',
            timeStyle: 'short',
            timeZone: 'Europe/Paris',
        }).format(new Date(value));
    } catch {
        return String(value);
    }
}

function StatusPill({ status }) {
    const badge = getStatusBadge(status);

    return (
        <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-semibold ${badge.className}`}>
            {badge.label}
        </span>
    );
}

function SignatureProgressPill({ contract }) {
    const progress = getSigningProgress(contract);

    return (
        <span className="inline-flex items-center rounded-full border border-indigo-500/30 bg-indigo-500/10 px-2.5 py-1 text-xs font-semibold text-indigo-200">
            {progress.completedCount}/{progress.totalRequired} signatures
        </span>
    );
}

export default function ContractViewerModal({
                                                contractId,
                                                isOpen,
                                                onClose,
                                                titleOverride = null,
                                            }) {
    const [contract, setContract] = useState(null);
    const [loading, setLoading] = useState(false);
    const [renderedHtml, setRenderedHtml] = useState('');
    const [signatureProfile, setSignatureProfile] = useState(null);
    const [signatureProfileLoaded, setSignatureProfileLoaded] = useState(false);

    const loadContract = useCallback(async ({ silent = false } = {}) => {
        if (!contractId) return null;

        if (!silent) {
            setLoading(true);
        }

        try {
            const data = await getAssignedContractById(contractId);
            setContract(data);
            return data;
        } catch (error) {
            if (!silent) {
                toast.error(error?.message || 'Impossible de charger le contrat.');
            }
            throw error;
        } finally {
            if (!silent) {
                setLoading(false);
            }
        }
    }, [contractId]);

    const loadSignatureProfile = useCallback(async () => {
        try {
            const data = await getMyElectronicSignature();
            setSignatureProfile(data);
        } catch {
            setSignatureProfile(null);
        } finally {
            setSignatureProfileLoaded(true);
        }
    }, []);

    useEffect(() => {
        if (!isOpen || !contractId) {
            setContract(null);
            setRenderedHtml('');
            setSignatureProfile(null);
            setSignatureProfileLoaded(false);
            return;
        }

        loadContract();
        loadSignatureProfile();
    }, [contractId, isOpen, loadContract, loadSignatureProfile]);

    const finalMarkdown = useMemo(() => {
        if (!contract) return '';
        return applyFieldValues(contract.markdown || contract.snapshotMarkdown || contract.template?.markdown || contract.template?.content || '', contract.fieldValues);
    }, [contract]);

    const canUserSignRoles = useMemo(() => getCanUserSignRoles(contract), [contract]);
    const shouldBlockInteractiveSigning = useMemo(() => {
        if (!contract || contract.status !== 'PENDING') return false;
        if (canUserSignRoles.length === 0) return false;
        if (!signatureProfileLoaded) return false;
        return !hasActiveSignature(signatureProfile);
    }, [contract, canUserSignRoles, signatureProfile, signatureProfileLoaded]);

    const displayContract = useMemo(() => {
        if (!contract) return null;
        if (!shouldBlockInteractiveSigning) return contract;
        return {
            ...contract,
            status: 'PENDING_SIGNATURE_SETUP_REQUIRED',
        };
    }, [contract, shouldBlockInteractiveSigning]);

    const contractTitle = useMemo(() => buildContractTitle(contract, titleOverride), [contract, titleOverride]);
    const companyName = contract?.modifiesCompanyNameSnapshot || contract?.generatedCompanyNameSnapshot || null;
    const signedRolesText = useMemo(() => {
        const progress = getSigningProgress(contract);
        if (!contract) return null;
        if (contract.status === 'SIGNED' || progress.isFullySigned) {
            return `Signatures complètes le ${formatDateTime(contract.signedAt)}`;
        }
        if (contract.status === 'REJECTED') {
            return `Refusé le ${formatDateTime(contract.refusedAt)}`;
        }
        return `${progress.remainingCount} signature${progress.remainingCount > 1 ? 's' : ''} restante${progress.remainingCount > 1 ? 's' : ''}`;
    }, [contract]);

    const handleAfterAction = useCallback(async () => {
        try {
            await Promise.all([
                loadContract({ silent: true }),
                loadSignatureProfile(),
            ]);
        } catch {
            toast.error('Impossible de recharger le contrat après l’action.');
        }
    }, [loadContract, loadSignatureProfile]);

    if (!isOpen) return null;

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title={contractTitle}
            showCloseButton
        >
            {loading || !contract ? (
                <div className="flex min-h-[220px] items-center justify-center">
                    <Spinner />
                </div>
            ) : (
                <div className="space-y-4">
                    <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                        <div className="space-y-2">
                            <div className="flex flex-wrap items-center gap-2">
                                <StatusPill status={contract.status} />
                                <SignatureProgressPill contract={contract} />
                            </div>

                            <div className="text-sm text-slate-300">
                                <div>
                                    Destinataire : <span className="font-medium text-slate-100">{contract.assignedToUser?.name || 'Utilisateur supprimé'}</span>
                                </div>
                                <div>
                                    Expéditeur : <span className="font-medium text-slate-100">{contract.senderUser?.name || 'Utilisateur introuvable'}</span>
                                </div>
                                {companyName ? (
                                    <div>
                                        Entreprise : <span className="font-medium text-slate-100">{companyName}</span>
                                    </div>
                                ) : null}
                                <div className="text-slate-400">{signedRolesText}</div>
                            </div>
                        </div>

                        <div className="flex items-center justify-end">
                            <CopyRenderedHtmlButton html={renderedHtml} />
                        </div>
                    </div>

                    {shouldBlockInteractiveSigning ? (
                        <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-amber-100">
                            <div className="font-semibold">Signature électronique absente</div>
                            <p className="mt-1 text-amber-200/90">
                                Vous pouvez consulter ce contrat, mais vous ne pourrez pas le signer tant qu’aucune signature électronique active n’est configurée dans votre profil.
                            </p>
                        </div>
                    ) : null}

                    {contract.status === 'REJECTED' && contract.refusalReason ? (
                        <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-100">
                            <div className="font-semibold">Motif du refus</div>
                            <p className="mt-1 text-red-200/90 whitespace-pre-wrap">{contract.refusalReason}</p>
                        </div>
                    ) : null}

                    <A4Preview
                        contract={displayContract}
                        markdown={finalMarkdown}
                        onHtmlChange={setRenderedHtml}
                        backgroundImageUrl={contract?.backgroundImageUrl || contract?.template?.backgroundImageUrl || ''}
                        onAfterAction={handleAfterAction}
                    />
                </div>
            )}
        </Modal>
    );
}
