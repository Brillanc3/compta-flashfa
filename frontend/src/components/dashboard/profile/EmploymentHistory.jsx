import React from "react";
import { Briefcase, TrendingUp, Calendar } from "lucide-react";
import { motion } from 'framer-motion';

const containerVariants = {
    hidden: { opacity: 0 },
    visible: { opacity: 1, transition: { staggerChildren: 0.1 } },
};

const itemVariants = {
    hidden: { y: 20, opacity: 0 },
    visible: { y: 0, opacity: 1, transition: { type: "spring", stiffness: 100 } },
};

const safeDate = (value) => {
    if (!value) return null;
    const d = new Date(value);
    return isNaN(d.getTime()) ? null : d;
};

const formatDate = (value) => {
    const d = safeDate(value);
    if (!d) return "Date inconnue";
    return d.toLocaleDateString("fr-FR", { year: "numeric", month: "long", day: "numeric" });
};

const statusLabels = {
    ACTIVE: "Actif",
    RESIGNED: "Démissionné",
    FIRE: "Licencié",
    PENDING_LINK: "En attente",
};

const EmploymentHistory = ({ employmentData = [] }) => {
    return (
        <motion.div className="bg-slate-800 rounded-lg shadow-lg p-6"
                    initial="hidden"
                    animate="visible"
                    variants={containerVariants}
        >
            <motion.h2 className="text-xl font-semibold text-white border-b border-slate-700 pb-3 mb-4 flex items-center"
                       variants={itemVariants}
            >
                <Briefcase className="mr-3 h-5 w-5 text-indigo-400" />
                Parcours Professionnel
            </motion.h2>

            {employmentData.length === 0 && (
                <p className="text-slate-400">Aucune donnée disponible.</p>
            )}

            <div className="space-y-10">
                {employmentData.map((emp, idx) => (
                    <motion.div key={idx} variants={itemVariants}>
                        <h3 className="text-lg font-medium text-indigo-300">
                            {emp.companyName}
                        </h3>

                        <p className="text-sm text-slate-400">
                            Statut : {statusLabels[emp.status] || emp.status}
                        </p>

                        <p className="text-sm text-slate-300">
                            Rang actuel : <span className="text-white">{emp.currentRank}</span>
                        </p>

                        <p className="text-xs text-slate-500 flex items-center mt-1">
                            <Calendar className="h-3 w-3 mr-1.5" />
                            Employé depuis le {formatDate(emp.hiredAt)}
                        </p>

                        <h4 className="text-md font-medium text-slate-300 mt-4 mb-3 flex items-center">
                            <TrendingUp className="mr-2 h-4 w-4" />
                            Historique des rangs
                        </h4>

                        {emp.history.length === 0 && (
                            <p className="text-slate-500 text-sm">Aucun historique disponible.</p>
                        )}

                        {emp.history.length > 0 && (
                            <div className="border-l-2 border-slate-700 pl-4 space-y-4">
                                {emp.history.map((h) => (
                                    <div key={h.id} className="relative">
                                        <div className="absolute -left-[2.3rem] top-1 h-4 w-4 bg-indigo-500 rounded-full border-4 border-slate-800"></div>

                                        <p className="font-semibold text-white">{h.rankName}</p>

                                        <p className="text-xs text-slate-500 mt-1 flex items-center">
                                            <Calendar className="mr-1.5 h-3 w-3" />
                                            Du {formatDate(h.assignedAt)}
                                            {h.leaveAt && ` au ${formatDate(h.leaveAt)}`}
                                        </p>
                                    </div>
                                ))}
                            </div>
                        )}
                    </motion.div>
                ))}
            </div>
        </motion.div>
    );
};

export default EmploymentHistory;
