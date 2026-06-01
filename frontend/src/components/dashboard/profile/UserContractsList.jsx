import React, { useState } from 'react';
import PropTypes from 'prop-types';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { FileText, CheckCircle, Clock, XCircle, AlertCircle, Link2 } from 'lucide-react';
import ContractViewerModal from '@/components/contracts/ContractViewerModal';
import ContractShareManagerModal from '@/components/contracts/ContractShareManagerModal.jsx';
import { motion } from 'framer-motion';

// ----------- Badges de statut -----------
const StatusBadge = ({ status }) => {
    const statusMap = {
        PENDING: { text: 'En attente', icon: <Clock size={14} />, color: 'bg-yellow-500/20 text-yellow-400' },
        SIGNED: { text: 'Signé', icon: <CheckCircle size={14} />, color: 'bg-green-500/20 text-green-400' },
        REJECTED: { text: 'Rejeté', icon: <XCircle size={14} />, color: 'bg-red-500/20 text-red-400' },
        CANCELED: { text: 'Annulé', icon: <AlertCircle size={14} />, color: 'bg-slate-500/20 text-slate-400' },
    };

    const { text, icon, color } = statusMap[status] || statusMap.CANCELED;

    return (
        <span className={`inline-flex items-center gap-1.5 rounded-full px-2 py-1 text-xs font-medium ${color}`}>
            {icon}
            {text}
        </span>
    );
};

// ----------- Liste des contrats utilisateur -----------
const UserContractsList = ({ contracts }) => {
    const [openContractId, setOpenContractId] = useState(null);
    const [openShareContract, setOpenShareContract] = useState(null);
    const [shareByContractId, setShareByContractId] = useState({});

    if (!contracts || contracts.length === 0) {
        return (
            <div className="bg-slate-800 rounded-lg shadow-lg p-6 text-center">
                <FileText className="mx-auto h-12 w-12 text-slate-500" />
                <h3 className="mt-2 text-lg font-semibold text-white">Aucun contrat</h3>
                <p className="mt-1 text-sm text-slate-400">Vous n'avez aucun contrat assigné pour le moment.</p>
            </div>
        );
    }

    return (
        <>
            {/* Modale d'affichage / signature / refus */}
            <ContractViewerModal
                contractId={openContractId}
                isOpen={!!openContractId}
                onClose={() => setOpenContractId(null)}
            />

            <ContractShareManagerModal
                isOpen={!!openShareContract}
                onClose={() => setOpenShareContract(null)}
                assignedContractIds={openShareContract ? [openShareContract.id] : []}
                contractTitle={openShareContract?.title || openShareContract?.template?.title || "Contrat"}
                initialShareId={openShareContract ? shareByContractId[openShareContract.id] || null : null}
                companyScoped={false}
                onShareChange={(share) => {
                    if (!openShareContract?.id) return;

                    setShareByContractId((prev) => ({
                        ...prev,
                        [openShareContract.id]: share?.id || null,
                    }));
                }}
            />

            <div className="bg-slate-800 rounded-lg shadow-lg">
                <h2 className="text-xl font-semibold text-white p-6 border-b border-slate-700 flex items-center">
                    <FileText className="mr-3 h-5 w-5 text-indigo-400" />
                    Mes Contrats
                </h2>

                <motion.ul
                    className="divide-y divide-slate-700"
                    initial="hidden"
                    animate="visible"
                    variants={{ visible: { transition: { staggerChildren: 0.05 } } }}
                >
                    {contracts.map(contract => (
                        <motion.li
                            key={contract.id}
                            onClick={() => setOpenContractId(contract.id)}
                            className="p-4 sm:p-6 flex items-center justify-between hover:bg-slate-700/50 transition-colors cursor-pointer"
                            variants={{ hidden: { opacity: 0, y: 20 }, visible: { opacity: 1, y: 0 } }}
                            whileHover={{ scale: 1.01 }}
                        >
                            <div className="flex-1 min-w-0">
                                {/* 🆕 Affichage du titre du contrat figé (backend snapshot dans contractService) */}
                                <p className="text-md font-semibold text-white truncate">
                                    {contract.title || contract.template?.title}
                                </p>

                                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-1 text-xs text-slate-400">
                                    <span>
                                        Assigné le: {format(new Date(contract.assignedAt), 'd MMMM yyyy', { locale: fr })}
                                    </span>
                                    {contract.signedAt && (
                                        <span>
                                            Signé le: {format(new Date(contract.signedAt), 'd MMMM yyyy', { locale: fr })}
                                        </span>
                                    )}
                                </div>
                            </div>

                            <div className="flex items-center gap-2 ml-4">
                                <StatusBadge status={contract.status} />

                                <button
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        setOpenShareContract(contract);
                                    }}
                                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-semibold border border-slate-600 text-slate-200 rounded-md hover:bg-slate-700 focus:outline-none focus:ring-2 focus:ring-slate-500 focus:ring-offset-2 focus:ring-offset-slate-800"
                                >
                                    <Link2 size={14} />
                                    {shareByContractId[contract.id] ? 'Gérer le partage' : 'Partager'}
                                </button>

                                {contract.status === 'PENDING' && (
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            setOpenContractId(contract.id);
                                        }}
                                        className="px-3 py-1.5 text-sm font-semibold bg-indigo-600 text-white rounded-md hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 focus:ring-offset-slate-800"
                                    >
                                        Voir
                                    </button>
                                )}
                            </div>
                        </motion.li>
                    ))}
                </motion.ul>
            </div>
        </>
    );
};

UserContractsList.propTypes = {
    contracts: PropTypes.array.isRequired
};

export default UserContractsList;
