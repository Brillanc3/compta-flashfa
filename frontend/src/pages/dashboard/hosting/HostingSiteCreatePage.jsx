import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { createSite } from '@/services/hostingService';
import { queryClient } from '@/utils/queryClient';

export default function HostingSiteCreatePage() {
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');

  const mutation = useMutation({
    mutationFn: () => createSite({ name: name.trim(), description: description.trim() || undefined }),
    onSuccess: (site) => {
      toast.success(`Site "${site.name}" créé — slug: ${site.slug}`);
      queryClient.invalidateQueries({ queryKey: ['hosting', 'sites'] });
      navigate(`/dashboard/hosting/${site.id}/edit`);
    },
    onError: (e) => toast.error(e?.response?.data?.message || e.message),
  });

  function handleSubmit(e) {
    e.preventDefault();
    if (!name.trim()) return toast.error('Le nom est requis');
    mutation.mutate();
  }

  return (
    <div className="p-6 max-w-lg">
      <h1 className="text-xl font-semibold text-white mb-6">Nouveau site hébergé</h1>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-slate-300 mb-1">Nom du site *</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-indigo-500"
            placeholder="Mon site"
            required
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-300 mb-1">Description</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
            className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-indigo-500 resize-none"
            placeholder="Description optionnelle..."
          />
        </div>
        <p className="text-xs text-slate-400">
          Le slug sera généré automatiquement par le backend (ex: <code>a3f2c8b91e4d</code>). URL publique: <code>/p/&lt;slug&gt;</code>
        </p>
        <div className="flex gap-3">
          <button
            type="submit"
            disabled={mutation.isPending}
            className="px-5 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-sm font-medium transition-colors"
          >
            {mutation.isPending ? 'Création...' : 'Créer le site'}
          </button>
          <button
            type="button"
            onClick={() => navigate('/dashboard/hosting')}
            className="px-5 py-2 rounded-lg border border-slate-600 hover:border-slate-400 text-slate-300 text-sm transition-colors"
          >
            Annuler
          </button>
        </div>
      </form>
    </div>
  );
}
