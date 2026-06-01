// src/components/admin/company/ManageContactsModal.jsx

import React, { useEffect, useMemo, useRef, useState } from 'react';
import Modal from '@/components/Modal';
import Select from 'react-select';
import toast from 'react-hot-toast';
import { Trash2, UserPlus, Star } from 'lucide-react';

import Spinner from '@/components/ui/Spinner';
import { useConfirmation } from '@/contexts/ConfirmationContext';

import {
    listUsersForAdmin,
    listBillableContacts,
    assignBillableContact,
    removeBillableContact,
    setBillableContactPrio,
} from '@/services/adminService';

// Styles react-select (thème sombre)
const selectStyles = {
    control: (styles) => ({
        ...styles,
        backgroundColor: '#334155',
        border: '1px solid #475569',
        boxShadow: 'none',
        '&:hover': { borderColor: '#64748b' },
        minHeight: 42,
    }),
    menu: (styles) => ({ ...styles, backgroundColor: '#334155', zIndex: 60 }),
    option: (styles, { isFocused, isSelected }) => ({
        ...styles,
        backgroundColor: isSelected ? '#4f46e5' : isFocused ? '#4338ca' : '#334155',
        color: 'white',
        ':active': { backgroundColor: '#4f46e5' },
    }),
    input: (styles) => ({ ...styles, color: 'white' }),
    singleValue: (styles) => ({ ...styles, color: 'white' }),
    placeholder: (styles) => ({ ...styles, color: '#94a3b8' }),
};

const DEFAULT_PAGE_SIZE = 25;

export default function ManageContactsModal({ isOpen, onClose, onComplete, company }) {
    const { confirmAction } = useConfirmation();

    const [currentContacts, setCurrentContacts] = useState([]);
    const [contactsLoading, setContactsLoading] = useState(false);

    const [allUsersOptions, setAllUsersOptions] = useState([]);
    const [selectedUserToAdd, setSelectedUserToAdd] = useState(null);
    const [isPrioToAdd, setIsPrioToAdd] = useState(false);

    const [isLoadingUsers, setIsLoadingUsers] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState(null);

    const debounceRef = useRef(null);
    const lastQueryRef = useRef('');

    const fetchContacts = async () => {
        if (!company?.id) return;
        setContactsLoading(true);
        setError(null);
        try {
            const data = await listBillableContacts(company.id);
            setCurrentContacts(Array.isArray(data) ? data : []);
        } catch {
            setError('Impossible de charger les contacts facturables.');
            setCurrentContacts([]);
        } finally {
            setContactsLoading(false);
        }
    };

    const fetchUsers = async (q = '') => {
        setIsLoadingUsers(true);
        setError(null);
        try {
            // Backend: GET /admin/users?search=...
            // On coupe volontairement à DEFAULT_PAGE_SIZE pour garder l’UI réactive sur mobile.
            const resp = await listUsersForAdmin({ search: q });
            const users = (Array.isArray(resp) ? resp : (resp?.items || [])).slice(0, DEFAULT_PAGE_SIZE);

            const options = (users || []).map((u) => ({
                value: u.id,
                label: `${u.name || 'Utilisateur'}${u.username ? ` (${u.username})` : ''}`,
            }));
            setAllUsersOptions(options);
        } catch {
            setError('Impossible de charger la liste des utilisateurs.');
            setAllUsersOptions([]);
        } finally {
            setIsLoadingUsers(false);
        }
    };

    useEffect(() => {
        if (!isOpen || !company) {
            setCurrentContacts([]);
            setAllUsersOptions([]);
            setSelectedUserToAdd(null);
            setIsPrioToAdd(false);
            setIsLoadingUsers(false);
            setIsSubmitting(false);
            setError(null);
            return;
        }

        fetchContacts();
        fetchUsers(lastQueryRef.current);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isOpen, company?.id]);

    const filteredUserOptions = useMemo(() => {
        const currentContactIds = new Set((currentContacts || []).map((c) => c.user?.id));
        return (allUsersOptions || []).filter((opt) => !currentContactIds.has(opt.value));
    }, [allUsersOptions, currentContacts]);

    const handleInputChange = (value, { action }) => {
        if (action === 'input-change') {
            const q = value || '';
            lastQueryRef.current = q;
            if (debounceRef.current) clearTimeout(debounceRef.current);
            debounceRef.current = setTimeout(() => {
                fetchUsers(q);
            }, 250);
        }
        return value;
    };

    const handleAddContact = async () => {
        if (!selectedUserToAdd || !company) return;
        setIsSubmitting(true);
        setError(null);
        try {
            await assignBillableContact(company.id, selectedUserToAdd.value, { isPrio: isPrioToAdd });
            toast.success(`${selectedUserToAdd.label} ajouté aux contacts facturables.`);
            setSelectedUserToAdd(null);
            setIsPrioToAdd(false);
            await fetchContacts();
        } catch (err) {
            setError(err?.message || "Erreur lors de l'ajout du contact.");
            toast.error(err?.message || "Erreur d'ajout.");
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleRemoveContact = (contactToRemove) => {
        if (!company) return;
        confirmAction({
            title: 'Retirer le contact facturable',
            message: `Retirer ${contactToRemove?.user?.name || 'cet utilisateur'} des contacts facturables de ${company.name} ?`,
            onConfirm: async () => {
                setIsSubmitting(true);
                setError(null);
                try {
                    await removeBillableContact(company.id, contactToRemove.user.id);
                    toast.success('Contact retiré.');
                    await fetchContacts();
                } catch (err) {
                    setError(err?.message || 'Erreur lors du retrait du contact.');
                    toast.error(err?.message || 'Erreur de retrait.');
                } finally {
                    setIsSubmitting(false);
                }
            },
        });
    };

    const handleTogglePrio = async (contact) => {
        if (!company?.id || !contact?.user?.id) return;
        setIsSubmitting(true);
        setError(null);
        try {
            await setBillableContactPrio(company.id, contact.user.id, !contact.isPrio);
            await fetchContacts();
            toast.success(!contact.isPrio ? 'Contact prioritaire défini.' : 'Priorité retirée.');
        } catch (err) {
            setError(err?.message || 'Erreur lors de la mise à jour de la priorité.');
            toast.error(err?.message || 'Erreur priorité.');
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleClose = () => {
        onComplete?.();
        onClose?.();
    };

    if (!isOpen || !company) return null;

    const prioId = currentContacts.find((c) => c.isPrio)?.user?.id;

    return (
        <Modal isOpen={isOpen} onClose={handleClose} title={`Contacts facturables — ${company.name}`}>
            <div className="space-y-6">
                {error && (
                    <p className="text-red-400 bg-red-900/30 p-3 rounded-md text-sm">{error}</p>
                )}

                {/* Ajout */}
                <div>
                    <h3 className="text-base sm:text-lg font-semibold text-white mb-2">Ajouter un contact</h3>
                    <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                        <div className="flex-1">
                            <Select
                                options={filteredUserOptions}
                                value={selectedUserToAdd}
                                onChange={setSelectedUserToAdd}
                                onInputChange={handleInputChange}
                                styles={selectStyles}
                                placeholder="Rechercher un utilisateur..."
                                isLoading={isLoadingUsers}
                                isDisabled={isLoadingUsers || isSubmitting}
                                isClearable
                                noOptionsMessage={() => (isLoadingUsers ? 'Chargement...' : 'Aucun utilisateur')}
                            />
                        </div>

                        <label className="flex items-center gap-2 text-sm text-slate-300 px-3 py-2 rounded-md border border-slate-700 bg-slate-800">
                            <input
                                type="checkbox"
                                checked={isPrioToAdd}
                                onChange={(e) => setIsPrioToAdd(e.target.checked)}
                                disabled={isSubmitting}
                            />
                            <span>Prioritaire</span>
                        </label>

                        <button
                            type="button"
                            onClick={handleAddContact}
                            disabled={!selectedUserToAdd || isSubmitting || isLoadingUsers}
                            className="px-3 py-2 bg-green-600 hover:bg-green-700 text-white font-semibold rounded-md disabled:opacity-50 flex items-center justify-center"
                            title="Ajouter"
                        >
                            {isSubmitting ? <Spinner size="sm" /> : <UserPlus size={16} />}
                        </button>
                    </div>
                </div>

                {/* Liste actuelle */}
                <div>
                    <h3 className="text-base sm:text-lg font-semibold text-white mb-2">
                        Contacts actuels ({currentContacts.length})
                    </h3>

                    {contactsLoading ? (
                        <div className="p-4 rounded-md border border-slate-700 bg-slate-800 flex justify-center">
                            <Spinner />
                        </div>
                    ) : currentContacts.length > 0 ? (
                        <ul className="max-h-72 overflow-y-auto space-y-2 p-3 bg-slate-800 rounded-md border border-slate-700">
                            {currentContacts
                                .slice()
                                .sort((a, b) => {
                                    const ap = a.isPrio ? 1 : 0;
                                    const bp = b.isPrio ? 1 : 0;
                                    if (ap !== bp) return bp - ap;
                                    return (a.user?.name || '').localeCompare(b.user?.name || '');
                                })
                                .map((contact) => {
                                    const isPrio = !!contact.isPrio;
                                    return (
                                        <li
                                            key={contact.user.id}
                                            className="flex items-center justify-between gap-2 p-2 bg-slate-700 rounded"
                                        >
                                            <div className="min-w-0">
                                                <div className="text-sm text-slate-200 truncate">{contact.user.name}</div>
                                                <div className="text-xs text-slate-400 truncate">
                                                    {contact.user.username ? `@${contact.user.username}` : ''}
                                                </div>
                                            </div>

                                            <div className="flex items-center gap-1 shrink-0">
                                                <button
                                                    type="button"
                                                    onClick={() => handleTogglePrio(contact)}
                                                    disabled={isSubmitting}
                                                    className={[
                                                        'p-1 rounded',
                                                        isPrio ? 'text-yellow-300' : 'text-slate-300 hover:text-yellow-200',
                                                    ].join(' ')}
                                                    title={isPrio ? 'Retirer la priorité' : 'Définir en prioritaire'}
                                                >
                                                    <Star size={16} fill={isPrio ? 'currentColor' : 'none'} />
                                                </button>

                                                <button
                                                    type="button"
                                                    onClick={() => handleRemoveContact(contact)}
                                                    disabled={isSubmitting}
                                                    className="p-1 text-red-400 hover:text-red-300 disabled:opacity-50"
                                                    title="Retirer ce contact"
                                                >
                                                    <Trash2 size={16} />
                                                </button>
                                            </div>
                                        </li>
                                    );
                                })}
                        </ul>
                    ) : (
                        <p className="text-sm text-slate-500 italic p-3 bg-slate-800 rounded-md border border-slate-700">
                            Aucun contact facturable assigné.
                        </p>
                    )}

                    {prioId ? (
                        <p className="mt-2 text-xs text-slate-400">
                            Contact prioritaire défini (1 maximum).
                        </p>
                    ) : (
                        <p className="mt-2 text-xs text-slate-400">
                            Aucun contact prioritaire.
                        </p>
                    )}
                </div>

                <div className="flex justify-end pt-2">
                    <button
                        type="button"
                        onClick={handleClose}
                        className="px-4 py-2 bg-slate-600 hover:bg-slate-500 text-white font-semibold rounded-md"
                    >
                        Fermer
                    </button>
                </div>
            </div>
        </Modal>
    );
}
