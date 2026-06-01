/* eslint-disable react-refresh/only-export-components */
// /frontend/src/contexts/ConfirmationContext.jsx

import React, { createContext, useState, useContext, useCallback } from 'react';
import ConfirmationModal from '@/components/ui/ConfirmationModal';

const ConfirmationContext = createContext({});

export const ConfirmationProvider = ({ children }) => {
    const [confirmationState, setConfirmationState] = useState({
        isOpen: false,
        title: '',
        message: '',
        onConfirm: () => {},
    });

    // Accepter un seul objet options
    const confirmAction = useCallback((options) => {
        const { title = "Confirmation Requise", message = '', onConfirm = () => {} } = options;
        setConfirmationState({
            isOpen: true,
            title: title,
            message: message,
            onConfirm: onConfirm,
        });
    }, []);

    const handleClose = () => {
        setConfirmationState({ isOpen: false, title: '', message: '', onConfirm: () => {} });
    };

    const handleConfirm = () => {
        if (typeof confirmationState.onConfirm === 'function') {
            confirmationState.onConfirm();
        }
        handleClose();
    };

    return (
        <ConfirmationContext.Provider value={{ confirmAction }}>
            {children}
            <ConfirmationModal
                isOpen={confirmationState.isOpen}
                onClose={handleClose}
                onConfirm={handleConfirm}
                title={confirmationState.title}
                message={confirmationState.message}
            />
        </ConfirmationContext.Provider>
    );
};

export const useConfirmation = () => {
    return useContext(ConfirmationContext);
};