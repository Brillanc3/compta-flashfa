import React, { useEffect, useRef, useState } from 'react';
import { Smile } from 'lucide-react';
import EmojiPicker, { Theme, EmojiStyle } from 'emoji-picker-react';

export default function InputEmojiButton({ onEmojiClick, theme }) {
    const [emojiOpen, setEmojiOpen] = useState(false);
    const btnRef = useRef(null);
    const panelRef = useRef(null);

    useEffect(() => {
        function onDown(e) {
            if (!emojiOpen) return;
            if (btnRef.current?.contains(e.target)) return;
            if (panelRef.current?.contains(e.target)) return;
            setEmojiOpen(false);
        }
        window.addEventListener('mousedown', onDown);
        return () => window.removeEventListener('mousedown', onDown);
    }, [emojiOpen]);

    return (
        <div className="relative">
            <button ref={btnRef} type="button" onClick={() => setEmojiOpen(v => !v)}
                className="p-2.5 rounded-xl border border-cca-border bg-cca-base hover:bg-cca-surface text-cca-textSecondary hover:text-brand-primary transition-all active:scale-95 shadow-sm"
                title="Emojis">
                <Smile className="w-4 h-4" />
            </button>
            {emojiOpen && (
                <div ref={panelRef} className="absolute bottom-14 left-0 z-50 rounded-2xl overflow-hidden border border-cca-border bg-cca-surface backdrop-blur-3xl shadow-[0_20px_50px_rgba(0,0,0,0.5)] animate-in slide-in-from-bottom-4 duration-300">
                    <EmojiPicker
                        onEmojiClick={(data) => { onEmojiClick(data); setEmojiOpen(false); }}
                        theme={theme === 'dark' ? Theme.DARK : Theme.LIGHT}
                        emojiStyle={EmojiStyle.NATIVE}
                        width={360}
                        height={420}
                    />
                </div>
            )}
        </div>
    );
}
