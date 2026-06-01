import React, { useEffect } from 'react';
import { Pin, X } from 'lucide-react';
import { useChatStore } from '../store/useChatStore';

export default function PinnedMessagesPanel({ channelId, isOpen, onClose }) {
    const loadPins = useChatStore(s => s.loadPins);
    const pins = useChatStore(s => s.pins[String(channelId)]) ?? [];

    useEffect(() => {
        if (isOpen && channelId) loadPins(channelId);
    }, [isOpen, channelId, loadPins]);

    if (!isOpen) return null;

    return (
        <div className="absolute top-0 right-0 h-full w-80 bg-cca-surface border-l border-cca-border shadow-2xl z-40 flex flex-col">
            <div className="flex items-center justify-between px-4 py-3 border-b border-cca-border">
                <div className="flex items-center gap-2 text-sm font-bold text-cca-textPrimary">
                    <Pin className="w-4 h-4 text-yellow-400" />
                    Messages épinglés
                </div>
                <button type="button" onClick={onClose} className="p-1 rounded hover:bg-cca-base text-cca-textSecondary transition-colors">
                    <X className="w-4 h-4" />
                </button>
            </div>
            <div className="flex-1 overflow-y-auto p-3 space-y-3">
                {pins.length === 0 && (
                    <div className="text-center text-xs text-cca-textSecondary/50 mt-8 italic">Aucun message épinglé</div>
                )}
                {pins.map(pin => (
                    <div key={String(pin.id ?? pin.messageId)} className="bg-cca-base rounded-xl p-3 border border-cca-border/60">
                        <div className="flex items-center gap-1.5 mb-1.5">
                            <span className="text-xs font-bold text-cca-textPrimary">
                                {pin.message?.author?.username ?? pin.message?.authorName ?? '—'}
                            </span>
                            <span className="text-[10px] text-cca-textSecondary/50">
                                {pin.pinnedAt ? new Date(pin.pinnedAt).toLocaleDateString('fr-FR') : ''}
                            </span>
                        </div>
                        <p className="text-xs text-cca-textSecondary/80 line-clamp-3 break-words">
                            {pin.message?.content || '(pièce jointe)'}
                        </p>
                        <div className="mt-1.5 text-[10px] text-cca-textSecondary/40">
                            Épinglé par {pin.pinnedBy?.username ?? '—'}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}
