import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCompany } from '@/contexts/CompanyContext';
import * as productsService from '@/services/productsService';

/**
 * Page : Création d'un produit pour la company sélectionnée.
 *
 * Utilise :
 * - productsService.createProduct(companyId, payload)
 *
 * Après création, redirige vers /dashboard/company/:companyId/products
 */
export default function ProductCreatePage() {
  const { selectedCompany } = useCompany();
  const companyId = selectedCompany?.id;
  const navigate = useNavigate();

  const [name, setName] = useState('');
  const [price, setPrice] = useState('');
  const [currency, setCurrency] = useState('EUR');
  const [description, setDescription] = useState('');
  const [isActive, setIsActive] = useState(true);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const inputClass = "w-full bg-slate-700 text-white placeholder-slate-400 border border-slate-600 rounded p-2 focus:outline-none focus:ring-2 focus:ring-blue-500";

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);

    if (!companyId) {
      setError("Entreprise non sélectionnée.");
      return;
    }
    if (!name.trim()) {
      setError("Le nom du produit est requis.");
      return;
    }
    if (price === '' || Number.isNaN(Number(price))) {
      setError("Prix invalide.");
      return;
    }

    const payload = {
      name: name.trim(),
      price: Number(price),
      currency: currency || 'EUR',
      description: description || null,
      isActive: !!isActive
    };

    setLoading(true);
    try {
      await productsService.createProduct(companyId, payload);
      // navigate to products list
      navigate(`/dashboard/company/${companyId}/products`);
    } catch (err) {
      setError(err?.message || (err?.message ?? JSON.stringify(err)) || 'Erreur lors de la création');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-6">
      <div className="max-w-3xl mx-auto bg-slate-800 rounded shadow p-6 text-white">
        <h1 className="text-2xl font-semibold mb-4">Nouveau produit</h1>

        {error && <div className="mb-4 text-red-400">{error}</div>}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm mb-1">Nom</label>
            <input className={inputClass} value={name} onChange={e => setName(e.target.value)} placeholder="Nom du produit" />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm mb-1">Prix</label>
              <input
                className={inputClass}
                value={price}
                onChange={e => setPrice(e.target.value)}
                placeholder="0.00"
                type="number"
                step="0.01"
                min="0"
              />
            </div>
            <div>
              <label className="block text-sm mb-1">Devise</label>
              <input className={inputClass} value={currency} onChange={e => setCurrency(e.target.value)} placeholder="EUR" />
            </div>
          </div>

          <div>
            <label className="block text-sm mb-1">Description</label>
            <textarea className="w-full bg-slate-700 text-white placeholder-slate-400 border border-slate-600 rounded p-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={description}
              onChange={e => setDescription(e.target.value)}
              rows={4}
              placeholder="Description (optionnelle)"
            />
          </div>

          <div className="flex items-center gap-3">
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={isActive} onChange={e => setIsActive(e.target.checked)} className="accent-blue-500" />
              Actif
            </label>
          </div>

          <div className="flex items-center gap-3 mt-4">
            <button type="submit" disabled={loading} className="px-4 py-2 bg-green-600 text-white rounded disabled:opacity-60">
              {loading ? 'Création…' : 'Créer le produit'}
            </button>
            <button type="button" onClick={() => navigate(-1)} className="px-4 py-2 border rounded text-white">
              Annuler
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}