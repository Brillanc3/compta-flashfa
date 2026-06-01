// frontend/src/components/Modal.jsx
import React, { useEffect, useRef } from "react";
import ReactDOM from "react-dom";
import PropTypes from "prop-types";

const Modal = ({
                   isOpen,
                   onClose,
                   title,
                   children,
                   disableOverlayClose = false,
                   showCloseButton = true,
               }) => {
    const previousOverflowRef = useRef(null);

    useEffect(() => {
        if (!isOpen) return;

        const handleEsc = (event) => {
            if (event.key === "Escape") onClose();
        };

        // Sauvegarde / lock scroll background
        previousOverflowRef.current = document.body.style.overflow;
        document.body.style.overflow = "hidden";

        window.addEventListener("keydown", handleEsc);

        // Cleanup (route change / unmount inclus)
        return () => {
            window.removeEventListener("keydown", handleEsc);
            document.body.style.overflow = previousOverflowRef.current ?? "";
        };
    }, [isOpen, onClose]);

    if (!isOpen) return null;

    const handleBackdropClick = () => {
        if (!disableOverlayClose) onClose();
    };

    return ReactDOM.createPortal(
        <div className="fixed inset-0 z-50">
            {/* Backdrop */}
            <div
                className="absolute inset-0 bg-black/60"
                onClick={handleBackdropClick}
                aria-hidden="true"
            />

            {/* Wrapper scrollable (si contenu trop grand) */}
            <div className="relative z-10 flex min-h-full w-full items-start justify-center p-4 overflow-y-auto sm:items-center">
                {/* Dialog */}
                <div
                    className="
                        rounded-xl bg-cca-surface border border-cca-border shadow-2xl flex flex-col
                        max-h-[calc(100vh-2rem)]
                        w-full sm:w-fit sm:max-w-[70vw]
                        animate-in zoom-in-95 duration-300
                    "
                    role="dialog"
                    aria-modal="true"
                    onClick={(e) => e.stopPropagation()}
                >
                    {/* Header (reste visible) */}
                    <div className={title ? "px-6 pt-6 pb-4 border-b border-cca-border bg-cca-base/50" : "px-6 pt-6 pb-4"}>
                        <div className="flex items-start justify-between gap-4">
                            {title ? (
                                <h2 className="text-xl font-heading font-bold text-cca-textPrimary min-w-0 break-words">{title}</h2>
                            ) : (
                                <div />
                            )}

                            {showCloseButton ? (
                                <button
                                    type="button"
                                    onClick={onClose}
                                    className="inline-flex items-center justify-center rounded-full border border-cca-border bg-cca-surface p-1.5 text-cca-textSecondary hover:text-brand-primary hover:border-brand-primary transition-all active:scale-90 shadow-sm"
                                    aria-label="Fermer"
                                    title="Fermer"
                                >
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                                        <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                                    </svg>
                                </button>
                            ) : null}
                        </div>
                    </div>

                    {/* Body scrollable */}
                    <div className="px-6 pb-6 pt-4 overflow-y-auto min-h-0">
                        {children}
                    </div>
                </div>
            </div>
        </div>,
        document.body
    );
};



Modal.propTypes = {
    isOpen: PropTypes.bool.isRequired,
    onClose: PropTypes.func.isRequired,
    title: PropTypes.string,
    children: PropTypes.node,
    disableOverlayClose: PropTypes.bool,
    showCloseButton: PropTypes.bool,
};

export default Modal;
