import React, { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { listVariables, upsertVariable, deleteVariable } from '@/services/hostingService';
import { queryClient } from '@/utils/queryClient';
import { useConfirmation } from '@/contexts/ConfirmationContext';

const MIN_REFRESH = 3;
const MAX_REFRESH = 300;

function VariableForm({ siteId, variable, onDone }) {
  const isNew = !variable;
  const [key, setKey] = useState(variable?.key ?? '');
  const [value, setValue] = useState(variable?.value ?? '');
  const [kind, setKind] = useState(variable?.kind ?? 'STATIC');
  const [sourceUrl, setSourceUrl] = useState(variable?.sourceUrl ?? '');
  const [sourcePath, setSourcePath] = useState(variable?.sourcePath ?? '');
  const [refreshSec, setRefreshSec] = useState(
    variable?.refreshMs ? Math.round(variable.refreshMs / 1000) : 30
  );

  const saveMutation = useMutation({
    mutationFn: () => upsertVariable(siteId, isNew ? key.trim() : variable.key, {
      value,
      kind,
      sourceUrl: kind === 'DYNAMIC' ? sourceUrl.trim() : null,
      sourcePath: kind === 'DYNAMIC' ? sourcePath.trim() : null,
      refreshMs: kind === 'DYNAMIC' ? Math.max(MIN_REFRESH, Math.min(MAX_REFRESH, Number(refreshSec))) * 1000 : null,
    }),
    onSuccess: () => {
      toast.success(isNew ? 'Variable créée' : 'Variable mise à jour');
      queryClient.invalidateQueries({ queryKey: ['hosting', 'variables', siteId] });
      onDone();
    },
    onError: (e) => toast.error(e?.response?.data?.message || e.message),
  });

  return (
    <div className="bg-slate-900 border border-slate-600 rounded-lg p-4 space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs text-slate-400 mb-1">Clé {isNew ? '*' : '(non modifiable)'}</label>
          <input value={key} onChange={e => isNew && setKey(e.target.value)} readOnly={!isNew}
            placeholder="inService"
            className={`w-full bg-slate-800 border border-slate-600 rounded px-3 py-1.5 text-white text-sm font-mono focus:outline-none focus:border-indigo-500 ${!isNew ? 'opacity-60 cursor-not-allowed' : ''}`} />
        </div>
        <div>
          <label className="block text-xs text-slate-400 mb-1">Type</label>
          <select value={kind} onChange={e => setKind(e.target.value)}
            className="w-full bg-slate-800 border border-slate-600 rounded px-3 py-1.5 text-white text-sm focus:outline-none focus:border-indigo-500">
            <option value="STATIC">Statique (saisie manuelle)</option>
            <option value="DYNAMIC">Dynamique (API externe)</option>
          </select>
        </div>
      </div>

      {kind === 'STATIC' ? (
        <div>
          <label className="block text-xs text-slate-400 mb-1">Valeur</label>
          <input value={value} onChange={e => setValue(e.target.value)}
            className="w-full bg-slate-800 border border-slate-600 rounded px-3 py-1.5 text-white text-sm focus:outline-none focus:border-indigo-500"
            placeholder="true" />
        </div>
      ) : (
        <>
          <div>
            <label className="block text-xs text-slate-400 mb-1">URL de l'API source *</label>
            <input value={sourceUrl} onChange={e => setSourceUrl(e.target.value)}
              className="w-full bg-slate-800 border border-slate-600 rounded px-3 py-1.5 text-white text-sm font-mono focus:outline-none focus:border-indigo-500"
              placeholder="https://api.exemple.com/status" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-slate-400 mb-1">Chemin JSON (optionnel)</label>
              <input value={sourcePath} onChange={e => setSourcePath(e.target.value)}
                className="w-full bg-slate-800 border border-slate-600 rounded px-3 py-1.5 text-white text-sm font-mono focus:outline-none focus:border-indigo-500"
                placeholder="data.status" />
              <p className="text-[10px] text-slate-500 mt-0.5">Ex: <code>data.employees.count</code></p>
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">Rafraîchissement (sec)</label>
              <input type="number" min={MIN_REFRESH} max={MAX_REFRESH} value={refreshSec} onChange={e => setRefreshSec(e.target.value)}
                className="w-full bg-slate-800 border border-slate-600 rounded px-3 py-1.5 text-white text-sm focus:outline-none focus:border-indigo-500" />
              <p className="text-[10px] text-slate-500 mt-0.5">Min {MIN_REFRESH}s · Max {MAX_REFRESH}s</p>
            </div>
          </div>
          <div>
            <label className="block text-xs text-slate-400 mb-1">Valeur par défaut (si l'API est inaccessible)</label>
            <input value={value} onChange={e => setValue(e.target.value)}
              className="w-full bg-slate-800 border border-slate-600 rounded px-3 py-1.5 text-white text-sm focus:outline-none focus:border-indigo-500"
              placeholder="false" />
          </div>
        </>
      )}

      <div className="flex gap-2">
        <button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending || !key.trim() || (kind === 'DYNAMIC' && !sourceUrl.trim())}
          className="px-3 py-1.5 rounded bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-sm font-medium">
          {isNew ? 'Créer' : 'Enregistrer'}
        </button>
        <button onClick={onDone} className="text-sm text-slate-400 hover:text-white">Annuler</button>
      </div>
    </div>
  );
}

export default function HostingVariablesTab({ siteId }) {
  const { confirmAction } = useConfirmation();
  const [showCreate, setShowCreate] = useState(false);
  const [editingKey, setEditingKey] = useState(null);

  const { data: variables, isLoading } = useQuery({
    queryKey: ['hosting', 'variables', siteId],
    queryFn: () => listVariables(siteId),
  });

  const deleteMutation = useMutation({
    mutationFn: (key) => deleteVariable(siteId, key),
    onSuccess: () => { toast.success('Variable supprimée'); queryClient.invalidateQueries({ queryKey: ['hosting', 'variables', siteId] }); },
    onError: (e) => toast.error(e?.response?.data?.message || e.message),
  });

  const vars = variables || [];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-xs text-slate-400">{vars.length} variable(s)</p>
        <button onClick={() => { setShowCreate(s => !s); setEditingKey(null); }}
          className="px-3 py-1.5 rounded bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium">
          + Nouvelle variable
        </button>
      </div>

      {showCreate && (
        <VariableForm siteId={siteId} onDone={() => setShowCreate(false)} />
      )}

      {isLoading && <p className="text-slate-400 text-sm">Chargement...</p>}
      {vars.length === 0 && !isLoading && (
        <p className="text-slate-500 text-sm">Aucune variable. Les variables sont accessibles en JS via <code className="text-green-400">/api/hosting/public/SLUG/variables</code></p>
      )}

      <div className="space-y-2">
        {vars.map((v) => (
          <div key={v.key}>
            {editingKey === v.key ? (
              <VariableForm siteId={siteId} variable={v} onDone={() => setEditingKey(null)} />
            ) : (
              <div className="bg-slate-800 border border-slate-700 rounded-lg px-4 py-3 flex items-center gap-3">
                <code className="text-sm text-indigo-400 font-mono w-32 shrink-0 truncate">{v.key}</code>
                <span className={`text-xs px-1.5 py-0.5 rounded ${v.kind === 'DYNAMIC' ? 'bg-violet-900 text-violet-300' : 'bg-slate-700 text-slate-400'}`}>
                  {v.kind === 'DYNAMIC' ? `Dynamique (${v.refreshMs ? Math.round(v.refreshMs / 1000) + 's' : '?'})` : 'Statique'}
                </span>
                <span className="text-sm text-white flex-1 truncate">
                  {v.kind === 'STATIC' ? v.value : (v.cachedValue ?? <span className="text-slate-500 italic">non fetchée</span>)}
                </span>
                {v.kind === 'DYNAMIC' && v.sourceUrl && (
                  <span className="text-xs text-slate-500 truncate max-w-[140px]" title={v.sourceUrl}>{v.sourceUrl}</span>
                )}
                <div className="flex gap-2 shrink-0">
                  <button onClick={() => { setEditingKey(v.key); setShowCreate(false); }} className="text-xs text-indigo-400 hover:text-indigo-300">Éditer</button>
                  <button onClick={() => confirmAction({ title: 'Supprimer la variable', message: `Supprimer "${v.key}" ?`, onConfirm: () => deleteMutation.mutate(v.key) })}
                    className="text-xs text-red-400 hover:text-red-300">Supprimer</button>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="mt-4 p-3 bg-slate-900 border border-slate-700 rounded text-xs text-slate-400 space-y-1">
        <p className="font-medium text-slate-300">Utilisation dans votre site</p>
        <code className="block text-green-400">{`fetch('/api/hosting/public/SLUG/variables')\n  .then(r => r.json())\n  .then(vars => {\n    if (vars.inService === 'true') { /* ... */ }\n  });`}</code>
      </div>
    </div>
  );
}
