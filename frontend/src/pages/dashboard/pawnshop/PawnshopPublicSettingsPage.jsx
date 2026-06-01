// frontend/src/pages/dashboard/pawnshop/PawnshopPublicSettingsPage.jsx
import React, { useState, useEffect, lazy, Suspense } from "react";
import toast from "react-hot-toast";
import { ExternalLink, Save, RefreshCw, RotateCcw, Copy, Code2, ChevronDown, ChevronUp } from "lucide-react";
const MonacoEditor = lazy(() => import("@monaco-editor/react").then(m => ({ default: m.default })));
import { useCompany } from "@/contexts/CompanyContext.jsx";
import { usePermissions } from "@/contexts/PermissionsContext.jsx";
import Spinner from "@/components/ui/Spinner";
import { getPublicPageConfig, updatePublicPageConfig } from "@/services/pawnshopService.js";

function GlassCard({ title, subtitle, children, className = "" }) {
    return (
        <div
            className={[
                "relative rounded-3xl p-6 overflow-hidden bg-cca-surface/30 border border-cca-border/40 backdrop-blur-2xl shadow-2xl shadow-black/30",
                className,
            ].join(" ")}
        >
            <div className="pointer-events-none absolute inset-0 opacity-25 mix-blend-soft-light [background:radial-gradient(circle_at_top_left,rgba(99,102,241,0.15),transparent_55%)]" />
            {title && (
                <div className="relative mb-4">
                    <div className="text-xl font-bold text-cca-textPrimary">{title}</div>
                    {subtitle && <div className="text-sm text-cca-textSecondary/40 mt-1">{subtitle}</div>}
                </div>
            )}
            <div className="relative">{children}</div>
        </div>
    );
}

function Field({ label, hint, children }) {
    return (
        <div className="mb-4">
            <div className="text-[10px] uppercase tracking-widest font-black text-cca-textSecondary/40 mb-1">
                {label}
            </div>
            {children}
            {hint && <div className="text-[10px] text-cca-textSecondary/30 mt-1">{hint}</div>}
        </div>
    );
}

function GlassInput({ className = "", ...props }) {
    return (
        <input
            className={[
                "w-full px-4 py-2 rounded-xl text-sm bg-cca-base/40 border border-cca-border/40 text-cca-textPrimary placeholder:text-cca-textSecondary/40 focus:outline-none focus:ring-2 focus:ring-brand-primary/20 transition-all",
                className,
            ].join(" ")}
            {...props}
        />
    );
}

function GlassTextarea({ className = "", ...props }) {
    return (
        <textarea
            className={[
                "w-full px-4 py-2 rounded-xl text-sm bg-cca-base/40 border border-cca-border/40 text-cca-textPrimary placeholder:text-cca-textSecondary/40 focus:outline-none focus:ring-2 focus:ring-brand-primary/20 transition-all resize-none",
                className,
            ].join(" ")}
            rows={3}
            {...props}
        />
    );
}

const SECTION_LABELS = {
    identity: "Identité (Prénom, Nom, Téléphone, IBAN)",
    cni: "Pièce d'identité (photo)",
    items: "Articles à estimer",
};
const DEFAULT_FORM_SECTIONS = ["identity", "cni", "items"];

const DEFAULT_THEME = {
    primaryColor: "#4f46e5",
    backgroundColor: "#f8fafc",
    surfaceColor: "#ffffff",
    textColor: "#1e293b",
    textSecondary: "#64748b",
    borderColor: "#e2e8f0",
    fontFamily: "system-ui, sans-serif",
    borderRadius: "12px",
    buttonColor: "#4f46e5",
    buttonTextColor: "#ffffff",
    googleFontsUrl: "",
    customCss: "",
    customHtml: "",
    formSections: DEFAULT_FORM_SECTIONS,
};

const EXAMPLE_CSS = `/* Exemple de CSS personnalisé */

/* Fond dégradé animé */
body {
  background: linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%);
  min-height: 100vh;
  animation: bgShift 8s ease infinite alternate;
}

@keyframes bgShift {
  from { filter: hue-rotate(0deg); }
  to   { filter: hue-rotate(30deg); }
}

/* Cartes avec effet glassmorphism */
form > div {
  background: rgba(255, 255, 255, 0.05) !important;
  backdrop-filter: blur(16px) !important;
  border: 1px solid rgba(255, 255, 255, 0.1) !important;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3) !important;
  color: #e2e8f0 !important;
}

/* Champs de formulaire sombres */
input, textarea {
  background: rgba(0, 0, 0, 0.3) !important;
  border: 1px solid rgba(255, 255, 255, 0.15) !important;
  color: #f1f5f9 !important;
  border-radius: 10px !important;
}
input::placeholder, textarea::placeholder {
  color: rgba(255,255,255,0.3) !important;
}

/* Bouton avec effet néon */
button[type="submit"] {
  background: linear-gradient(90deg, #6366f1, #8b5cf6) !important;
  box-shadow: 0 0 20px rgba(99,102,241,0.5) !important;
  transition: box-shadow 0.3s ease !important;
}
button[type="submit"]:hover {
  box-shadow: 0 0 35px rgba(139,92,246,0.8) !important;
}
`;

const EXAMPLE_HTML = `<!-- Exemple de wrapper HTML personnalisé -->
<!-- Le formulaire sera injecté dans <div id="pw-form"></div> -->

<div style="min-height:100vh; background: linear-gradient(135deg,#0f0c29,#302b63,#24243e); padding: 2rem 1rem; font-family: 'Inter', system-ui, sans-serif;">

  <!-- En-tête personnalisé -->
  <header style="text-align:center; padding: 2rem 0 3rem;">
    <div style="display:inline-block; background:rgba(255,255,255,0.05); border:1px solid rgba(255,255,255,0.1); border-radius:999px; padding:0.4rem 1.2rem; font-size:0.75rem; color:#a78bfa; letter-spacing:0.1em; text-transform:uppercase; margin-bottom:1rem;">
      🏆 Estimation en ligne
    </div>
    <h1 style="font-size:2.5rem; font-weight:900; color:#fff; margin:0 0 0.5rem; letter-spacing:-0.02em;">
      Mon Pawnshop
    </h1>
    <p style="color:rgba(255,255,255,0.5); font-size:1rem; margin:0;">
      Obtenez une estimation gratuite en quelques minutes
    </p>
  </header>

  <!-- Le formulaire est injecté ici -->
  <div id="pw-form" style="max-width:640px; margin:0 auto;"></div>

  <!-- Pied de page -->
  <footer style="text-align:center; margin-top:3rem; color:rgba(255,255,255,0.2); font-size:0.75rem;">
    © 2025 Mon Pawnshop — Tous droits réservés
  </footer>

</div>
`;

const THEME_FIELDS = [
    { key: "primaryColor", label: "Couleur principale", type: "color" },
    { key: "backgroundColor", label: "Fond de page", type: "color" },
    { key: "surfaceColor", label: "Fond des cartes", type: "color" },
    { key: "textColor", label: "Texte principal", type: "color" },
    { key: "textSecondary", label: "Texte secondaire", type: "color" },
    { key: "borderColor", label: "Bordures", type: "color" },
    { key: "buttonColor", label: "Bouton principal", type: "color" },
    { key: "buttonTextColor", label: "Texte bouton", type: "color" },
    { key: "fontFamily", label: "Police (CSS font-family)", type: "text", placeholder: "system-ui, sans-serif" },
    { key: "borderRadius", label: "Arrondi des coins", type: "text", placeholder: "12px" },
];

export default function PawnshopPublicSettingsPage() {
    const { activeCompanyId } = useCompany();
    const { has, isReady } = usePermissions();
    const canManage = has("PAWNSHOP.PUBLIC_PAGE.MANAGE");

    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [regenerateSlug, setRegenerateSlug] = useState(false);
    const [showAdvanced, setShowAdvanced] = useState(false);

    const [publicSlug, setPublicSlug] = useState("");
    const [isEnabled, setIsEnabled] = useState(true);
    const [shopName, setShopName] = useState("");
    const [logoUrl, setLogoUrl] = useState("");
    const [welcomeText, setWelcomeText] = useState("");
    const [theme, setTheme] = useState({ ...DEFAULT_THEME });

    const publicUrl = publicSlug ? `${window.location.origin}/pawnshop/${publicSlug}` : null;

    useEffect(() => {
        if (!isReady || !activeCompanyId) return;
        setLoading(true);
        getPublicPageConfig()
            .then((data) => {
                if (data?.publicSlug) {
                    setPublicSlug(data.publicSlug);
                    setIsEnabled(data.isEnabled ?? true);
                    setShopName(data.shopName || "");
                    setLogoUrl(data.logoUrl || "");
                    setWelcomeText(data.welcomeText || "");
                    if (data.theme) {
                        try {
                            setTheme({ ...DEFAULT_THEME, ...JSON.parse(data.theme) });
                        } catch { /* intentional */ }
                    }
                }
            })
            .catch(() => toast.error("Impossible de charger la configuration."))
            .finally(() => setLoading(false));
    }, [isReady, activeCompanyId]);

    function updateTheme(key, value) {
        setTheme((prev) => ({ ...prev, [key]: value }));
    }

    async function handleSave() {
        setSaving(true);
        try {
            const res = await updatePublicPageConfig({
                regenerateSlug,
                isEnabled,
                shopName: shopName.trim() || null,
                logoUrl: logoUrl.trim() || null,
                welcomeText: welcomeText.trim() || null,
                theme,
            });
            if (res?.publicSlug) setPublicSlug(res.publicSlug);
            setRegenerateSlug(false);
            toast.success("Configuration sauvegardée.");
        } catch (e) {
            toast.error(e?.response?.data?.message || "Sauvegarde impossible.");
        } finally {
            setSaving(false);
        }
    }

    function copySlug() {
        if (publicUrl) {
            navigator.clipboard.writeText(publicUrl).then(() => toast.success("URL copiée !"));
        }
    }

    if (!isReady) return <div className="p-6 text-cca-textPrimary">Chargement…</div>;
    if (!canManage) return <div className="p-6 text-cca-textPrimary">Accès refusé.</div>;

    return (
        <div className="space-y-8 text-cca-textPrimary">
            <div className="pb-2 flex items-start justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold tracking-wide">Page publique — Configuration</h1>
                    <p className="text-cca-textSecondary/40 text-sm mt-1">
                        Personnalisez la page de soumission d'estimation accessible sans connexion.
                    </p>
                </div>
                {publicUrl && (
                    <a
                        href={publicUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest inline-flex items-center gap-2 bg-cca-base/40 hover:bg-cca-base/60 border border-cca-border/40 backdrop-blur-xl transition-all"
                    >
                        <ExternalLink size={16} /> Voir la page
                    </a>
                )}
            </div>

            {loading ? (
                <div className="flex justify-center py-12">
                    <Spinner />
                </div>
            ) : (
                <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-[1fr_1.3fr] gap-6">
                    {/* General */}
                    <div className="space-y-6">
                        <GlassCard title="Paramètres généraux">
                            <Field label="Identifiant public (slug)">
                                <div className="flex items-center gap-2">
                                    <div className="flex-1 px-4 py-2 rounded-xl text-sm bg-cca-base/20 border border-cca-border/30 text-cca-textPrimary font-mono tracking-wider">
                                        {publicSlug || <span className="text-cca-textSecondary/40 font-sans">Généré à la première sauvegarde</span>}
                                    </div>
                                    {publicSlug && (
                                        <button type="button" onClick={copySlug}
                                            className="p-2 rounded-lg bg-cca-base/40 border border-cca-border/40 hover:bg-cca-base/60 transition-all"
                                            title="Copier l'URL">
                                            <Copy size={14} />
                                        </button>
                                    )}
                                    <button type="button"
                                        onClick={() => setRegenerateSlug(true)}
                                        className={["p-2 rounded-lg border transition-all", regenerateSlug ? "bg-amber-600/20 border-amber-500/40 text-amber-300" : "bg-cca-base/40 border-cca-border/40 hover:bg-cca-base/60"].join(" ")}
                                        title="Régénérer le slug (appliqué à la sauvegarde)">
                                        <RotateCcw size={14} />
                                    </button>
                                </div>
                                {regenerateSlug && (
                                    <div className="text-[10px] text-amber-400 mt-1">
                                        ⚠ Un nouveau code sera généré à la sauvegarde. L'ancien lien ne fonctionnera plus.
                                    </div>
                                )}
                                {publicSlug && !regenerateSlug && (
                                    <div className="text-[10px] text-cca-textSecondary/30 mt-1 break-all">
                                        {window.location.origin}/pawnshop/{publicSlug}
                                    </div>
                                )}
                            </Field>
                            <Field label="Statut">
                                <label className="flex items-center gap-3 cursor-pointer">
                                    <input
                                        type="checkbox"
                                        checked={isEnabled}
                                        onChange={(e) => setIsEnabled(e.target.checked)}
                                        className="w-5 h-5 rounded accent-indigo-500"
                                    />
                                    <span className="text-sm">
                                        {isEnabled
                                            ? "Page activée (accessible au public)"
                                            : "Page désactivée"}
                                    </span>
                                </label>
                            </Field>
                            <Field label="Nom de la boutique">
                                <GlassInput
                                    value={shopName}
                                    onChange={(e) => setShopName(e.target.value)}
                                    placeholder="Mon Pawnshop"
                                />
                            </Field>
                            <Field label="URL du logo" hint="Lien direct vers une image (https://)">
                                <GlassInput
                                    value={logoUrl}
                                    onChange={(e) => setLogoUrl(e.target.value)}
                                    placeholder="https://…"
                                    type="url"
                                />
                            </Field>
                            <Field label="Texte de bienvenue">
                                <GlassTextarea
                                    value={welcomeText}
                                    onChange={(e) => setWelcomeText(e.target.value)}
                                    placeholder="Bienvenue ! Remplissez ce formulaire pour obtenir une estimation de vos objets."
                                />
                            </Field>
                            <Field label="Ordre des sections du formulaire" hint="Utilisez ↑ ↓ pour réordonner les blocs du formulaire public">
                                <div className="space-y-1">
                                    {(theme.formSections || DEFAULT_FORM_SECTIONS).map((key, idx, arr) => (
                                        <div key={key} className="flex items-center gap-2 px-3 py-2 rounded-xl bg-cca-base/30 border border-cca-border/30 text-sm">
                                            <span className="flex-1 text-cca-textPrimary">{SECTION_LABELS[key] || key}</span>
                                            <button
                                                type="button"
                                                disabled={idx === 0}
                                                onClick={() => {
                                                    const s = [...arr];
                                                    [s[idx - 1], s[idx]] = [s[idx], s[idx - 1]];
                                                    updateTheme("formSections", s);
                                                }}
                                                className="p-1 rounded-lg hover:bg-cca-border/40 disabled:opacity-20 disabled:cursor-not-allowed transition-colors text-cca-textSecondary"
                                            >↑</button>
                                            <button
                                                type="button"
                                                disabled={idx === arr.length - 1}
                                                onClick={() => {
                                                    const s = [...arr];
                                                    [s[idx], s[idx + 1]] = [s[idx + 1], s[idx]];
                                                    updateTheme("formSections", s);
                                                }}
                                                className="p-1 rounded-lg hover:bg-cca-border/40 disabled:opacity-20 disabled:cursor-not-allowed transition-colors text-cca-textSecondary"
                                            >↓</button>
                                        </div>
                                    ))}
                                </div>
                            </Field>
                        </GlassCard>
                    </div>

                    {/* Theme + Advanced */}
                    <div className="space-y-6">
                        <GlassCard title="Thème & apparence" subtitle="Personnalisation visuelle de la page publique">
                            <div className="grid grid-cols-2 gap-3">
                                {THEME_FIELDS.map((f) => (
                                    <div key={f.key}>
                                        <div className="text-[10px] uppercase tracking-widest font-black text-cca-textSecondary/40 mb-1">{f.label}</div>
                                        {f.type === "color" ? (
                                            <div className="flex items-center gap-2">
                                                <input type="color" value={theme[f.key] || "#000000"} onChange={(e) => updateTheme(f.key, e.target.value)} className="h-9 w-12 rounded-lg border border-cca-border/40 cursor-pointer bg-transparent" />
                                                <GlassInput value={theme[f.key] || ""} onChange={(e) => updateTheme(f.key, e.target.value)} className="text-xs" placeholder="#000000" />
                                            </div>
                                        ) : (
                                            <GlassInput value={theme[f.key] || ""} onChange={(e) => updateTheme(f.key, e.target.value)} placeholder={f.placeholder} />
                                        )}
                                    </div>
                                ))}
                            </div>

                            {/* Google Fonts */}
                            <div className="mt-4 pt-4 border-t border-cca-border/30">
                                <Field label="Google Fonts URL" hint="Ex: https://fonts.googleapis.com/css2?family=Playfair+Display — la police sera chargée sur la page publique">
                                    <GlassInput
                                        value={theme.googleFontsUrl || ""}
                                        onChange={(e) => updateTheme("googleFontsUrl", e.target.value)}
                                        placeholder="https://fonts.googleapis.com/css2?family=…"
                                        type="url"
                                    />
                                </Field>
                            </div>

                            {/* Live preview */}
                            <div className="mt-4 pt-4 border-t border-cca-border/30">
                                <div className="text-[10px] uppercase tracking-widest font-black text-cca-textSecondary/40 mb-2">Prévisualisation</div>
                                <div style={{ backgroundColor: theme.surfaceColor, border: `1px solid ${theme.borderColor}`, borderRadius: theme.borderRadius, padding: "1rem", fontFamily: theme.fontFamily, color: theme.textColor }}>
                                    <div style={{ fontWeight: 700, fontSize: "1rem", marginBottom: "0.5rem" }}>{shopName || "Mon Pawnshop"}</div>
                                    <div style={{ fontSize: "0.75rem", color: theme.textSecondary, marginBottom: "1rem" }}>{welcomeText || "Bienvenue !"}</div>
                                    <button style={{ backgroundColor: theme.buttonColor, color: theme.buttonTextColor, border: "none", borderRadius: "8px", padding: "0.5rem 1.25rem", fontWeight: 700, fontSize: "0.75rem", cursor: "default" }}>Soumettre</button>
                                </div>
                            </div>
                        </GlassCard>

                        {/* Advanced / Pro mode */}
                        <GlassCard>
                            <button
                                type="button"
                                onClick={() => setShowAdvanced(v => !v)}
                                className="flex items-center gap-2 w-full text-left"
                            >
                                <Code2 size={16} className="text-indigo-400" />
                                <span className="text-sm font-bold text-cca-textPrimary flex-1">Mode avancé — CSS &amp; HTML personnalisé</span>
                                {showAdvanced ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                            </button>
                            {showAdvanced && (
                                <div className="mt-4 space-y-5">
                                    <div>
                                        <div className="flex items-center justify-between mb-1">
                                            <div className="text-[10px] uppercase tracking-widest font-black text-cca-textSecondary/40">CSS personnalisé</div>
                                            <button type="button" onClick={() => updateTheme("customCss", EXAMPLE_CSS)} className="text-[10px] font-semibold text-indigo-400 hover:text-indigo-300 transition-colors">Voir un exemple</button>
                                        </div>
                                        <div className="text-[10px] text-cca-textSecondary/30 mb-2">Injecté en &lt;style&gt; sur la page publique. Utilisez <code className="text-indigo-400">.pw-*</code> pour cibler les éléments du formulaire.</div>
                                        <div className="rounded-xl overflow-hidden border border-cca-border/40" style={{ height: 240 }}>
                                            <Suspense fallback={<div className="h-full flex items-center justify-center text-cca-textSecondary/40 text-sm">Chargement…</div>}>
                                                <MonacoEditor
                                                    height="240px"
                                                    language="css"
                                                    theme="vs-dark"
                                                    value={theme.customCss || ""}
                                                    onChange={(v) => updateTheme("customCss", v || "")}
                                                    options={{ minimap: { enabled: false }, fontSize: 13, lineNumbers: "off", scrollBeyondLastLine: false, wordWrap: "on" }}
                                                />
                                            </Suspense>
                                        </div>
                                    </div>
                                    <div>
                                        <div className="flex items-center justify-between mb-1">
                                            <div className="text-[10px] uppercase tracking-widest font-black text-cca-textSecondary/40">HTML personnalisé (wrapper de page)</div>
                                            <button type="button" onClick={() => updateTheme("customHtml", EXAMPLE_HTML)} className="text-[10px] font-semibold text-indigo-400 hover:text-indigo-300 transition-colors">Voir un exemple</button>
                                        </div>
                                        <div className="text-[10px] text-cca-textSecondary/30 mb-2">Remplace l'enveloppe de la page. Ajoutez <code className="text-indigo-400">&lt;div id="pw-form"&gt;&lt;/div&gt;</code> pour injecter le formulaire à l'emplacement voulu. Si absent, le formulaire s'affiche en bas.</div>
                                        <div className="rounded-xl overflow-hidden border border-cca-border/40" style={{ height: 320 }}>
                                            <Suspense fallback={<div className="h-full flex items-center justify-center text-cca-textSecondary/40 text-sm">Chargement…</div>}>
                                                <MonacoEditor
                                                    height="320px"
                                                    language="html"
                                                    theme="vs-dark"
                                                    value={theme.customHtml || ""}
                                                    onChange={(v) => updateTheme("customHtml", v || "")}
                                                    options={{ minimap: { enabled: false }, fontSize: 13, scrollBeyondLastLine: false, wordWrap: "on", formatOnPaste: true }}
                                                />
                                            </Suspense>
                                        </div>
                                        {theme.customHtml?.trim() && (
                                            <div className="text-[10px] text-amber-400 mt-1">
                                                ⚠ Mode HTML actif — le thème couleurs/police est remplacé par votre code.
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}
                        </GlassCard>
                    </div>
                </div>
            )}

            {!loading && (
                <div className="flex justify-end">
                    <button
                        onClick={handleSave}
                        disabled={saving}
                        className="px-6 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest inline-flex items-center gap-2 bg-indigo-600/30 hover:bg-indigo-600/40 border border-indigo-500/40 backdrop-blur-xl transition-all active:scale-95 disabled:opacity-50"
                    >
                        {saving ? <RefreshCw size={16} className="animate-spin" /> : <Save size={16} />}
                        {saving ? "Sauvegarde…" : "Sauvegarder"}
                    </button>
                </div>
            )}
        </div>
    );
}
