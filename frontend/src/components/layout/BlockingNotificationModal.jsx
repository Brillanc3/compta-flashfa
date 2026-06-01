import React, { useMemo, useState } from "react";
import { useNotifications } from "../../contexts/NotificationContext";
import Modal from "../Modal";
import { toast } from "react-hot-toast";
import apiClient from "../../services/api.js";
import remarkGfm from "remark-gfm";
import remarkBreaks from "remark-breaks";
import ReactMarkdown from "react-markdown";

/* -------------------------------------------------------------------------- */
/* MAIN COMPONENT                                                             */
/* -------------------------------------------------------------------------- */

const BlockingNotificationModal = () => {
    const { blockingNotification, acknowledge, openContractSignature } =
        useNotifications();

    const title = blockingNotification?.title;
    const body = blockingNotification?.body;
    const behavior = blockingNotification?.behavior;

    // All hooks before early returns
    const content = useMemo(
        () => ({
            title: title || "Notification importante",
            body: body || "Veuillez prendre connaissance de ce message.",
        }),
        [title, body]
    );

    // Rien à afficher
    if (!blockingNotification) return null;
    // Sécurité ultime (normalement inutile car filtré en amont)
    if (behavior !== "BLOCKING") return null;

    const {
        id: recipientId,
    } = blockingNotification;

    // Ces extensions restent compatibles si tu les ajoutes plus tard
    const isContractNotification = Boolean(
        blockingNotification.assignedContractId
    );

    const hasForm =
        Array.isArray(blockingNotification.formFields) &&
        blockingNotification.formFields.length > 0;

    /* ------------------------------------------------------------------ */
    /* ACTIONS                                                            */
    /* ------------------------------------------------------------------ */

    const handleAcknowledge = async () => {
        try {
            await acknowledge(recipientId);
        } catch {
            toast.error("Impossible de valider la notification.");
        }
    };

    const handleSignContract = async () => {
        try {
            await acknowledge(recipientId);
            openContractSignature?.(
                blockingNotification.assignedContractId
            );
        } catch {
            toast.error("Impossible d’ouvrir le contrat.");
        }
    };

    /* ------------------------------------------------------------------ */
    /* RENDER                                                             */
    /* ------------------------------------------------------------------ */

    return (
        <Modal
            isOpen={true}
            onClose={() => {}}
            title={content.title}
            disableOverlayClose={true}
        >
            <div className="text-slate-300">
                <p className="text-md mb-6 whitespace-pre-line">
                    <ReactMarkdown remarkPlugins={[remarkGfm, remarkBreaks]}>
                        {content.body}
                    </ReactMarkdown>

                </p>

                {/* === FORMULAIRE DYNAMIQUE === */}
                {hasForm ? (
                    <DynamicForm
                        fields={blockingNotification.formFields}
                        submitEndpoint={
                            blockingNotification.submitEndpoint
                        }
                        submitMethod={
                            blockingNotification.submitMethod || "PATCH"
                        }
                        onSuccess={handleAcknowledge}
                    />
                ) : (
                    <div className="flex justify-end pt-4 border-t border-slate-700">
                        {isContractNotification ? (
                            <button
                                onClick={handleSignContract}
                                className="px-6 py-2 bg-green-600 hover:bg-green-700 text-white font-bold rounded-md"
                            >
                                Voir et signer le contrat
                            </button>
                        ) : (
                            <button
                                onClick={handleAcknowledge}
                                className="px-6 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-md"
                            >
                                J’ai lu et j’accepte
                            </button>
                        )}
                    </div>
                )}
            </div>
        </Modal>
    );
};

/* -------------------------------------------------------------------------- */
/* DYNAMIC FORM                                                               */
/* -------------------------------------------------------------------------- */

const DynamicForm = ({
                         fields,
                         submitEndpoint,
                         submitMethod,
                         onSuccess,
                     }) => {
    const [values, setValues] = useState({});
    const [loading, setLoading] = useState(false);

    const handleChange = (id, val) =>
        setValues((v) => ({ ...v, [id]: val }));

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);

        try {
            await apiClient.request({
                url: submitEndpoint,
                method: submitMethod,
                data: values,
            });

            toast.success("Informations envoyées avec succès ✅");
            onSuccess?.();
        } catch (err) {
            console.error(
                "[BlockingNotificationModal] form submit error:",
                err
            );
            toast.error("Impossible d’envoyer les informations");
        } finally {
            setLoading(false);
        }
    };

    return (
        <form
            onSubmit={handleSubmit}
            className="space-y-4 mt-2 border-t border-slate-700 pt-4"
        >
            {fields.map((f) => (
                <div key={f.id} className="flex flex-col">
                    <label className="text-sm text-slate-300 mb-1">
                        {f.label}
                    </label>
                    <input
                        type={f.type || "text"}
                        required={f.required}
                        value={values[f.id] || ""}
                        onChange={(e) =>
                            handleChange(f.id, e.target.value)
                        }
                        className="bg-slate-700 text-white rounded-md px-3 py-2"
                    />
                </div>
            ))}

            <div className="flex justify-end pt-4 border-t border-slate-700">
                <button
                    type="submit"
                    disabled={loading}
                    className="px-6 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-md"
                >
                    {loading ? "Envoi…" : "Envoyer"}
                </button>
            </div>
        </form>
    );
};

export default BlockingNotificationModal;
