// /frontend/src/pages/dashboard/RankManagementPage.jsx

import React, { useState, useEffect, useCallback } from 'react';
import { getRanks, updateRankOrder, deleteRank } from '@/services/employeesService';
import toast from 'react-hot-toast';
import Spinner from '@/components/ui/Spinner';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import { GripVertical, Trash2, Edit } from 'lucide-react';
import RankFormModal from '@/components/dashboard/RankFormModal';
import {useCompany} from "@/contexts/CompanyContext.jsx";
import ActionConfirmationModal from "@/components/dashboard/employees/ActionConfirmationModal";

const RankManagementPage = () => {
    const { activeCompanyId } = useCompany();
    const companyId = activeCompanyId;
    const [ranks, setRanks] = useState([]);
    const [initialRanks, setInitialRanks] = useState([]);
    const [loading, setLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);

    // --- NOUVEAU : États pour la modale ---
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [rankToEdit, setRankToEdit] = useState(null);
 
    // --- États pour la suppression ---
    const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
    const [rankToDeleteId, setRankToDeleteId] = useState(null);
    const [isDeleting, setIsDeleting] = useState(false);

    const fetchRanks = useCallback(async () => {
        try {
            setLoading(true);
            const data = await getRanks(companyId);
            setRanks(data);
            setInitialRanks(data);
        } catch (error) {
            toast.error(error.message || "Erreur lors du chargement des rangs.");
        } finally {
            setLoading(false);
        }
    }, [companyId]);

    useEffect(() => {
        fetchRanks();
    }, [fetchRanks]);

    const handleOpenCreateModal = () => {
        setRankToEdit(null);
        setIsModalOpen(true);
    };

    const handleOpenEditModal = (rank) => {
        setRankToEdit(rank);
        setIsModalOpen(true);
    };

    const handleOnDragEnd = (result) => {
        if (!result.destination) return;
        const items = Array.from(ranks);
        const [reorderedItem] = items.splice(result.source.index, 1);
        items.splice(result.destination.index, 0, reorderedItem);
        setRanks(items);
    };

    const handleSaveOrder = async () => {
        setIsSaving(true);
        try {
            const rankIds = ranks.map(rank => rank.id);
            await updateRankOrder(companyId, rankIds);
            toast.success("L'ordre des rangs a été sauvegardé.");
            setInitialRanks(ranks);
        } catch (error) {
            toast.error(error.message || "Erreur lors de la sauvegarde.");
        } finally {
            setIsSaving(false);
        }
    };

    const handleDeleteRank = (rankId) => {
        setRankToDeleteId(rankId);
        setIsDeleteModalOpen(true);
    };
 
    const confirmDeleteRank = async () => {
        if (!rankToDeleteId) return;
        setIsDeleting(true);
        try {
            await deleteRank(companyId, rankToDeleteId);
            toast.success("Rang supprimé.");
            setIsDeleteModalOpen(false);
            setRankToDeleteId(null);
            fetchRanks();
        } catch (error) {
            toast.error(error.message || "Erreur lors de la suppression.");
        } finally {
            setIsDeleting(false);
        }
    };

    const isOrderChanged = JSON.stringify(ranks.map(r => r.id)) !== JSON.stringify(initialRanks.map(r => r.id));

    if (loading) return <div className="flex justify-center py-10"><Spinner /></div>;

    return (
        <>
            <div className="space-y-6">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                    <div>
                        <h1 className="text-3xl font-bold text-cca-textPrimary">Gestion des Rangs</h1>
                        <p className="text-sm text-cca-textSecondary mt-1">
                            La position la plus haute est la plus importante hiérarchiquement.
                        </p>
                    </div>
                    <div>
                        {isOrderChanged && (
                            <button onClick={handleSaveOrder} disabled={isSaving} className="bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-4 rounded-md mr-4 disabled:bg-slate-500">
                                {isSaving ? "Sauvegarde..." : "Sauvegarder l'Ordre"}
                            </button>
                        )}
                        <button onClick={handleOpenCreateModal} className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2 px-6 rounded-xl transition shadow-lg shadow-indigo-500/20 active:scale-95">
                            Créer un Rang
                        </button>
                    </div>
                </div>

                <div className="relative overflow-hidden rounded-2xl bg-cca-surface border border-cca-border shadow-2xl shadow-black/40">
                    <div className="p-4 border-b border-cca-border flex items-center gap-2">
                        <div className="h-2 w-2 rounded-full bg-indigo-500" />
                        <span className="text-xs font-bold uppercase tracking-widest text-cca-textSecondary/80">Hiérarchie des rangs</span>
                    </div>

                    <DragDropContext onDragEnd={handleOnDragEnd}>
                        <Droppable droppableId="ranks">
                            {(provided) => (
                                <div {...provided.droppableProps} ref={provided.innerRef} className="divide-y divide-cca-border">
                                    {ranks.map((rank, index) => (
                                        <Draggable key={rank.id} draggableId={String(rank.id)} index={index}>
                                            {(provided, snapshot) => (
                                                <div
                                                    ref={provided.innerRef}
                                                    {...provided.draggableProps}
                                                    {...provided.dragHandleProps}
                                                    className={`
                                                        flex items-center justify-between p-4 md:p-5 transition
                                                        ${snapshot.isDragging ? 'bg-indigo-600/20 backdrop-blur-md z-50' : 'hover:bg-cca-base/40'}
                                                    `}
                                                >
                                                    <div className="flex items-center gap-4 min-w-0">
                                                        <div className="p-1.5 rounded-lg bg-cca-base border border-cca-border text-cca-textSecondary shadow-sm">
                                                            <GripVertical size={18} />
                                                        </div>
                                                        <div className="min-w-0">
                                                            <div className="flex items-center gap-2">
                                                                <span className="text-xs font-black text-indigo-400">#{rank.position}</span>
                                                                <span className="font-bold text-cca-textPrimary truncate">{rank.name}</span>
                                                            </div>
                                                            {rank.permissionTemplates && (
                                                                <div className="text-[10px] text-cca-textSecondary uppercase tracking-wider mt-0.5">
                                                                    {rank.permissionTemplates.length} permissions configurées
                                                                </div>
                                                            )}
                                                        </div>
                                                    </div>
                                                    <div className="flex items-center gap-2">
                                                        <button
                                                            onClick={() => handleOpenEditModal(rank)}
                                                            className="p-2 rounded-lg bg-cca-base border border-cca-border text-cca-textSecondary hover:text-indigo-400 transition active:scale-90"
                                                            title="Modifier"
                                                        >
                                                            <Edit size={16}/>
                                                        </button>
                                                        <button
                                                            onClick={() => handleDeleteRank(rank.id)}
                                                            className="p-2 rounded-lg bg-cca-base border border-cca-border text-cca-textSecondary hover:text-red-400 transition active:scale-90"
                                                            title="Supprimer"
                                                        >
                                                            <Trash2 size={16}/>
                                                        </button>
                                                    </div>
                                                </div>
                                            )}
                                        </Draggable>
                                    ))}
                                    {provided.placeholder}
                                </div>
                            )}
                        </Droppable>
                    </DragDropContext>
                </div>
            </div>

            <RankFormModal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                companyId={rankToEdit?.companyId ?? companyId}
                rankToEdit={rankToEdit}
                onComplete={fetchRanks}
            />
 
            <ActionConfirmationModal
                isOpen={isDeleteModalOpen}
                onClose={() => setIsDeleteModalOpen(false)}
                title="Supprimer le rang"
                message="Êtes-vous sûr de vouloir supprimer ce rang ? Cette action est irréversible et pourrait affecter les employés associés."
                onConfirm={confirmDeleteRank}
                loading={isDeleting}
            />
        </>
    );
};

export default RankManagementPage;