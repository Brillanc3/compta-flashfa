// src/chat/components/ChatMessages.jsx

import React, { useEffect, useRef } from "react";
import { useChatStore } from "../store/useChatStore";

export default function ChatMessages({ channelId }) {
    const messages = useChatStore((s) => s.messages[channelId] || []);
    const fetchMessages = useChatStore((s) => s.fetchMessages);

    const scrollRef = useRef(null);

    useEffect(() => {
        fetchMessages(channelId);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [channelId]);

    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTo({ top: scrollRef.current.scrollHeight });
        }
    }, [messages]);

    return (
        <div ref={scrollRef} className="p-4 space-y-4 overflow-y-auto">
            {messages.map((msg) => (
                <div key={msg.id} className="group animate-in fade-in slide-in-from-bottom-2 duration-300">
                    <div className="flex items-start gap-4 p-3 rounded-2xl bg-cca-surface/40 border border-cca-border hover:bg-cca-surface/60 transition-all shadow-sm">
                        <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                                <span className="font-bold text-cca-textPrimary">
                                    {msg.author?.name}
                                </span>
                                <span className="text-[10px] text-cca-textSecondary/60 font-medium">
                                    {new Date(msg.createdAt).toLocaleString()}
                                </span>
                            </div>
                            <div className="text-sm text-cca-textPrimary leading-relaxed whitespace-pre-wrap break-words">
                                {msg.content}
                            </div>
                        </div>
                    </div>
                </div>
            ))}
        </div>
    );
}
