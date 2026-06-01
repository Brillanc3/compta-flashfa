import React from 'react';

export default function NewMessagesDivider() {
    return (
        <div className="flex items-center gap-3 my-2 px-2">
            <div className="flex-1 h-px bg-red-500/50" />
            <span className="text-[10px] font-bold uppercase tracking-widest text-red-400 shrink-0">Nouveaux messages</span>
            <div className="flex-1 h-px bg-red-500/50" />
        </div>
    );
}
