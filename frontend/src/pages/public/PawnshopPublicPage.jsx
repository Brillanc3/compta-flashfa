// frontend/src/pages/public/PawnshopPublicPage.jsx
import React, { useState, useEffect, useMemo, useRef } from "react";
import { createPortal } from "react-dom";
import { useParams } from "react-router-dom";
import apiClient from "@/services/api.js";

function useIsMobile() {
    const [mobile, setMobile] = useState(() => window.innerWidth < 640);
    useEffect(() => {
        const h = () => setMobile(window.innerWidth < 640);
        window.addEventListener("resize", h);
        return () => window.removeEventListener("resize", h);
    }, []);
    return mobile;
}

function CniPasteModal({ theme, onCapture, onClose }) {
    const [preview, setPreview] = useState(null);
    const [captured, setCaptured] = useState(null);

    useEffect(() => {
        function onPaste(e) {
            const items = e.clipboardData?.items;
            if (!items) return;
            for (const item of items) {
                if (item.type.startsWith("image/")) {
                    const file = item.getAsFile();
                    if (!file) continue;
                    setCaptured(file);
                    setPreview(URL.createObjectURL(file));
                    break;
                }
            }
        }
        window.addEventListener("paste", onPaste);
        return () => window.removeEventListener("paste", onPaste);
    }, []);

    const ms = {
        overlay: { position: "fixed", inset: 0, backgroundColor: "rgba(0,0,0,0.6)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, padding: "1rem" },
        box: { backgroundColor: theme.surfaceColor, border: `1px solid ${theme.borderColor}`, borderRadius: theme.borderRadius, padding: "2rem", maxWidth: "480px", width: "100%", fontFamily: theme.fontFamily, color: theme.textColor },
        title: { fontWeight: 700, fontSize: "1.1rem", marginBottom: "1rem" },
        hint: { fontSize: "0.875rem", color: theme.textSecondary, marginBottom: "1.5rem", lineHeight: 1.6 },
        kbd: { display: "inline-block", background: "#e2e8f0", border: "1px solid #cbd5e1", borderRadius: "6px", padding: "0.15rem 0.5rem", fontFamily: "monospace", fontWeight: 700, fontSize: "0.9rem" },
        dropzone: { border: `2px dashed ${theme.borderColor}`, borderRadius: "8px", padding: "2rem", textAlign: "center", color: theme.textSecondary, fontSize: "0.875rem", marginBottom: "1rem", minHeight: "80px", display: "flex", alignItems: "center", justifyContent: "center" },
        preview: { width: "100%", borderRadius: "8px", border: `1px solid ${theme.borderColor}`, marginBottom: "1rem", maxHeight: "220px", objectFit: "contain" },
        row: { display: "flex", gap: "0.75rem" },
        btnPrimary: { flex: 1, padding: "0.75rem", borderRadius: "8px", backgroundColor: captured ? theme.buttonColor : "#94a3b8", color: theme.buttonTextColor, border: "none", fontWeight: 700, fontSize: "0.875rem", cursor: captured ? "pointer" : "not-allowed" },
        btnSecondary: { padding: "0.75rem 1.25rem", borderRadius: "8px", backgroundColor: "transparent", color: theme.textSecondary, border: `1px solid ${theme.borderColor}`, fontWeight: 600, fontSize: "0.875rem", cursor: "pointer" },
    };

    return (
        <div style={ms.overlay} onClick={(e) => e.target === e.currentTarget && onClose()}>
            <div style={ms.box}>
                <div style={ms.title}>📋 Envoyer ma pièce d'identité</div>
                <p style={ms.hint}>
                    Faites une capture d'écran de votre pièce d'identité, puis appuyez sur{" "}
                    <span style={ms.kbd}>Ctrl</span> + <span style={ms.kbd}>V</span> pour la coller ici.
                </p>
                {!preview ? (
                    <div style={ms.dropzone}>En attente du collage…</div>
                ) : (
                    <img src={preview} alt="Aperçu CNI" style={ms.preview} />
                )}
                <div style={ms.row}>
                    <button style={ms.btnSecondary} type="button" onClick={onClose}>Annuler</button>
                    <button
                        style={ms.btnPrimary}
                        type="button"
                        disabled={!captured}
                        onClick={() => { if (captured) { onCapture(captured); onClose(); } }}
                    >
                        {captured ? "Confirmer" : "En attente…"}
                    </button>
                </div>
            </div>
        </div>
    );
}

const DEFAULT_FORM_SECTIONS = ["identity", "cni", "items"];

const DEFAULT_THEME = {
    primaryColor: "#4f46e5",
    backgroundColor: "#f8fafc",
    surfaceColor: "#ffffff",
    textColor: "#1e293b",
    textSecondary: "#64748b",
    borderColor: "#e2e8f0",
    fontFamily: "'Inter', system-ui, sans-serif",
    borderRadius: "12px",
    buttonColor: "#4f46e5",
    buttonTextColor: "#ffffff",
    warningColor: "#f59e0b",
    formSections: DEFAULT_FORM_SECTIONS,
    googleFontsUrl: "",
    customCss: "",
    customHtml: "",
};

function mergeTheme(loaded) {
    return { ...DEFAULT_THEME, ...(loaded || {}) };
}

function fmtMoney(v) {
    const n = Number(v ?? 0);
    return Number.isFinite(n)
        ? n.toLocaleString("fr-FR", { style: "currency", currency: "USD", maximumFractionDigits: 2 })
        : "0,00 $US";
}

function today() {
    return new Date().toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" });
}

function generateJustificatif({ firstName, lastName, total, raison }) {
    const name = `${firstName} ${lastName}`.trim() || "[Nom Prénom]";
    const montant = fmtMoney(total);
    const src = raison?.trim() || "[source non précisée]";
    return `Je soussigné(e) ${name} certifie que les biens présentés à l'estimation, d'une valeur totale de ${montant}, proviennent de la source suivante : ${src}. Je déclare sur l'honneur l'exactitude de cette information. Fait le ${today()}.`;
}

export default function PawnshopPublicPage() {
    const { slug } = useParams();
    const isMobile = useIsMobile();
    const [config, setConfig] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [submitting, setSubmitting] = useState(false);
    const [success, setSuccess] = useState(false);

    const [firstName, setFirstName] = useState("");
    const [lastName, setLastName] = useState("");
    const [phoneNumber, setPhoneNumber] = useState("");
    const [iban, setIban] = useState("");
    const [selectedItems, setSelectedItems] = useState({});
    const [raison, setRaison] = useState("");
    const [cniFile, setCniFile] = useState(null);
    const [showCniModal, setShowCniModal] = useState(false);
    const [showAddItem, setShowAddItem] = useState(false);
    const [addSearch, setAddSearch] = useState("");
    const [addProductId, setAddProductId] = useState("");
    const [addQty, setAddQty] = useState("1");

    const theme = useMemo(() => mergeTheme(config?.theme), [config]);
    const [proMount, setProMount] = useState(null);
    const proWrapRef = useRef(null);

    // Pro-mode: inject custom HTML into wrapper div and find form mount point
    const proHtml = theme.customHtml?.trim() || "";
    useEffect(() => {
        if (!proHtml || !proWrapRef.current) return;
        proWrapRef.current.innerHTML = proHtml;
        setProMount(proWrapRef.current.querySelector("#pw-form") || null);
    }, [proHtml]);

    // Inject Google Fonts
    useEffect(() => {
        if (!theme.googleFontsUrl) return;
        const el = document.createElement("link");
        el.rel = "stylesheet";
        el.href = theme.googleFontsUrl;
        document.head.appendChild(el);
        return () => el.remove();
    }, [theme.googleFontsUrl]);

    // Inject custom CSS
    useEffect(() => {
        if (!theme.customCss) return;
        const el = document.createElement("style");
        el.textContent = theme.customCss;
        document.head.appendChild(el);
        return () => el.remove();
    }, [theme.customCss]);

    useEffect(() => {
        setLoading(true);
        apiClient
            .get(`/pawnshop/public/${slug}/config`)
            .then((res) => setConfig(res.data))
            .catch(() => setError("Cette page n'est pas disponible."))
            .finally(() => setLoading(false));
    }, [slug]);

    const items = useMemo(() => {
        if (!config?.products) return [];
        return Object.entries(selectedItems)
            .filter(([, qty]) => Number(qty) > 0)
            .map(([productId, qty]) => {
                const p = config.products.find((p) => String(p.id) === productId);
                return p ? { productId: Number(productId), quantity: Number(qty), product: p } : null;
            })
            .filter(Boolean);
    }, [selectedItems, config]);

    const total = useMemo(() => {
        return items.reduce((sum, i) => sum + Number(i.product.buyPrice) * i.quantity, 0);
    }, [items]);

    const needsJustificatif = total >= 25000;

    const justificatifText = useMemo(() => {
        if (!needsJustificatif) return "";
        return generateJustificatif({ firstName, lastName, total, raison });
    }, [needsJustificatif, firstName, lastName, total, raison]);

    function addItem() {
        const id = String(addProductId);
        const n = Math.max(1, Number(addQty) || 1);
        if (!id) return;
        setSelectedItems((prev) => ({ ...prev, [id]: (prev[id] || 0) + n }));
        setAddProductId("");
        setAddQty("1");
        setAddSearch("");
        setShowAddItem(false);
    }

    function removeItem(productId) {
        setSelectedItems((prev) => {
            const next = { ...prev };
            delete next[String(productId)];
            return next;
        });
    }

    function updateQty(productId, qty) {
        const n = Math.max(0, Number(qty) || 0);
        if (n === 0) removeItem(productId);
        else setSelectedItems((prev) => ({ ...prev, [String(productId)]: n }));
    }

    async function handleSubmit(e) {
        e.preventDefault();
        if (!firstName.trim() || !lastName.trim()) {
            alert("Nom et prénom requis.");
            return;
        }
        if (!phoneNumber.trim()) {
            alert("Numéro de téléphone requis.");
            return;
        }
        if (!iban.trim()) {
            alert("IBAN requis.");
            return;
        }
        if (items.length === 0) {
            alert("Sélectionnez au moins un article.");
            return;
        }
        if (needsJustificatif && !raison.trim()) {
            alert("La justification de l'origine des biens est requise pour ce montant.");
            return;
        }

        setSubmitting(true);
        try {
            const res = await apiClient.post(`/pawnshop/public/${slug}/estimation`, {
                firstName: firstName.trim(),
                lastName: lastName.trim(),
                phoneNumber: phoneNumber.trim(),
                iban: iban.trim(),
                items: items.map((i) => ({ productId: i.productId, quantity: i.quantity })),
                justificatif: needsJustificatif ? justificatifText : null,
            });

            // Upload CNI image if captured
            if (cniFile && res.data?.clientId) {
                try {
                    const fd = new FormData();
                    fd.append("file", cniFile, cniFile.name || "cni.png");
                    await apiClient.post(`/pawnshop/public/${slug}/client/${res.data.clientId}/cni`, fd, {
                        headers: { "Content-Type": "multipart/form-data" },
                    });
                } catch {
                    // CNI upload failure is non-blocking
                }
            }

            setSuccess(true);
        } catch (err) {
            alert(err?.response?.data?.message || "Une erreur s'est produite. Veuillez réessayer.");
        } finally {
            setSubmitting(false);
        }
    }

    const s = {
        page: {
            minHeight: "100vh",
            backgroundColor: theme.backgroundColor,
            fontFamily: theme.fontFamily,
            color: theme.textColor,
            padding: "2rem 1rem",
        },
        container: { maxWidth: "700px", margin: "0 auto" },
        card: {
            backgroundColor: theme.surfaceColor,
            border: `1px solid ${theme.borderColor}`,
            borderRadius: theme.borderRadius,
            padding: "1.5rem",
            marginBottom: "1.5rem",
        },
        h1: { fontSize: "1.75rem", fontWeight: 700, marginBottom: "0.25rem", margin: 0 },
        h2: { fontSize: "1.1rem", fontWeight: 600, marginBottom: "1rem", color: theme.textColor, margin: "0 0 1rem 0" },
        label: {
            display: "block",
            fontSize: "0.75rem",
            fontWeight: 600,
            textTransform: "uppercase",
            letterSpacing: "0.05em",
            marginBottom: "0.35rem",
            color: theme.textSecondary,
        },
        input: {
            width: "100%",
            padding: "0.625rem 0.875rem",
            borderRadius: "8px",
            border: `1px solid ${theme.borderColor}`,
            fontSize: "0.875rem",
            color: theme.textColor,
            backgroundColor: theme.surfaceColor,
            boxSizing: "border-box",
            outline: "none",
        },
        textarea: {
            width: "100%",
            padding: "0.625rem 0.875rem",
            borderRadius: "8px",
            border: `1px solid ${theme.borderColor}`,
            fontSize: "0.875rem",
            color: theme.textColor,
            backgroundColor: theme.surfaceColor,
            boxSizing: "border-box",
            outline: "none",
            minHeight: "100px",
            resize: "vertical",
        },
        btn: {
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: "0.5rem",
            padding: "0.875rem 2rem",
            borderRadius: "8px",
            backgroundColor: submitting ? `${theme.buttonColor}99` : theme.buttonColor,
            color: theme.buttonTextColor,
            border: "none",
            fontWeight: 700,
            fontSize: "1rem",
            cursor: submitting ? "not-allowed" : "pointer",
            width: "100%",
        },
        row: { display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: "1rem", marginBottom: "1rem" },
        field: { marginBottom: "1rem" },
        productRow: {
            display: "flex",
            alignItems: isMobile ? "flex-start" : "center",
            flexWrap: "wrap",
            gap: "0.5rem",
            padding: "0.625rem 0",
            borderBottom: `1px solid ${theme.borderColor}`,
        },
        totalRow: {
            display: "flex",
            justifyContent: "space-between",
            padding: "0.75rem 0",
            fontWeight: 700,
            fontSize: "1.1rem",
            borderTop: `2px solid ${theme.borderColor}`,
            marginTop: "0.5rem",
        },
        warning: {
            backgroundColor: `${theme.warningColor}18`,
            border: `1px solid ${theme.warningColor}50`,
            borderRadius: "8px",
            padding: "1rem",
            marginBottom: "1rem",
        },
        preview: {
            backgroundColor: "#f1f5f9",
            border: `1px solid ${theme.borderColor}`,
            borderRadius: "8px",
            padding: "1rem",
            fontSize: "0.875rem",
            lineHeight: 1.7,
            color: "#334155",
            fontStyle: "italic",
        },
    };

    if (loading) {
        return (
            <div style={{ ...s.page, display: "flex", alignItems: "center", justifyContent: "center" }}>
                <div style={{ color: theme.textSecondary }}>Chargement…</div>
            </div>
        );
    }

    if (error) {
        return (
            <div style={{ ...s.page, display: "flex", alignItems: "center", justifyContent: "center" }}>
                <div style={{ textAlign: "center", color: "#ef4444", fontSize: "1.1rem" }}>{error}</div>
            </div>
        );
    }

    const orderedSections = Array.isArray(theme.formSections) && theme.formSections.length
        ? theme.formSections
        : DEFAULT_FORM_SECTIONS;

    const sectionIdentity = (
        <div key="identity" id="pw-section-identity" style={s.card}>
            <h2 id="pw-section-identity-title" style={s.h2}>Vos informations</h2>
            <div style={s.row}>
                <div>
                    <label htmlFor="pw-field-firstname" style={s.label}>Prénom *</label>
                    <input id="pw-field-firstname" data-field="firstname" style={s.input} value={firstName} onChange={(e) => setFirstName(e.target.value)} required placeholder="Prénom" />
                </div>
                <div>
                    <label htmlFor="pw-field-lastname" style={s.label}>Nom *</label>
                    <input id="pw-field-lastname" data-field="lastname" style={s.input} value={lastName} onChange={(e) => setLastName(e.target.value)} required placeholder="Nom de famille" />
                </div>
            </div>
            <div style={s.row}>
                <div>
                    <label htmlFor="pw-field-phone" style={s.label}>Téléphone *</label>
                    <input id="pw-field-phone" data-field="phone" style={s.input} value={phoneNumber} onChange={(e) => setPhoneNumber(e.target.value)} placeholder="555-5555" type="tel" required />
                </div>
                <div>
                    <label htmlFor="pw-field-iban" style={s.label}>IBAN *</label>
                    <input id="pw-field-iban" data-field="iban" style={s.input} value={iban} onChange={(e) => setIban(e.target.value)} placeholder="XXXXX" required />
                </div>
            </div>
        </div>
    );

    const sectionCni = (
        <div key="cni" id="pw-section-cni" style={s.card}>
            <h2 style={s.h2}>Pièce d'identité</h2>
            <div style={s.field}>
                <button type="button" onClick={() => setShowCniModal(true)} style={{ display: "flex", alignItems: "center", gap: "0.5rem", padding: "0.625rem 1rem", borderRadius: "8px", border: cniFile ? `2px solid ${theme.primaryColor}` : `1px dashed ${theme.borderColor}`, backgroundColor: cniFile ? `${theme.primaryColor}12` : "transparent", color: cniFile ? theme.primaryColor : theme.textSecondary, fontWeight: 600, fontSize: "0.875rem", cursor: "pointer", width: "100%" }}>
                    <span>{cniFile ? "✅ Pièce d'identité capturée" : "📋 Envoyer ma carte d'identité"}</span>
                    {cniFile && <span style={{ marginLeft: "auto", fontSize: "0.75rem", color: theme.textSecondary }}>Cliquer pour remplacer</span>}
                </button>
            </div>
        </div>
    );

    const sectionItems = (
        <div key="items" id="pw-section-items" style={s.card}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "1rem" }}>
                <h2 style={{ ...s.h2, margin: 0 }}>Articles à estimer</h2>
                <button type="button" onClick={() => setShowAddItem(true)} style={{ display: "flex", alignItems: "center", gap: "0.4rem", padding: "0.5rem 1rem", borderRadius: "8px", backgroundColor: theme.buttonColor, color: theme.buttonTextColor, border: "none", fontWeight: 700, fontSize: "0.8rem", cursor: "pointer" }}>
                    + Ajouter
                </button>
            </div>
            {showAddItem && (() => {
                const filtered = (config.products || []).filter(p => !addSearch.trim() || p.name.toLowerCase().includes(addSearch.toLowerCase())).slice(0, 8);
                const sel = addProductId ? (config.products || []).find(p => String(p.id) === addProductId) : null;
                return (
                    <div style={{ border: `1px solid ${theme.primaryColor}40`, borderRadius: "8px", padding: "1rem", marginBottom: "1rem", backgroundColor: `${theme.primaryColor}08` }}>
                        <div style={{ fontSize: "0.8rem", fontWeight: 600, marginBottom: "0.5rem", color: theme.textSecondary }}>Rechercher un article</div>
                        <input style={{ ...s.input, marginBottom: "0.5rem" }} value={addSearch} onChange={e => { setAddSearch(e.target.value); setAddProductId(""); }} placeholder="Nom de l'article…" autoFocus />
                        {!sel && filtered.length > 0 && (
                            <div style={{ border: `1px solid ${theme.borderColor}`, borderRadius: "8px", overflow: "hidden", marginBottom: "0.5rem", maxHeight: "200px", overflowY: "auto" }}>
                                {filtered.map(p => (
                                    <button key={p.id} type="button" onClick={() => { setAddProductId(String(p.id)); setAddSearch(p.name); }} style={{ display: "flex", justifyContent: "space-between", width: "100%", padding: "0.6rem 0.875rem", background: "none", border: "none", borderBottom: `1px solid ${theme.borderColor}`, cursor: "pointer", fontSize: "0.875rem", textAlign: "left", color: theme.textColor }}>
                                        <span>{p.name}</span>
                                        <span style={{ color: theme.textSecondary, whiteSpace: "nowrap", marginLeft: "1rem" }}>{fmtMoney(p.buyPrice)}</span>
                                    </button>
                                ))}
                            </div>
                        )}
                        {sel && (
                            <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginBottom: "0.5rem", flexWrap: "wrap" }}>
                                <div style={{ flex: 1, fontSize: "0.875rem", fontWeight: 600 }}>{sel.name}</div>
                                <div style={{ fontSize: "0.875rem", color: theme.textSecondary }}>{fmtMoney(sel.buyPrice)} / u.</div>
                                <div style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
                                    <span style={{ fontSize: "0.75rem", color: theme.textSecondary }}>Qté</span>
                                    <input type="number" min="1" value={addQty} onChange={e => setAddQty(e.target.value)} style={{ ...s.input, width: "64px", textAlign: "center", padding: "0.3rem 0.4rem" }} />
                                </div>
                            </div>
                        )}
                        <div style={{ display: "flex", gap: "0.5rem" }}>
                            <button type="button" onClick={() => { setShowAddItem(false); setAddSearch(""); setAddProductId(""); setAddQty("1"); }} style={{ padding: "0.5rem 0.875rem", borderRadius: "6px", border: `1px solid ${theme.borderColor}`, background: "transparent", color: theme.textSecondary, fontSize: "0.8rem", cursor: "pointer" }}>Annuler</button>
                            <button type="button" onClick={addItem} disabled={!addProductId} style={{ padding: "0.5rem 1rem", borderRadius: "6px", border: "none", backgroundColor: addProductId ? theme.buttonColor : "#94a3b8", color: theme.buttonTextColor, fontWeight: 700, fontSize: "0.8rem", cursor: addProductId ? "pointer" : "not-allowed" }}>Ajouter</button>
                        </div>
                    </div>
                );
            })()}
            {items.length === 0 ? (
                <div style={{ color: theme.textSecondary, fontSize: "0.875rem", padding: "1rem 0", textAlign: "center" }}>Aucun article ajouté. Cliquez sur "+ Ajouter".</div>
            ) : (
                <>
                    {items.map(i => (
                        <div key={i.productId} style={s.productRow}>
                            <div style={{ flex: 1, fontSize: "0.875rem", fontWeight: 600 }}>{i.product.name}</div>
                            <div style={{ fontSize: "0.8rem", color: theme.textSecondary, whiteSpace: "nowrap" }}>{fmtMoney(i.product.buyPrice)} / u.</div>
                            <input type="number" min="1" value={i.quantity} onChange={e => updateQty(i.productId, e.target.value)} style={{ ...s.input, width: "64px", textAlign: "center", padding: "0.3rem 0.4rem" }} />
                            <div style={{ fontSize: "0.875rem", fontWeight: 700, whiteSpace: "nowrap", color: theme.primaryColor }}>{fmtMoney(Number(i.product.buyPrice) * i.quantity)}</div>
                            <button type="button" onClick={() => removeItem(i.productId)} style={{ background: "none", border: "none", cursor: "pointer", color: "#ef4444", fontSize: "1rem", lineHeight: 1, padding: "0.25rem" }}>✕</button>
                        </div>
                    ))}
                    <div style={s.totalRow}>
                        <span>Total estimé</span>
                        <span style={{ color: theme.primaryColor }}>{fmtMoney(total)}</span>
                    </div>
                </>
            )}
        </div>
    );

    const SECTION_MAP = { identity: sectionIdentity, cni: sectionCni, items: sectionItems };

    const formContent = success ? (
        <div style={proHtml && proMount ? {} : s.container}>
            <div style={{ ...s.card, textAlign: "center", padding: "3rem 1.5rem" }}>
                <div style={{ fontSize: "3rem", marginBottom: "1rem" }}>✅</div>
                <h2 style={{ fontSize: "1.5rem", fontWeight: 700, marginBottom: "0.5rem" }}>
                    Estimation soumise !
                </h2>
                <p style={{ color: theme.textSecondary }}>
                    Votre demande a bien été enregistrée. Nous vous contacterons prochainement.
                </p>
            </div>
        </div>
    ) : (
        <div style={proHtml && proMount ? {} : s.container}>
            {showCniModal && (
                <CniPasteModal
                    theme={theme}
                    onCapture={(file) => setCniFile(file)}
                    onClose={() => setShowCniModal(false)}
                />
            )}
            {!proHtml && (
                <div style={{ marginBottom: "2rem", textAlign: "center" }}>
                    {config.logoUrl && (
                        <img src={config.logoUrl} alt="Logo" style={{ height: "60px", marginBottom: "1rem" }} />
                    )}
                    <h1 style={s.h1}>{config.shopName}</h1>
                    {config.welcomeText && (
                        <p style={{ color: theme.textSecondary, marginTop: "0.5rem" }}>{config.welcomeText}</p>
                    )}
                </div>
            )}
            <form onSubmit={handleSubmit}>
                {orderedSections.map(key => SECTION_MAP[key] || null)}

                {needsJustificatif && (
                    <div id="pw-section-justificatif" style={s.card}>
                        <div style={s.warning}>
                            <strong>⚠️ Déclaration d'origine des biens requise</strong>
                            <p style={{ margin: "0.5rem 0 0", fontSize: "0.875rem" }}>Le montant total dépasse 25 000 $. Conformément à la réglementation, vous devez indiquer la provenance des biens présentés à l'estimation.</p>
                        </div>
                        <div style={s.field}>
                            <label style={s.label}>Provenance des biens *</label>
                            <textarea style={s.textarea} value={raison} onChange={(e) => setRaison(e.target.value)} placeholder="Ex : vide-grenier, brocante, récupération en décharge, héritage, succession…" required={needsJustificatif} />
                        </div>
                        {raison.trim() && (
                            <div>
                                <label style={{ ...s.label, marginBottom: "0.5rem" }}>Aperçu de la déclaration générée</label>
                                <div style={s.preview}>{justificatifText}</div>
                            </div>
                        )}
                    </div>
                )}

                <button type="submit" disabled={submitting} style={s.btn}>
                    {submitting ? "Envoi en cours…" : "Soumettre mon estimation"}
                </button>
            </form>
            <p style={{ textAlign: "center", marginTop: "1.5rem", fontSize: "0.75rem", color: theme.textSecondary }}>
                Vos données sont utilisées uniquement dans le cadre de cette estimation. Aucun paiement n'est effectué à ce stade.
            </p>
        </div>
    );

    if (proHtml) {
        // No React wrapper background/padding — custom HTML controls the full page layout
        return (
            <>
                <div ref={proWrapRef} style={{ minHeight: "100vh" }} />
                {proMount
                    ? createPortal(formContent, proMount)
                    : <div style={s.page}>{formContent}</div>
                }
            </>
        );
    }

    return <div style={s.page}>{formContent}</div>;
}
