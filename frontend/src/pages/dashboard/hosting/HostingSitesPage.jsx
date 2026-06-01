import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useQuery, useMutation } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { listSites, deleteSite, publishSite, unpublishSite } from '@/services/hostingService';
import { queryClient } from '@/utils/queryClient';
import { useConfirmation } from '@/contexts/ConfirmationContext';

function fmtDate(d) {
  if (!d) return '—';
  try { return new Date(d).toLocaleDateString('fr-FR'); } catch { return String(d); }
}

export default function HostingSitesPage() {
  const navigate = useNavigate();
  const { confirmAction } = useConfirmation();

  const { data, isLoading, isError } = useQuery({
    queryKey: ['hosting', 'sites'],
    queryFn: listSites,
  });

  const delMutation = useMutation({
    mutationFn: (id) => deleteSite(id),
    onSuccess: () => {
      toast.success('Site supprimé');
      queryClient.invalidateQueries({ queryKey: ['hosting', 'sites'] });
    },
    onError: (e) => toast.error(e?.response?.data?.message || e.message),
  });

  const toggleMutation = useMutation({
    mutationFn: ({ id, isPublished }) => isPublished ? unpublishSite(id) : publishSite(id),
    onSuccess: (site) => {
      toast.success(site.isPublished ? 'Site publié' : 'Site dépublié');
      queryClient.invalidateQueries({ queryKey: ['hosting', 'sites'] });
    },
    onError: (e) => toast.error(e?.response?.data?.message || e.message),
  });

  const sites = data?.data || [];

  return (
    <div className="p-6 space-y-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-white">Sites hébergés</h1>
          <p className="text-sm text-slate-300">Gérez vos sites web statiques (HTML/CSS/JS).</p>
        </div>
        <Link
          to="/dashboard/hosting/new"
          className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium transition-colors"
        >
          Nouveau site
        </Link>
      </div>

      {isLoading && <p className="text-slate-400 text-sm">Chargement...</p>}
      {isError && <p className="text-red-400 text-sm">Erreur lors du chargement.</p>}

      {!isLoading && sites.length === 0 && (
        <p className="text-slate-400 text-sm">Aucun site hébergé. Créez le premier !</p>
      )}

      <div className="space-y-3">
        {sites.map((site) => (
          <div key={site.id} className="bg-slate-800 border border-slate-700 rounded-lg p-4 flex items-center gap-4">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="font-medium text-white truncate">{site.name}</span>
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${site.isPublished ? 'bg-green-900 text-green-300' : 'bg-slate-700 text-slate-400'}`}>
                  {site.isPublished ? 'Publié' : 'Brouillon'}
                </span>
              </div>
              <div className="text-xs text-slate-400 mt-0.5 space-x-3">
                <span>Slug: <code className="text-indigo-400">{site.slug}</code></span>
                <span>{site.pageCount ?? 0} page(s)</span>
                <span>Modifié: {fmtDate(site.updatedAt)}</span>
              </div>
              {site.isPublished && (
                <a
                  href={`/p/${site.slug}`}
                  target="_blank"
                  rel="noreferrer"
                  className="text-xs text-indigo-400 hover:underline mt-0.5 inline-block"
                >
                  /p/{site.slug} ↗
                </a>
              )}
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={() => toggleMutation.mutate({ id: site.id, isPublished: site.isPublished })}
                disabled={toggleMutation.isPending}
                className="px-3 py-1.5 rounded text-xs font-medium border border-slate-600 hover:border-slate-400 text-slate-300 hover:text-white transition-colors"
              >
                {site.isPublished ? 'Dépublier' : 'Publier'}
              </button>
              <button
                onClick={() => navigate(`/dashboard/hosting/${site.id}/edit`)}
                className="px-3 py-1.5 rounded text-xs font-medium border border-slate-600 hover:border-indigo-500 text-slate-300 hover:text-indigo-400 transition-colors"
              >
                Éditer
              </button>
              <button
                onClick={() => confirmAction({
                  title: 'Supprimer le site',
                  message: `Supprimer "${site.name}" ? Cette action est irréversible.`,
                  onConfirm: () => delMutation.mutate(site.id),
                })}
                disabled={delMutation.isPending}
                className="px-3 py-1.5 rounded text-xs font-medium border border-red-900 hover:border-red-500 text-red-400 hover:text-red-300 transition-colors"
              >
                Supprimer
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
