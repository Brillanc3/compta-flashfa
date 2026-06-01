import React, { useState } from "react";
import { Link } from "react-router-dom";
import { ChevronDown, ChevronUp, Copy, Check } from "lucide-react";
import { usePermissions } from "@/contexts/PermissionsContext.jsx";

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
                {open
                    ? <ChevronUp size={15} className="shrink-0 text-cca-textSecondary/40" />
                    : <ChevronDown size={15} className="shrink-0 text-cca-textSecondary/40" />}
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
    const key = label || code.slice(0, 20);
    return (
        <div className="relative group">
            {label && <div className="text-[10px] uppercase tracking-widest font-black text-cca-textSecondary/40 mb-1">{label}</div>}
            <pre className="bg-[#1a1a2e] border border-cca-border/30 rounded-xl px-4 py-3 text-xs font-mono text-indigo-200 overflow-x-auto whitespace-pre-wrap leading-relaxed pr-10">
                {code}
            </pre>
            <button
                type="button"
                onClick={() => copy(code, key)}
                className="absolute top-2 right-2 p-1.5 rounded-lg bg-cca-base/60 border border-cca-border/40 opacity-0 group-hover:opacity-100 transition-opacity"
                title="Copier"
            >
                {copied === key
                    ? <Check size={12} className="text-green-400" />
                    : <Copy size={12} className="text-cca-textSecondary" />}
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
        amber:  "bg-amber-900/30 text-amber-300 border-amber-500/30",
        green:  "bg-green-900/30 text-green-300 border-green-500/30",
        red:    "bg-red-900/30 text-red-300 border-red-500/30",
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
                <tbody>{rows.map((r, i) => <Row key={i} cells={r} />)}</tbody>
            </table>
        </div>
    );
}

export default function HostingDocsPage() {
    const { has, isReady } = usePermissions();

    if (!isReady) return null;
    if (!has("HOSTING.MANAGE") && !has("HOSTING.VIEW")) {
        return <div className="p-6 text-cca-textPrimary">Accès refusé.</div>;
    }

    return (
        <div className="space-y-4 text-cca-textPrimary max-w-3xl">
            {/* Header */}
            <div className="flex items-start gap-3">
                <Link
                    to="/dashboard/hosting"
                    className="mt-0.5 p-2 rounded-xl bg-cca-base/40 border border-cca-border/40 hover:bg-cca-base/60 transition-all shrink-0"
                >
                    ←
                </Link>
                <div>
                    <h1 className="text-xl sm:text-2xl font-bold tracking-wide">Documentation — Hébergement</h1>
                    <p className="text-cca-textSecondary/40 text-xs sm:text-sm mt-0.5">
                        Guide complet pour créer et gérer vos sites web hébergés.
                    </p>
                </div>
            </div>

            {/* Quick nav */}
            <div className="flex flex-wrap gap-2 text-[11px]">
                {["Concepts", "Premiers pas", "HTML/CSS/JS", "Formulaires", "Données dynamiques", "Endpoints", "Permissions"].map(l => (
                    <span key={l} className="px-2.5 py-1 rounded-full bg-cca-base/40 border border-cca-border/40 text-cca-textSecondary cursor-default">{l}</span>
                ))}
            </div>

            {/* === SECTION 1 === */}
            <Section title="Concepts de base" defaultOpen>
                <p>Chaque site hébergé possède un <strong>slug unique</strong> auto-généré (ex: <Chip>a3f2c8b91e4d</Chip>). Il n'est pas modifiable.</p>
                <div className="mt-3 space-y-1 text-xs font-mono bg-cca-base/40 rounded-xl p-4 border border-cca-border/30">
                    <div className="text-indigo-300">Site</div>
                    <div className="pl-4 text-cca-textSecondary">├── slug → <span className="text-indigo-200">a3f2c8b91e4d</span></div>
                    <div className="pl-4 text-cca-textSecondary">├── Pages</div>
                    <div className="pl-8 text-cca-textSecondary">├── / &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;← accueil (route vide, obligatoire)</div>
                    <div className="pl-8 text-cca-textSecondary">├── /services</div>
                    <div className="pl-8 text-cca-textSecondary">└── /contact</div>
                    <div className="pl-4 text-cca-textSecondary">└── Assets (partagés entre toutes les pages)</div>
                    <div className="pl-8 text-cca-textSecondary">├── style.css</div>
                    <div className="pl-8 text-cca-textSecondary">└── script.js</div>
                </div>
                <SimpleTable
                    head={["URL publique", "Description"]}
                    rows={[
                        [<Chip>/p/{"{slug}"}</Chip>, "Page d'accueil (route vide)"],
                        [<Chip>/p/{"{slug}"}/services</Chip>, "Sous-page « services »"],
                        [<Chip>/p/{"{slug}"}/contact</Chip>, "Sous-page « contact »"],
                    ]}
                />
                <p className="mt-2">Le site est rendu dans un <strong>iframe</strong>. Le CSS et JS des assets sont injectés automatiquement dans <Chip>{'<head>'}</Chip> et en bas de <Chip>{'<body>'}</Chip> de <em>toutes</em> les pages.</p>
            </Section>

            {/* === SECTION 2 === */}
            <Section title="Premiers pas">
                <ol className="space-y-2 list-none">
                    {[
                        ["1", "green", "Dashboard → Hébergement → Nouveau site"],
                        ["2", "green", "Onglet Pages → éditer la page d'accueil (HTML du contenu principal)"],
                        ["3", "indigo", "Onglet Assets → ajouter style.css et script.js (globaux)"],
                        ["4", "amber", "Onglet Paramètres → Publier"],
                        ["5", "green", "URL publique : /p/{slug}"],
                    ].map(([n, c, txt]) => (
                        <li key={n} className="flex items-start gap-2"><Badge color={c}>{n}</Badge><span>{txt}</span></li>
                    ))}
                </ol>
                <p className="mt-3 text-xs">La <strong>page d'accueil</strong> (route vide) est créée automatiquement et ne peut pas être supprimée.</p>
                <p className="text-xs">Pour les sous-pages : onglet Pages → + Ajouter une page. La <strong>route</strong> est le chemin sans <Chip>/</Chip> en début/fin (ex: <Chip>a-propos</Chip> → URL <Chip>/p/slug/a-propos</Chip>).</p>
            </Section>

            {/* === SECTION 3 === */}
            <Section title="Exemples HTML / CSS / JS">
                <p className="font-semibold text-cca-textPrimary">Asset global — style.css</p>
                <CopyPre label="Thème dark minimaliste" code={`* { box-sizing: border-box; margin: 0; padding: 0; }

body {
  font-family: 'Segoe UI', system-ui, sans-serif;
  background: #0f172a;
  color: #e2e8f0;
  min-height: 100vh;
}

nav {
  background: #1e293b;
  padding: 1rem 2rem;
  display: flex;
  align-items: center;
  gap: 2rem;
  border-bottom: 1px solid #334155;
}

nav a {
  color: #94a3b8;
  text-decoration: none;
  font-size: 0.9rem;
  transition: color 0.2s;
}
nav a:hover, nav a.active { color: #6366f1; }

.container { max-width: 900px; margin: 3rem auto; padding: 0 2rem; }

h1 { font-size: 2rem; margin-bottom: 1rem; color: #f1f5f9; }
h2 { font-size: 1.4rem; margin-bottom: 0.75rem; color: #cbd5e1; }
p  { color: #94a3b8; line-height: 1.7; margin-bottom: 1rem; }

.card {
  background: #1e293b;
  border: 1px solid #334155;
  border-radius: 0.75rem;
  padding: 1.5rem;
  margin-bottom: 1rem;
}

.btn {
  display: inline-block;
  background: #6366f1;
  color: white;
  padding: 0.6rem 1.4rem;
  border-radius: 0.5rem;
  text-decoration: none;
  font-size: 0.9rem;
  border: none;
  cursor: pointer;
  transition: background 0.2s;
}
.btn:hover { background: #4f46e5; }

footer {
  text-align: center;
  padding: 2rem;
  color: #475569;
  font-size: 0.8rem;
  border-top: 1px solid #1e293b;
  margin-top: 4rem;
}`} />
                <p className="font-semibold text-cca-textPrimary mt-4">Asset global — script.js</p>
                <CopyPre label="Navigation active automatique" code={`document.addEventListener('DOMContentLoaded', function () {
  var path = window.location.pathname;
  document.querySelectorAll('nav a').forEach(function (link) {
    if (link.getAttribute('href') === path) link.classList.add('active');
  });
});`} />
                <p className="font-semibold text-cca-textPrimary mt-4">Page d'accueil (route vide)</p>
                <CopyPre label="Remplacez VOTRE_SLUG par votre slug réel" code={`<nav>
  <strong style="color:#6366f1">Mon Entreprise</strong>
  <a href="/p/VOTRE_SLUG">Accueil</a>
  <a href="/p/VOTRE_SLUG/services">Services</a>
  <a href="/p/VOTRE_SLUG/contact">Contact</a>
</nav>

<div class="container">
  <h1>Bienvenue !</h1>
  <p>Découvrez nos services et contactez-nous pour toute demande.</p>

  <div class="card">
    <h2>À propos</h2>
    <p>Équipe passionnée, résultats garantis.</p>
    <a href="/p/VOTRE_SLUG/services" class="btn">Voir nos services</a>
  </div>
</div>

<footer>© 2026 Mon Entreprise</footer>`} />
                <p className="font-semibold text-cca-textPrimary mt-4">Tableau de tarifs</p>
                <CopyPre label="À coller dans n'importe quelle page" code={`<div class="card">
  <h2>Nos tarifs</h2>
  <table style="width:100%;border-collapse:collapse;margin-top:1rem">
    <thead>
      <tr style="border-bottom:1px solid #334155">
        <th style="text-align:left;padding:.5rem;color:#94a3b8;font-weight:500">Prestation</th>
        <th style="text-align:right;padding:.5rem;color:#94a3b8;font-weight:500">Prix</th>
      </tr>
    </thead>
    <tbody>
      <tr style="border-bottom:1px solid #1e293b">
        <td style="padding:.6rem .5rem;color:#e2e8f0">Service de base</td>
        <td style="padding:.6rem .5rem;text-align:right;color:#6366f1;font-weight:600">500 $</td>
      </tr>
      <tr>
        <td style="padding:.6rem .5rem;color:#e2e8f0">Forfait mensuel</td>
        <td style="padding:.6rem .5rem;text-align:right;color:#6366f1;font-weight:600">3 000 $/mois</td>
      </tr>
    </tbody>
  </table>
</div>`} />
            </Section>

            {/* === SECTION 4 === */}
            <Section title="Formulaires de contact">
                <p>Le JS dans votre page peut faire des appels <Chip>fetch</Chip> vers des services externes. Le site est servi dans un iframe avec <Chip>allow-scripts allow-same-origin allow-forms</Chip>.</p>
                <CopyPre label="Page contact — webhook Discord (route: contact)" code={`<nav>
  <strong style="color:#6366f1">Mon Entreprise</strong>
  <a href="/p/VOTRE_SLUG">Accueil</a>
  <a href="/p/VOTRE_SLUG/contact">Contact</a>
</nav>

<div class="container">
  <h1>Contact</h1>
  <div class="card">
    <form id="contactForm">
      <div style="margin-bottom:1rem">
        <label style="display:block;margin-bottom:.4rem;color:#94a3b8;font-size:.85rem">Nom *</label>
        <input type="text" id="nom" required
          style="width:100%;background:#0f172a;border:1px solid #334155;border-radius:.5rem;padding:.6rem 1rem;color:#f1f5f9;font-size:.9rem;outline:none" />
      </div>
      <div style="margin-bottom:1rem">
        <label style="display:block;margin-bottom:.4rem;color:#94a3b8;font-size:.85rem">Message *</label>
        <textarea id="message" required rows="5"
          style="width:100%;background:#0f172a;border:1px solid #334155;border-radius:.5rem;padding:.6rem 1rem;color:#f1f5f9;font-size:.9rem;outline:none;resize:vertical"></textarea>
      </div>
      <button type="submit" class="btn" id="submitBtn">Envoyer</button>
      <p id="formStatus" style="margin-top:.75rem;display:none"></p>
    </form>
  </div>
</div>

<footer>© 2026 Mon Entreprise</footer>

<script>
var WEBHOOK_URL = 'https://discord.com/api/webhooks/VOTRE_WEBHOOK_ID/VOTRE_TOKEN';

document.getElementById('contactForm').addEventListener('submit', async function (e) {
  e.preventDefault();
  var btn    = document.getElementById('submitBtn');
  var status = document.getElementById('formStatus');
  var nom    = document.getElementById('nom').value.trim();
  var msg    = document.getElementById('message').value.trim();

  btn.disabled = true;
  btn.textContent = 'Envoi...';

  try {
    await fetch(WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        embeds: [{ fields: [
          { name: 'Nom', value: nom, inline: true },
          { name: 'Message', value: msg }
        ]}]
      })
    });
    status.style.display = 'block';
    status.style.color   = '#4ade80';
    status.textContent   = '✓ Message envoyé !';
    e.target.reset();
  } catch (err) {
    status.style.display = 'block';
    status.style.color   = '#f87171';
    status.textContent   = "Erreur lors de l'envoi. Réessayez.";
  }

  btn.disabled    = false;
  btn.textContent = 'Envoyer';
});
</script>`} />
                <CopyPre label="Alternative simple — Formspree (sans JS custom)" code={`<!-- Créer un compte gratuit sur formspree.io, remplacer YOUR_FORM_ID -->
<form action="https://formspree.io/f/YOUR_FORM_ID" method="POST">
  <input  type="text"  name="nom"     placeholder="Votre nom"     required />
  <textarea            name="message" placeholder="Votre message" required></textarea>
  <button type="submit" class="btn">Envoyer</button>
</form>`} />
            </Section>

            {/* === SECTION 5 === */}
            <Section title="Afficher des données dynamiques">
                <p>Le JS s'exécute dans l'iframe et peut faire des <Chip>fetch</Chip> vers n'importe quelle API publique.</p>
                <CopyPre label="Horloge en temps réel" code={`<p id="heure" style="color:#94a3b8"></p>

<script>
function majHeure() {
  document.getElementById('heure').textContent =
    'Il est ' + new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
}
majHeure();
setInterval(majHeure, 30000);
</script>`} />
                <CopyPre label="Galerie d'images" code={`<div id="galerie" style="display:grid;grid-template-columns:repeat(auto-fill,minmax(180px,1fr));gap:1rem;margin-top:1rem"></div>

<script>
var images = [
  { src: 'https://MON-CDN.com/photo1.jpg', caption: 'Événement du 12 mai' },
  { src: 'https://MON-CDN.com/photo2.jpg', caption: 'Soirée annuelle' },
];
var g = document.getElementById('galerie');
images.forEach(function (img) {
  var d = document.createElement('div');
  d.style.cssText = 'border-radius:.5rem;overflow:hidden;border:1px solid #334155';
  d.innerHTML = '<img src="' + img.src + '" style="width:100%;display:block" />'
    + '<p style="padding:.5rem;font-size:.8rem;color:#94a3b8;text-align:center">' + img.caption + '</p>';
  g.appendChild(d);
});
</script>`} />
                <CopyPre label="Météo via API publique (wttr.in)" code={`<p id="meteo">Chargement...</p>

<script>
fetch('https://wttr.in/Paris?format=%C+%t&lang=fr')
  .then(function(r) { return r.text(); })
  .then(function(d) { document.getElementById('meteo').textContent = 'Paris : ' + d; })
  .catch(function()  { document.getElementById('meteo').textContent = 'Météo indisponible'; });
</script>`} />
            </Section>

            {/* === SECTION 6 === */}
            <Section title="Référence complète des endpoints">
                <p className="font-semibold text-cca-textPrimary">Sites</p>
                <SimpleTable
                    head={["Méthode", "Endpoint", "Permission", "Description"]}
                    rows={[
                        [<Badge color="green">GET</Badge>,    <Chip>/api/hosting</Chip>,                        <Badge color="indigo">VIEW</Badge>,    "Lister les sites"],
                        [<Badge color="amber">POST</Badge>,   <Chip>/api/hosting</Chip>,                        <Badge color="amber">MANAGE</Badge>,  "Créer un site"],
                        [<Badge color="green">GET</Badge>,    <Chip>/api/hosting/:siteId</Chip>,                <Badge color="indigo">VIEW</Badge>,    "Détail site + pages + assets"],
                        [<Badge color="amber">PATCH</Badge>,  <Chip>/api/hosting/:siteId</Chip>,                <Badge color="amber">MANAGE</Badge>,  "Modifier nom / description"],
                        [<Badge color="amber">POST</Badge>,   <Chip>/api/hosting/:siteId/publish</Chip>,        <Badge color="amber">PUBLISH</Badge>, "Publier"],
                        [<Badge color="amber">POST</Badge>,   <Chip>/api/hosting/:siteId/unpublish</Chip>,      <Badge color="amber">PUBLISH</Badge>, "Dépublier"],
                        [<Badge color="red">DELETE</Badge>,   <Chip>/api/hosting/:siteId</Chip>,                <Badge color="red">DELETE</Badge>,    "Supprimer (cascade)"],
                        [<Badge color="amber">PATCH</Badge>,  <Chip>/api/hosting/:siteId/bill</Chip>,           <Badge color="amber">MANAGE</Badge>,  "Lier/délier une facture"],
                    ]}
                />

                <p className="font-semibold text-cca-textPrimary mt-4">Pages</p>
                <SimpleTable
                    head={["Méthode", "Endpoint", "Permission", "Description"]}
                    rows={[
                        [<Badge color="green">GET</Badge>,    <Chip>/api/hosting/:siteId/pages</Chip>,                    <Badge color="indigo">VIEW</Badge>,   "Lister les pages"],
                        [<Badge color="amber">POST</Badge>,   <Chip>/api/hosting/:siteId/pages</Chip>,                    <Badge color="amber">MANAGE</Badge>, "Créer une page"],
                        [<Badge color="green">GET</Badge>,    <Chip>/api/hosting/:siteId/pages/:pageId</Chip>,             <Badge color="indigo">VIEW</Badge>,   "Récupérer une page (avec HTML)"],
                        [<Badge color="amber">PATCH</Badge>,  <Chip>/api/hosting/:siteId/pages/:pageId</Chip>,             <Badge color="amber">MANAGE</Badge>, "Modifier titre / HTML / route"],
                        [<Badge color="red">DELETE</Badge>,   <Chip>/api/hosting/:siteId/pages/:pageId</Chip>,             <Badge color="red">DELETE</Badge>,   "Supprimer (sauf accueil)"],
                    ]}
                />

                <p className="font-semibold text-cca-textPrimary mt-4">Assets CSS/JS</p>
                <SimpleTable
                    head={["Méthode", "Endpoint", "Permission", "Description"]}
                    rows={[
                        [<Badge color="green">GET</Badge>,    <Chip>/api/hosting/:siteId/assets</Chip>,           <Badge color="indigo">VIEW</Badge>,   "Lister les assets"],
                        [<Badge color="amber">PUT</Badge>,    <Chip>/api/hosting/:siteId/assets</Chip>,           <Badge color="amber">MANAGE</Badge>, "Créer ou mettre à jour (upsert)"],
                        [<Badge color="green">GET</Badge>,    <Chip>/api/hosting/:siteId/assets/:assetId</Chip>,  <Badge color="indigo">VIEW</Badge>,   "Récupérer un asset (avec contenu)"],
                        [<Badge color="red">DELETE</Badge>,   <Chip>/api/hosting/:siteId/assets/:assetId</Chip>,  <Badge color="red">DELETE</Badge>,   "Supprimer"],
                    ]}
                />

                <p className="font-semibold text-cca-textPrimary mt-4">Endpoint public (sans authentification)</p>
                <SimpleTable
                    head={["Méthode", "Endpoint", "Description"]}
                    rows={[
                        [<Badge color="green">GET</Badge>, <Chip>/api/hosting/public/:slug</Chip>,       "Page d'accueil du site"],
                        [<Badge color="green">GET</Badge>, <Chip>/api/hosting/public/:slug/:route</Chip>, "Sous-page"],
                    ]}
                />
                <CopyPre label="Corps — Créer un site (POST /api/hosting)" code={`{
  "name": "Mon Site",
  "description": "Description optionnelle"
}`} />
                <CopyPre label="Corps — Créer une page (POST /api/hosting/:siteId/pages)" code={`{
  "route": "a-propos",
  "title": "À propos",
  "htmlContent": "<h1>À propos de nous</h1><p>Notre équipe...</p>"
}`} />
                <CopyPre label="Corps — Upsert asset (PUT /api/hosting/:siteId/assets)" code={`{
  "filename": "style.css",
  "content": "body { margin: 0; background: #0f172a; }"
}`} />
                <CopyPre label="Corps — Lier une facture (PATCH /api/hosting/:siteId/bill)" code={`{ "billId": 42 }
// Pour délier :
{ "billId": null }`} />
                <CopyPre label="Réponse — endpoint public (/api/hosting/public/:slug)" code={`{
  "site": { "slug": "a3f2c8b91e4d", "name": "Mon Site" },
  "page": {
    "title": "Accueil",
    "htmlContent": "<h1>Bonjour !</h1>"
  },
  "assets": [
    { "filename": "style.css", "kind": "CSS", "content": "body { ... }" },
    { "filename": "script.js", "kind": "JS",  "content": "console.log('ok')" }
  ]
}`} />
            </Section>

            {/* === SECTION 7 === */}
            <Section title="Permissions">
                <SimpleTable
                    head={["Permission", "Ce qu'elle permet"]}
                    rows={[
                        [<Chip>HOSTING.VIEW</Chip>,    "Voir la liste des sites, pages, assets"],
                        [<Chip>HOSTING.MANAGE</Chip>,  "Créer, modifier, lier une facture (inclut VIEW + PUBLISH + DELETE)"],
                        [<Chip>HOSTING.PUBLISH</Chip>, "Publier / dépublier (inclut VIEW)"],
                        [<Chip>HOSTING.DELETE</Chip>,  "Supprimer sites, pages, assets (inclut VIEW)"],
                    ]}
                />
                <p className="mt-2 text-xs"><Chip>HOSTING.MANAGE</Chip> est la permission principale — elle inclut toutes les autres.</p>
                <p className="text-xs mt-1"><strong>Note :</strong> les URLs publiques <Chip>/p/{"{slug}"}</Chip> sont accessibles sans authentification tant que le site est publié.</p>
            </Section>

            {/* Bonne pratiques */}
            <div className="rounded-2xl border border-amber-500/20 bg-amber-900/10 px-5 py-4 text-xs text-amber-200/70 space-y-1">
                <p className="font-bold text-amber-300 mb-2">⚠ Bonnes pratiques</p>
                <p>• Ne pas mettre de <strong>tokens/mots de passe</strong> dans le JS — le code source est visible publiquement.</p>
                <p>• Utiliser un <strong>asset CSS global</strong> plutôt que du style inline répété dans chaque page.</p>
                <p>• Tester avant de publier : le site reste en <strong>Brouillon</strong> jusqu'à la publication explicite.</p>
                <p>• Une facture ne peut être liée qu'à <strong>un seul site</strong> hébergé (contrainte unique).</p>
            </div>
        </div>
    );
}
