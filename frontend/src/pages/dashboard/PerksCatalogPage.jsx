// frontend/src/pages/dashboard/PerksCatalogPage.jsx

import React, { useState, useEffect, useCallback } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { getPerksCatalog } from '@/services/clientsService';
import Spinner from '@/components/ui/Spinner';
import { Store, Building, XCircle, Search, Filter } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkBreaks from 'remark-breaks';

const pageVariants = {
    hidden: { opacity: 0 },
    visible: { opacity: 1, transition: { staggerChildren: 0.05 } }
};

const cardVariants = {
    hidden: { y: 20, opacity: 0 },
    visible: { y: 0, opacity: 1, transition: { type: 'spring', stiffness: 100 } }
};

export default function PerksCatalogPage() {
    const [catalog, setCatalog] = useState([]);
    const [filteredCatalog, setFilteredCatalog] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [selectedPerk, setSelectedPerk] = useState(null);
    const [searchQuery, setSearchQuery] = useState('');

    const fetchCatalog = useCallback(async () => {
        try {
            setLoading(true);
            setError(null);
            const data = await getPerksCatalog();
            const arr = Array.isArray(data) ? data : [];
            setCatalog(arr);
            setFilteredCatalog(arr);
        } catch (err) {
            setError(err.message || "Erreur lors du chargement du catalogue.");
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchCatalog();
    }, [fetchCatalog]);

    useEffect(() => {
        if (!searchQuery.trim()) {
            setFilteredCatalog(catalog);
            return;
        }
        
        const q = searchQuery.toLowerCase();
        const filtered = catalog.filter(p => 
            p.company.name.toLowerCase().includes(q) || 
            p.label.toLowerCase().includes(q) ||
            (p.perksDescription && p.perksDescription.toLowerCase().includes(q))
        );
        setFilteredCatalog(filtered);
    }, [searchQuery, catalog]);

    const formatPrice = (price, duration) => {
        if (price === null || price === undefined) return "Prix non spécifié";
        const formattedPrice = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(price);
        
        if (duration) {
            return `${formattedPrice} / ${duration.toLowerCase()}`;
        }
        return formattedPrice;
    };

    return (
        <motion.div
            className="space-y-6"
            initial="hidden"
            animate="visible"
            variants={pageVariants}
        >
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2">
                        <Store className="text-emerald-400" size={28} />
                        Catalogue des Avantages
                    </h1>
                    <p className="text-slate-400 text-sm mt-1">Découvrez tous les privilèges proposés par nos entreprises partenaires.</p>
                </div>
                
                <div className="relative w-full md:w-72">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <Search className="h-4 w-4 text-slate-400" />
                    </div>
                    <input
                        type="text"
                        className="w-full bg-slate-900/80 border border-slate-700 rounded-xl pl-10 pr-4 py-2 text-sm text-white placeholder-slate-400 focus:outline-none focus:border-brand-primary focus:ring-1 focus:ring-brand-primary transition-all"
                        placeholder="Rechercher un avantage..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                    />
                </div>
            </div>

            {loading ? (
                <div className="flex justify-center p-12">
                    <Spinner />
                </div>
            ) : error ? (
                <div className="bg-red-500/10 border border-red-500/20 text-red-400 p-4 rounded-xl text-sm">
                    {error}
                </div>
            ) : catalog.length === 0 ? (
                <div className="flex flex-col items-center justify-center p-16 bg-slate-900/50 backdrop-blur-md rounded-2xl border border-slate-800 text-slate-400 shadow-xl">
                    <Store size={48} className="mb-4 text-slate-700" />
                    <p className="text-lg font-medium text-slate-300">Aucun avantage dans le catalogue</p>
                    <p className="text-sm mt-1 text-center max-w-md">
                        Les entreprises n'ont pas encore publié d'avantages publiquement.
                    </p>
                </div>
            ) : filteredCatalog.length === 0 ? (
                <div className="flex flex-col items-center justify-center p-16 bg-slate-900/50 backdrop-blur-md rounded-2xl border border-slate-800 text-slate-400 shadow-xl">
                    <Filter size={48} className="mb-4 text-slate-700" />
                    <p className="text-lg font-medium text-slate-300">Aucun résultat</p>
                    <p className="text-sm mt-1 text-center max-w-md">
                        Aucun avantage ne correspond à votre recherche "{searchQuery}".
                    </p>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {filteredCatalog.map((perk, idx) => (
                        <motion.div
                            key={`${perk.company.id}-${perk.id}-${idx}`}
                            variants={cardVariants}
                            onClick={() => setSelectedPerk(perk)}
                            className="bg-slate-900/50 backdrop-blur-md border border-slate-800/60 rounded-2xl p-6 shadow-xl hover:border-emerald-500/30 hover:bg-slate-800/80 transition-all cursor-pointer group flex flex-col h-full"
                        >
                            <div className="flex justify-between items-start mb-4">
                                <div className="w-12 h-12 bg-emerald-500/10 rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform overflow-hidden">
                                    {perk.perksIconUrl ? (
                                        <img src={perk.perksIconUrl} alt={perk.label} className="w-full h-full object-cover" />
                                    ) : (
                                        <Building className="text-emerald-400" size={24} />
                                    )}
                                </div>
                                <span className="px-3 py-1 bg-slate-800 text-slate-300 text-xs font-semibold rounded-full border border-slate-700">
                                    {perk.label}
                                </span>
                            </div>

                            <h3 className="text-xl font-bold text-white mb-2 group-hover:text-emerald-400 transition-colors">
                                {perk.company.name}
                            </h3>
                            
                            <div className="mb-4 inline-block px-3 py-1.5 bg-emerald-500/10 border border-emerald-500/20 rounded-lg">
                                <p className="text-sm font-bold text-emerald-400 tracking-wide">
                                    {formatPrice(perk.perksPrice, perk.perksPriceDuration)}
                                </p>
                            </div>

                            <div className="text-sm text-slate-400 line-clamp-3 mt-auto pt-2">
                                {perk.perksDescription ? (
                                    <div className="prose prose-invert prose-sm max-w-none">
                                        <ReactMarkdown
                                            remarkPlugins={[remarkGfm, remarkBreaks]}
                                        >
                                            {perk.perksDescription}
                                        </ReactMarkdown>
                                    </div>
                                ) : (
                                    <span className="italic text-slate-500">Aucune description disponible.</span>
                                )}
                            </div>
                        </motion.div>
                    ))}
                </div>
            )}

            {/* Modal for detailed view */}
            <AnimatePresence>
                {selectedPerk && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
                        onClick={() => setSelectedPerk(null)}
                    >
                        <motion.div
                            initial={{ scale: 0.95, opacity: 0, y: 20 }}
                            animate={{ scale: 1, opacity: 1, y: 0 }}
                            exit={{ scale: 0.95, opacity: 0, y: 20 }}
                            onClick={(e) => e.stopPropagation()}
                            className="bg-slate-900 border border-slate-800 rounded-2xl p-8 max-w-2xl w-full max-h-[85vh] overflow-y-auto shadow-2xl relative"
                        >
                            <button 
                                onClick={() => setSelectedPerk(null)}
                                className="absolute top-4 right-4 text-slate-400 hover:text-white transition-colors"
                            >
                                <XCircle size={24} />
                            </button>

                            <div className="flex items-center gap-4 mb-4">
                                <div className="w-16 h-16 bg-emerald-500/10 rounded-2xl flex items-center justify-center overflow-hidden shrink-0">
                                    {selectedPerk.perksIconUrl ? (
                                        <img src={selectedPerk.perksIconUrl} alt={selectedPerk.label} className="w-full h-full object-cover" />
                                    ) : (
                                        <Building className="text-emerald-400" size={32} />
                                    )}
                                </div>
                                <div>
                                    <h2 className="text-2xl font-bold text-white">{selectedPerk.company.name}</h2>
                                    <p className="text-slate-400">Avantage {selectedPerk.label}</p>
                                </div>
                            </div>
                            
                            <div className="mb-6 p-4 bg-slate-950/80 border border-slate-800 rounded-xl inline-block">
                                <span className="text-xs font-semibold text-slate-500 uppercase tracking-widest block mb-1">Prix de l'avantage</span>
                                <span className="text-xl font-black text-emerald-400">
                                    {formatPrice(selectedPerk.perksPrice, selectedPerk.perksPriceDuration)}
                                </span>
                            </div>

                            <div className="bg-slate-950/50 border border-slate-800/80 rounded-xl p-6">
                                {selectedPerk.perksDescription ? (
                                    <div className="prose prose-invert prose-emerald max-w-none">
                                        <ReactMarkdown remarkPlugins={[remarkGfm, remarkBreaks]}>
                                            {selectedPerk.perksDescription}
                                        </ReactMarkdown>
                                    </div>
                                ) : (
                                    <p className="text-slate-400 italic">Aucune description détaillée n'est fournie pour cet avantage.</p>
                                )}
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </motion.div>
    );
}
