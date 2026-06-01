import { useCallback, useEffect, useState } from 'react';
import toast from 'react-hot-toast';

export const MAX_IMAGES_PER_MESSAGE = 2;
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

function isGifFile(file) {
    if (!file) return false;
    if (file.type === 'image/gif') return true;
    return (file.name || '').toLowerCase().endsWith('.gif');
}

export function isImageFile(file) {
    return !!file && typeof file.type === 'string' && file.type.startsWith('image/');
}

function makeId() {
    return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export function useInputAttachments(messageBeingEdited) {
    const [attachments, setAttachments] = useState([]);

    useEffect(() => {
        setAttachments(prev => {
            prev.forEach(a => { try { URL.revokeObjectURL(a.url); } catch { /* empty */ } });
            return [];
        });
    }, [messageBeingEdited]);

    const addFiles = useCallback((filesLike) => {
        if (messageBeingEdited) return;
        const incoming = Array.from(filesLike || []).filter(Boolean);
        if (!incoming.length) return;

        setAttachments(prev => {
            const remaining = Math.max(0, MAX_IMAGES_PER_MESSAGE - prev.length);
            if (remaining <= 0) {
                toast.error(`Maximum ${MAX_IMAGES_PER_MESSAGE} images par message.`);
                return prev;
            }
            const next = [...prev];
            let addedCount = 0;
            for (const file of incoming) {
                if (addedCount >= remaining) break;
                if (!isImageFile(file)) { toast.error(`"${file.name}" n'est pas une image.`); continue; }
                if (isGifFile(file)) { toast.error('Les GIFs ne sont pas supportés.'); continue; }
                if (file.size > MAX_IMAGE_BYTES) { toast.error(`"${file.name}" dépasse 5 Mo.`); continue; }
                next.push({ id: makeId(), file, url: URL.createObjectURL(file) });
                addedCount++;
            }
            return next;
        });
    }, [messageBeingEdited]);

    const removeAttachment = useCallback((id) => {
        setAttachments(prev => {
            const item = prev.find(a => a.id === id);
            if (item) try { URL.revokeObjectURL(item.url); } catch { /* empty */ }
            return prev.filter(a => a.id !== id);
        });
    }, []);

    const clearAttachments = useCallback(() => {
        setAttachments(prev => {
            prev.forEach(a => { try { URL.revokeObjectURL(a.url); } catch { /* empty */ } });
            return [];
        });
    }, []);

    return { attachments, addFiles, removeAttachment, clearAttachments };
}
