// src/chat/components/ChatHeader.jsx

import React from "react";
import { Hash, Shield, Pin, Users } from "lucide-react";
import { useChatStore } from "../store/useChatStore";

export default function ChatHeader({ isDm, memberListOpen, onToggleMemberList, pinsOpen, onTogglePins }) {
    const activeChannel = useChatStore((s) => s.activeChannel);

    if (!activeChannel && !isDm) return null;

    return (
        <header className="h-14 px-4 flex items-center justify-between border-b border-cca-border bg-cca-surface/80 backdrop-blur-xl shadow-sm shrink-0">
            <div className="flex items-center gap-3">
                <div className="p-1.5 rounded-lg bg-cca-base border border-cca-border">
                    <Hash className="w-5 h-5 text-cca-textSecondary" />
                </div>
                <div>
                    <div className="font-bold font-heading text-cca-textPrimary">{activeChannel?.name}</div>
                    {activeChannel?.topic && (
                        <div className="text-xs text-cca-textSecondary leading-none mt-0.5">
                            {activeChannel.topic}
                        </div>
                    )}
                </div>
            </div>

            <div className="flex items-center gap-2">
                {!isDm && onTogglePins && (
                    <button
                        type="button"
                        onClick={onTogglePins}
                        title="Messages épinglés"
                        className={`p-2 rounded-lg border transition-colors ${
                            pinsOpen
                                ? 'bg-yellow-500/20 border-yellow-500/40 text-yellow-400'
                                : 'bg-cca-surface border-cca-border text-cca-textSecondary hover:text-yellow-400 hover:border-yellow-500/40'
                        }`}
                    >
                        <Pin className="w-4 h-4" />
                    </button>
                )}
                {!isDm && onToggleMemberList && (
                    <button
                        type="button"
                        onClick={onToggleMemberList}
                        title="Liste des membres"
                        className={`p-2 rounded-lg border transition-colors ${
                            memberListOpen
                                ? 'bg-brand-primary/20 border-brand-primary/40 text-brand-primary'
                                : 'bg-cca-surface border-cca-border text-cca-textSecondary hover:text-brand-primary hover:border-brand-primary/40'
                        }`}
                    >
                        <Users className="w-4 h-4" />
                    </button>
                )}
            </div>
        </header>
    );
}
