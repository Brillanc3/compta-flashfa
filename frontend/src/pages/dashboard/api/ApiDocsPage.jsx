import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { BookOpen, CheckCircle, ChevronRight } from 'lucide-react';
import { listApiKeys } from '@/services/apiService';
import { useCompany } from '@/contexts/CompanyContext';
import { usePermissions } from '@/contexts/PermissionsContext';
import { CodeBlock } from './docs/_components';

const BASE = '/dashboard/api/docs';

const ALL_MODULES = [
  { path: 'employees',    label: 'Employees',    gate: null },
  { path: 'rangs',        label: 'Rangs',        gate: null },
  { path: 'clients',      label: 'Clients',      gate: 'clients' },
  { path: 'comptabilite', label: 'Comptabilité', gate: 'comptabilite' },
  { path: 'chat',         label: 'Chat',         gate: 'chat' },
  { path: 'boxs',         label: 'Boxs',         gate: 'boxs' },
  { path: 'inventory',    label: 'Inventory',    gate: 'inventory' },
  { path: 'garage',       label: 'Garage',       gate: 'garage' },
];

const NAV = [
  { id: 'quick-start',  label: 'Quick start' },
  { id: 'installation', label: 'Installation' },
  { id: 'guide',        label: 'Guide' },
  { id: 'securite',     label: 'Sécurité' },
];

function Sidebar({ active, onNav, companyModules, modulesReady }) {
  const hasModule = (gate) => !gate || !modulesReady || companyModules.includes(gate);
  const visible = ALL_MODULES.filter(m => hasModule(m.gate));

  return (
    <aside className="w-44 shrink-0">
      <nav className="sticky top-6 space-y-0.5">
        {NAV.map(item => (
          <button
            key={item.id}
            onClick={() => onNav(item.id)}
            className={`w-full text-left flex items-center justify-between px-3 py-1.5 rounded-lg text-sm transition
              ${active === item.id
                ? 'bg-brand-primary/15 text-brand-primary font-medium'
                : 'text-cca-textSecondary hover:text-cca-textPrimary hover:bg-cca-surface'}`}
          >
            <span>{item.label}</span>
            {active === item.id && <ChevronRight size={12} />}
          </button>
        ))}

        <p className="pt-4 pb-1 text-[10px] font-semibold uppercase tracking-widest text-cca-textSecondary px-2">
          Modules
        </p>
        {visible.map(m => (
          <Link
            key={m.path}
            to={`${BASE}/${m.path}`}
            className="w-full flex items-center justify-between px-3 py-1.5 rounded-lg text-sm text-cca-textSecondary hover:text-cca-textPrimary hover:bg-cca-surface transition"
          >
            <span>{m.label}</span>
            <ChevronRight size={12} className="opacity-40" />
          </Link>
        ))}
      </nav>
    </aside>
  );
}

export default function ApiDocsPage() {
  const [active, setActive] = useState('quick-start');
  useCompany();
  useQuery({ queryKey: ['api', 'keys'], queryFn: listApiKeys });
  const { companyModules, isReady: modulesReady } = usePermissions();

  const baseUrl = window.location.origin.replace(/:\d+$/, ':3000');
  const hasModule = (gate) => !gate || !modulesReady || companyModules.includes(gate);

  const scrollTo = (id) => {
    setActive(id);
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  return (
    <div className="flex gap-10 max-w-5xl mx-auto p-6">
      <Sidebar active={active} onNav={scrollTo} companyModules={companyModules} modulesReady={modulesReady} />

      <main className="flex-1 min-w-0 space-y-20">

        {/* ── Quick start ── */}
        <section id="quick-start" className="space-y-4 scroll-mt-6">
          <div>
            <h1 className="text-2xl font-bold text-cca-textPrimary flex items-center gap-2">
              <BookOpen size={22} /> Documentation API
            </h1>
            <p className="text-cca-textSecondary text-sm mt-1">
              Référence des endpoints disponibles. Chaque requête doit être authentifiée via une clé API.
            </p>
          </div>

          <h2 className="text-lg font-semibold text-cca-textPrimary border-b border-cca-border pb-2">Quick start</h2>

          <p className="text-sm text-cca-textSecondary">
            Passez votre clé dans l'en-tête{' '}
            <code className="font-mono text-xs bg-cca-base border border-cca-border rounded px-1">x-api-key</code>.
            L'entreprise est déduite automatiquement de la clé — pas besoin de passer de{' '}
            <code className="font-mono text-xs bg-cca-base border border-cca-border rounded px-1">x-company-id</code>.
          </p>

          <CodeBlock lang="bash">{`curl "${baseUrl}/api/employees" \\
  -H "x-api-key: votre_cle_api"`}</CodeBlock>

          <div className="flex gap-2 p-3 rounded-lg bg-blue-500/10 border border-blue-500/30 text-xs text-blue-300">
            <CheckCircle size={14} className="mt-0.5 shrink-0" />
            <span>
              Chaque clé possède des <strong>scopes</strong> qui définissent les méthodes HTTP autorisées (GET, POST…).
              Une méthode hors scope retourne <strong>403</strong>.
            </span>
          </div>

          <div className="rounded-lg border border-cca-border overflow-hidden">
            {[
              { code: '200', color: 'text-green-400', desc: 'Succès.' },
              { code: '400', color: 'text-amber-400', desc: 'Paramètre manquant ou mal formé.' },
              { code: '401', color: 'text-red-400',   desc: 'Clé API absente ou invalide.' },
              { code: '403', color: 'text-red-400',   desc: 'Clé désactivée ou méthode hors scope.' },
              { code: '404', color: 'text-amber-400', desc: 'Ressource introuvable.' },
            ].map(({ code, color, desc }) => (
              <div key={code} className="flex items-center gap-4 px-4 py-2 border-b border-cca-border/50 last:border-0">
                <code className={`font-mono text-xs font-bold min-w-[36px] ${color}`}>{code}</code>
                <span className="text-xs text-cca-textSecondary">{desc}</span>
              </div>
            ))}
          </div>

          {/* Module cards */}
          <div>
            <p className="text-sm font-semibold text-cca-textPrimary mb-3 mt-6">Référence par module</p>
            <div className="grid grid-cols-2 gap-2">
              {ALL_MODULES.filter(m => hasModule(m.gate)).map(m => (
                <Link
                  key={m.path}
                  to={`${BASE}/${m.path}`}
                  className="flex items-center justify-between px-4 py-3 rounded-xl border border-cca-border bg-cca-surface hover:border-brand-primary/40 hover:bg-brand-primary/5 transition group"
                >
                  <span className="text-sm text-cca-textPrimary font-medium">{m.label}</span>
                  <ChevronRight size={14} className="text-cca-textSecondary group-hover:text-brand-primary transition" />
                </Link>
              ))}
            </div>
          </div>
        </section>

        {/* ── Installation ── */}
        <section id="installation" className="space-y-4 scroll-mt-6">
          <h2 className="text-lg font-semibold text-cca-textPrimary border-b border-cca-border pb-2">Installation</h2>
          <p className="text-sm text-cca-textSecondary">
            Aucune librairie requise — l'API est accessible via HTTP standard. Exemple de client minimal par langage :
          </p>

          <CodeBlock lang="Python">{`import requests

API_KEY  = "votre_cle_api"          # stocker en variable d'env
BASE_URL = "${baseUrl}/api"

def api_get(path, **params):
    r = requests.get(f"{BASE_URL}{path}", headers={"x-api-key": API_KEY}, params=params)
    r.raise_for_status()
    return r.json()`}</CodeBlock>

          <CodeBlock lang="JavaScript (browser)">{`const API_KEY  = "votre_cle_api";   // ne jamais exposer côté client en prod
const BASE_URL = "${baseUrl}/api";

async function apiGet(path, params = {}) {
  const url = new URL(BASE_URL + path);
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  const res = await fetch(url, { headers: { "x-api-key": API_KEY } });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}`}</CodeBlock>

          <CodeBlock lang="Node.js">{`const https = require("https");

const API_KEY  = process.env.API_KEY;
const BASE_URL = "${baseUrl}/api";

function apiGet(path, params = {}) {
  const url = new URL(BASE_URL + path);
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  return new Promise((resolve, reject) => {
    const req = https.get(url, { headers: { "x-api-key": API_KEY } }, (res) => {
      let body = "";
      res.on("data", (c) => (body += c));
      res.on("end", () => resolve(JSON.parse(body)));
    });
    req.on("error", reject);
  });
}`}</CodeBlock>

          <CodeBlock lang="PHP">{`<?php
define('API_KEY',  getenv('API_KEY'));
define('BASE_URL', '${baseUrl}/api');

function api_get(string $path, array $params = []): array {
    $url = BASE_URL . $path . ($params ? '?' . http_build_query($params) : '');
    $ctx = stream_context_create(['http' => [
        'header' => "x-api-key: " . API_KEY . "\\r\\n",
    ]]);
    $json = file_get_contents($url, false, $ctx);
    if ($json === false) throw new RuntimeException("API request failed");
    return json_decode($json, true);
}`}</CodeBlock>
        </section>

        {/* ── Guide ── */}
        <section id="guide" className="space-y-4 scroll-mt-6">
          <h2 className="text-lg font-semibold text-cca-textPrimary border-b border-cca-border pb-2">Guide</h2>
          <p className="text-sm text-cca-textSecondary">Exemples d'utilisation courants avec les clients définis ci-dessus.</p>

          <h3 className="text-sm font-semibold text-cca-textPrimary">Lister les employés actifs</h3>
          <CodeBlock lang="Python">{`employees = api_get("/employees")
for emp in employees:
    print(emp["user"]["name"], "→", emp["rank"]["name"])`}</CodeBlock>

          <CodeBlock lang="JavaScript (browser)">{`const employees = await apiGet("/employees");
employees.forEach(e => console.log(e.user.name, "→", e.rank.name));`}</CodeBlock>

          <h3 className="text-sm font-semibold text-cca-textPrimary mt-6">Récupérer le profil d'un employé</h3>
          <CodeBlock lang="Python">{`employee = api_get("/employees/employee/1")
print(employee["user"]["name"])
print("Dernières factures :", len(employee["bills"]))`}</CodeBlock>

          <CodeBlock lang="JavaScript (browser)">{`const employee = await apiGet("/employees/employee/1");
console.log(employee.user.name);
console.log("Dernières factures :", employee.bills.length);`}</CodeBlock>
        </section>

        {/* ── Sécurité ── */}
        <section id="securite" className="space-y-3 pb-12 scroll-mt-6">
          <h2 className="text-lg font-semibold text-cca-textPrimary border-b border-cca-border pb-2">Sécurité</h2>
          <div className="space-y-2">
            {[
              "Ne jamais exposer la clé côté client (navigateur, app mobile).",
              "Stocker en variable d'environnement ou gestionnaire de secrets.",
              "Créer des clés avec les scopes minimum nécessaires.",
              "Désactiver ou régénérer la clé immédiatement si compromise.",
            ].map((tip, i) => (
              <div key={i} className="flex gap-2 items-start text-sm text-cca-textSecondary">
                <CheckCircle size={14} className="mt-0.5 shrink-0 text-green-400" />
                <span>{tip}</span>
              </div>
            ))}
          </div>
        </section>

      </main>
    </div>
  );
}
