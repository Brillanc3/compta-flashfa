// src/components/chat/MessageBubble.jsx
import React from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import MessageEmbed from "./MessageEmbed";

export default function MessageBubble({ message, selfUserId }) {
    const mine = String(message.authorId) === String(selfUserId);

    const author = message.author || {};
    const avatar = author.imageUrl || null;
    const name = author.fullName || author.name || "Utilisateur";
    const initials = (name.split(" ").map(w => w[0]).join("").slice(0, 2) || "U").toUpperCase();

    const time = new Date(message.createdAt).toLocaleTimeString("fr-FR", {
        hour: "2-digit",
        minute: "2-digit",
    });

    // Détection YouTube (Discord-style)
    // Supporte : watch?v=ID, watch?feature=share&v=ID, youtu.be/ID, embed/ID, music.youtube.com...
    const ytRegex = /(?:https?:\/\/)?(?:www\.|m\.|music\.)?(?:youtube\.com\/(?:watch\?.*v=|embed\/|v\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/;
    const ytMatch = message.content?.match(ytRegex);
    const ytUrl = ytMatch ? `https://www.youtube.com/watch?v=${ytMatch[1]}` : null;

    return (
        <div className={`flex items-start gap-3 ${mine ? "justify-end" : ""} animate-chatMsg`}>

            {/* Avatar à gauche si ce n'est pas moi */}
            {!mine && (
                <AvatarBubble avatar={avatar} initials={initials} name={name} />
            )}

            {/* Bulle */}
            <div className={`max-w-[75%] flex flex-col ${mine ? "items-end text-right" : "items-start"}`}>

                {/* Nom + heure */}
                <div className="text-[11px] text-slate-400 mb-1">
                    {name} • {time}
                </div>

                {/* BULLE GALACTIC GLASS */}
                <div
                    className={`px-4 py-2 rounded-2xl text-sm leading-relaxed shadow-xl backdrop-blur-xl border border-white/10 relative overflow-hidden
                        
                        ${mine
                        ? "bg-gradient-to-br from-emerald-600/30 via-emerald-700/20 to-teal-900/10 text-emerald-100 rounded-tr-sm"
                        : "bg-gradient-to-br from-indigo-600/20 via-purple-700/20 to-slate-900/40 text-slate-200 rounded-tl-sm"
                    }
                    `}
                    style={{
                        boxShadow: mine
                            ? "0 0 20px rgba(0,255,180,0.15)"
                            : "0 0 20px rgba(120,80,255,0.15)",
                        backdropFilter: "blur(14px)",
                    }}
                >

                    {/* Halo d’ambiance */}
                    <div className="absolute inset-0 opacity-20 pointer-events-none mix-blend-screen bg-[radial-gradient(circle_at_top_left,rgba(255,255,255,0.25),transparent_60%)]" />

                    {/* Glow néon */}
                    <div className={`absolute -inset-1 blur-xl opacity-10 pointer-events-none ${
                        mine ? "bg-emerald-400" : "bg-indigo-400"
                    }`} />

                    <div className="relative z-10">
                        <ReactMarkdown
                            remarkPlugins={[remarkGfm]}
                            components={{
                                a: (props) => (
                                    <a {...props} className="text-blue-300 underline hover:text-blue-200" target="_blank" rel="noopener noreferrer" />
                                ),
                                code: ({ inline, children }) =>
                                    inline ? (
                                        <code className="bg-black/30 px-1 rounded text-[0.85em] text-amber-300">
                                            {children}
                                        </code>
                                    ) : (
                                        <pre className="bg-black/40 p-3 rounded-lg text-[0.9em] overflow-x-auto text-amber-200 border border-white/10">
                                            <code>{children}</code>
                                        </pre>
                                    )
                            }}
                        >
                            {sanitize(message.content)}
                        </ReactMarkdown>
                    </div>
                </div>

                {/* YouTube Embed */}
                {ytUrl && <MessageEmbed url={ytUrl} />}
            </div>

            {/* Avatar à droite si c’est mon message */}
            {mine && (
                <AvatarBubble avatar={avatar} initials={initials} name={name} />
            )}
        </div>
    );
}

/* =============================================================================
 *  Avatar Bubble
 * ============================================================================= */
function AvatarBubble({ avatar, initials, name }) {
    return (
        <div className="shrink-0">
            {avatar ? (
                <img src={avatar} alt={name} className="w-8 h-8 rounded-full object-cover shadow-md" />
            ) : (
                <div className="w-8 h-8 rounded-full bg-slate-700 text-slate-200 grid place-items-center text-xs font-semibold shadow-md">
                    {initials}
                </div>
            )}
        </div>
    );
}

/* =============================================================================
 *  Sanitize simple (évite HTML dangereux)
 * ============================================================================= */
function sanitize(str) {
    if (!str) return "";
    return str.replace(/<\/?(script|style|iframe|object|embed|link)[^>]*>/gi, "");
}
