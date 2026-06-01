// /frontend/src/components/dashboard/employees/StatusManagerCard.jsx

import React, { useState, useEffect } from 'react';
import { getRanks, changeEmployeeRank, changeEmployeeStatus, resetEmployeeAccount } from '@/services/employeesService';
import toast from 'react-hot-toast';
import Spinner from '@/components/ui/Spinner';
import { Briefcase } from 'lucide-react';
import { InfoCard, InfoRow } from './EmployeeInfoComponents';
import { useConfirmation } from '@/contexts/ConfirmationContext';

const StatusManagerCard = ({ employee, companyId, onUpdate }) => {
    const { confirmAction } = useConfirmation();

    const [allRanks, setAllRanks] = useState([]);
    const [selectedRankId, setSelectedRankId] = useState(employee.rank.id);
    const [isRankLoading, setIsRankLoading] = useState(true);
    const [isSubmitting, setIsSubmitting] = useState(false);

    // -------- RESET MODAL STATE --------
    const [showResetModal, setShowResetModal] = useState(false);
    const [resetData, setResetData] = useState(null); // username, token, expiration
    const [timeLeft, setTimeLeft] = useState(0);

    // -----------------------------
    //   LOAD RANKS
    // -----------------------------
    useEffect(() => {
        getRanks(companyId)
            .then(setAllRanks)
            .catch(() => toast.error("Impossible de charger la liste des rangs."))
            .finally(() => setIsRankLoading(false));
    }, [companyId]);


    // -----------------------------
    //   SAVE RANK
    // -----------------------------
    const handleRankSave = async () => {
        setIsSubmitting(true);
        try {
            await changeEmployeeRank(companyId, employee.id, selectedRankId);
            toast.success("Le rang de l'employé a été mis à jour.");
            onUpdate();
        } catch (error) {
            toast.error(error.message || "Erreur lors de la mise à jour du rang.");
        } finally {
            setIsSubmitting(false);
        }
    };


    // -----------------------------
    //   CHANGE STATUS
    // -----------------------------
    const handleStatusChange = (newStatus) => {
        const statusText = {
            FIRE: "virer",
            RESIGNED: "marquer comme démissionnaire"
        };
        const message = `Êtes-vous sûr de vouloir ${statusText[newStatus] || 'changer le statut de'} cet employé ?`;

        confirmAction({
            title: "Confirmation",
            message,
            onConfirm: async () => {
                setIsSubmitting(true);
                try {
                    await changeEmployeeStatus(companyId, employee.id, newStatus);
                    toast.success("Le statut de l'employé a été mis à jour.");
                    onUpdate();
                } catch (error) {
                    toast.error(error.message || "Erreur lors de la mise à jour du statut.");
                } finally {
                    setIsSubmitting(false);
                }
            }
        });
    };


    // -----------------------------
    //   RESET ACCOUNT
    // -----------------------------
    const handleResetAccount = () => {
        confirmAction({
            title: "Reset du compte",
            message: "Voulez-vous vraiment réinitialiser son mot de passe ? Un token temporaire sera généré.",
            onConfirm: async () => {
                setIsSubmitting(true);
                try {
                    const response = await resetEmployeeAccount(companyId, employee.id);

                    const reset = response?.data;

                    if (!reset) {
                        toast.error("Erreur inattendue.");
                        return;
                    }

                    const { username, tempPasswordToken, tempPasswordExpiresAt, alreadyActive } = reset;

                    setResetData({
                        username,
                        tempPasswordToken,
                        tempPasswordExpiresAt
                    });

                    if (alreadyActive) {
                        toast.success("Un token était déjà actif.");
                    } else {
                        toast.success("Token généré avec succès !");
                    }

                    setShowResetModal(true);
                    //onUpdate?.();
                } catch (error) {
                    toast.error(error.message || "Erreur lors du reset du compte.");
                } finally {
                    setIsSubmitting(false);
                }
            }
        });
    };



    // -----------------------------
    //   TIMER LOGIC
    // -----------------------------
    useEffect(() => {
        if (!resetData) return;

        const interval = setInterval(() => {
            const exp = new Date(resetData.tempPasswordExpiresAt).getTime();
            const now = Date.now();

            const diff = Math.max(exp - now, 0);
            setTimeLeft(diff);

            if (diff <= 0) clearInterval(interval);
        }, 1000);

        return () => clearInterval(interval);
    }, [resetData]);

    const formattedTime = () => {
        const totalSec = Math.floor(timeLeft / 1000);
        const min = Math.floor(totalSec / 60);
        const sec = totalSec % 60;
        return `${min}m ${sec < 10 ? "0" : ""}${sec}s`;
    };

    const progressPercent = () => {
        const total = 15 * 60 * 1000;
        return Math.max(0, (timeLeft / total) * 100);
    };


    const renderResetModal = () => {
        if (!showResetModal || !resetData) return null;

        return (
            <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 animate-in fade-in duration-300">
                <div className="bg-cca-surface/80 border border-brand-primary/30 backdrop-blur-2xl p-8 rounded-[2.5rem] shadow-2xl w-full max-w-md relative overflow-hidden group">
                    {/* Background glow */}
                    <div className="absolute -top-24 -right-24 h-48 w-48 bg-brand-primary/10 blur-[80px] group-hover:bg-brand-primary/20 transition-colors" />

                    <h2 className="text-2xl font-black font-heading text-cca-textPrimary uppercase tracking-tight mb-6">Reset du compte</h2>

                    <div className="space-y-4 mb-8">
                        <div className="bg-cca-base/40 p-4 rounded-2xl border border-cca-border/20">
                            <span className="text-[10px] font-black uppercase tracking-widest text-cca-textSecondary/40 block mb-1">Identifiant</span>
                            <span className="text-lg font-bold text-cca-textPrimary">{resetData.username}</span>
                        </div>
                        <div className="bg-cca-base/40 p-4 rounded-2xl border border-cca-border/20">
                            <span className="text-[10px] font-black uppercase tracking-widest text-cca-textSecondary/40 block mb-1">Code Temporaire</span>
                            <span className="text-2xl font-black font-mono text-brand-primary tracking-tighter">{resetData.tempPasswordToken}</span>
                        </div>
                        <div className="flex justify-between items-center px-2">
                            <span className="text-[10px] font-black uppercase tracking-widest text-cca-textSecondary/60">Expiration</span>
                            <span className="text-sm font-black text-rose-400 font-mono">{formattedTime()}</span>
                        </div>
                    </div>

                    <div className="w-full h-1.5 bg-cca-base/40 rounded-full overflow-hidden mb-8">
                        <div
                            className="h-full bg-gradient-to-r from-brand-primary to-indigo-400"
                            style={{
                                width: `${progressPercent()}%`,
                                transition: "width 1s linear"
                            }}
                        ></div>
                    </div>

                    <button
                        className="w-full h-14 bg-brand-primary text-white font-black uppercase tracking-widest text-[10px] rounded-2xl shadow-xl shadow-brand-primary/20 hover:brightness-110 active:scale-95 transition-all"
                        onClick={() => setShowResetModal(false)}
                    >
                        Terminer & Fermer
                    </button>

                </div>
            </div>
        );
    };


    const isRankChanged = selectedRankId !== employee.rank.id;

    return (
        <InfoCard icon={<Briefcase className="text-amber-400" />} title="Statut Actuel">
            <div className="space-y-6">
                <InfoRow label="Statut" value={employee.status} />

                <div className="grid grid-cols-3 gap-4 items-center">
                    <span className="text-cca-textSecondary/40 text-[10px] font-black uppercase tracking-widest">Rang</span>
                    <div className="col-span-2">
                        {isRankLoading ? (
                            <Spinner size="small" />
                        ) : (
                            <select
                                value={selectedRankId}
                                onChange={(e) => setSelectedRankId(parseInt(e.target.value))}
                                className="w-full bg-cca-base/40 border border-cca-border/40 rounded-xl p-3 text-cca-textPrimary font-bold focus:outline-none focus:ring-2 focus:ring-brand-primary/20 transition-all"
                                disabled={isSubmitting}
                            >
                                {allRanks.map(rank => (
                                    <option key={rank.id} value={rank.id} className="bg-slate-800">{rank.name}</option>
                                ))}
                            </select>
                        )}
                    </div>
                </div>

                {isRankChanged && (
                    <div className="flex justify-end">
                        <button
                            onClick={handleRankSave}
                            disabled={isSubmitting}
                            className="px-6 py-2 bg-indigo-600 text-white text-[10px] font-black uppercase tracking-widest rounded-xl hover:bg-indigo-500 shadow-lg shadow-indigo-600/10 disabled:opacity-50 transition-all"
                        >
                            {isSubmitting ? 'Sauvegarde...' : 'Sauvegarder le rang'}
                        </button>
                    </div>
                )}
            </div>

            {/* ---------------- ACTIONS ---------------- */}
            <div className="mt-10 pt-6 border-t border-cca-border/20 flex flex-wrap items-center gap-4">
                <span className="text-[10px] font-black uppercase tracking-widest text-cca-textSecondary/60 w-full mb-2">Actions Administratives</span>

                <button
                    onClick={() => handleStatusChange('FIRE')}
                    disabled={isSubmitting || employee.status === 'FIRE'}
                    className="h-10 px-4 rounded-xl text-[10px] font-black uppercase tracking-widest border border-rose-500/30 text-rose-400 hover:bg-rose-500/10 disabled:opacity-30 transition-all"
                >
                    Licencier
                </button>

                <button
                    onClick={() => handleStatusChange('RESIGNED')}
                    disabled={isSubmitting || employee.status === 'RESIGNED'}
                    className="h-10 px-4 rounded-xl text-[10px] font-black uppercase tracking-widest border border-amber-500/30 text-amber-500 hover:bg-amber-500/10 disabled:opacity-30 transition-all"
                >
                    Démission
                </button>

                <button
                    onClick={handleResetAccount}
                    disabled={isSubmitting}
                    className="h-10 px-4 rounded-xl text-[10px] font-black uppercase tracking-widest border border-sky-500/30 text-sky-400 hover:bg-sky-500/10 disabled:opacity-30 transition-all ml-auto"
                >
                    Reset Accès
                </button>
            </div>

            {renderResetModal()}
        </InfoCard>
    );
};

export default StatusManagerCard;
