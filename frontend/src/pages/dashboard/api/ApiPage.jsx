import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'react-hot-toast';
import { Key, Plus, Trash2, Power, Copy, Check, ChevronDown, ChevronUp } from 'lucide-react';
import { listApiKeys, createApiKey, setApiKeyStatus, deleteApiKey } from '@/services/apiService';
import { usePermissions } from '@/contexts/PermissionsContext';

const ALL_ACTIONS = ['GET', 'POST', 'PATCH', 'DELETE'];

const MODULE_LABELS = {
  calendar: 'Calendrier',
  clients: 'Clients',
  employees: 'Employés',
  comptabilite: 'Comptabilité',
  chat: 'Chat',
  garage: 'Garage',
  inventory: 'Inventaire',
  products: 'Produits',
  tickets: 'Tickets',
  contracts: 'Contrats',
  hosting: 'Hébergement',
  boxs: 'Boxs',
  mecano: 'Mécano',
  pawnshop: 'Mont-de-piété',
  regie: 'Régie',
  immobilier: 'Immobilier',
  quiz: 'Quiz',
  automation: 'Automatisation',
};

const ACTION_COLORS = {
  GET:    'bg-blue-500/20 text-blue-400 border-blue-500/30',
  POST:   'bg-green-500/20 text-green-400 border-green-500/30',
  PATCH:  'bg-amber-500/20 text-amber-400 border-amber-500/30',
  DELETE: 'bg-red-500/20 text-red-400 border-red-500/30',
};

function ScopeBadge({ scope }) {
  return (
    <span className={`font-mono text-[10px] font-bold px-1.5 py-0.5 rounded border ${ACTION_COLORS[scope] || 'bg-gray-500/20 text-gray-400 border-gray-500/30'}`}>
      {scope}
    </span>
  );
}

function ModuleBadge({ module: mod }) {
  return (
    <span className="text-[10px] font-medium px-1.5 py-0.5 rounded border bg-purple-500/20 text-purple-400 border-purple-500/30">
      {MODULE_LABELS[mod] || mod}
    </span>
  );
}

function KeyCard({ apiKey, canManage, onToggle, onDelete }) {
  const [copied, setCopied] = useState(false);
  const [_revealedKey, _setRevealedKey] = useState(null);

  const handleCopy = (key) => {
    navigator.clipboard.writeText(key).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <div className={`rounded-xl border bg-cca-surface p-4 space-y-3 ${apiKey.isActive ? 'border-cca-border' : 'border-cca-border/50 opacity-60'}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <p className="font-medium text-cca-textPrimary text-sm truncate">{apiKey.name}</p>
          <p className="text-xs text-cca-textSecondary mt-0.5">
            Créée le {new Date(apiKey.createdAt).toLocaleDateString('fr-FR')}
            {apiKey.lastUsedAt && ` · Utilisée le ${new Date(apiKey.lastUsedAt).toLocaleDateString('fr-FR')}`}
          </p>
        </div>
        {canManage && (
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={() => onToggle(apiKey.id, !apiKey.isActive)}
              title={apiKey.isActive ? 'Désactiver' : 'Activer'}
              className={`p-1.5 rounded-lg border transition ${apiKey.isActive ? 'border-green-500/40 text-green-400 hover:bg-green-500/10' : 'border-cca-border text-cca-textSecondary hover:bg-cca-base'}`}
            >
              <Power size={14} />
            </button>
            <button
              onClick={() => onDelete(apiKey.id, apiKey.name)}
              title="Supprimer"
              className="p-1.5 rounded-lg border border-red-500/40 text-red-400 hover:bg-red-500/10 transition"
            >
              <Trash2 size={14} />
            </button>
          </div>
        )}
      </div>

      {/* Clé masquée */}
      {apiKey._revealedKey ? (
        <div className="space-y-1.5">
          <div className="flex items-center gap-2">
            <code className="flex-1 font-mono text-xs bg-cca-base border border-cca-border rounded-lg px-3 py-2 text-cca-textPrimary overflow-x-auto">
              {apiKey._revealedKey}
            </code>
            <button onClick={() => handleCopy(apiKey._revealedKey)} className="p-2 rounded-lg border border-cca-border hover:bg-cca-base transition">
              {copied ? <Check size={14} className="text-green-400" /> : <Copy size={14} className="text-cca-textSecondary" />}
            </button>
          </div>
          <p className="text-xs text-amber-400 border border-amber-400/30 bg-amber-400/10 rounded-lg px-3 py-2">
            Copiez cette clé maintenant. Elle ne sera plus affichée.
          </p>
        </div>
      ) : (
        <code className="block font-mono text-xs bg-cca-base border border-cca-border rounded-lg px-3 py-2 text-cca-textSecondary">
          {apiKey.maskedKey}
        </code>
      )}

      {/* Scopes */}
      {(() => {
        const raw = apiKey.scopes;
        const actions = Array.isArray(raw) ? raw : (raw?.actions || []);
        const mods = Array.isArray(raw) ? [] : (raw?.modules || []);
        return (
          <div className="space-y-1.5">
            <div className="flex flex-wrap gap-1.5">
              {actions.map((s) => <ScopeBadge key={s} scope={s} />)}
            </div>
            {mods.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {mods.map((m) => <ModuleBadge key={m} module={m} />)}
              </div>
            )}
            {mods.length === 0 && (
              <span className="text-[10px] text-cca-textSecondary">Tous les modules</span>
            )}
          </div>
        );
      })()}
    </div>
  );
}

function CreateKeyForm({ onClose, onCreated, availableModules }) {
  const [name, setName] = useState('');
  const [actions, setActions] = useState(['GET']);
  const [modules, setModules] = useState([]);

  const toggleAction = (s) => setActions((prev) => prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s]);
  const toggleModule = (m) => setModules((prev) => prev.includes(m) ? prev.filter((x) => x !== m) : [...prev, m]);

  const { mutate, isPending } = useMutation({
    mutationFn: createApiKey,
    onSuccess: (data) => {
      onCreated(data);
      toast.success('Clé créée. Copiez-la maintenant.');
    },
    onError: (err) => toast.error(err?.response?.data?.message || 'Erreur lors de la création.'),
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!name.trim()) return toast.error('Nom requis');
    if (actions.length === 0) return toast.error('Au moins une action requise');
    mutate({ name: name.trim(), scopes: { actions, modules } });
  };

  return (
    <form onSubmit={handleSubmit} className="rounded-xl border border-brand-primary/30 bg-cca-surface p-4 space-y-4">
      <p className="text-sm font-semibold text-cca-textPrimary">Nouvelle clé API</p>

      <div className="space-y-1.5">
        <label className="text-xs text-cca-textSecondary">Nom</label>
        <input
          autoFocus
          className="w-full bg-cca-base border border-cca-border rounded-lg px-3 py-2 text-sm text-cca-textPrimary focus:outline-none focus:ring-2 focus:ring-brand-primary/50"
          placeholder="Ex : Site vitrine, FiveM HUD…"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
      </div>

      <div className="space-y-1.5">
        <label className="text-xs text-cca-textSecondary">Actions autorisées</label>
        <div className="flex flex-wrap gap-2">
          {ALL_ACTIONS.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => toggleAction(s)}
              className={`font-mono text-xs font-bold px-2.5 py-1 rounded-lg border transition ${
                actions.includes(s)
                  ? ACTION_COLORS[s]
                  : 'border-cca-border text-cca-textSecondary hover:bg-cca-base'
              }`}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-1.5">
        <label className="text-xs text-cca-textSecondary">
          Modules autorisés{' '}
          <span className="text-cca-textSecondary/60">(vide = tous les modules)</span>
        </label>
        <div className="flex flex-wrap gap-2">
          {(availableModules || []).map((slug) => (
            <button
              key={slug}
              type="button"
              onClick={() => toggleModule(slug)}
              className={`text-xs px-2.5 py-1 rounded-lg border transition ${
                modules.includes(slug)
                  ? 'bg-purple-500/20 text-purple-400 border-purple-500/30'
                  : 'border-cca-border text-cca-textSecondary hover:bg-cca-base'
              }`}
            >
              {MODULE_LABELS[slug] || slug}
            </button>
          ))}
        </div>
      </div>

      <div className="flex gap-2">
        <button
          type="submit"
          disabled={isPending}
          className="text-sm px-4 py-2 rounded-lg bg-brand-primary text-white hover:bg-brand-primary/90 transition"
        >
          Créer
        </button>
        <button
          type="button"
          onClick={onClose}
          className="text-sm px-4 py-2 rounded-lg border border-cca-border text-cca-textSecondary hover:bg-cca-base transition"
        >
          Annuler
        </button>
      </div>
    </form>
  );
}

export default function ApiPage() {
  const qc = useQueryClient();
  const { has, companyModules } = usePermissions();
  const canManage = has('API.MANAGE');
  const [showCreate, setShowCreate] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ['api', 'keys'],
    queryFn: listApiKeys,
  });

  const toggleMutation = useMutation({
    mutationFn: ({ id, isActive }) => setApiKeyStatus(id, isActive),
    onSuccess: (updated) => {
      qc.setQueryData(['api', 'keys'], (old) => ({
        ...old,
        data: (old?.data || []).map((k) => k.id === updated.id ? { ...k, ...updated } : k),
      }));
      toast.success(updated.isActive ? 'Clé activée.' : 'Clé désactivée.');
    },
    onError: () => toast.error('Erreur.'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => deleteApiKey(id),
    onSuccess: (_, id) => {
      qc.setQueryData(['api', 'keys'], (old) => ({
        ...old,
        data: (old?.data || []).filter((k) => k.id !== id),
      }));
      toast.success('Clé supprimée.');
    },
    onError: () => toast.error('Erreur.'),
  });

  const handleCreated = (newKey) => {
    qc.setQueryData(['api', 'keys'], (old) => ({
      ...old,
      data: [{ ...newKey, _revealedKey: newKey.key }, ...(old?.data || [])],
    }));
    setShowCreate(false);
  };

  const handleDelete = (id, name) => {
    if (!window.confirm(`Supprimer la clé "${name}" ? Cette action est irréversible.`)) return;
    deleteMutation.mutate(id);
  };

  const keys = data?.data || [];

  if (isLoading) {
    return <div className="p-8 text-cca-textSecondary text-sm">Chargement…</div>;
  }

  return (
    <div className="max-w-2xl mx-auto p-6 space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-cca-textPrimary flex items-center gap-2">
            <Key size={24} /> Clés API
          </h1>
          <p className="text-cca-textSecondary text-sm mt-1">
            Créez des clés avec des scopes spécifiques pour accéder à l'API depuis vos sites externes.
          </p>
        </div>
        {canManage && !showCreate && (
          <button
            onClick={() => setShowCreate(true)}
            className="flex items-center gap-2 text-sm px-4 py-2 rounded-lg bg-brand-primary text-white hover:bg-brand-primary/90 transition shrink-0"
          >
            <Plus size={14} /> Nouvelle clé
          </button>
        )}
      </div>

      {showCreate && (
        <CreateKeyForm
          onClose={() => setShowCreate(false)}
          onCreated={handleCreated}
          availableModules={companyModules}
        />
      )}

      {keys.length === 0 && !showCreate ? (
        <div className="rounded-xl border border-dashed border-cca-border p-8 text-center text-cca-textSecondary text-sm">
          Aucune clé API. Créez votre première clé pour commencer.
        </div>
      ) : (
        <div className="space-y-3">
          {keys.map((k) => (
            <KeyCard
              key={k.id}
              apiKey={k}
              canManage={canManage}
              onToggle={(id, isActive) => toggleMutation.mutate({ id, isActive })}
              onDelete={handleDelete}
            />
          ))}
        </div>
      )}

      {/* Rappel doc */}
      <div className="rounded-xl border border-cca-border bg-cca-surface p-4 space-y-2">
        <p className="text-sm font-medium text-cca-textPrimary">Comment utiliser ces clés ?</p>
        <p className="text-xs text-cca-textSecondary">
          Consultez la{' '}
          <a href="/dashboard/api/docs" className="text-brand-primary underline underline-offset-2">
            documentation complète
          </a>{' '}
          pour les exemples d'intégration (JS, Python, PHP) et les détails par scope.
        </p>
      </div>
    </div>
  );
}
