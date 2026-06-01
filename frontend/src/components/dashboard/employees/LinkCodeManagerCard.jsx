// frontend/src/components/dashboard/employees/LinkCodeManagerCard.jsx

import React, { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import toast from 'react-hot-toast';
import { KeyRound, Copy, RefreshCw, Loader2, CheckCheck, ShieldAlert } from 'lucide-react';
import { generateLinkCode } from '@/services/employeesService';

/**
 * Card affichée côté dirigeant sur le profil d'un employé PENDING_LINK.
 * Permet de générer/régénérer un code de liaison à donner à l'employé IRL.
 */
const LinkCodeManagerCard = ({ employee, companyId, onRefresh: _onRefresh }) => {
    const [linkCode, setLinkCode] = useState(employee?.linkCode ?? null);
    const [linkCodeCreatedAt, setLinkCodeCreatedAt] = useState(employee?.linkCodeCreatedAt ?? null);
    const [loading, setLoading] = useState(false);
    const [copied, setCopied] = useState(false);

    const handleGenerate = async () => {
        setLoading(true);
        try {
            const res = await generateLinkCode(companyId, employee.id);
            if (res?.data) {
                setLinkCode(res.data.linkCode);
                setLinkCodeCreatedAt(res.data.linkCodeCreatedAt);
                toast.success('Code de liaison généré !');
            }
        } catch (err) {
            toast.error(err?.message || 'Erreur lors de la génération du code.');
        } finally {
            setLoading(false);
        }
    };

    const handleCopy = async () => {
        if (!linkCode) return;
        await navigator.clipboard.writeText(linkCode);
        setCopied(true);
        toast.success('Code copié !');
        setTimeout(() => setCopied(false), 2000);
    };

    // Formatage de la date de création
    const formattedDate = linkCodeCreatedAt
        ? new Date(linkCodeCreatedAt).toLocaleString('fr-FR', {
              day: '2-digit', month: '2-digit', year: 'numeric',
              hour: '2-digit', minute: '2-digit',
          })
        : null;

    return (
        <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ type: 'spring', stiffness: 120, damping: 16 }}
            className="relative overflow-hidden rounded-2xl border border-violet-500/20 bg-violet-500/5 backdrop-blur-xl shadow-xl shadow-violet-500/5"
        >
            {/* Glow strip */}
            <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-violet-400/50 to-transparent" />

            <div className="p-6 space-y-5">
                {/* Header */}
                <div className="flex items-center gap-3">
                    <div className="p-2.5 rounded-xl bg-violet-500/10 border border-violet-500/20 shrink-0">
                        <KeyRound className="h-5 w-5 text-violet-400" />
                    </div>
                    <div>
                        <p className="text-[10px] font-black uppercase tracking-[0.3em] text-violet-400/80">
                            Liaison de compte
                        </p>
                        <h3 className="text-base font-black text-cca-textPrimary leading-tight">
                            Code de Liaison
                        </h3>
                    </div>
                </div>

                {/* Explication */}
                <p className="text-sm text-cca-textSecondary leading-relaxed">
                    Générez un code unique et donnez-le à{' '}
                    <span className="text-cca-textPrimary font-bold">{employee?.user?.name}</span>{' '}
                    pour qu'il puisse relier son compte.
                </p>

                {/* Code display */}
                <AnimatePresence mode="wait">
                    {linkCode ? (
                        <motion.div
                            key="code"
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            className="space-y-3"
                        >
                            {/* Code box */}
                            <div className="relative flex items-center justify-between gap-3 p-4 rounded-xl bg-cca-base/60 border border-violet-500/30">
                                <span className="font-mono text-2xl font-black tracking-[0.5em] text-violet-300 select-all">
                                    {linkCode}
                                </span>
                                <button
                                    onClick={handleCopy}
                                    title="Copier le code"
                                    className="shrink-0 p-2 rounded-lg bg-violet-500/10 hover:bg-violet-500/20 border border-violet-500/20 transition-all active:scale-95"
                                >
                                    {copied
                                        ? <CheckCheck className="h-4 w-4 text-emerald-400" />
                                        : <Copy className="h-4 w-4 text-violet-400" />
                                    }
                                </button>
                            </div>

                            {/* Metadata */}
                            <div className="flex items-center justify-between">
                                {formattedDate && (
                                    <p className="text-[10px] text-cca-textSecondary/50 font-medium">
                                        Généré le {formattedDate}
                                    </p>
                                )}
                                <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-amber-500/10 border border-amber-500/20 text-[9px] font-black uppercase tracking-widest text-amber-400">
                                    <ShieldAlert className="h-2.5 w-2.5" />
                                    Usage unique
                                </span>
                            </div>
                        </motion.div>
                    ) : (
                        <motion.div
                            key="empty"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            className="py-2 text-center text-sm text-cca-textSecondary/40 italic"
                        >
                            Aucun code généré pour le moment.
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* Generate / Regenerate button */}
                <button
                    onClick={handleGenerate}
                    disabled={loading}
                    className="
                        w-full flex items-center justify-center gap-2
                        px-4 py-3 rounded-xl
                        bg-violet-600 hover:bg-violet-500 active:scale-95
                        text-[10px] font-black uppercase tracking-widest text-white
                        shadow-lg shadow-violet-500/20
                        disabled:opacity-40 disabled:cursor-not-allowed disabled:active:scale-100
                        transition-all
                    "
                >
                    {loading ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                        <RefreshCw className="h-4 w-4" />
                    )}
                    {loading ? 'Génération…' : linkCode ? 'Régénérer un code' : 'Générer un code'}
                </button>
            </div>
        </motion.div>
    );
};

export default LinkCodeManagerCard;
