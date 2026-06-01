import React, { useState, useEffect, useCallback } from 'react';

import {
    listClients,
    addStampToCard,
    getAllFidelityTemplates,
    createCardForClient,
    deleteFidelityCard,
    updateFidelityCardStatus,
    getCardLastHistory,
    renewFidelityCard
} from '@/services/clientsService';

import toast from 'react-hot-toast';
import Spinner from '@/components/ui/Spinner';

import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import AddCircleOutlineIcon from '@mui/icons-material/AddCircleOutline';
import VisibilityIcon from '@mui/icons-material/Visibility';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';
import InfoIcon from '@mui/icons-material/Info';
import BlockIcon from '@mui/icons-material/Block';
import AutorenewIcon from '@mui/icons-material/Autorenew';
import {useCompany} from "@/contexts/CompanyContext.jsx";
import ConfirmationModal from '@/components/ui/ConfirmationModal';

const FidelityClientsPage = () => {
    const { activeCompanyId } = useCompany();
    const companyId = activeCompanyId;

    const [clients, setClients] = useState([]);
    const [pagination, setPagination] = useState(null);
    const [loading, setLoading] = useState(true);

    const [page, setPage] = useState(1);
    const [limit] = useState(15);
    const [search, setSearch] = useState('');
    const [searchInput, setSearchInput] = useState('');
    const [filter, setFilter] = useState('all');

    // View Card Modal
    const [modalOpen, setModalOpen] = useState(false);
    const [modalLoading, setModalLoading] = useState(false);
    const [modalData, setModalData] = useState(null);

    // Create Card Modal
    const [createCardClientId, setCreateCardClientId] = useState(null);
    const [templates, setTemplates] = useState([]);
    const [loadingTemplates, setLoadingTemplates] = useState(false);

    // Deactivation
    const [deactivatingCardId, setDeactivatingCardId] = useState(null);
    const [deactivationComment, setDeactivationComment] = useState("");

    const [confirmModal, setConfirmModal] = useState({ isOpen: false, message: '', onConfirm: null });

    // History (Comment viewer)
    const [historyCardId, setHistoryCardId] = useState(null);
    const [historyData, setHistoryData] = useState(null);
    const [loadingHistory, setLoadingHistory] = useState(false);

    /*--------------- SEARCH DEBOUNCE ----------------*/
    useEffect(() => {
        const t = setTimeout(() => {
            setSearch(searchInput);
            setPage(1);
        }, 300);
        return () => clearTimeout(t);
    }, [searchInput]);

    /*--------------- FETCH CLIENTS ----------------*/
    const fetchData = useCallback(async () => {
        try {
            setLoading(true);
            const result = await listClients(companyId, { page, limit, search, filter });
            setClients(result.data);
            setPagination(result.pagination);
        } catch (err) {
            toast.error(err.message || "Erreur lors du chargement.");
        }
        setLoading(false);
    }, [companyId, page, limit, search, filter]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    /*--------------- VIEW CARD IMAGE ----------------*/
    const handleViewCard = (publicLink) => {
        setModalOpen(true);
        setModalLoading(true);

        const url = `${window.location.origin}/api/fidelity/view/${publicLink}`;
        setModalData(url);
        setModalLoading(false);
    };

    /*--------------- ADD STAMP ----------------*/
    const handleAddStamp = async (card) => {
        try {
            const result = await addStampToCard(companyId, card.publicLink);

            if (result.isFull) {
                toast(`Carte complète (${result.stampCount}/${result.maxStamps})`, {
                    icon: "🏁"
                });
            } else {
                toast.success(`Tampon ajouté (${result.stampCount}/${result.maxStamps})`);
            }

            fetchData();
        } catch {
            toast.error("Impossible d'ajouter le tampon.");
        }
    };

    /*--------------- COPY LINK ----------------*/
    const copyLink = (publicLink) => {
        const link = `${window.location.origin}/api/fidelity/view/${publicLink}`;
        navigator.clipboard.writeText(link);
        toast.success("Lien copié !");
    };

    /*--------------- CREATE CARD ----------------*/
    const openCreateCardModal = async (clientId) => {
        try {
            setCreateCardClientId(clientId);
            setLoadingTemplates(true);
            const allTemplates = await getAllFidelityTemplates(companyId);
            setTemplates(allTemplates);
        } catch {
            toast.error("Impossible de charger les modèles");
        }
        setLoadingTemplates(false);
    };

    const handleCreateCard = async (templateId) => {
        try {
            await createCardForClient(companyId, createCardClientId, templateId);
            toast.success("Carte créée !");
            setCreateCardClientId(null);
            fetchData();
        } catch (err) {
            toast.error(err.message || "Erreur lors de la création.");
        }
    };

    /*--------------- DELETE CARD ----------------*/
    const handleDeleteCard = (cardId) => {
        setConfirmModal({
            isOpen: true,
            message: "Êtes-vous sûr de vouloir supprimer cette carte ? Cette action est irréversible.",
            onConfirm: async () => {
                setConfirmModal(p => ({ ...p, isOpen: false }));
                try {
                    await deleteFidelityCard(companyId, cardId);
                    toast.success("Carte supprimée !");
                    fetchData();
                } catch (err) {
                    toast.error(err.message || "Erreur lors de la suppression.");
                }
            },
        });
    };

    /*--------------- DISABLE CARD ----------------*/
    const openDisableModal = (cardId) => {
        setDeactivatingCardId(cardId);
        setDeactivationComment("");
    };

    const handleDisableCard = async () => {
        if (!deactivationComment.trim()) {
            return toast.error("Le commentaire est obligatoire.");
        }

        try {
            await updateFidelityCardStatus(companyId, deactivatingCardId, 'DISABLED', deactivationComment);
            toast.success("Carte désactivée !");
            setDeactivatingCardId(null);
            fetchData();
        } catch (err) {
            toast.error(err.message || "Erreur lors de la désactivation.");
        }
    };

    /*--------------- VIEW HISTORY (COMMENT) ----------------*/
    const handleShowHistory = async (cardId) => {
        setHistoryCardId(cardId);
        setLoadingHistory(true);
        try {
            const history = await getCardLastHistory(companyId, cardId);
            setHistoryData(history);
        } catch {
            toast.error("Impossible de charger l'historique.");
        }
        setLoadingHistory(false);
    };

    const handleRenewCard = (cardId) => {
        setConfirmModal({
            isOpen: true,
            message: "Voulez-vous renouveler cette carte ? Les tampons seront remis à zéro.",
            onConfirm: async () => {
                setConfirmModal(p => ({ ...p, isOpen: false }));
                try {
                    await renewFidelityCard(companyId, cardId);
                    toast.success("Carte renouvelée !");
                    fetchData();
                } catch (err) {
                    toast.error(err.message || "Erreur lors du renouvellement.");
                }
            },
        });
    };

    /*--------------- RENDER ----------------*/
    if (loading) return (
        <div className="flex justify-center py-20">
            <Spinner />
        </div>
    );

    return (
        <div className="space-y-10 animate-fadeIn">

            {/* HEADER */}
            <div className="pb-6 border-b border-slate-700">
                <h1 className="text-4xl font-extrabold text-white">Cartes de Fidélité</h1>
                <p className="text-slate-400 mt-1">Gérez toutes les cartes de vos clients.</p>
            </div>

            {/* SEARCH BAR */}
            <div className="bg-slate-800 p-5 rounded-xl border border-slate-700 flex flex-col sm:flex-row gap-4">
                <input
                    type="text"
                    placeholder="Rechercher un client..."
                    className="bg-slate-700 text-white rounded-lg px-4 py-2 w-full"
                    value={searchInput}
                    onChange={(e) => setSearchInput(e.target.value)}
                />

                <select
                    value={filter}
                    onChange={(e) => { setFilter(e.target.value); setPage(1); }}
                    className="bg-slate-700 text-white rounded-lg px-4 py-2"
                >
                    <option value="all">Tous</option>
                    <option value="with">Avec carte</option>
                    <option value="without">Sans carte</option>
                </select>
            </div>

            {/* CLIENT GRID */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                {clients.map(client => (
                    <div key={client.id}
                         className="bg-slate-800 border border-slate-700 p-6 rounded-xl shadow-lg">

                        <h3 className="text-xl font-bold text-white">{client.name}</h3>

                        {client.cards?.length > 0 ? (
                            <div className="mt-4 space-y-4">
                                {client.cards.map(card => {
                                    const max = card.template?.stampZones?.length || 0;
                                    const count = card.stampCount;

                                    return (
                                        <div key={card.id}
                                             className="border border-slate-600 p-3 rounded-lg bg-slate-900">

                                            {/* HEADER */}
                                            <div className="flex justify-between items-center">
                                                <p className="text-slate-300 font-semibold">
                                                    Modèle : <span className="text-white">{card.template.name}</span>
                                                </p>

                                                <span className={`px-2 py-1 rounded text-xs ${
                                                    card.status === "COMPLETED"
                                                        ? "bg-green-700 text-white"
                                                        : "bg-slate-700 text-slate-200"
                                                }`}>
                                                    {card.status}
                                                </span>
                                            </div>

                                            {/* DEACTIVATION MESSAGES */}
                                            {!card.template.isActive && (
                                                <div className="mt-3 p-2 bg-red-900/30 border border-red-700/50 rounded flex items-center gap-2 text-red-400 text-xs">
                                                    <BlockIcon fontSize="inherit" />
                                                    <span>Carte désactivée (global)</span>
                                                </div>
                                            )}

                                            {card.status === 'DISABLED' && (
                                                <div className="mt-3 p-2 bg-orange-900/30 border border-orange-700/50 rounded flex items-center gap-2 text-orange-400 text-xs">
                                                    <BlockIcon fontSize="inherit" />
                                                    <span>Carte désactivée (Client)</span>
                                                    <button
                                                        onClick={() => handleShowHistory(card.id)}
                                                        className="ml-auto underline flex items-center gap-1"
                                                    >
                                                        <InfoIcon fontSize="inherit" />
                                                        Voir commentaire
                                                    </button>
                                                </div>
                                            )}

                                            {/* STAMPS */}
                                            <p className="mt-2 text-slate-400">
                                                Tampons : <span className="text-white">{count}</span> / {max}
                                            </p>

                                            {/* PROGRESS BAR */}
                                            <div className="w-full bg-slate-700 h-2 rounded mt-2">
                                                <div
                                                    className="h-2 bg-indigo-500 rounded"
                                                    style={{ width: `${(count / max) * 100}%` }}
                                                />
                                            </div>

                                            {/* ACTIONS */}
                                            <div className="flex flex-wrap gap-2 mt-4">

                                                <button
                                                    onClick={() => handleAddStamp(card)}
                                                    disabled={!card.template.isActive || card.status === 'DISABLED'}
                                                    className="bg-green-600 hover:bg-green-700 px-3 py-1.5 rounded text-white flex items-center gap-1 text-sm disabled:opacity-30 disabled:cursor-not-allowed"
                                                >
                                                    <AddCircleOutlineIcon fontSize="small" />
                                                    Tampon
                                                </button>

                                                <button
                                                    onClick={() => copyLink(card.publicLink)}
                                                    className="bg-slate-700 hover:bg-slate-600 px-3 py-1.5 rounded text-white flex items-center gap-1 text-sm"
                                                >
                                                    <ContentCopyIcon fontSize="small" />
                                                    Copier
                                                </button>

                                                <button
                                                    onClick={() => handleViewCard(card.publicLink)}
                                                    className="bg-slate-700 hover:bg-slate-600 px-3 py-1.5 rounded text-white flex items-center gap-1 text-sm"
                                                >
                                                    <VisibilityIcon fontSize="small" />
                                                    Voir
                                                </button>

                                                {card.status !== 'DISABLED' && (
                                                    <button
                                                        onClick={() => openDisableModal(card.id)}
                                                        className="bg-orange-600/20 hover:bg-orange-600/40 text-orange-400 px-3 py-1.5 rounded flex items-center gap-1 text-sm border border-orange-500/30 transition-colors"
                                                        title="Désactiver la carte"
                                                    >
                                                        <BlockIcon fontSize="small" />
                                                    </button>
                                                )}

                                                <button
                                                    onClick={() => handleDeleteCard(card.id)}
                                                    className="bg-red-600/20 hover:bg-red-600/40 text-red-400 px-3 py-1.5 rounded flex items-center gap-1 text-sm border border-red-500/30 transition-colors ml-auto"
                                                    title="Supprimer la carte"
                                                >
                                                    <DeleteIcon fontSize="small" />
                                                </button>
                                            </div>

                                            {count >= max && (
                                                <div className="mt-4 p-3 bg-yellow-900/20 border border-yellow-700/50 rounded-lg">
                                                    <p className="text-yellow-400 text-sm font-semibold mb-3">
                                                        Cette carte est complète.
                                                    </p>
                                                    <button
                                                        onClick={() => handleRenewCard(card.id)}
                                                        className="w-full bg-yellow-600 hover:bg-yellow-700 text-white py-2 rounded-lg flex items-center justify-center gap-2 font-bold transition-all shadow-lg shadow-yellow-900/20"
                                                    >
                                                        <AutorenewIcon />
                                                        Renouveler la carte
                                                    </button>
                                                </div>
                                            )}

                                        </div>
                                    );
                                })}
                            </div>

                        ) : (
                            <p className="text-slate-500 mt-2">Aucune carte</p>
                        )}

                        {/* CREATE CARD BUTTON */}
                        <button
                            onClick={() => openCreateCardModal(client.id)}
                            className="mt-4 bg-indigo-600 hover:bg-indigo-700 px-4 py-2 rounded-lg text-white font-medium flex items-center gap-2"
                        >
                            <AddIcon fontSize="small" /> Nouvelle carte
                        </button>

                    </div>
                ))}
            </div>

            {/* PAGINATION */}
            {pagination?.totalPages > 1 && (
                <div className="flex justify-between items-center mt-8">
                    <button
                        onClick={() => setPage(page - 1)}
                        disabled={page === 1}
                        className="px-4 py-2 bg-slate-700 text-white rounded disabled:opacity-40"
                    >
                        Précédent
                    </button>

                    <p className="text-white">Page {pagination.currentPage} / {pagination.totalPages}</p>

                    <button
                        onClick={() => setPage(page + 1)}
                        disabled={page === pagination.totalPages}
                        className="px-4 py-2 bg-slate-700 text-white rounded disabled:opacity-40"
                    >
                        Suivant
                    </button>
                </div>
            )}

            {/* MODAL — VIEW CARD */}
            {modalOpen && (
                <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
                    <div className="bg-slate-800 p-6 rounded-xl w-full max-w-lg relative border border-slate-700">

                        <button
                            onClick={() => setModalOpen(false)}
                            className="absolute top-3 right-3 text-slate-300 text-xl"
                        >✕</button>

                        <h2 className="text-2xl font-bold text-white mb-4">Carte</h2>

                        {modalLoading ? (
                            <div className="flex justify-center py-10"><Spinner /></div>
                        ) : (
                            <img
                                src={modalData}
                                className="max-h-[450px] mx-auto rounded-xl border border-slate-600"
                            />
                        )}
                    </div>
                </div>
            )}

                       {createCardClientId && (
                <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
                    <div className="bg-slate-800 p-6 rounded-xl w-full max-w-md relative border border-slate-700">

                        <button
                            onClick={() => setCreateCardClientId(null)}
                            className="absolute top-3 right-3 text-slate-300 text-xl"
                        >✕</button>

                        <h2 className="text-xl font-bold text-white mb-4">
                            Choisir un modèle de carte
                        </h2>

                        {loadingTemplates ? (
                            <Spinner />
                        ) : (
                            <div className="space-y-3">
                                {templates.map(tpl => (
                                    <button
                                        key={tpl.id}
                                        onClick={() => handleCreateCard(tpl.id)}
                                        className="w-full bg-indigo-600 hover:bg-indigo-700 px-4 py-2 rounded-lg text-white font-medium"
                                    >
                                        {tpl.name}
                                    </button>
                                ))}
                            </div>
                        )}

                    </div>
                </div>
            )}

            {/* MODAL — DISABLE CARD */}
            {deactivatingCardId && (
                <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
                    <div className="bg-slate-800 p-6 rounded-xl w-full max-w-md relative border border-slate-700 shadow-2xl">
                        <h2 className="text-xl font-bold text-white mb-4">Désactiver la carte</h2>
                        <p className="text-slate-400 text-sm mb-4">Veuillez indiquer la raison de la désactivation (obligatoire).</p>

                        <textarea
                            value={deactivationComment}
                            onChange={(e) => setDeactivationComment(e.target.value)}
                            placeholder="Ex: Client a trop de cartes, carte volée, etc."
                            className="w-full bg-slate-900 border border-slate-700 rounded-lg p-3 text-white placeholder:text-slate-600 focus:outline-none focus:border-indigo-500 min-h-[100px]"
                        />

                        <div className="flex gap-3 mt-6">
                            <button
                                onClick={() => setDeactivatingCardId(null)}
                                className="flex-1 px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg font-medium transition"
                            >
                                Annuler
                            </button>
                            <button
                                onClick={handleDisableCard}
                                className="flex-1 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg font-medium transition"
                            >
                                Désactiver
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* MODAL — VIEW HISTORY COMMENT */}
            {historyCardId && (
                <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
                    <div className="bg-slate-800 p-6 rounded-xl w-full max-w-md relative border border-slate-700 shadow-2xl">
                        <button
                            onClick={() => setHistoryCardId(null)}
                            className="absolute top-3 right-3 text-slate-300 text-xl"
                        >✕</button>

                        <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
                            <InfoIcon size={20} /> Raison de désactivation
                        </h2>

                        {loadingHistory ? <Spinner /> : (
                            <div className="space-y-4">
                                <p className="text-white bg-slate-900/50 p-4 rounded-lg border border-slate-700 italic">
                                    "{historyData?.comment || "Aucun commentaire spécifié."}"
                                </p>
                                <div className="text-xs text-slate-500">
                                    <p>Par : {historyData?.performedBy?.name || "Inconnu"}</p>
                                    <p>Le : {historyData?.createdAt ? new Date(historyData.createdAt).toLocaleString() : "Date inconnue"}</p>
                                </div>
                            </div>
                        )}

                        <button
                            onClick={() => setHistoryCardId(null)}
                            className="w-full mt-6 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-medium transition"
                        >
                            Fermer
                        </button>
                    </div>
                </div>
            )}
            <ConfirmationModal
                isOpen={confirmModal.isOpen}
                onClose={() => setConfirmModal(p => ({ ...p, isOpen: false }))}
                onConfirm={confirmModal.onConfirm}
                message={confirmModal.message}
            />
        </div>
    );
};

export default FidelityClientsPage;
