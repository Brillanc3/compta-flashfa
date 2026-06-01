import React, { useRef, useEffect, useState } from 'react';
import { editMessage } from '../../api/client';
import { useMessageStore } from '../../stores/messageStore';

export default function EditMessageInline({ message, guildId, onCancel }) {
    const [value, setValue]   = useState(message.content ?? '');
    const [saving, setSaving] = useState(false);
    const taRef = useRef(null);
    const upsert = useMessageStore(s => s.upsertMessage);

    useEffect(() => {
        const el = taRef.current;
        if (!el) return;
        el.focus();
        el.setSelectionRange(el.value.length, el.value.length);
        el.style.height = 'auto';
        el.style.height = Math.min(el.scrollHeight, 240) + 'px';
    }, []);

    const save = async () => {
        const text = value.trim();
        if (!text || text === message.content) { onCancel?.(); return; }
        setSaving(true);
        try {
            const updated = await editMessage(guildId, message.channelId, message.id, { content: text });
            upsert(message.channelId, { ...message, ...updated });
            onCancel?.();
        } finally { setSaving(false); }
    };

    return (
        <div className="tv2-edit-inline">
            <textarea
                ref={taRef}
                value={value}
                onChange={(e) => {
                    setValue(e.target.value);
                    const el = e.target;
                    el.style.height = 'auto';
                    el.style.height = Math.min(el.scrollHeight, 240) + 'px';
                }}
                onKeyDown={(e) => {
                    if (e.key === 'Escape') { e.preventDefault(); onCancel?.(); }
                    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); save(); }
                }}
                disabled={saving}
                className="tv2-edit-textarea"
                rows={1}
            />
            <div className="tv2-edit-hint">
                échap pour <button className="tv2-link" onClick={onCancel}>annuler</button>
                {' · '}
                entrée pour <button className="tv2-link" onClick={save} disabled={saving}>enregistrer</button>
            </div>
        </div>
    );
}
