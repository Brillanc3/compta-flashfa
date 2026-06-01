// frontend/src/components/admin/company/BillableContactsManager.jsx
import React, { useState } from 'react';
import PropTypes from 'prop-types';
import toast from 'react-hot-toast';
import { addBillableContact, removeBillableContact } from '@/services/adminCompanyService';
import Select from 'react-select'; // npm install react-select
import { Trash2 } from 'lucide-react';
import ConfirmationModal from '@/components/ui/ConfirmationModal';

const BillableContactsManager = ({ company, allEmployees, onUpdate }) => {
    const [selectedUser, setSelectedUser] = useState(null);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [confirmModal, setConfirmModal] = useState({ isOpen: false, message: '', onConfirm: null });

    const billableContactIds = new Set(company.billableContacts?.map(c => c.userId) || []);
    const addableEmployees = (allEmployees || [])
        .filter(emp => !billableContactIds.has(emp.userId))
        .map(emp => ({ value: emp.userId, label: emp.user.name }));

    const handleAdd = async () => {
        if (!selectedUser) return;
        setIsSubmitting(true);
        try {
            await addBillableContact(company.id, selectedUser.value);
            onUpdate();
            setSelectedUser(null);
            toast.success("Contact facturable ajouté.");
        } catch (error) {
            toast.error(error.message || "Erreur lors de l'ajout.");
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleRemove = (userId) => {
        setConfirmModal({
            isOpen: true,
            message: "Êtes-vous sûr de vouloir supprimer ce contact facturable ?",
            onConfirm: async () => {
                setConfirmModal(p => ({ ...p, isOpen: false }));
                try {
                    await removeBillableContact(company.id, userId);
                    onUpdate();
                    toast.success("Contact facturable supprimé.");
                } catch (error) {
                    toast.error(error.message || "Erreur lors de la suppression.");
                }
            },
        });
    };

    return (
        <div className="space-y-4">
            {/* Liste des contacts actuels */}
            <ul className="space-y-2">
                {company.billableContacts?.map(contact => (
                    <li key={contact.userId} className="flex items-center justify-between bg-slate-700 p-2 rounded-md">
                        <span className="text-white">{contact.user.name}</span>
                        <button onClick={() => handleRemove(contact.userId)} className="text-red-400 hover:text-red-300">
                            <Trash2 size={16} />
                        </button>
                    </li>
                ))}
            </ul>
            {/* Formulaire d'ajout */}
            <div className="flex items-center gap-2">
                <Select
                    options={addableEmployees}
                    value={selectedUser}
                    onChange={setSelectedUser}
                    placeholder="Ajouter un employé..."
                    className="flex-1"
                    classNamePrefix="react-select"
                />
                <button onClick={handleAdd} disabled={!selectedUser || isSubmitting} className="py-2 px-4 bg-green-600 hover:bg-green-700 text-white font-semibold rounded-md disabled:opacity-50">
                    Ajouter
                </button>
            </div>
            <ConfirmationModal
                isOpen={confirmModal.isOpen}
                onClose={() => setConfirmModal(p => ({ ...p, isOpen: false }))}
                onConfirm={confirmModal.onConfirm}
                message={confirmModal.message}
            />
        </div>
    );
};

BillableContactsManager.propTypes = {
    company: PropTypes.object.isRequired,
    allEmployees: PropTypes.array, // Peut être undefined
    onUpdate: PropTypes.func.isRequired,
};

export default BillableContactsManager;