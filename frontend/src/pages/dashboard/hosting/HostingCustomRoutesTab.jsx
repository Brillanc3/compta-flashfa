import React, { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { listCustomRoutes, upsertCustomRoute, deleteCustomRoute, listForms } from '@/services/hostingService';
import { queryClient } from '@/utils/queryClient';
import { useConfirmation } from '@/contexts/ConfirmationContext';

const KEY_REGEX = /^[a-zA-Z0-9_-]{1,64}$/;

const ROUTE_DEFINITIONS = {
  SERVICE: {
    label: 'Statut de service',
    description: 'Employés actuellement en service (CalendarEvent actif)',
    defaultKey: 'service',
    fields: [
      { key: 'isOnline',    label: 'isOnline',    hint: 'Vrai si au moins 1 personne en service' },
      { key: 'memberCount', label: 'memberCount', hint: 'Nombre de personnes en service' },
      { key: 'members',     label: 'members',     hint: 'Liste [{name, elapsedSeconds}]' },
    ],
  },
  FORM_RESPONSES: {
    label: 'Statistiques de formulaire',
    description: 'Nombre de réponses reçues pour un formulaire',
    defaultKey: 'form-stats',
    requiresForm: true,
    fields: [
      { key: 'totalResponses', label: 'totalResponses', hint: 'Total des réponses' },
      { key: 'unreadCount',    label: 'unreadCount',    hint: 'Réponses non lues' },
      { key: 'lastResponseAt', label: 'lastResponseAt', hint: 'Date de la dernière réponse' },
    ],
  },
};

const TYPE_LABELS = {
  SERVICE:        'Statut de service',
  FORM_RESPONSES: 'Statistiques formulaire',
};

function RouteForm({ siteId, route, onDone }) {
  const isNew = !route;
  const initType = route?.type ?? 'SERVICE';
  const def = ROUTE_DEFINITIONS[initType];

  const [key,         setKey        ] = useState(route?.key         ?? def?.defaultKey ?? '');
  const [type,        setType       ] = useState(initType);
  const [isActive,    setIsActive   ] = useState(route?.isActive    ?? false);
  const [description, setDescription] = useState(route?.description ?? '');
  const [fields,      setFields     ] = useState(
    route?.fields?.length ? route.fields : Object.values(ROUTE_DEFINITIONS[initType]?.fields ?? []).map(f => f.key)
  );
  const [formId, setFormId] = useState(route?.formId ?? '');

  const currentDef = ROUTE_DEFINITIONS[type];

  const { data: forms } = useQuery({
    queryKey: ['hosting', 'forms', siteId],
    queryFn: () => listForms(siteId),
    enabled: currentDef?.requiresForm ?? false,
  });

  function handleTypeChange(t) {
    setType(t);
    const d = ROUTE_DEFINITIONS[t];
    if (isNew) setKey(d?.defaultKey ?? '');
    setFields(d?.fields?.map(f => f.key) ?? []);
    setFormId('');
  }

  function toggleField(fieldKey) {
    setFields(prev =>
      prev.includes(fieldKey) ? prev.filter(f => f !== fieldKey) : [...prev, fieldKey]
    );
  }

  const saveMutation = useMutation({
    mutationFn: () => upsertCustomRoute(siteId, isNew ? key.trim() : route.key, {
      type,
      isActive,
      description: description.trim() || null,
      fields,
      formId: currentDef?.requiresForm ? Number(formId) || null : null,
    }),
    onSuccess: () => {
      toast.success(isNew ? 'Route créée' : 'Route mise à jour');
      queryClient.invalidateQueries({ queryKey: ['hosting', 'custom-routes', siteId] });
      onDone();
    },
    onError: (e) => toast.error(e?.response?.data?.message || e.message),
  });

  const keyInvalid = isNew && key.trim() && !KEY_REGEX.test(key.trim());
  const canSave =
    (!isNew || KEY_REGEX.test(key.trim())) &&
    fields.length > 0 &&
    (!currentDef?.requiresForm || formId);

  return (
    <div className="bg-slate-900 border border-slate-600 rounded-lg p-4 space-y-4">
      {/* Type */}
      <div>
        <label className="block text-xs text-slate-400 mb-1.5">Type de route *</label>
        <div className="grid grid-cols-2 gap-2">
          {Object.entries(ROUTE_DEFINITIONS).map(([t, d]) => (
            <button
              key={t}
              onClick={() => handleTypeChange(t)}
              className={`text-left px-3 py-2.5 rounded-lg border transition-colors ${
                type === t
                  ? 'border-indigo-500 bg-indigo-950 text-white'
                  : 'border-slate-600 bg-slate-800 text-slate-300 hover:border-slate-500'
              }`}
            >
              <p className="text-sm font-medium">{d.label}</p>
              <p className="text-[10px] text-slate-400 mt-0.5">{d.description}</p>
            </button>
          ))}
        </div>
      </div>

      {/* Formulaire requis */}
      {currentDef?.requiresForm && (
        <div>
          <label className="block text-xs text-slate-400 mb-1">Formulaire *</label>
          <select
            value={formId}
            onChange={(e) => setFormId(e.target.value)}
            className="w-full bg-slate-800 border border-slate-600 rounded px-3 py-1.5 text-white text-sm focus:outline-none focus:border-indigo-500"
          >
            <option value="">-- Choisir un formulaire --</option>
            {(forms || []).map((f) => (
              <option key={f.id} value={f.id}>{f.name}</option>
            ))}
          </select>
        </div>
      )}

      {/* Champs exposés */}
      <div>
        <label className="block text-xs text-slate-400 mb-1.5">Champs exposés *</label>
        <div className="space-y-1.5">
          {currentDef?.fields.map((f) => (
            <label key={f.key} className="flex items-start gap-2.5 cursor-pointer group">
              <input
                type="checkbox"
                checked={fields.includes(f.key)}
                onChange={() => toggleField(f.key)}
                className="mt-0.5 accent-indigo-500"
              />
              <div>
                <span className="text-sm text-white font-mono">{f.label}</span>
                <span className="text-xs text-slate-400 ml-2">{f.hint}</span>
              </div>
            </label>
          ))}
        </div>
      </div>

      {/* Clé + état */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs text-slate-400 mb-1">Clé URL {isNew ? '*' : '(non modifiable)'}</label>
          <input
            value={key}
            onChange={(e) => isNew && setKey(e.target.value)}
            readOnly={!isNew}
            placeholder="service"
            className={`w-full bg-slate-800 border rounded px-3 py-1.5 text-white text-sm font-mono focus:outline-none ${
              !isNew ? 'opacity-60 cursor-not-allowed border-slate-600' : keyInvalid ? 'border-red-500 focus:border-red-500' : 'border-slate-600 focus:border-indigo-500'
            }`}
          />
          {keyInvalid && <p className="text-[10px] text-red-400 mt-0.5">Alphanumérique, - et _ uniquement</p>}
          {key && !keyInvalid && (
            <p className="text-[10px] text-slate-500 mt-0.5">
              <code className="text-green-400">/api/hosting/public/SLUG/api/{key}</code>
            </p>
          )}
        </div>
        <div className="flex flex-col justify-center gap-1">
          <label className="block text-xs text-slate-400">État</label>
          <label className="flex items-center gap-2 cursor-pointer">
            <div
              onClick={() => setIsActive((v) => !v)}
              className={`relative w-10 h-5 rounded-full transition-colors ${isActive ? 'bg-green-600' : 'bg-slate-600'}`}
            >
              <span className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white transition-transform ${isActive ? 'translate-x-5' : ''}`} />
            </div>
            <span className={`text-sm font-medium ${isActive ? 'text-green-400' : 'text-slate-400'}`}>
              {isActive ? 'Activée' : 'Désactivée'}
            </span>
          </label>
        </div>
      </div>

      {/* Description */}
      <div>
        <label className="block text-xs text-slate-400 mb-1">Description (optionnel)</label>
        <input
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Ex: Statut de l'équipe visible sur la page d'accueil"
          className="w-full bg-slate-800 border border-slate-600 rounded px-3 py-1.5 text-white text-sm focus:outline-none focus:border-indigo-500"
        />
      </div>

      <div className="flex gap-2 pt-1">
        <button
          onClick={() => saveMutation.mutate()}
          disabled={saveMutation.isPending || !canSave}
          className="px-3 py-1.5 rounded bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-sm font-medium"
        >
          {isNew ? 'Créer' : 'Enregistrer'}
        </button>
        <button onClick={onDone} className="text-sm text-slate-400 hover:text-white">Annuler</button>
      </div>
    </div>
  );
}

export default function HostingCustomRoutesTab({ siteId }) {
  const { confirmAction } = useConfirmation();
  const [showCreate, setShowCreate] = useState(false);
  const [editingKey, setEditingKey] = useState(null);

  const { data: routes, isLoading } = useQuery({
    queryKey: ['hosting', 'custom-routes', siteId],
    queryFn: () => listCustomRoutes(siteId),
  });

  const toggleMutation = useMutation({
    mutationFn: ({ route, isActive }) =>
      upsertCustomRoute(siteId, route.key, {
        type:        route.type,
        isActive,
        description: route.description,
        fields:      route.fields,
        formId:      route.formId,
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['hosting', 'custom-routes', siteId] }),
    onError: (e) => toast.error(e?.response?.data?.message || e.message),
  });

  const deleteMutation = useMutation({
    mutationFn: (key) => deleteCustomRoute(siteId, key),
    onSuccess: () => {
      toast.success('Route supprimée');
      queryClient.invalidateQueries({ queryKey: ['hosting', 'custom-routes', siteId] });
    },
    onError: (e) => toast.error(e?.response?.data?.message || e.message),
  });

  const list = routes || [];

  const EXAMPLE_SNIPPETS = {
    SERVICE: `fetch('/api/hosting/public/SLUG/api/service')
  .then(r => r.json())
  .then(data => {
    // data.isOnline, data.memberCount, data.members
    if (data.isOnline) { /* équipe disponible */ }
  });`,
    FORM_RESPONSES: `fetch('/api/hosting/public/SLUG/api/form-stats')
  .then(r => r.json())
  .then(data => {
    // data.totalResponses, data.unreadCount, data.lastResponseAt
  });`,
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-xs text-slate-400">{list.length} / 20 route(s)</p>
        <button
          onClick={() => { setShowCreate((s) => !s); setEditingKey(null); }}
          className="px-3 py-1.5 rounded bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium"
        >
          + Nouvelle route
        </button>
      </div>

      {showCreate && (
        <RouteForm siteId={siteId} onDone={() => setShowCreate(false)} />
      )}

      {isLoading && <p className="text-slate-400 text-sm">Chargement...</p>}
      {list.length === 0 && !isLoading && !showCreate && (
        <p className="text-slate-500 text-sm">
          Aucune route API. Exposez des données du site (service, formulaires) sans écrire de backend.
        </p>
      )}

      <div className="space-y-2">
        {list.map((route) => (
          <div key={route.key}>
            {editingKey === route.key ? (
              <RouteForm siteId={siteId} route={route} onDone={() => setEditingKey(null)} />
            ) : (
              <div className="bg-slate-800 border border-slate-700 rounded-lg px-4 py-3 flex items-center gap-3">
                <div
                  onClick={() => toggleMutation.mutate({ route, isActive: !route.isActive })}
                  className={`relative w-8 h-4 rounded-full transition-colors cursor-pointer shrink-0 ${route.isActive ? 'bg-green-600' : 'bg-slate-600'}`}
                >
                  <span className={`absolute top-0.5 left-0.5 w-3 h-3 rounded-full bg-white transition-transform ${route.isActive ? 'translate-x-4' : ''}`} />
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <code className="text-sm text-indigo-400 font-mono">{route.key}</code>
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-700 text-slate-400">
                      {TYPE_LABELS[route.type] ?? route.type}
                    </span>
                    {route.type === 'FORM_RESPONSES' && route.form && (
                      <span className="text-[10px] text-slate-500 truncate">{route.form.name}</span>
                    )}
                    {!route.isActive && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-red-950 text-red-400">404</span>
                    )}
                  </div>
                  <p className="text-xs text-slate-400 truncate mt-0.5">
                    {route.description || (Array.isArray(route.fields) ? route.fields.join(', ') : '')}
                  </p>
                </div>

                <div className="flex gap-2 shrink-0">
                  <button
                    onClick={() => { setEditingKey(route.key); setShowCreate(false); }}
                    className="text-xs text-indigo-400 hover:text-indigo-300"
                  >
                    Éditer
                  </button>
                  <button
                    onClick={() => confirmAction({
                      title: 'Supprimer la route',
                      message: `Supprimer la route "${route.key}" ?`,
                      onConfirm: () => deleteMutation.mutate(route.key),
                    })}
                    className="text-xs text-red-400 hover:text-red-300"
                  >
                    Supprimer
                  </button>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="mt-2 p-3 bg-slate-900 border border-slate-700 rounded text-xs text-slate-400 space-y-2">
        <p className="font-medium text-slate-300">Utilisation dans vos pages</p>
        {Object.entries(EXAMPLE_SNIPPETS).map(([type, snippet]) => (
          <div key={type}>
            <p className="text-[10px] text-slate-500 mb-0.5">{TYPE_LABELS[type]}</p>
            <code className="block text-green-400 whitespace-pre">{snippet}</code>
          </div>
        ))}
        <p className="text-[10px] text-slate-500">Requêtes acceptées uniquement depuis la plateforme.</p>
      </div>
    </div>
  );
}
