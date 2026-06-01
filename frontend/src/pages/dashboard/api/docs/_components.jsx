import { useState } from 'react';
import { AlertCircle, Play } from 'lucide-react';
import { RouteTestModal } from './RouteTestModal';

export function CodeBlock({ children, lang }) {
  return (
    <div className="rounded-xl overflow-hidden border border-cca-border">
      {lang && (
        <div className="bg-cca-surface px-4 py-1.5 text-[11px] font-mono text-cca-textSecondary border-b border-cca-border">
          {lang}
        </div>
      )}
      <pre className="bg-cca-base p-4 overflow-x-auto text-xs font-mono text-cca-textPrimary leading-relaxed">
        <code>{children}</code>
      </pre>
    </div>
  );
}

export function Param({ name, type, required, description }) {
  return (
    <div className="flex items-start gap-3 py-2 border-b border-cca-border/50 last:border-0">
      <div className="min-w-[160px]">
        <span className="font-mono text-xs text-brand-primary">{name}</span>
        {required && <span className="ml-1 text-[10px] text-red-400 font-semibold">requis</span>}
      </div>
      <span className="text-[10px] font-mono text-amber-400 min-w-[90px]">{type}</span>
      <span className="text-xs text-cca-textSecondary flex-1">{description}</span>
    </div>
  );
}

export function Endpoint({ method, path, description, params, queryParams, example, exampleResponse, notes }) {
  const [testOpen, setTestOpen] = useState(false);

  const colors = {
    GET:    'bg-blue-500/20 text-blue-400 border-blue-500/30',
    POST:   'bg-green-500/20 text-green-400 border-green-500/30',
    PATCH:  'bg-amber-500/20 text-amber-400 border-amber-500/30',
    PUT:    'bg-purple-500/20 text-purple-400 border-purple-500/30',
    DELETE: 'bg-red-500/20 text-red-400 border-red-500/30',
  };
  return (
    <>
    <div className="rounded-xl border border-cca-border bg-cca-surface overflow-hidden">
      <div className="flex items-center gap-3 px-4 py-3 border-b border-cca-border bg-cca-base/50">
        <span className={`font-mono text-xs font-bold px-2 py-0.5 rounded border ${colors[method]}`}>{method}</span>
        <code className="font-mono text-sm text-cca-textPrimary flex-1">{path}</code>
        <button
          type="button"
          onClick={() => setTestOpen(true)}
          className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium border border-cca-border bg-cca-surface text-cca-textSecondary hover:text-brand-primary hover:border-brand-primary/50 transition shrink-0"
        >
          <Play size={10} />
          Tester
        </button>
      </div>
      <div className="p-4 space-y-4">
        <p className="text-sm text-cca-textSecondary">{description}</p>
        {notes && (
          <div className="flex gap-2 p-3 rounded-lg bg-amber-500/10 border border-amber-500/30 text-xs text-amber-300">
            <AlertCircle size={14} className="mt-0.5 shrink-0" />
            <span>{notes}</span>
          </div>
        )}
        {params?.length > 0 && (
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-cca-textSecondary mb-2">Paramètres URL</p>
            <div className="rounded-lg border border-cca-border overflow-hidden">
              {params.map((p) => <Param key={p.name} {...p} />)}
            </div>
          </div>
        )}
        {queryParams?.length > 0 && (
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-cca-textSecondary mb-2">Query string</p>
            <div className="rounded-lg border border-cca-border overflow-hidden">
              {queryParams.map((p) => <Param key={p.name} {...p} />)}
            </div>
          </div>
        )}
        {example && (
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-cca-textSecondary mb-2">Requête</p>
            <CodeBlock lang="bash">{example}</CodeBlock>
          </div>
        )}
        {exampleResponse && (
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-cca-textSecondary mb-2">Réponse</p>
            <CodeBlock lang="json">{exampleResponse}</CodeBlock>
          </div>
        )}
      </div>
    </div>
    <RouteTestModal
      isOpen={testOpen}
      onClose={() => setTestOpen(false)}
      method={method}
      path={path}
      queryParams={queryParams}
    />
    </>
  );
}
