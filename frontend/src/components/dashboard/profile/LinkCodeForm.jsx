// frontend/src/components/dashboard/profile/LinkCodeForm.jsx

import React, { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import toast from 'react-hot-toast';
import { Link2, CheckCircle2, AlertTriangle, Loader2 } from 'lucide-react';
import { useLinkCode as linkCodeApi } from '@/services/employeesService';

/**
 * Visible uniquement si l'utilisateur n'a pas de discordId ET pas de characterId.
 * Permet de saisir un code de liaison fourni par le dirigeant.
 */
const LinkCodeForm = ({ onSuccess }) => {
    const [code, setCode] = useState('');
    const [loading, setLoading] = useState(false);
    const [done, setDone] = useState(false);

    const handleInput = (e) => {
        // Uppercase, alphanumérique seulement, max 8 chars
        const v = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8);
        setCode(v);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (code.length !== 8) {
            toast.error('Le code doit contenir exactement 8 caractères.');
            return;
        }
        setLoading(true);
        try {
            await linkCodeApi(code);
            setDone(true);
            toast.success('Compte lié avec succès !');
            // Recharge les données du profil après un court délai
            setTimeout(() => onSuccess?.(), 1200);
        } catch (err) {
            const msg = err?.message || 'Code invalide ou déjà utilisé.';
            toast.error(msg);
        } finally {
            setLoading(false);
        }
    };

    return (
        <motion.div
            initial={{ opacity: 0, y: -12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ type: 'spring', stiffness: 120, damping: 16 }}
            className="relative overflow-hidden rounded-2xl border border-amber-500/30 bg-amber-500/5 backdrop-blur-xl shadow-xl shadow-amber-500/5"
        >
            {/* Glow strip */}
            <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-amber-400/60 to-transparent" />

            <div className="p-6 space-y-5">
                {/* Header */}
                <div className="flex items-start gap-4">
                    <div className="shrink-0 p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/20">
                        <AlertTriangle className="h-5 w-5 text-amber-400" />
                    </div>
                    <div>
                        <p className="text-[10px] font-black uppercase tracking-[0.3em] text-amber-400/80 mb-0.5">
                            Compte incomplet
                        </p>
                        <h2 className="text-lg font-black text-cca-textPrimary leading-tight">
                            Lier votre compte
                        </h2>
                        <p className="text-sm text-cca-textSecondary mt-1 leading-relaxed">
                            Votre compte n'est pas encore lié à une identité en jeu.
                            Demandez à votre dirigeant le <span className="text-amber-300 font-bold">code de liaison</span> et saisissez-le ci-dessous.
                        </p>
                    </div>
                </div>

                {/* Form */}
                <AnimatePresence mode="wait">
                    {done ? (
                        <motion.div
                            key="success"
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            className="flex items-center gap-3 p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20"
                        >
                            <CheckCircle2 className="h-6 w-6 text-emerald-400 shrink-0" />
                            <div>
                                <p className="font-black text-emerald-400 text-sm">Liaison réussie !</p>
                                <p className="text-xs text-cca-textSecondary">Votre profil est en cours de mise à jour…</p>
                            </div>
                        </motion.div>
                    ) : (
                        <motion.form
                            key="form"
                            onSubmit={handleSubmit}
                            className="flex flex-col sm:flex-row gap-3"
                        >
                            <div className="flex-1">
                                <input
                                    id="link-code-input"
                                    type="text"
                                    value={code}
                                    onChange={handleInput}
                                    placeholder="XXXXXXXX"
                                    disabled={loading}
                                    autoComplete="off"
                                    spellCheck={false}
                                    className="
                                        w-full rounded-xl bg-cca-base/60 border border-cca-border
                                        px-4 py-3 text-center text-xl font-black font-mono tracking-[0.4em]
                                        text-cca-textPrimary placeholder:text-cca-textSecondary/20
                                        focus:outline-none focus:border-amber-400/60 focus:ring-2 focus:ring-amber-400/10
                                        transition-all uppercase disabled:opacity-50
                                    "
                                    maxLength={8}
                                />
                            </div>
                            <button
                                type="submit"
                                disabled={loading || code.length !== 8}
                                className="
                                    flex items-center justify-center gap-2 px-6 py-3 rounded-xl
                                    bg-amber-500 hover:bg-amber-400 active:scale-95
                                    text-[10px] font-black uppercase tracking-widest text-white
                                    shadow-lg shadow-amber-500/20
                                    disabled:opacity-40 disabled:cursor-not-allowed disabled:active:scale-100
                                    transition-all
                                "
                            >
                                {loading ? (
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                    <Link2 className="h-4 w-4" />
                                )}
                                {loading ? 'Liaison…' : 'Lier mon compte'}
                            </button>
                        </motion.form>
                    )}
                </AnimatePresence>

                {/* Badge */}
                <p className="text-[10px] text-cca-textSecondary/40 font-medium">
                    Ce code est à usage unique et vous a été fourni par votre dirigeant.
                </p>
            </div>
        </motion.div>
    );
};

export default LinkCodeForm;
