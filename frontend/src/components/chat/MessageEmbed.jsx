// src/components/chat/MessageEmbed.jsx
import React from "react";
import ReactPlayer from "react-player";

/**
 * MessageEmbed: A Discord-style glassmorphism container for YouTube videos.
 * Designed to look premium and aligned with the "LTD Little Seoul" design system.
 */
export default function MessageEmbed({ url }) {
  if (!url) return null;

  return (
    <div className="mt-3 w-full max-w-full sm:max-w-[500px] min-w-0 animate-chatMsg">
      <div
        className="group relative w-full overflow-hidden rounded-xl border border-white/10 bg-gradient-to-br from-slate-900/60 to-black/40 shadow-2xl backdrop-blur-xl"
        style={{
          boxShadow: "0 8px 32px rgba(0, 0, 0, 0.4), 0 0 15px rgba(120, 80, 255, 0.1)",
        }}
      >
        {/* Decorative corner accent */}
        <div className="absolute top-0 left-0 w-1 h-full bg-gradient-to-b from-indigo-500 via-purple-500 to-indigo-600 opacity-60 group-hover:opacity-100 transition-opacity" />
 
        <div 
          className="relative w-full max-w-full overflow-hidden rounded-lg bg-black/60 shadow-inner"
          style={{ paddingBottom: '56.25%' }}
        >
          {(() => {
            const videoId = url.match(/(?:v=|\/)([a-zA-Z0-9_-]{11})/)?.[1];
            if (!videoId) return null;
            return (
              <iframe
                title="YouTube Video"
                className="absolute inset-0 w-full h-full border-0"
                style={{ maxWidth: '100%' }}
                src={`https://www.youtube.com/embed/${videoId}?enablejsapi=1&origin=${typeof window !== 'undefined' ? window.location.origin : ''}`}
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                allowFullScreen
              />
            );
          })()}
        </div>
 
        {/* Info Area (Discord style) */}
        <div className="px-4 py-2 flex items-center justify-between text-[11px] text-slate-400 font-medium tracking-tight bg-black/20 w-full overflow-hidden">
          <div className="flex items-center gap-1.5 min-w-0">
            <svg className="w-3.5 h-3.5 text-red-500 shrink-0" viewBox="0 0 24 24" fill="currentColor">
              <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
            </svg>
            <span className="truncate">YouTube</span>
          </div>
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-white transition-colors flex items-center gap-1 shrink-0 ml-2"
          >
            <span className="truncate">Ouvrir</span>
            <svg className="w-3 h-3 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6M15 3h6v6M10 14L21 3" />
            </svg>
          </a>
        </div>
      </div>
    </div>
  );
}
