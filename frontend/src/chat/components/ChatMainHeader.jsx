import React, { useRef, useState } from 'react';
import { Hash, User, Lock, Menu, X, MessageSquare, Bell, BellOff, Volume2, VolumeX } from 'lucide-react';
import NotifToggle from './NotifToggle';

export default function ChatMainHeader({
    isDesktop,
    isDmView,
    currentName,
    currentTopic,
    hasActiveEntity,
    canViewCurrent,
    activeChannelId,
    pinsOpen,
    setPinsOpen,
    memberListOpen,
    setMemberListOpen,
    muted,
    setMuted,
    prefs,
    setPref,
    openDashboardMenu,
    onMobileSidebarOpen,
}) {
    const [notifSettingsOpen, setNotifSettingsOpen] = useState(false);
    const notifBtnRef = useRef(null);
    const notifPanelRef = useRef(null);

    React.useEffect(() => {
        if (!notifSettingsOpen) return;
        const handler = (e) => {
            if (notifBtnRef.current?.contains(e.target)) return;
            if (notifPanelRef.current?.contains(e.target)) return;
            setNotifSettingsOpen(false);
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, [notifSettingsOpen]);

    return (
        <div className="relative z-[60] overflow-visible bg-cca-surface/80 border-b border-cca-border backdrop-blur-xl shadow-xl shadow-black/10 px-3 py-3 md:px-4 md:py-3 flex items-center justify-between">
            <div className="relative flex items-center gap-2 min-w-0">
                {!isDesktop && (
                    <button
                        type="button"
                        onClick={onMobileSidebarOpen}
                        className="mr-1 inline-flex items-center justify-center h-10 w-10 rounded-xl bg-cca-surface border border-cca-border hover:bg-cca-base transition-colors active:scale-95"
                        aria-label="Ouvrir la liste des salons"
                    >
                        <Menu className="w-5 h-5 text-cca-textPrimary" />
                    </button>
                )}
                <div className="flex h-8 w-8 items-center justify-center text-cca-textSecondary/60 shrink-0">
                    {isDmView ? <User className="w-5 h-5" /> : <Hash className="w-5 h-5" />}
                </div>
                <div className="min-w-0">
                    <div className="flex items-center gap-2">
                        <h1 className="text-base md:text-lg font-bold font-heading truncate text-cca-textPrimary">
                            {currentName || 'Sélectionne un salon'}
                        </h1>
                        {hasActiveEntity && !canViewCurrent && (
                            <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-red-500/10 text-red-400 border border-red-500/30">
                                <Lock className="w-3 h-3" /> Accès restreint
                            </span>
                        )}
                    </div>
                    {hasActiveEntity && currentTopic && (
                        <p className="text-xs text-cca-textSecondary truncate">{currentTopic}</p>
                    )}
                    {!hasActiveEntity && (
                        <p className="text-xs text-cca-textSecondary">Choisis un salon ou un message privé pour commencer.</p>
                    )}
                </div>
            </div>

            <div className="relative flex items-center gap-2 text-xs text-cca-textSecondary">
                {hasActiveEntity && !isDmView && <span className="hidden sm:inline">#{activeChannelId}</span>}

                {hasActiveEntity && !isDmView && isDesktop && (
                    <>
                        <button type="button" onClick={() => setPinsOpen(v => !v)} title="Messages épinglés"
                            className={`p-2 rounded-lg border transition-colors ${pinsOpen ? 'bg-yellow-500/20 border-yellow-500/40 text-yellow-400' : 'bg-cca-surface border-cca-border text-cca-textSecondary hover:text-yellow-400 hover:border-yellow-500/40'}`}>
                            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="17" x2="12" y2="22"/><path d="M5 17H19V15L17 13V7L18 6V4H6V6L7 7V13L5 15V17Z"/></svg>
                        </button>
                        <button type="button" onClick={() => setMemberListOpen(v => !v)} title="Liste des membres"
                            className={`p-2 rounded-lg border transition-colors ${memberListOpen ? 'bg-brand-primary/20 border-brand-primary/40 text-brand-primary' : 'bg-cca-surface border-cca-border text-cca-textSecondary hover:text-brand-primary hover:border-brand-primary/40'}`}>
                            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
                        </button>
                    </>
                )}

                <div className="relative">
                    <button ref={notifBtnRef} type="button" onClick={() => setNotifSettingsOpen(v => !v)}
                        className={`inline-flex items-center justify-center h-8 w-8 rounded-lg border transition-all active:scale-95 ${muted ? 'bg-cca-surface border-cca-border text-cca-textSecondary/50' : 'bg-cca-surface border-cca-border text-cca-textSecondary hover:text-brand-primary hover:border-brand-primary/40'}`}
                        title="Préférences de notifications sonores">
                        {muted ? <BellOff className="w-4 h-4" /> : <Bell className="w-4 h-4" />}
                    </button>
                    {notifSettingsOpen && (
                        <div ref={notifPanelRef} className="absolute top-full right-0 mt-2 w-64 bg-cca-surface border border-cca-border rounded-xl shadow-2xl z-50 overflow-hidden">
                            <div className="px-3 py-2 border-b border-cca-border bg-cca-base/50">
                                <span className="text-xs font-bold text-cca-textSecondary uppercase tracking-wider">Notifications sonores</span>
                            </div>
                            <div className="p-2 space-y-1">
                                <NotifToggle label="Tout couper" icon={muted ? <VolumeX className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5" />} checked={muted} onChange={v => setMuted(v)} accent="red" />
                                <div className="h-px bg-cca-border/50 my-1" />
                                <NotifToggle label="Messages normaux" checked={prefs.messages} onChange={v => setPref('messages', v)} disabled={muted} />
                                <NotifToggle label="@everyone" checked={prefs.mention_everyone} onChange={v => setPref('mention_everyone', v)} disabled={muted} />
                                <NotifToggle label="Mentions directes" checked={prefs.mention_user} onChange={v => setPref('mention_user', v)} disabled={muted} />
                                <NotifToggle label="Mentions de rang" checked={prefs.mention_rank} onChange={v => setPref('mention_rank', v)} disabled={muted} />
                            </div>
                        </div>
                    )}
                </div>

                {!isDesktop && (
                    <button type="button" onClick={openDashboardMenu}
                        className="inline-flex items-center justify-center h-10 w-10 rounded-xl bg-cca-surface border border-cca-border hover:bg-cca-base transition-colors active:scale-95 ml-1"
                        aria-label="Ouvrir le menu principal">
                        <MessageSquare className="w-5 h-5 text-cca-textPrimary" />
                    </button>
                )}
            </div>
        </div>
    );
}
