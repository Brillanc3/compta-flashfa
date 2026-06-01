// /frontend/src/components/AnnouncementModal.jsx
import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkBreaks from 'remark-breaks';
import Modal from './Modal';
import { getActiveAnnouncement } from '../services/announcementService';
import { useAuth } from '../contexts/AuthContext';

const STORAGE_KEY = 'dismissed_announcements';

function getDismissed() {
    try {
        return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
    } catch {
        return [];
    }
}

function markDismissed(id) {
    const list = getDismissed();
    if (!list.includes(id)) {
        localStorage.setItem(STORAGE_KEY, JSON.stringify([...list, id]));
    }
}

const AnnouncementModal = () => {
    const { isAuthenticated } = useAuth();
    const navigate = useNavigate();
    const [announcement, setAnnouncement] = useState(null);
    const [open, setOpen] = useState(false);

    useEffect(() => {
        if (!isAuthenticated) return;

        const check = () => {
            getActiveAnnouncement()
                .then((data) => {
                    if (!data) return;
                    const dismissed = getDismissed();
                    if (!dismissed.includes(data.id)) {
                        setAnnouncement((prev) => {
                            if (prev?.id === data.id) return prev;
                            return data;
                        });
                        setOpen(true);
                    }
                })
                .catch(() => {});
        };

        check();
        const interval = setInterval(check, 5 * 60 * 1000);
        return () => clearInterval(interval);
    }, [isAuthenticated]);

    const dismiss = () => {
        if (announcement) markDismissed(announcement.id);
        setOpen(false);
    };

    const handleAction = (action) => {
        if (action.type === 'dismiss') {
            dismiss();
        } else if (action.type === 'reload') {
            dismiss();
            window.location.reload();
        } else if (action.type === 'redirect' && action.url) {
            dismiss();
            if (action.url.startsWith('http')) {
                window.open(action.url, '_blank', 'noopener,noreferrer');
            } else {
                navigate(action.url);
            }
        }
    };

    if (!open || !announcement) return null;

    const actions = Array.isArray(announcement.actions) && announcement.actions.length > 0
        ? announcement.actions
        : [{ label: 'Fermer', type: 'dismiss' }];

    return (
        <Modal
            isOpen={open}
            onClose={dismiss}
            title={announcement.title}
            disableOverlayClose={false}
        >
            <div className="prose prose-invert prose-sm max-w-none text-slate-300 mb-6">
                <ReactMarkdown remarkPlugins={[remarkGfm, remarkBreaks]}>
                    {announcement.body}
                </ReactMarkdown>
            </div>

            <div className="flex flex-wrap justify-end gap-2 pt-4 border-t border-cca-border">
                {actions.map((action, idx) => (
                    <ActionButton key={idx} action={action} onClick={() => handleAction(action)} />
                ))}
            </div>
        </Modal>
    );
};

const ActionButton = ({ action, onClick }) => {
    const base = 'px-5 py-2 rounded-md font-semibold text-sm transition-colors';

    if (action.type === 'dismiss') {
        return (
            <button onClick={onClick} className={`${base} bg-cca-surface border border-cca-border text-cca-textSecondary hover:text-cca-textPrimary`}>
                {action.label}
            </button>
        );
    }

    if (action.type === 'reload') {
        return (
            <button onClick={onClick} className={`${base} bg-amber-600 hover:bg-amber-700 text-white`}>
                {action.label}
            </button>
        );
    }

    return (
        <button onClick={onClick} className={`${base} bg-brand-primary hover:opacity-90 text-white`}>
            {action.label}
        </button>
    );
};

export default AnnouncementModal;
