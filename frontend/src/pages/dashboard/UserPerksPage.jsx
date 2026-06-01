// frontend/src/pages/dashboard/UserPerksPage.jsx

import React, { useState, useEffect, useCallback } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { getMyPerks } from '@/services/clientsService';
import Spinner from '@/components/ui/Spinner';
import { Star, Building, XCircle, Store } from 'lucide-react';
import { Link } from 'react-router-dom';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkBreaks from 'remark-breaks';

const pageVariants = {
    hidden: { opacity: 0 },
    visible: { opacity: 1, transition: { staggerChildren: 0.1 } }
};

const cardVariants = {
    hidden: { y: 20, opacity: 0 },
    visible: { y: 0, opacity: 1, transition: { type: 'spring', stiffness: 100 } }
};

export default function UserPerksPage() {
    const [perks, setPerks] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [selectedPerk, setSelectedPerk] = useState(null);

    const fetchPerks = useCallback(async () => {
        try {
            setLoading(true);
            setError(null);
            const data = await getMyPerks();
            setPerks(Array.isArray(data) ? data : []);
        } catch (err) {
            setError(err.message || "Erreur lors du chargement de vos avantages.");
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchPerks();
    }, [fetchPerks]);

    return (
        <motion.div
            className="space-y-6"
            initial="hidden"
            animate="visible"
            variants={pageVariants}
        >
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2">
                        <Star className="text-yellow-400" size={28} />
                        Mes Avantages
                    </h1>
                    <p className="text-slate-400 text-sm mt-1">Consultez vos avantages clients exclusifs obtenus auprès de nos partenaires.</p>
                </div>
                
                <Link 
                    to="/dashboard/perks-catalog"
                    className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-white font-medium text-sm transition-all shadow-sm hover:shadow-md"
                >
                    <Store size={18} className="text-emerald-400" />
                    Voir le catalogue d'avantages
                </Link>
            </div>

            {loading ? (
                <div className="flex justify-center p-12">
                    <Spinner />
                </div>
            ) : error ? (
                <div className="bg-red-500/10 border border-red-500/20 text-red-400 p-4 rounded-xl text-sm">
                    {error}
                </div>
            ) : perks.length === 0 ? (
                <div className="flex flex-col items-center justify-center p-16 bg-slate-900/50 backdrop-blur-md rounded-2xl border border-slate-800 text-slate-400 shadow-xl">
                    <Star size={48} className="mb-4 text-slate-700" />
                    <p className="text-lg font-medium text-slate-300">Aucun avantage pour le moment</p>
                    <p className="text-sm mt-1 text-center max-w-md">
                        Devenez un client privilégié chez nos partenaires pour débloquer des avantages exclusifs qui apparaîtront ici.
                    </p>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {perks.map((perk, idx) => (
                        <motion.div
                            key={`${perk.clientId}-${perk.variable.id}-${idx}`}
                            variants={cardVariants}
                            onClick={() => setSelectedPerk(perk)}
                            className="bg-slate-900/50 backdrop-blur-md border border-slate-800/60 rounded-2xl p-6 shadow-xl hover:border-brand-primary/50 hover:bg-slate-800/80 transition-all cursor-pointer group"
                        >
                            <div className="flex justify-between items-start mb-4">
                                <div className="w-12 h-12 bg-brand-primary/10 rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform overflow-hidden">
                                    {perk.variable.perksIconUrl ? (
                                        <img src={perk.variable.perksIconUrl} alt={perk.variable.label} className="w-full h-full object-cover" />
                                    ) : (
                                        <Building className="text-brand-primary" size={24} />
                                    )}
                                </div>
                                <span className="px-3 py-1 bg-yellow-500/20 text-yellow-400 text-xs font-semibold rounded-full border border-yellow-500/30 shadow-[0_0_15px_rgba(234,179,8,0.2)]">
                                    {perk.variable.label}
                                </span>
                            </div>

                            <h3 className="text-xl font-bold text-white mb-1 group-hover:text-brand-primary transition-colors">
                                {perk.company.name}
                            </h3>
                            <p className="text-sm text-slate-400 font-medium mb-4">
                                {perk.clientName}
                            </p>

                            <div className="text-sm text-slate-300 line-clamp-3">
                                {perk.variable.perksDescription ? (
                                    <div className="prose prose-invert prose-sm max-w-none">
                                        <ReactMarkdown
                                            remarkPlugins={[remarkGfm, remarkBreaks]}
                                        >
                                            {perk.variable.perksDescription}
                                        </ReactMarkdown>
                                    </div>
                                ) : (
                                    <span className="italic text-slate-500">Aucune description disponible.</span>
                                )}
                            </div>

                            {perk.fidelityCard && (
                                <div className="mt-5 pt-5 border-t border-slate-800/60">
                                    <div className="flex justify-between items-center text-sm">
                                        <span className="text-slate-400">Carte de fidélité</span>
                                        <span className="font-semibold text-white bg-slate-800 px-2 py-1 rounded-md">
                                            {perk.fidelityCard.stampCount} / {perk.fidelityCard.template.stampZones?.length || '?'} tampons
                                        </span>
                                    </div>
                                </div>
                            )}
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

                            <div className="flex items-center gap-4 mb-6">
                                <div className="w-16 h-16 bg-brand-primary/10 rounded-2xl flex items-center justify-center overflow-hidden shrink-0">
                                    {selectedPerk.variable.perksIconUrl ? (
                                        <img src={selectedPerk.variable.perksIconUrl} alt={selectedPerk.variable.label} className="w-full h-full object-cover" />
                                    ) : (
                                        <Building className="text-brand-primary" size={32} />
                                    )}
                                </div>
                                <div>
                                    <h2 className="text-2xl font-bold text-white">{selectedPerk.company.name}</h2>
                                    <p className="text-slate-400">Avantage {selectedPerk.variable.label}</p>
                                </div>
                            </div>

                            <div className="bg-slate-950/50 border border-slate-800/80 rounded-xl p-6 mb-6">
                                {selectedPerk.variable.perksDescription ? (
                                    <div className="prose prose-invert prose-indigo max-w-none">
                                        <ReactMarkdown remarkPlugins={[remarkGfm, remarkBreaks]}>
                                            {selectedPerk.variable.perksDescription}
                                        </ReactMarkdown>
                                    </div>
                                ) : (
                                    <p className="text-slate-400 italic">Aucune description détaillée n'est fournie pour cet avantage.</p>
                                )}
                            </div>

                            {selectedPerk.fidelityCard && (
                                <div className="bg-indigo-500/10 border border-indigo-500/20 rounded-xl p-6 flex flex-col sm:flex-row items-center justify-between gap-4">
                                    <div>
                                        <h4 className="text-indigo-300 font-semibold mb-1">Carte de fidélité active</h4>
                                        <p className="text-sm text-indigo-400/80">
                                            Vous avez cumulé {selectedPerk.fidelityCard.stampCount} tampons sur un total de {selectedPerk.fidelityCard.template.stampZones?.length || '?'}.
                                        </p>
                                    </div>
                                    <a 
                                        href={`/fidelity/view/${selectedPerk.fidelityCard.publicLink}`}
                                        target="_blank"
                                        rel="noreferrer"
                                        className="whitespace-nowrap px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium rounded-lg transition-colors"
                                    >
                                        Voir ma carte
                                    </a>
                                </div>
                            )}
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </motion.div>
    );
}
