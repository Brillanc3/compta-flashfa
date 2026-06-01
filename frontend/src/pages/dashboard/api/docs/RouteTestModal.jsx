import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Loader2, Play, Key, ChevronDown, ChevronUp, Check } from 'lucide-react';
import Modal from '@/components/Modal';
import { listApiKeys, createApiKey } from '@/services/apiService';

const ALL_SCOPES = ['GET', 'POST', 'PATCH', 'DELETE'];

const SCOPE_COLORS = {
  GET:    'bg-blue-500/20 text-blue-400 border-blue-500/50',
  POST:   'bg-green-500/20 text-green-400 border-green-500/50',
  PATCH:  'bg-amber-500/20 text-amber-400 border-amber-500/50',
  DELETE: 'bg-red-500/20 text-red-400 border-red-500/50',
};

const METHOD_COLORS = {
  GET:    'bg-blue-500/20 text-blue-400 border-blue-500/30',
  POST:   'bg-green-500/20 text-green-400 border-green-500/30',
  PATCH:  'bg-amber-500/20 text-amber-400 border-amber-500/30',
  DELETE: 'bg-red-500/20 text-red-400 border-red-500/30',
  PUT:    'bg-purple-500/20 text-purple-400 border-purple-500/30',
};

function getBaseUrl() {
  return window.location.origin.replace(/:\d+$/, ':3000');
}

function extractUrlParamNames(path) {
  return [...path.matchAll(/:([a-zA-Z]+)/g)].map(m => m[1]);
}

function buildUrl(path, urlParams, qParams) {
  let url = getBaseUrl() + path;
  for (const [k, v] of Object.entries(urlParams)) {
    if (v) url = url.replace(`:${k}`, encodeURIComponent(v));
  }
  const qs = Object.entries(qParams).filter(([, v]) => v !== '');
  if (qs.length > 0) {
    url += '?' + qs.map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`).join('&');
  }
  return url;
}

export function RouteTestModal({ isOpen, onClose, method, path, queryParams = [] }) {
  const qc = useQueryClient();
  const urlParamNames = extractUrlParamNames(path);

  // Key state
  const [selectedKeyId, setSelectedKeyId] = useState(null);
  const [apiKey, setApiKey] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [newKeyName, setNewKeyName] = useState('Test');
  const [newKeyScopes, setNewKeyScopes] = useState([method]);

  // Request state
  const [urlParamValues, setUrlParamValues] = useState({});
  const [qParamValues, setQParamValues] = useState({});
  const [bodyText, setBodyText] = useState('');

  // Response state
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);

  const { data: keysData } = useQuery({
    queryKey: ['api', 'keys'],
    queryFn: listApiKeys,
    enabled: isOpen,
  });
  const keys = keysData?.data ?? [];
  const selectedKey = keys.find(k => k.id === selectedKeyId) ?? null;

  const { mutate: doCreate, isPending: creating } = useMutation({
    mutationFn: createApiKey,
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ['api', 'keys'] });
      if (data.key) {
        setApiKey(data.key);
        setSelectedKeyId(data.id);
      }
      setShowCreate(false);
    },
  });

  function toggleScope(s) {
    setNewKeyScopes(prev =>
      prev.includes(s) ? prev.filter(x => x !== s) : [...prev, s]
    );
  }

  function selectKey(k) {
    setSelectedKeyId(k.id);
    setApiKey(''); // clear — user must paste the full key
  }

  async function handleSend() {
    if (!apiKey) return;
    setLoading(true);
    setResult(null);
    const url = buildUrl(path, urlParamValues, qParamValues);
    const hasBody = ['POST', 'PATCH', 'PUT'].includes(method);
    try {
      const res = await fetch(url, {
        method,
        headers: {
          'x-api-key': apiKey,
          ...(hasBody && bodyText ? { 'Content-Type': 'application/json' } : {}),
        },
        ...(hasBody && bodyText ? { body: bodyText } : {}),
      });
      let parsed;
      const ct = res.headers.get('content-type') || '';
      if (ct.includes('json')) {
        parsed = await res.json();
      } else {
        parsed = await res.text();
      }
      setResult({ status: res.status, ok: res.ok, data: parsed });
    } catch (err) {
      setResult({ status: 0, ok: false, data: String(err) });
    } finally {
      setLoading(false);
    }
  }

  const noKeys = keys.length === 0;
  const keyPlaceholder = selectedKey
    ? `Clé complète pour "${selectedKey.name}"…`
    : 'Collez votre clé API…';

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Tester la route">
      <div className="space-y-5" style={{ minWidth: 460, maxWidth: 580 }}>

        {/* Route badge */}
        <div className="flex items-center gap-2 px-3 py-2.5 rounded-lg bg-cca-base border border-cca-border">
          <span className={`font-mono text-xs font-bold px-2 py-0.5 rounded border ${METHOD_COLORS[method] || ''}`}>
            {method}
          </span>
          <code className="font-mono text-sm text-cca-textPrimary">{path}</code>
        </div>

        {/* API Key section */}
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wider text-cca-textSecondary flex items-center gap-1.5">
            <Key size={11} /> Clé API
          </p>

          {/* Selectable key cards */}
          {keys.length > 0 && (
            <div className="space-y-1">
              {keys.map(k => {
                const isSelected = k.id === selectedKeyId;
                return (
                  <button
                    key={k.id}
                    type="button"
                    onClick={() => selectKey(k)}
                    className={`w-full flex items-center gap-2 px-2.5 py-2 rounded-lg border text-left transition
                      ${isSelected
                        ? 'border-brand-primary/60 bg-brand-primary/10'
                        : 'border-cca-border/50 bg-cca-base/60 hover:border-cca-border hover:bg-cca-base'
                      }`}
                  >
                    <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 transition
                      ${isSelected ? 'border-brand-primary bg-brand-primary' : 'border-cca-border/60'}`}
                    >
                      {isSelected && <Check size={9} className="text-white" strokeWidth={3} />}
                    </div>
                    <span className="text-xs text-cca-textPrimary font-medium">{k.name}</span>
                    <span className="font-mono text-[10px] text-cca-textSecondary">{k.maskedKey}</span>
                    <div className="ml-auto flex gap-1">
                      {(Array.isArray(k.scopes) ? k.scopes : k.scopes?.actions)?.map(s => (
                        <span
                          key={s}
                          className={`font-mono px-1 py-0.5 rounded border text-[10px] ${SCOPE_COLORS[s] || 'text-cca-textSecondary border-cca-border'}`}
                        >
                          {s}
                        </span>
                      ))}
                    </div>
                  </button>
                );
              })}
            </div>
          )}

          {/* Full key paste input */}
          <div className="space-y-1">
            {selectedKey && (
              <p className="text-[11px] text-brand-primary/80">
                Collez la clé complète de <strong>{selectedKey.name}</strong> (visible une seule fois à la création)
              </p>
            )}
            <input
              type="password"
              placeholder={keyPlaceholder}
              value={apiKey}
              onChange={e => setApiKey(e.target.value)}
              className={`w-full px-3 py-2 rounded-lg bg-cca-base text-sm font-mono text-cca-textPrimary placeholder-cca-textSecondary/60 focus:outline-none transition border
                ${selectedKey ? 'border-brand-primary/40 focus:border-brand-primary' : 'border-cca-border focus:border-brand-primary'}`}
            />
          </div>

          {/* No keys warning */}
          {noKeys && !showCreate && (
            <p className="text-xs text-amber-400">
              Aucune clé API.{' '}
              <button
                type="button"
                onClick={() => setShowCreate(true)}
                className="underline hover:text-amber-300 transition"
              >
                Créer une clé
              </button>
            </p>
          )}

          {/* Toggle create form */}
          {!noKeys && (
            <button
              type="button"
              onClick={() => setShowCreate(s => !s)}
              className="text-xs text-cca-textSecondary hover:text-cca-textPrimary flex items-center gap-1 transition"
            >
              {showCreate ? <ChevronUp size={11} /> : <ChevronDown size={11} />}
              Créer une nouvelle clé
            </button>
          )}

          {/* Create form */}
          {showCreate && (
            <div className="p-3 rounded-lg bg-cca-base border border-cca-border space-y-3">
              <input
                type="text"
                placeholder="Nom de la clé"
                value={newKeyName}
                onChange={e => setNewKeyName(e.target.value)}
                className="w-full px-3 py-1.5 rounded bg-cca-surface border border-cca-border text-sm text-cca-textPrimary placeholder-cca-textSecondary/60 focus:outline-none focus:border-brand-primary"
              />
              <div>
                <p className="text-[11px] text-cca-textSecondary mb-2">Scopes</p>
                <div className="flex gap-2 flex-wrap">
                  {ALL_SCOPES.map(s => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => toggleScope(s)}
                      className={`px-2.5 py-1 rounded text-xs font-mono font-semibold border transition
                        ${newKeyScopes.includes(s)
                          ? SCOPE_COLORS[s]
                          : 'text-cca-textSecondary border-cca-border bg-transparent hover:border-cca-textSecondary'
                        }`}
                    >
                      {s}
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={() => setNewKeyScopes(ALL_SCOPES)}
                    className="px-2.5 py-1 rounded text-xs font-mono border border-cca-border text-cca-textSecondary hover:text-cca-textPrimary transition"
                  >
                    Tout
                  </button>
                </div>
              </div>
              <button
                type="button"
                onClick={() => doCreate({ name: newKeyName, scopes: { actions: newKeyScopes } })}
                disabled={creating || !newKeyName.trim() || newKeyScopes.length === 0}
                className="w-full py-1.5 rounded text-sm font-medium bg-brand-primary/15 border border-brand-primary/40 text-brand-primary hover:bg-brand-primary/25 transition disabled:opacity-50 flex items-center justify-center gap-1.5"
              >
                {creating && <Loader2 size={12} className="animate-spin" />}
                Créer et utiliser cette clé
              </button>
            </div>
          )}
        </div>

        {/* URL params */}
        {urlParamNames.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wider text-cca-textSecondary">Paramètres URL</p>
            <div className="space-y-1.5">
              {urlParamNames.map(name => (
                <div key={name} className="flex items-center gap-2">
                  <code className="font-mono text-xs text-brand-primary w-32 shrink-0">:{name}</code>
                  <input
                    type="text"
                    placeholder={name}
                    value={urlParamValues[name] || ''}
                    onChange={e => setUrlParamValues(p => ({ ...p, [name]: e.target.value }))}
                    className="flex-1 px-3 py-1.5 rounded bg-cca-base border border-cca-border text-sm font-mono text-cca-textPrimary placeholder-cca-textSecondary/50 focus:outline-none focus:border-brand-primary transition"
                  />
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Query params */}
        {queryParams.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wider text-cca-textSecondary">Query string</p>
            <div className="space-y-1.5">
              {queryParams.map(p => (
                <div key={p.name} className="flex items-center gap-2">
                  <code className="font-mono text-xs text-amber-400 w-32 shrink-0">{p.name}</code>
                  <input
                    type="text"
                    placeholder={p.description?.split('.')[0] || p.name}
                    value={qParamValues[p.name] || ''}
                    onChange={e => setQParamValues(pv => ({ ...pv, [p.name]: e.target.value }))}
                    className="flex-1 px-3 py-1.5 rounded bg-cca-base border border-cca-border text-sm font-mono text-cca-textPrimary placeholder-cca-textSecondary/50 focus:outline-none focus:border-brand-primary transition"
                  />
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Body */}
        {['POST', 'PATCH', 'PUT'].includes(method) && (
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wider text-cca-textSecondary">Corps (JSON)</p>
            <textarea
              rows={5}
              placeholder="{}"
              value={bodyText}
              onChange={e => setBodyText(e.target.value)}
              className="w-full px-3 py-2 rounded-lg bg-cca-base border border-cca-border text-sm font-mono text-cca-textPrimary placeholder-cca-textSecondary/50 focus:outline-none focus:border-brand-primary resize-y transition"
            />
          </div>
        )}

        {/* Send button */}
        <button
          type="button"
          onClick={handleSend}
          disabled={loading || !apiKey}
          className="w-full py-2.5 rounded-lg font-semibold text-sm flex items-center justify-center gap-2 transition bg-brand-primary text-white hover:bg-brand-primary/90 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {loading ? <Loader2 size={14} className="animate-spin" /> : <Play size={14} />}
          {loading ? 'Envoi en cours…' : 'Envoyer la requête'}
        </button>

        {/* Response */}
        {result && (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold uppercase tracking-wider text-cca-textSecondary">Réponse</p>
              <span className={`font-mono text-xs font-bold ${result.ok ? 'text-green-400' : 'text-red-400'}`}>
                HTTP {result.status || 'ERR'}
              </span>
            </div>
            <div className="rounded-xl border border-cca-border overflow-hidden">
              <pre className="bg-cca-base p-4 overflow-auto text-xs font-mono text-cca-textPrimary leading-relaxed max-h-64">
                {typeof result.data === 'string'
                  ? result.data
                  : JSON.stringify(result.data, null, 2)}
              </pre>
            </div>
          </div>
        )}

      </div>
    </Modal>
  );
}
