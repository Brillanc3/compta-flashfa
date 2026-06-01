import React, { useMemo, useState } from "react";
import Modal from "@/components/Modal";
import toast from "react-hot-toast";
import { rejectContract, signContract } from "@/services/contractService";

export const ELECTRONIC_SIGNATURE_TOKEN = "[[ELECTRONIC_SIGNATURE]]";
// eslint-disable-next-line react-refresh/only-export-components
export const ELECTRONIC_SIGNATURE_TOKENS = [
    ELECTRONIC_SIGNATURE_TOKEN,
    "[[__ELECTRONIC_SIGNATURE__]]",
];
export const CONTRACT_SIGNATURE_CONFIRMATION_TEXT = "Lu et approuvé";

const ROLE_ORDER = {
    SENDER: 0,
    RECIPIENT: 1,
};

function hash32(str) {
    let h = 2166136261;
    for (let i = 0; i < str.length; i += 1) {
        h ^= str.charCodeAt(i);
        h = Math.imul(h, 16777619);
    }
    return h >>> 0;
}

function toHex8(n) {
    return (n >>> 0).toString(16).padStart(8, "0");
}

function escapeHtml(str) {
    return String(str ?? "")
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");
}

function normalizePhrase(value) {
    return String(value ?? "")
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase()
        .trim()
        .replace(/\s+/g, " ");
}

function formatSignedAt(iso) {
    if (!iso) return "—";

    try {
        return new Intl.DateTimeFormat("fr-FR", {
            dateStyle: "long",
            timeStyle: "short",
            timeZone: "Europe/Paris",
        }).format(new Date(iso));
    } catch {
        return String(iso || "—");
    }
}

function getRoleTitle(role) {
    return role === "SENDER" ? "Signature expéditeur" : "Signature destinataire";
}

function getRolePendingLabel(role) {
    return role === "SENDER" ? "En attente de la signature de l'expéditeur." : "En attente de la signature du destinataire.";
}

function getSignerLabel(signature, fallbackUser, role) {
    return (
        signature?.signerNameSnapshot
        || signature?.signerUser?.name
        || signature?.signerUser?.username
        || fallbackUser?.name
        || fallbackUser?.username
        || (role === "SENDER" ? "Expéditeur" : "Destinataire")
    );
}

function normalizeSvgSnapshot(svg, { height = 76 } = {}) {
    if (typeof svg !== "string") return "";

    const trimmed = svg.trim();
    if (!trimmed || !/<svg\b/i.test(trimmed)) return "";

    return trimmed
        .replace(/<\?xml[\s\S]*?\?>/gi, "")
        .replace(/<!doctype[\s\S]*?>/gi, "")
        .replace(/<script[\s\S]*?<\/script>/gi, "")
        .replace(/<foreignObject[\s\S]*?<\/foreignObject>/gi, "")
        .replace(/\son[a-z]+\s*=\s*("[^"]*"|'[^']*')/gi, "")
        .replace(/<svg\b([^>]*)>/i, (match, attrs) => {
            const safeAttrs = String(attrs || "")
                .replace(/\s(?:width|height)\s*=\s*("[^"]*"|'[^']*')/gi, "")
                .replace(/\sstyle\s*=\s*("[^"]*"|'[^']*')/gi, "");

            return `<svg${safeAttrs} style="display:block;width:100%;height:${height}px;max-width:100%;" preserveAspectRatio="xMidYMid meet">`;
        });
}

function buildFingerprint(section, contractId) {
    return toHex8(
        hash32(
            `${contractId || ""}|${section?.role || ""}|${section?.signature?.id || ""}|${section?.signature?.signerUserId || ""}|${section?.signature?.signedAt || ""}|${section?.signature?.signatureSvgSnapshot || ""}`
        )
    );
}

// eslint-disable-next-line react-refresh/only-export-components
export function buildContractSignatureSections(contract) {
    if (!contract || typeof contract !== "object") return [];

    const signatures = Array.isArray(contract.signatures) ? contract.signatures : [];
    const senderSignature = contract.senderSignature || signatures.find((item) => item?.role === "SENDER") || null;
    const recipientSignature = contract.recipientSignature || signatures.find((item) => item?.role === "RECIPIENT") || null;
    const currentUserRoles = Array.isArray(contract.currentUserRoles)
        ? contract.currentUserRoles.filter(Boolean)
        : contract.currentUserRole
            ? [contract.currentUserRole]
            : [];

    const sections = [
        {
            role: "SENDER",
            title: getRoleTitle("SENDER"),
            signature: senderSignature,
            signerLabel: getSignerLabel(senderSignature, contract.senderUser, "SENDER"),
            pendingLabel: getRolePendingLabel("SENDER"),
            canCurrentUserSign: contract.status === "PENDING"
                && currentUserRoles.includes("SENDER")
                && !senderSignature,
            canCurrentUserReject: false,
        },
        {
            role: "RECIPIENT",
            title: getRoleTitle("RECIPIENT"),
            signature: recipientSignature,
            signerLabel: getSignerLabel(recipientSignature, contract.assignedToUser, "RECIPIENT"),
            pendingLabel: getRolePendingLabel("RECIPIENT"),
            canCurrentUserSign: contract.status === "PENDING"
                && currentUserRoles.includes("RECIPIENT")
                && !recipientSignature,
            canCurrentUserReject: contract.status === "PENDING"
                && currentUserRoles.includes("RECIPIENT")
                && !recipientSignature,
        },
    ];

    return sections.sort((left, right) => (ROLE_ORDER[left.role] ?? 99) - (ROLE_ORDER[right.role] ?? 99));
}

function renderSignatureSvg(signatureSvgSnapshot, contractId, role) {
    const markup = normalizeSvgSnapshot(signatureSvgSnapshot, { height: 76 });

    if (!markup) {
        return (
            <div
                style={{
                    minHeight: 76,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    color: "#64748b",
                    fontSize: 12,
                    textAlign: "center",
                }}
            >
                Signature indisponible
            </div>
        );
    }

    return (
        <div
            key={`${contractId || "contract"}-${role || "role"}`}
            style={{ minHeight: 76 }}
            dangerouslySetInnerHTML={{ __html: markup }}
        />
    );
}

function SignatureSectionCard({ contractId, section }) {
    const fingerprint = useMemo(() => buildFingerprint(section, contractId), [contractId, section]);
    const signature = section?.signature || null;

    return (
        <div
            style={{
                flex: "1 1 300px",
                minWidth: 0,
                border: "1px solid rgba(15,23,42,.12)",
                borderRadius: 14,
                padding: 14,
                background: "rgba(255,255,255,.9)",
            }}
        >
            <div style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: ".08em", color: "#64748b" }}>
                {section?.title}
            </div>

            {signature ? (
                <>
                    <div style={{ marginTop: 8, fontWeight: 700, fontSize: 14 }}>Signature électronique valide</div>
                    <div style={{ marginTop: 6, fontSize: 12 }}>
                        Signé électroniquement par <b>{section.signerLabel}</b>
                    </div>
                    <div style={{ marginTop: 4, fontSize: 12, color: "#475569" }}>
                        Horodatage : {formatSignedAt(signature.signedAt)}
                    </div>
                    <div style={{ marginTop: 4, fontSize: 11, color: "#64748b" }}>
                        Empreinte {fingerprint}
                        {signature?.id ? ` • Signature #${signature.id}` : ""}
                    </div>
                    {signature?.confirmationText ? (
                        <div style={{ marginTop: 4, fontSize: 11, color: "#64748b" }}>
                            Mention : “{signature.confirmationText}”
                        </div>
                    ) : null}

                    <div
                        style={{
                            marginTop: 12,
                            border: "1px solid rgba(15,23,42,.10)",
                            borderRadius: 12,
                            padding: 10,
                            background: "white",
                        }}
                    >
                        {renderSignatureSvg(signature.signatureSvgSnapshot, contractId, section.role)}
                    </div>
                </>
            ) : (
                <>
                    <div style={{ marginTop: 8, fontWeight: 700, fontSize: 14 }}>Signature en attente</div>
                    <div style={{ marginTop: 6, fontSize: 12, color: "#475569" }}>{section?.pendingLabel}</div>

                    <div
                        style={{
                            marginTop: 12,
                            border: "1px dashed rgba(15,23,42,.18)",
                            borderRadius: 12,
                            padding: 12,
                            minHeight: 108,
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            color: "#64748b",
                            fontSize: 12,
                            textAlign: "center",
                            background: "rgba(2,6,23,.02)",
                        }}
                    >
                        {section?.canCurrentUserSign ? "Votre signature électronique sera apposée ici." : "Aucune signature apposée pour le moment."}
                    </div>
                </>
            )}
        </div>
    );
}

function SignatureGrid({ contractId, sections, status, refusalReason }) {
    return (
        <div style={{ marginTop: 24, paddingTop: 16, borderTop: "1px solid rgba(15,23,42,.18)" }}>
            <div style={{ fontWeight: 700, fontSize: "1.02em" }}>Signatures électroniques</div>

            {status === "REJECTED" ? (
                <div style={{ marginTop: 8, fontSize: 12, color: "#b91c1c" }}>
                    Contrat refusé{refusalReason ? ` — Motif : ${refusalReason}` : ""}
                </div>
            ) : null}

            <div
                style={{
                    display: "flex",
                    gap: 16,
                    rowGap: 16,
                    flexWrap: "wrap",
                    alignItems: "stretch",
                    marginTop: 14,
                }}
            >
                {(Array.isArray(sections) ? sections : []).map((section) => (
                    <SignatureSectionCard
                        key={section.role}
                        contractId={contractId}
                        section={section}
                    />
                ))}
            </div>
        </div>
    );
}

function renderSignatureSectionHtml(section, contractId) {
    const signature = section?.signature || null;
    const fingerprint = buildFingerprint(section, contractId);

    if (!signature) {
        return `
        <div style="flex:1 1 300px; min-width:240px; border:1px solid rgba(15,23,42,.12); border-radius:14px; padding:14px; background:rgba(255,255,255,.9);">
          <div style="font-size:10px; text-transform:uppercase; letter-spacing:.08em; color:#64748b;">${escapeHtml(section?.title || "Signature")}</div>
          <div style="margin-top:8px; font-weight:700; font-size:14px;">Signature en attente</div>
          <div style="margin-top:6px; font-size:12px; color:#475569;">${escapeHtml(section?.pendingLabel || "En attente de signature.")}</div>
          <div style="margin-top:12px; border:1px dashed rgba(15,23,42,.18); border-radius:12px; padding:12px; min-height:108px; display:flex; align-items:center; justify-content:center; color:#64748b; font-size:12px; text-align:center; background:rgba(2,6,23,.02);">
            Aucune signature apposée pour le moment.
          </div>
        </div>
      `;
    }

    const signatureMarkup = normalizeSvgSnapshot(signature.signatureSvgSnapshot, { height: 76 });

    return `
      <div style="flex:1 1 300px; min-width:240px; border:1px solid rgba(15,23,42,.12); border-radius:14px; padding:14px; background:rgba(255,255,255,.9);">
        <div style="font-size:10px; text-transform:uppercase; letter-spacing:.08em; color:#64748b;">${escapeHtml(section?.title || "Signature")}</div>
        <div style="margin-top:8px; font-weight:700; font-size:14px;">Signature électronique valide</div>
        <div style="margin-top:6px; font-size:12px;">Signé électroniquement par <b>${escapeHtml(section?.signerLabel || "Utilisateur")}</b></div>
        <div style="margin-top:4px; font-size:12px; color:#475569;">Horodatage : ${escapeHtml(formatSignedAt(signature.signedAt))}</div>
        <div style="margin-top:4px; font-size:11px; color:#64748b;">Empreinte ${escapeHtml(fingerprint)}${signature?.id ? ` • Signature #${escapeHtml(signature.id)}` : ""}</div>
        ${signature?.confirmationText ? `<div style="margin-top:4px; font-size:11px; color:#64748b;">Mention : “${escapeHtml(signature.confirmationText)}”</div>` : ""}
        <div style="margin-top:12px; border:1px solid rgba(15,23,42,.10); border-radius:12px; padding:10px; background:white; min-height:96px;">
          ${signatureMarkup || '<div style="min-height:76px; display:flex; align-items:center; justify-content:center; color:#64748b; font-size:12px; text-align:center;">Signature indisponible</div>'}
        </div>
      </div>
    `;
}

// eslint-disable-next-line react-refresh/only-export-components
export function signatureToHtml({ contractId, sections = [], status = "PENDING", refusalReason = null }) {
    return `
      <div style="margin-top:24px; padding-top:16px; border-top:1px solid rgba(15,23,42,.18);">
        <div style="font-weight:700; font-size:14px;">Signatures électroniques</div>
        ${status === "REJECTED" ? `<div style="margin-top:8px; font-size:12px; color:#b91c1c;">Contrat refusé${refusalReason ? ` — Motif : ${escapeHtml(refusalReason)}` : ""}</div>` : ""}
        <div style="display:flex; gap:16px; row-gap:16px; flex-wrap:wrap; align-items:stretch; margin-top:14px;">
          ${(Array.isArray(sections) ? sections : []).map((section) => renderSignatureSectionHtml(section, contractId)).join("")}
        </div>
      </div>
    `;
}

export default function ElectronicSignatureBlock({ contractId = null, sections = [], status = "PENDING", refusalReason = null }) {
    return (
        <SignatureGrid
            contractId={contractId}
            sections={sections}
            status={status}
            refusalReason={refusalReason}
        />
    );
}

export function ElectronicSignaturePendingBlock({
                                                    contract,
                                                    requiredText = CONTRACT_SIGNATURE_CONFIRMATION_TEXT,
                                                    onAfterAction,
                                                }) {
    const [open, setOpen] = useState(false);
    const [mode, setMode] = useState("sign");
    const [phrase, setPhrase] = useState("");
    const [reason, setReason] = useState("");
    const [loading, setLoading] = useState(false);
    const [selectedRole, setSelectedRole] = useState(null);

    const sections = useMemo(() => buildContractSignatureSections(contract), [contract]);
    const signableSections = useMemo(
        () => sections.filter((section) => section.canCurrentUserSign),
        [sections]
    );
    const canReject = useMemo(
        () => sections.some((section) => section.canCurrentUserReject),
        [sections]
    );

    const normalizedRequiredText = normalizePhrase(requiredText) === normalizePhrase(CONTRACT_SIGNATURE_CONFIRMATION_TEXT)
        ? CONTRACT_SIGNATURE_CONFIRMATION_TEXT
        : CONTRACT_SIGNATURE_CONFIRMATION_TEXT;
    const canSign = useMemo(
        () => normalizePhrase(phrase) === normalizePhrase(normalizedRequiredText),
        [phrase, normalizedRequiredText]
    );

    const reset = () => {
        setMode("sign");
        setPhrase("");
        setReason("");
        setLoading(false);
        setSelectedRole(signableSections[0]?.role || null);
    };

    const close = () => {
        setOpen(false);
        reset();
    };

    const openForSign = (role) => {
        setSelectedRole(role || signableSections[0]?.role || null);
        setMode("sign");
        setOpen(true);
    };

    const openForReject = () => {
        setMode("reject");
        setSelectedRole("RECIPIENT");
        setOpen(true);
    };

    const doSign = async () => {
        if (!contract?.id) {
            toast.error("Contrat introuvable.");
            return;
        }

        if (!selectedRole) {
            toast.error("Aucun rôle de signature disponible.");
            return;
        }

        if (!canSign) {
            toast.error(`Veuillez écrire exactement : "${normalizedRequiredText}"`);
            return;
        }

        try {
            setLoading(true);
            await signContract(contract.id, {
                confirmationText: normalizedRequiredText,
                role: selectedRole,
            });
            toast.success(selectedRole === "SENDER" ? "Signature expéditeur enregistrée." : "Signature destinataire enregistrée.");
            close();
            onAfterAction?.({ type: "signed", role: selectedRole });
        } catch (error) {
            toast.error(error?.error || error?.message || "Erreur lors de la signature.");
            setLoading(false);
        }
    };

    const doReject = async () => {
        if (!contract?.id) {
            toast.error("Contrat introuvable.");
            return;
        }

        if (!reason.trim()) {
            toast.error("Vous devez indiquer une raison.");
            return;
        }

        try {
            setLoading(true);
            await rejectContract(contract.id, { reason: reason.trim() });
            toast.success("Contrat refusé.");
            close();
            onAfterAction?.({ type: "rejected" });
        } catch (error) {
            toast.error(error?.error || error?.message || "Erreur lors du refus.");
            setLoading(false);
        }
    };

    return (
        <>
            <SignatureGrid
                contractId={contract?.id || null}
                sections={sections}
                status={contract?.status || "PENDING"}
                refusalReason={contract?.refusalReason || null}
            />

            {(signableSections.length > 0 || canReject) ? (
                <div style={{ marginTop: 12, display: "flex", gap: 8, flexWrap: "wrap" }}>
                    {signableSections.map((section) => (
                        <button
                            key={section.role}
                            type="button"
                            onClick={() => openForSign(section.role)}
                            style={{
                                appearance: "none",
                                border: 0,
                                borderRadius: 10,
                                padding: "10px 14px",
                                background: section.role === "SENDER" ? "#1d4ed8" : "#16a34a",
                                color: "white",
                                cursor: "pointer",
                                fontWeight: 600,
                            }}
                        >
                            {section.role === "SENDER" ? "Signer comme expéditeur" : "Signer comme destinataire"}
                        </button>
                    ))}

                    {canReject ? (
                        <button
                            type="button"
                            onClick={openForReject}
                            style={{
                                appearance: "none",
                                border: 0,
                                borderRadius: 10,
                                padding: "10px 14px",
                                background: "rgba(185, 28, 28, .12)",
                                color: "#991b1b",
                                cursor: "pointer",
                                fontWeight: 600,
                            }}
                        >
                            Refuser le contrat
                        </button>
                    ) : null}
                </div>
            ) : null}

            <Modal
                isOpen={open}
                onClose={close}
                title={mode === "sign" ? "Signer le contrat" : "Refuser le contrat"}
                size="md"
            >
                {mode === "sign" ? (
                    <div className="space-y-4">
                        {signableSections.length > 1 ? (
                            <div className="space-y-2">
                                <div className="text-sm text-slate-300">Choisissez le rôle à signer.</div>
                                <div className="flex flex-wrap gap-2">
                                    {signableSections.map((section) => (
                                        <button
                                            key={section.role}
                                            type="button"
                                            onClick={() => setSelectedRole(section.role)}
                                            className={`rounded-lg px-3 py-2 text-sm font-medium transition ${selectedRole === section.role ? "bg-indigo-600 text-white" : "bg-slate-700 text-slate-200 hover:bg-slate-600"}`}
                                            disabled={loading}
                                        >
                                            {section.title}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        ) : null}

                        <div className="text-sm text-slate-300">
                            Pour confirmer, écrivez exactement : <b className="text-white">"{normalizedRequiredText}"</b>
                        </div>

                        <input
                            type="text"
                            className="w-full rounded-lg bg-slate-700 p-2 text-white outline-none ring-0"
                            placeholder={normalizedRequiredText}
                            value={phrase}
                            onChange={(event) => setPhrase(event.target.value)}
                            disabled={loading}
                        />

                        <div className="flex gap-3">
                            <button
                                type="button"
                                onClick={close}
                                className="flex-1 rounded-lg bg-slate-700 py-2 text-white hover:bg-slate-600"
                                disabled={loading}
                            >
                                Annuler
                            </button>

                            <button
                                type="button"
                                onClick={doSign}
                                className="flex-1 rounded-lg bg-green-600 py-2 text-white hover:bg-green-700 disabled:opacity-50"
                                disabled={!canSign || !selectedRole || loading}
                            >
                                {loading ? "Signature..." : "Signer"}
                            </button>
                        </div>
                    </div>
                ) : (
                    <div className="space-y-4">
                        <div className="text-sm text-slate-300">Indiquez la raison du refus. Ce champ est obligatoire.</div>

                        <textarea
                            className="w-full rounded-lg bg-slate-700 p-2 text-white outline-none ring-0"
                            rows={4}
                            value={reason}
                            onChange={(event) => setReason(event.target.value)}
                            disabled={loading}
                        />

                        <div className="flex gap-3">
                            <button
                                type="button"
                                onClick={close}
                                className="flex-1 rounded-lg bg-slate-700 py-2 text-white hover:bg-slate-600"
                                disabled={loading}
                            >
                                Annuler
                            </button>

                            <button
                                type="button"
                                onClick={doReject}
                                className="flex-1 rounded-lg bg-red-600 py-2 text-white hover:bg-red-700 disabled:opacity-50"
                                disabled={!reason.trim() || loading}
                            >
                                {loading ? "Refus..." : "Refuser"}
                            </button>
                        </div>
                    </div>
                )}
            </Modal>
        </>
    );
}
