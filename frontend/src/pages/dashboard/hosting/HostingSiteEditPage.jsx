import React, { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery, useMutation } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import {
  getSite, updateSite, publishSite, unpublishSite,
  listPages, createPage, updatePage, deletePage, getPage,
  listAssets, upsertAsset, deleteAsset, getAsset,
} from '@/services/hostingService';
import { queryClient } from '@/utils/queryClient';
import { useConfirmation } from '@/contexts/ConfirmationContext';
import HostingFormsTab from './HostingFormsTab';
import HostingVariablesTab from './HostingVariablesTab';
import HostingCustomRoutesTab from './HostingCustomRoutesTab';

const TABS = ['Paramètres', 'Pages', 'Assets', 'Formulaires', 'Variables', 'Routes API'];

// ─── Onglet Paramètres ───────────────────────────────────

function SiteSettingsTab({ site, siteId }) {
  const [name, setName] = useState(site.name);
  const [description, setDescription] = useState(site.description ?? '');

  const updateMutation = useMutation({
    mutationFn: () => updateSite(siteId, { name: name.trim(), description: description.trim() || null }),
    onSuccess: () => {
      toast.success('Paramètres enregistrés');
      queryClient.invalidateQueries({ queryKey: ['hosting', 'site', siteId] });
    },
    onError: (e) => toast.error(e?.response?.data?.message || e.message),
  });

  const toggleMutation = useMutation({
    mutationFn: () => site.isPublished ? unpublishSite(siteId) : publishSite(siteId),
    onSuccess: (s) => {
      toast.success(s.isPublished ? 'Site publié' : 'Site dépublié');
      queryClient.invalidateQueries({ queryKey: ['hosting', 'site', siteId] });
      queryClient.invalidateQueries({ queryKey: ['hosting', 'sites'] });
    },
    onError: (e) => toast.error(e?.response?.data?.message || e.message),
  });

  return (
    <div className="space-y-4 max-w-lg">
      <div>
        <label className="block text-sm font-medium text-slate-300 mb-1">Slug (auto-généré, non modifiable)</label>
        <div className="flex items-center gap-2">
          <code className="bg-slate-900 border border-slate-700 rounded px-3 py-2 text-indigo-400 text-sm">
            {site.slug}
          </code>
          {site.isPublished && (
            <a href={`/p/${site.slug}`} target="_blank" rel="noreferrer" className="text-xs text-indigo-400 hover:underline">
              Voir ↗
            </a>
          )}
        </div>
      </div>
      <div>
        <label className="block text-sm font-medium text-slate-300 mb-1">Nom *</label>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-indigo-500"
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-slate-300 mb-1">Description</label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={3}
          className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-indigo-500 resize-none"
        />
      </div>
      <div className="flex gap-3">
        <button
          onClick={() => updateMutation.mutate()}
          disabled={updateMutation.isPending}
          className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-sm font-medium"
        >
          Enregistrer
        </button>
        <button
          onClick={() => toggleMutation.mutate()}
          disabled={toggleMutation.isPending}
          className={`px-4 py-2 rounded-lg text-sm font-medium border transition-colors ${
            site.isPublished
              ? 'border-yellow-700 text-yellow-400 hover:border-yellow-500'
              : 'border-green-700 text-green-400 hover:border-green-500'
          }`}
        >
          {site.isPublished ? 'Dépublier' : 'Publier'}
        </button>
      </div>
    </div>
  );
}

// ─── Onglet Pages ────────────────────────────────────────

function PagesTab({ siteId }) {
  const { confirmAction } = useConfirmation();
  const [editingId, setEditingId] = useState(null);
  const [editHtml, setEditHtml] = useState('');
  const [editTitle, setEditTitle] = useState('');
  const [newRoute, setNewRoute] = useState('');
  const [newTitle, setNewTitle] = useState('');
  const [newHtml, setNewHtml] = useState('');
  const [showNew, setShowNew] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ['hosting', 'pages', siteId],
    queryFn: () => listPages(siteId),
  });

  const { data: pageDetail } = useQuery({
    queryKey: ['hosting', 'page', siteId, editingId],
    queryFn: () => getPage(siteId, editingId),
    enabled: !!editingId,
  });

  const updateMutation = useMutation({
    mutationFn: () => updatePage(siteId, editingId, { title: editTitle, htmlContent: editHtml }),
    onSuccess: () => {
      toast.success('Page enregistrée');
      setEditingId(null);
      queryClient.invalidateQueries({ queryKey: ['hosting', 'pages', siteId] });
    },
    onError: (e) => toast.error(e?.response?.data?.message || e.message),
  });

  const createMutation = useMutation({
    mutationFn: () => createPage(siteId, { route: newRoute, title: newTitle, htmlContent: newHtml }),
    onSuccess: () => {
      toast.success('Page créée');
      setShowNew(false);
      setNewRoute(''); setNewTitle(''); setNewHtml('');
      queryClient.invalidateQueries({ queryKey: ['hosting', 'pages', siteId] });
    },
    onError: (e) => toast.error(e?.response?.data?.message || e.message),
  });

  const deleteMutation = useMutation({
    mutationFn: (pageId) => deletePage(siteId, pageId),
    onSuccess: () => {
      toast.success('Page supprimée');
      queryClient.invalidateQueries({ queryKey: ['hosting', 'pages', siteId] });
    },
    onError: (e) => toast.error(e?.response?.data?.message || e.message),
  });

  const pages = data?.data || [];

  function startEdit(page) {
    setEditingId(page.id);
    setEditTitle(page.title);
    setEditHtml('');
  }

  React.useEffect(() => {
    if (pageDetail) setEditHtml(pageDetail.htmlContent ?? '');
  }, [pageDetail]);

  if (editingId) {
    const page = pages.find(p => p.id === editingId);
    return (
      <div className="space-y-3">
        <div className="flex items-center gap-3">
          <button onClick={() => setEditingId(null)} className="text-slate-400 hover:text-white text-sm">← Retour</button>
          <span className="text-white font-medium">Édition: {page?.route ? `/${page.route}` : '/ (accueil)'}</span>
        </div>
        <div>
          <label className="block text-xs text-slate-400 mb-1">Titre</label>
          <input
            value={editTitle}
            onChange={(e) => setEditTitle(e.target.value)}
            className="w-full bg-slate-800 border border-slate-600 rounded px-3 py-2 text-white text-sm focus:outline-none focus:border-indigo-500"
          />
        </div>
        <div>
          <label className="block text-xs text-slate-400 mb-1">HTML</label>
          <textarea
            value={editHtml}
            onChange={(e) => setEditHtml(e.target.value)}
            rows={20}
            className="w-full bg-slate-900 border border-slate-600 rounded px-3 py-2 text-green-300 text-sm font-mono focus:outline-none focus:border-indigo-500 resize-y"
            placeholder="<h1>Bonjour</h1>"
          />
        </div>
        <button
          onClick={() => updateMutation.mutate()}
          disabled={updateMutation.isPending}
          className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-sm font-medium"
        >
          Enregistrer
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {isLoading && <p className="text-slate-400 text-sm">Chargement...</p>}
      <div className="space-y-2">
        {pages.map((page) => (
          <div key={page.id} className="bg-slate-800 border border-slate-700 rounded-lg px-4 py-3 flex items-center gap-3">
            <span className="text-sm text-white font-mono flex-1">
              {page.route ? `/${page.route}` : '/ (accueil)'}
            </span>
            <span className="text-xs text-slate-400">{page.title}</span>
            <div className="flex gap-2">
              <button onClick={() => startEdit(page)} className="text-xs text-indigo-400 hover:text-indigo-300">Éditer</button>
              {page.route !== '' && (
                <button
                  onClick={() => confirmAction({
                    title: 'Supprimer la page',
                    message: `Supprimer la page "/${page.route}" ?`,
                    onConfirm: () => deleteMutation.mutate(page.id),
                  })}
                  className="text-xs text-red-400 hover:text-red-300"
                >
                  Supprimer
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      {showNew ? (
        <div className="bg-slate-800 border border-slate-700 rounded-lg p-4 space-y-3">
          <h3 className="text-sm font-medium text-white">Nouvelle page</h3>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-slate-400 mb-1">Route (ex: <code>about</code>)</label>
              <input
                value={newRoute}
                onChange={(e) => setNewRoute(e.target.value)}
                className="w-full bg-slate-900 border border-slate-600 rounded px-3 py-2 text-white text-sm focus:outline-none focus:border-indigo-500"
                placeholder="a-propos"
              />
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">Titre</label>
              <input
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                className="w-full bg-slate-900 border border-slate-600 rounded px-3 py-2 text-white text-sm focus:outline-none focus:border-indigo-500"
                placeholder="À propos"
              />
            </div>
          </div>
          <div>
            <label className="block text-xs text-slate-400 mb-1">HTML (optionnel)</label>
            <textarea
              value={newHtml}
              onChange={(e) => setNewHtml(e.target.value)}
              rows={8}
              className="w-full bg-slate-900 border border-slate-600 rounded px-3 py-2 text-green-300 text-sm font-mono focus:outline-none focus:border-indigo-500 resize-y"
            />
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => createMutation.mutate()}
              disabled={createMutation.isPending}
              className="px-4 py-1.5 rounded bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium"
            >
              Créer
            </button>
            <button onClick={() => setShowNew(false)} className="text-sm text-slate-400 hover:text-white">Annuler</button>
          </div>
        </div>
      ) : (
        <button
          onClick={() => setShowNew(true)}
          className="px-4 py-2 rounded-lg border border-dashed border-slate-600 hover:border-indigo-500 text-slate-400 hover:text-indigo-400 text-sm transition-colors"
        >
          + Ajouter une page
        </button>
      )}
    </div>
  );
}

// ─── Onglet Assets ───────────────────────────────────────

function AssetsTab({ siteId }) {
  const { confirmAction } = useConfirmation();
  const [filename, setFilename] = useState('');
  const [content, setContent] = useState('');
  const [editingAsset, setEditingAsset] = useState(null);

  const { data, isLoading } = useQuery({
    queryKey: ['hosting', 'assets', siteId],
    queryFn: () => listAssets(siteId),
  });

  const { data: assetDetail } = useQuery({
    queryKey: ['hosting', 'asset', siteId, editingAsset?.id],
    queryFn: () => getAsset(siteId, editingAsset.id),
    enabled: !!editingAsset,
  });

  React.useEffect(() => {
    if (assetDetail) setContent(assetDetail.content ?? '');
  }, [assetDetail]);

  const upsertMutation = useMutation({
    mutationFn: () => upsertAsset(siteId, { filename, content }),
    onSuccess: () => {
      toast.success('Asset enregistré');
      setEditingAsset(null); setFilename(''); setContent('');
      queryClient.invalidateQueries({ queryKey: ['hosting', 'assets', siteId] });
    },
    onError: (e) => toast.error(e?.response?.data?.message || e.message),
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => deleteAsset(siteId, id),
    onSuccess: () => {
      toast.success('Asset supprimé');
      queryClient.invalidateQueries({ queryKey: ['hosting', 'assets', siteId] });
    },
    onError: (e) => toast.error(e?.response?.data?.message || e.message),
  });

  const assets = data?.data || [];

  function startEdit(asset) {
    setEditingAsset(asset);
    setFilename(asset.filename);
    setContent('');
  }

  if (editingAsset) {
    return (
      <div className="space-y-3">
        <div className="flex items-center gap-3">
          <button onClick={() => setEditingAsset(null)} className="text-slate-400 hover:text-white text-sm">← Retour</button>
          <span className="text-white font-medium font-mono">{editingAsset.filename}</span>
        </div>
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          rows={20}
          className="w-full bg-slate-900 border border-slate-600 rounded px-3 py-2 text-green-300 text-sm font-mono focus:outline-none focus:border-indigo-500 resize-y"
        />
        <button
          onClick={() => upsertMutation.mutate()}
          disabled={upsertMutation.isPending}
          className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-sm font-medium"
        >
          Enregistrer
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <p className="text-xs text-slate-400">
        Les assets CSS/JS sont inclus automatiquement dans toutes les pages du site. Nommez-les <code>.css</code> ou <code>.js</code>.
      </p>
      {isLoading && <p className="text-slate-400 text-sm">Chargement...</p>}
      <div className="space-y-2">
        {assets.map((a) => (
          <div key={a.id} className="bg-slate-800 border border-slate-700 rounded-lg px-4 py-3 flex items-center gap-3">
            <span className={`text-xs px-1.5 py-0.5 rounded font-mono font-medium ${a.kind === 'CSS' ? 'bg-blue-900 text-blue-300' : 'bg-yellow-900 text-yellow-300'}`}>{a.kind}</span>
            <span className="text-sm text-white font-mono flex-1">{a.filename}</span>
            <div className="flex gap-2">
              <button onClick={() => startEdit(a)} className="text-xs text-indigo-400 hover:text-indigo-300">Éditer</button>
              <button
                onClick={() => confirmAction({
                  title: "Supprimer l'asset",
                  message: `Supprimer "${a.filename}" ?`,
                  onConfirm: () => deleteMutation.mutate(a.id),
                })}
                className="text-xs text-red-400 hover:text-red-300"
              >
                Supprimer
              </button>
            </div>
          </div>
        ))}
      </div>

      <div className="bg-slate-800 border border-slate-700 rounded-lg p-4 space-y-3">
        <h3 className="text-sm font-medium text-white">Nouvel asset</h3>
        <input
          value={filename}
          onChange={(e) => setFilename(e.target.value)}
          placeholder="style.css ou script.js"
          className="w-full bg-slate-900 border border-slate-600 rounded px-3 py-2 text-white text-sm font-mono focus:outline-none focus:border-indigo-500"
        />
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          rows={8}
          className="w-full bg-slate-900 border border-slate-600 rounded px-3 py-2 text-green-300 text-sm font-mono focus:outline-none focus:border-indigo-500 resize-y"
          placeholder="body { margin: 0; }"
        />
        <button
          onClick={() => upsertMutation.mutate()}
          disabled={upsertMutation.isPending || !filename.trim()}
          className="px-4 py-1.5 rounded bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-sm font-medium"
        >
          Enregistrer
        </button>
      </div>
    </div>
  );
}

// ─── Page principale ─────────────────────────────────────

export default function HostingSiteEditPage() {
  const { siteId: siteIdParam } = useParams();
  const siteId = Number(siteIdParam);
  const [tab, setTab] = useState(0);

  const { data: site, isLoading, isError } = useQuery({
    queryKey: ['hosting', 'site', siteId],
    queryFn: () => getSite(siteId),
    enabled: !!siteId,
  });

  if (isLoading) return <div className="p-6 text-slate-400 text-sm">Chargement...</div>;
  if (isError || !site) return <div className="p-6 text-red-400 text-sm">Site introuvable.</div>;

  return (
    <div className="p-6 space-y-5">
      <div className="flex items-center gap-3">
        <Link to="/dashboard/hosting" className="text-slate-400 hover:text-white text-sm">← Sites</Link>
        <h1 className="text-xl font-semibold text-white">{site.name}</h1>
        <span className={`text-xs px-2 py-0.5 rounded-full ${site.isPublished ? 'bg-green-900 text-green-300' : 'bg-slate-700 text-slate-400'}`}>
          {site.isPublished ? 'Publié' : 'Brouillon'}
        </span>
      </div>

      <div className="flex border-b border-slate-700">
        {TABS.map((t, i) => (
          <button
            key={t}
            onClick={() => setTab(i)}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              tab === i ? 'border-indigo-500 text-white' : 'border-transparent text-slate-400 hover:text-white'
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      <div>
        {tab === 0 && <SiteSettingsTab site={site} siteId={siteId} />}
        {tab === 1 && <PagesTab siteId={siteId} />}
        {tab === 2 && <AssetsTab siteId={siteId} />}
        {tab === 3 && <HostingFormsTab siteId={siteId} />}
        {tab === 4 && <HostingVariablesTab siteId={siteId} />}
        {tab === 5 && <HostingCustomRoutesTab siteId={siteId} />}
      </div>
    </div>
  );
}
