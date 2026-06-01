// frontend/src/pages/dashboard/pawnshop/PawnshopPublicDocsPage.jsx
import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { usePermissions } from "@/contexts/PermissionsContext.jsx";
import { ChevronDown, ChevronUp, ArrowLeft, Copy, Check } from "lucide-react";

function useCopy() {
    const [copied, setCopied] = useState("");
    function copy(text, key) {
        navigator.clipboard.writeText(text).catch(() => {});
        setCopied(key);
        setTimeout(() => setCopied(""), 1500);
    }
    return { copied, copy };
}

function Section({ title, children, defaultOpen = false }) {
    const [open, setOpen] = useState(defaultOpen);
    return (
        <div className="rounded-2xl border border-cca-border/40 bg-cca-surface/20 overflow-hidden">
            <button
                type="button"
                onClick={() => setOpen(v => !v)}
                className="w-full flex items-center justify-between px-4 sm:px-5 py-4 text-left hover:bg-cca-base/20 transition-colors gap-3"
            >
                <span className="font-bold text-cca-textPrimary text-sm sm:text-base">{title}</span>
                {open ? <ChevronUp size={15} className="shrink-0 text-cca-textSecondary/40" /> : <ChevronDown size={15} className="shrink-0 text-cca-textSecondary/40" />}
            </button>
            {open && (
                <div className="px-4 sm:px-5 pb-5 space-y-4 text-sm text-cca-textSecondary leading-relaxed border-t border-cca-border/20">
                    <div className="pt-4">{children}</div>
                </div>
            )}
        </div>
    );
}

function CopyPre({ code, label }) {
    const { copied, copy } = useCopy();
    return (
        <div className="relative group">
            {label && <div className="text-[10px] uppercase tracking-widest font-black text-cca-textSecondary/40 mb-1">{label}</div>}
            <pre className="bg-[#1a1a2e] border border-cca-border/30 rounded-xl px-4 py-3 text-xs font-mono text-indigo-200 overflow-x-auto whitespace-pre-wrap leading-relaxed pr-10">
                {code}
            </pre>
            <button
                type="button"
                onClick={() => copy(code, label || code.slice(0, 20))}
                className="absolute top-2 right-2 p-1.5 rounded-lg bg-cca-base/60 border border-cca-border/40 opacity-0 group-hover:opacity-100 transition-opacity"
                title="Copier"
            >
                {copied === (label || code.slice(0, 20)) ? <Check size={12} className="text-green-400" /> : <Copy size={12} className="text-cca-textSecondary" />}
            </button>
        </div>
    );
}

function Chip({ children }) {
    return (
        <code className="inline-block bg-indigo-950/60 border border-indigo-500/30 rounded px-1.5 py-0.5 text-indigo-300 font-mono text-[11px]">
            {children}
        </code>
    );
}

function Badge({ color = "indigo", children }) {
    const cls = {
        indigo: "bg-indigo-900/40 text-indigo-300 border-indigo-500/30",
        amber: "bg-amber-900/30 text-amber-300 border-amber-500/30",
        green: "bg-green-900/30 text-green-300 border-green-500/30",
    }[color];
    return <span className={`inline-block border rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${cls}`}>{children}</span>;
}

function Row({ cells }) {
    return (
        <tr className="border-t border-cca-border/20 hover:bg-cca-base/10 align-top">
            {cells.map((c, i) => (
                <td key={i} className="px-3 py-2 text-xs text-cca-textSecondary whitespace-normal">{c}</td>
            ))}
        </tr>
    );
}

function SimpleTable({ head, rows }) {
    return (
        <div className="overflow-x-auto -mx-4 sm:mx-0">
            <table className="w-full min-w-[480px] sm:min-w-0 text-xs rounded-xl border border-cca-border/30 overflow-hidden">
                <thead>
                    <tr className="bg-cca-base/50">
                        {head.map((h, i) => (
                            <th key={i} className="px-3 py-2 text-left text-[10px] uppercase tracking-widest font-black text-cca-textSecondary/50">{h}</th>
                        ))}
                    </tr>
                </thead>
                <tbody>
                    {rows.map((r, i) => <Row key={i} cells={r} />)}
                </tbody>
            </table>
        </div>
    );
}

export default function PawnshopPublicDocsPage() {
    const navigate = useNavigate();
    const { has, isReady } = usePermissions();

    if (!isReady) return null;
    if (!has("PAWNSHOP.PUBLIC_PAGE.MANAGE")) return <div className="p-6 text-cca-textPrimary">Accès refusé.</div>;

    return (
        <div className="space-y-4 text-cca-textPrimary max-w-3xl">
            {/* Header */}
            <div className="flex items-start gap-3">
                <button type="button" onClick={() => navigate("/dashboard/company/pawnshop/public-settings")}
                    className="mt-0.5 p-2 rounded-xl bg-cca-base/40 border border-cca-border/40 hover:bg-cca-base/60 transition-all shrink-0">
                    <ArrowLeft size={15} />
                </button>
                <div>
                    <h1 className="text-xl sm:text-2xl font-bold tracking-wide">Documentation — Page publique</h1>
                    <p className="text-cca-textSecondary/40 text-xs sm:text-sm mt-0.5">
                        Référence complète pour personnaliser la page d'estimation.
                    </p>
                </div>
            </div>

            {/* Quick nav */}
            <div className="flex flex-wrap gap-2 text-[11px]">
                {["Thème", "Google Fonts", "Sections", "CSS", "Sélecteurs", "HTML Pro", "Slug"].map(l => (
                    <span key={l} className="px-2.5 py-1 rounded-full bg-cca-base/40 border border-cca-border/40 text-cca-textSecondary cursor-default">{l}</span>
                ))}
            </div>

            {/* Sections */}
            <Section title="Vue d'ensemble" defaultOpen>
                <p>URL publique : <Chip>/pawnshop/{"<slug>"}</Chip> — accessible sans connexion.</p>
                <p>Trois niveaux de personnalisation :</p>
                <div className="space-y-2 mt-2">
                    <div className="flex items-start gap-2"><Badge color="green">1</Badge><span><strong>Thème</strong> — couleurs, police, arrondis. Aucun code requis.</span></div>
                    <div className="flex items-start gap-2"><Badge color="indigo">2</Badge><span><strong>CSS</strong> — règles CSS injectées dans <Chip>&lt;style&gt;</Chip>. Cible les éléments via IDs et attributs fournis.</span></div>
                    <div className="flex items-start gap-2"><Badge color="amber">3</Badge><span><strong>HTML Pro</strong> — remplace entièrement la structure de la page. Le formulaire s'injecte dans <Chip>#pw-form</Chip>.</span></div>
                </div>
            </Section>

            <Section title="Clés du thème JSON">
                <SimpleTable
                    head={["Clé", "Type", "Défaut", "Description"]}
                    rows={[
                        [<Chip>primaryColor</Chip>, "hex", "#4f46e5", "Couleur principale (accent, totaux)"],
                        [<Chip>backgroundColor</Chip>, "hex", "#f8fafc", "Fond de page"],
                        [<Chip>surfaceColor</Chip>, "hex", "#ffffff", "Fond des cartes"],
                        [<Chip>textColor</Chip>, "hex", "#1e293b", "Texte principal"],
                        [<Chip>textSecondary</Chip>, "hex", "#64748b", "Labels et textes secondaires"],
                        [<Chip>borderColor</Chip>, "hex", "#e2e8f0", "Bordures"],
                        [<Chip>buttonColor</Chip>, "hex", "#4f46e5", "Fond bouton soumettre"],
                        [<Chip>buttonTextColor</Chip>, "hex", "#ffffff", "Texte bouton soumettre"],
                        [<Chip>fontFamily</Chip>, "CSS string", "system-ui", "Police appliquée à toute la page"],
                        [<Chip>borderRadius</Chip>, "CSS string", "12px", "Arrondi des cartes et champs"],
                        [<Chip>googleFontsUrl</Chip>, "URL", "—", "URL Google Fonts injectée en <link>"],
                        [<Chip>formSections</Chip>, "array", '["identity","cni","items"]', "Ordre des sections du formulaire"],
                        [<Chip>customCss</Chip>, "CSS string", "—", "CSS injecté sur la page publique"],
                        [<Chip>customHtml</Chip>, "HTML string", "—", "Wrapper HTML complet (mode pro)"],
                    ]}
                />
            </Section>

            <Section title="Google Fonts">
                <p>Renseignez l'URL complète dans le champ <strong>Google Fonts URL</strong>. Puis mettez à jour <Chip>fontFamily</Chip> avec le nom exact de la police.</p>
                <CopyPre label="Exemple — Playfair Display" code={`Google Fonts URL:
https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;700&display=swap

fontFamily:
'Playfair Display', serif`} />
            </Section>

            <Section title="Ordre des sections du formulaire">
                <p>Réordonnable avec ↑ ↓ dans la configuration. La section <strong>Déclaration +25 000 $</strong> est toujours en dernier (non configurable).</p>
                <SimpleTable
                    head={["Clé", "ID HTML généré", "Contenu"]}
                    rows={[
                        [<Chip>identity</Chip>, <Chip>#pw-section-identity</Chip>, "Prénom, Nom, Téléphone, IBAN"],
                        [<Chip>cni</Chip>, <Chip>#pw-section-cni</Chip>, "Photo pièce d'identité (Ctrl+V)"],
                        [<Chip>items</Chip>, <Chip>#pw-section-items</Chip>, "Articles à estimer"],
                        ["auto", <Chip>#pw-section-justificatif</Chip>, "Déclaration d'origine (+25 000 $)"],
                    ]}
                />
                <CopyPre label="Exemple JSON" code={`"formSections": ["cni", "identity", "items"]
// Photo CNI en premier, puis identité, puis articles`} />
            </Section>

            <Section title="Sélecteurs CSS — référence complète">
                <p className="text-cca-textPrimary font-semibold mb-2">Sections</p>
                <SimpleTable
                    head={["Sélecteur", "Cible"]}
                    rows={[
                        [<Chip>#pw-section-identity</Chip>, "Carte Identité (nom, prénom, tel, IBAN)"],
                        [<Chip>#pw-section-cni</Chip>, "Carte Pièce d'identité"],
                        [<Chip>#pw-section-items</Chip>, "Carte Articles à estimer"],
                        [<Chip>#pw-section-justificatif</Chip>, "Carte Déclaration +25 000 $"],
                    ]}
                />
                <p className="text-cca-textPrimary font-semibold mb-2 mt-4">Champs individuels</p>
                <SimpleTable
                    head={["Sélecteur", "Champ"]}
                    rows={[
                        [<Chip>#pw-field-firstname</Chip>, "Input Prénom"],
                        [<Chip>#pw-field-lastname</Chip>, "Input Nom"],
                        [<Chip>#pw-field-phone</Chip>, "Input Téléphone"],
                        [<Chip>#pw-field-iban</Chip>, "Input IBAN"],
                        [<Chip>input[data-field="firstname"]</Chip>, "Input Prénom (attribut)"],
                        [<Chip>input[data-field="lastname"]</Chip>, "Input Nom (attribut)"],
                        [<Chip>input[data-field="phone"]</Chip>, "Input Téléphone (attribut)"],
                        [<Chip>input[data-field="iban"]</Chip>, "Input IBAN (attribut)"],
                    ]}
                />
                <p className="text-cca-textPrimary font-semibold mb-2 mt-4">Éléments génériques</p>
                <SimpleTable
                    head={["Sélecteur", "Cible"]}
                    rows={[
                        [<Chip>form {">"} div</Chip>, "Toutes les cartes du formulaire"],
                        [<Chip>input, textarea</Chip>, "Tous les champs de saisie"],
                        [<Chip>button[type="submit"]</Chip>, "Bouton Soumettre"],
                        [<Chip>button[type="button"]</Chip>, "Boutons secondaires (Ajouter…)"],
                        [<Chip>#pw-section-identity-title</Chip>, "Titre h2 de la carte identité"],
                    ]}
                />
                <CopyPre label="Exemple — style spécifique par section" code={`/* Section CNI en premier = couleur distincte */
#pw-section-cni {
  background: rgba(99, 102, 241, 0.08) !important;
  border: 1px solid rgba(99, 102, 241, 0.3) !important;
}

/* Masquer le label IBAN (le remettre via placeholder) */
label[for="pw-field-iban"] {
  display: none;
}
#pw-field-iban {
  border: 2px solid #6366f1 !important;
}

/* Fond glassmorphism sur tous les champs */
input, textarea {
  background: rgba(255,255,255,0.06) !important;
  border: 1px solid rgba(255,255,255,0.12) !important;
  color: #f1f5f9 !important;
  border-radius: 10px !important;
}
input::placeholder, textarea::placeholder {
  color: rgba(255,255,255,0.25) !important;
}`} />
            </Section>

            <Section title="CSS personnalisé — exemples prêts à l'emploi">
                <CopyPre label="Fond dégradé animé + glassmorphism" code={`body {
  background: linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%);
  min-height: 100vh;
  animation: bgShift 8s ease infinite alternate;
}
@keyframes bgShift {
  from { filter: hue-rotate(0deg); }
  to   { filter: hue-rotate(30deg); }
}
form > div {
  background: rgba(255,255,255,0.05) !important;
  backdrop-filter: blur(16px) !important;
  border: 1px solid rgba(255,255,255,0.1) !important;
  color: #e2e8f0 !important;
}
input, textarea {
  background: rgba(0,0,0,0.3) !important;
  border: 1px solid rgba(255,255,255,0.15) !important;
  color: #f1f5f9 !important;
}
button[type="submit"] {
  background: linear-gradient(90deg, #6366f1, #8b5cf6) !important;
  box-shadow: 0 0 20px rgba(99,102,241,0.5) !important;
}`} />
                <CopyPre label="Style épuré minimaliste" code={`body { background: #fafafa; font-family: 'Georgia', serif; }
form > div {
  border: none !important;
  border-bottom: 2px solid #e5e7eb !important;
  border-radius: 0 !important;
  background: transparent !important;
}
input, textarea {
  border: none !important;
  border-bottom: 1px solid #d1d5db !important;
  border-radius: 0 !important;
  background: transparent !important;
  padding-left: 0 !important;
}
button[type="submit"] {
  border-radius: 0 !important;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  font-size: 0.75rem;
}`} />
            </Section>

            <Section title="HTML personnalisé (Mode pro)">
                <div className="space-y-2">
                    <p>Remplace l'enveloppe complète de la page. Le formulaire React est injecté dans <Chip>&lt;div id="pw-form"&gt;&lt;/div&gt;</Chip>.</p>
                    <div className="flex flex-col gap-1 text-xs">
                        <span>✅ Si <Chip>#pw-form</Chip> est présent → formulaire injecté à cet emplacement exact.</span>
                        <span>⚠️ Si absent → formulaire affiché en dehors du HTML custom.</span>
                        <span>🚫 Les <Chip>&lt;script&gt;</Chip> dans le HTML ne s'exécutent pas (contexte React).</span>
                    </div>
                </div>
                <CopyPre label="Template minimal" code={`<div style="min-height:100vh; background:#0f172a; padding:2rem 1rem; font-family:system-ui,sans-serif; color:#e2e8f0;">
  <h1 style="text-align:center; font-size:2rem; font-weight:900; margin:0 0 2rem;">Mon Pawnshop</h1>

  <!-- Formulaire injecté ici -->
  <div id="pw-form" style="max-width:640px; margin:0 auto;"></div>

  <footer style="text-align:center; color:#475569; font-size:0.75rem; margin-top:3rem;">
    © 2025 Mon Pawnshop
  </footer>
</div>`} />
                <CopyPre label="Template avancé avec animation" code={`<style>
  @keyframes fadeUp { from { opacity:0; transform:translateY(24px) } to { opacity:1; transform:none } }
  .pw-hero { animation: fadeUp 0.7s ease; }
  .pw-wrap { animation: fadeUp 0.7s ease 0.15s both; }
</style>

<div style="min-height:100vh; background:linear-gradient(135deg,#0f0c29,#302b63,#24243e); padding:2rem 1rem; font-family:'Inter',system-ui,sans-serif; color:#e2e8f0;">

  <div class="pw-hero" style="text-align:center; padding:3rem 0 2rem;">
    <p style="color:#818cf8; font-size:0.7rem; letter-spacing:0.15em; text-transform:uppercase; margin:0 0 0.5rem;">✦ Estimation gratuite ✦</p>
    <h1 style="font-size:2.25rem; font-weight:900; margin:0 0 0.5rem; letter-spacing:-0.02em;">Mon Pawnshop</h1>
    <p style="color:#94a3b8; font-size:0.95rem; margin:0;">Obtenez une offre en quelques minutes, sans engagement.</p>
  </div>

  <div class="pw-wrap">
    <div id="pw-form" style="max-width:620px; margin:0 auto;"></div>
  </div>

  <footer style="text-align:center; margin-top:3rem; color:#334155; font-size:0.7rem;">
    © 2025 Mon Pawnshop — Tous droits réservés
  </footer>
</div>`} />
                <p className="mt-2 text-xs">Combinez avec le <strong>CSS personnalisé</strong> pour styler les champs à l'intérieur de votre wrapper HTML.</p>
            </Section>

            <Section title="Déclaration d'origine des biens (+25 000 $)">
                <p>Quand le total dépasse <strong>25 000 $</strong>, une section supplémentaire apparaît automatiquement (non réordonnable, toujours en dernier).</p>
                <p>Elle génère un texte de déclaration. Lors de la conversion en feuille d'achat, l'employé doit copier ce texte avant de confirmer.</p>
                <p>Sélecteur CSS : <Chip>#pw-section-justificatif</Chip></p>
            </Section>

            <Section title="Gestion du slug (URL publique)">
                <p>Format : <Chip>xxxx-xxxx-xxxx</Chip> (hexadécimal, généré automatiquement à la première sauvegarde).</p>
                <div className="space-y-1 text-xs">
                    <p>• Cliquez sur <strong>↺</strong> pour demander un nouveau code (appliqué à la sauvegarde).</p>
                    <p>• <span className="text-amber-400">⚠ Changer le slug invalide tous les liens déjà partagés.</span></p>
                    <p>• La page peut être désactivée (toggle <strong>Statut</strong>) sans changer le slug.</p>
                </div>
            </Section>
        </div>
    );
}
