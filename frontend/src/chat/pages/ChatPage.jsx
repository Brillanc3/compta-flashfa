import React, { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { useOutletContext, useNavigate, useParams } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import { X, MessageSquare } from "lucide-react";

import ChatSidebar from "../components/ChatSidebar";
import ChatServerBar from "../components/ChatServerBar";
import ChatPermissionsDrawer from "../components/ChatPermissionsDrawer";
import SidebarContextMenu from "../components/SidebarContextMenu";
import ChannelModal from "../components/ChannelModal";
import CreateCategoryModal from "../components/CreateCategoryModal";
import ChatMainHeader from "../components/ChatMainHeader";
import ChatMessageList from "../components/ChatMessageList";
import ChatImagePreviewModal from "../components/ChatImagePreviewModal";
import MemberListPanel from "../components/MemberListPanel";
import UserStatusBar from "../components/UserStatusBar";

import { usePresenceStore } from "../store/usePresenceStore";
import { usePresenceHeartbeat } from "../hooks/usePresenceHeartbeat";
import { usePushNotifications } from "../hooks/usePushNotifications";
import { useMediaQuery } from "../hooks/useMediaQuery";
import { useChatStore } from "../store/useChatStore";
import { useDmStore } from "../store/useDmStore";
import { useChatUIStore } from "../store/useChatUIStore";

import { useCompany } from "@/contexts/CompanyContext";
import { useAuth } from "@/contexts/AuthContext";
import { useAudioNotification } from "@/hooks/useAudioNotification";
import { getChannelMembers } from "@/services/chatService";
import { getRanks } from "@/services/employeesService";

export default function ChatPage() {
    const { openMenu: openDashboardMenu } = useOutletContext() || {};
    const { '*': urlWildcard } = useParams();
    const navigate = useNavigate();
    const urlDmId = urlWildcard?.startsWith('dm/') ? urlWildcard.slice(3) : null;
    const urlChannelId = !urlDmId ? (urlWildcard || null) : null;

    /* ----- STORES ----- */
    const ensureInitialized = useChatStore((s) => s.ensureInitialized);
    const activeChannel = useChatStore((s) => s.activeChannel);
    const messagesByChannel = useChatStore((s) => s.messages);
    const isLoadingMessages = useChatStore((s) => s.isLoadingMessages);
    const canViewChannel = useChatStore((s) => s.canViewChannel);
    const canSendMessage = useChatStore((s) => s.canSendMessage);
    const canManageMessages = useChatStore((s) => s.canManageMessages);
    const startEditingMessage = useChatStore((s) => s.startEditingMessage);
    const deleteMessage = useChatStore((s) => s.deleteMessage);
    const isLoadingChannels = useChatStore((s) => s.isLoadingChannels);
    const selectChannel = useChatStore((s) => s.selectChannel);
    const channels = useChatStore((s) => s.channels);

    const activeConversation = useDmStore((s) => s.activeConversation);
    const messagesByDm = useDmStore((s) => s.messages);
    const isLoadingDmMessages = useDmStore((s) => s.isLoadingMessages);
    const setActiveConversation = useDmStore((s) => s.setActiveConversation);
    const conversations = useDmStore((s) => s.conversations);

    const { permissionsDrawerOpen, permissionsCategory, closePermissionsDrawer } = useChatUIStore();
    useChatUIStore((s) => s.openContextMenu);
    const { channelModalOpen, channelModalMode, channelBeingEdited, preselectedCategoryId, closeChannelModal } = useChatUIStore();
    const { categoryModalOpen, closeCategoryModal } = useChatUIStore();

    /* ----- DERIVED ----- */
    const isDmView = !!activeConversation;
    const hasActiveEntity = !!activeChannel || !!activeConversation;
    const currentName = isDmView ? activeConversation.otherUserName : activeChannel?.name;
    const currentTopic = isDmView ? "Messages Privés" : activeChannel?.topic;
    const canViewCurrent = isDmView ? true : canViewChannel;
    const canSendCurrent = isDmView ? true : canSendMessage;
    const currentMessagesRaw = isDmView
        ? messagesByDm[activeConversation?.id]
        : messagesByChannel[activeChannel?.id];
    const channelMessages = Array.isArray(currentMessagesRaw) ? currentMessagesRaw : [];
    const currentIsLoading = isDmView ? isLoadingDmMessages : isLoadingMessages;

    const { activeCompanyId } = useCompany();
    const { user } = useAuth();
    const presences = usePresenceStore((s) => s.presences);
    const { muted, setMuted, prefs, setPref } = useAudioNotification();

    /* ----- STATE ----- */
    const [channelMembers, setChannelMembers] = useState([]);
    const [channelCompanyId, setChannelCompanyId] = useState(null);
    const [chatRanks, setChatRanks] = useState([]);
    const [memberListOpen, setMemberListOpen] = useState(true);
    const [pinsOpen, setPinsOpen] = useState(false);
    const [replyTo, setReplyTo] = useState(null);
    const [mobileSidebarOpen, setMobileSidebarOpen] = useState(true);
    const [imagePreview, setImagePreview] = useState({ open: false, attachments: [], currentIndex: 0 });

    const msgListRef = useRef(null);
    const bottomRef = useRef(null);
    const shouldAutoScrollRef = useRef(true);

    /* ----- DATA LOADING ----- */
    useEffect(() => {
        if (!activeChannel?.id) { setChannelMembers([]); setChannelCompanyId(null); return; }
        getChannelMembers(activeChannel.id)
            .then(data => {
                setChannelMembers(Array.isArray(data) ? data : (data?.members ?? []));
                setChannelCompanyId(data?.companyId ?? null);
            })
            .catch(err => { console.warn('getChannelMembers:', err); setChannelMembers([]); setChannelCompanyId(null); });
    }, [activeChannel?.id]);

    useEffect(() => {
        const cid = activeCompanyId ?? channelCompanyId;
        if (!cid) return;
        getRanks(cid)
            .then(data => setChatRanks(Array.isArray(data) ? data.map(r => ({ id: r.id, name: r.name })) : []))
            .catch(() => setChatRanks([]));
    }, [activeCompanyId, channelCompanyId]);

    const members = useMemo(() => {
        if (channelMembers.length > 0) return channelMembers.map(m => ({ id: m.userId, name: m.name || m.username, rank: m.rank }));
        return Object.entries(presences).map(([id, p]) => ({ id: Number(id), name: p.name || p.username, rank: p.rank ?? null }));
    }, [channelMembers, presences]);

    /* ----- INIT ----- */
    useEffect(() => {
        const saved = localStorage.getItem("chat:selectedCompanyId");
        const globalCid = localStorage.getItem("lastCompanyId");
        const cid = saved || globalCid;
        if (cid) void ensureInitialized(cid);
    }, [ensureInitialized]);

    /* ----- PUSH NOTIFICATIONS ----- */
    usePushNotifications('/api');

    /* ----- PRESENCE ----- */
    const { setStatus } = usePresenceHeartbeat(activeCompanyId);
    useEffect(() => {
        if (activeCompanyId) usePresenceStore.getState().loadPresences(activeCompanyId);
    }, [activeCompanyId]);

    /* ----- MOBILE ----- */
    const isDesktop = useMediaQuery("(min-width: 768px)");
    useEffect(() => {
        if (isDesktop) { setMobileSidebarOpen(true); return; }
        if (hasActiveEntity) setMobileSidebarOpen(false); else setMobileSidebarOpen(true);
    }, [hasActiveEntity, isDesktop]);

    /* ----- URL SYNC ----- */
    useEffect(() => {
        if (!urlChannelId || !channels?.length) return;
        const ch = channels.find((c) => String(c.id) === String(urlChannelId));
        if (ch && String(activeChannel?.id) !== String(urlChannelId)) selectChannel(ch);
    }, [urlChannelId, channels, activeChannel?.id, selectChannel]);

    useEffect(() => {
        if (!activeChannel?.id || isDmView) return;
        if (String(urlChannelId) === String(activeChannel.id)) return;
        navigate(`/dashboard/chat/${activeChannel.id}`, { replace: true });
    }, [activeChannel?.id, isDmView, urlChannelId, navigate]);

    useEffect(() => {
        if (!urlDmId || !conversations?.length) return;
        const conv = conversations.find((c) => String(c.id) === String(urlDmId));
        if (conv && String(activeConversation?.id) !== String(urlDmId)) setActiveConversation(conv.id);
    }, [urlDmId, conversations, activeConversation?.id, setActiveConversation]);

    useEffect(() => {
        if (!activeConversation?.id) return;
        if (String(urlDmId) === String(activeConversation.id)) return;
        navigate(`/dashboard/chat/dm/${activeConversation.id}`, { replace: true });
    }, [activeConversation?.id, urlDmId, navigate]);

    /* ----- SCROLL ----- */
    const scrollToBottom = useCallback((behavior = "auto") => {
        if (bottomRef.current) bottomRef.current.scrollIntoView({ block: "end", behavior });
        else if (msgListRef.current) msgListRef.current.scrollTop = msgListRef.current.scrollHeight;
    }, []);

    useEffect(() => {
        if (!hasActiveEntity || currentIsLoading) return;
        queueMicrotask(() => scrollToBottom("auto"));
    }, [activeChannel?.id, activeConversation?.id, currentIsLoading, scrollToBottom, hasActiveEntity]);

    useEffect(() => {
        if (!hasActiveEntity || !shouldAutoScrollRef.current) return;
        queueMicrotask(() => scrollToBottom("auto"));
    }, [channelMessages.length, scrollToBottom, hasActiveEntity]);

    const clearReply = useCallback(() => setReplyTo(null), []);
    const closePins = useCallback(() => setPinsOpen(false), []);

    const handleMsgListScroll = useCallback(() => {
        const el = msgListRef.current;
        if (!el) return;
        shouldAutoScrollRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 120;
    }, []);

    /* ----- IMAGE PREVIEW ----- */
    const openImagePreview = useCallback((attachments, index) => {
        if (!attachments?.[index]?.url) return;
        setImagePreview({ open: true, attachments, currentIndex: index });
    }, []);
    const closeImagePreview = useCallback(() => setImagePreview({ open: false, attachments: [], currentIndex: 0 }), []);
    const nextImage = useCallback(() => setImagePreview(prev =>
        prev.open && prev.attachments.length > 1
            ? { ...prev, currentIndex: (prev.currentIndex + 1) % prev.attachments.length }
            : prev
    ), []);
    const prevImage = useCallback(() => setImagePreview(prev =>
        prev.open && prev.attachments.length > 1
            ? { ...prev, currentIndex: (prev.currentIndex - 1 + prev.attachments.length) % prev.attachments.length }
            : prev
    ), []);

    const handleJumpToMessage = useCallback((msgId) => {
        const el = msgListRef.current?.querySelector(`[data-message-id="${msgId}"]`);
        if (!el) return;
        el.scrollIntoView({ block: 'center', behavior: 'smooth' });
        el.classList.add('!bg-brand-primary/15', 'ring-1', 'ring-brand-primary/40');
        setTimeout(() => el.classList.remove('!bg-brand-primary/15', 'ring-1', 'ring-brand-primary/40'), 2000);
    }, []);

    const closeContextMenus = useCallback(() => useChatUIStore.getState().closeContextMenu(), []);

    /* ----- RENDER ----- */
    if (isLoadingChannels) {
        return (
            <div className="fixed inset-0 z-[100] bg-cca-base flex flex-col items-center justify-center gap-4">
                <div className="w-16 h-16 border-4 border-brand-primary/20 border-t-brand-primary rounded-full animate-spin" />
                <MessageSquare className="w-8 h-8 text-brand-primary animate-pulse" />
            </div>
        );
    }

    return (
        <div className="relative flex h-full min-h-0 bg-cca-base text-cca-textPrimary overflow-hidden transition-colors duration-300">
            {/* Backdrop mobile */}
            <AnimatePresence>
                {!isDesktop && mobileSidebarOpen && (
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                        onClick={() => setMobileSidebarOpen(false)}
                        className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm md:hidden" />
                )}
            </AnimatePresence>

            {/* Sidebar */}
            <AnimatePresence mode="wait">
                {(isDesktop || mobileSidebarOpen) && (
                    <motion.div key="sidebar"
                        initial={isDesktop ? false : { x: "-100%" }}
                        animate={{ x: 0 }}
                        exit={{ x: "-100%" }}
                        transition={{ type: "spring", damping: 25, stiffness: 200 }}
                        className={`${isDesktop ? "relative z-30" : "fixed inset-y-0 left-0 z-50 w-[85%] max-w-[320px]"} flex h-full min-h-0`}
                    >
                        <ChatServerBar />
                        <div className="flex flex-col h-full flex-1 min-h-0 border-r border-cca-border/50">
                            <ChatSidebar
                                onSelectChannel={() => { if (!isDesktop) setMobileSidebarOpen(false); }}
                                className="flex-1 min-h-0"
                                headerRight={!isDesktop ? (
                                    <button type="button" onClick={() => setMobileSidebarOpen(false)}
                                        className="p-2 rounded-full hover:bg-cca-surface/60 text-cca-textSecondary hover:text-cca-textPrimary transition-colors">
                                        <X className="w-5 h-5" />
                                    </button>
                                ) : null}
                            />
                            <UserStatusBar onSetStatus={setStatus} />
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Main chat area */}
            <main className="flex-1 flex flex-col overflow-hidden min-h-0 relative z-10 transition-all duration-300">
                <ChatMainHeader
                    isDesktop={isDesktop}
                    isDmView={isDmView}
                    currentName={currentName}
                    currentTopic={currentTopic}
                    hasActiveEntity={hasActiveEntity}
                    canViewCurrent={canViewCurrent}
                    activeChannelId={activeChannel?.id}
                    pinsOpen={pinsOpen}
                    setPinsOpen={setPinsOpen}
                    memberListOpen={memberListOpen}
                    setMemberListOpen={setMemberListOpen}
                    muted={muted}
                    setMuted={setMuted}
                    prefs={prefs}
                    setPref={setPref}
                    openDashboardMenu={typeof openDashboardMenu === 'function' ? openDashboardMenu : () => setMobileSidebarOpen(true)}
                    onMobileSidebarOpen={() => setMobileSidebarOpen(true)}
                />
                <div className="flex-1 overflow-hidden flex flex-col min-h-0">
                    <ChatMessageList
                        msgListRef={msgListRef}
                        bottomRef={bottomRef}
                        hasActiveEntity={hasActiveEntity}
                        canViewCurrent={canViewCurrent}
                        canSendCurrent={canSendCurrent}
                        currentIsLoading={currentIsLoading}
                        channelMessages={channelMessages}
                        currentUserId={user?.id}
                        canManage={canManageMessages && !isDmView}
                        channelId={activeChannel?.id}
                        isDmView={isDmView}
                        activeChannelId={activeChannel?.id}
                        activeConversationId={activeConversation?.id}
                        onEdit={startEditingMessage}
                        onDelete={deleteMessage}
                        onReply={setReplyTo}
                        onJumpToMessage={handleJumpToMessage}
                        onImageClick={openImagePreview}
                        members={members}
                        ranks={chatRanks}
                        replyTo={replyTo}
                        onClearReply={clearReply}
                        channelMembers={channelMembers}
                        guildCompanyId={channelCompanyId}
                        pinsOpen={pinsOpen}
                        onClosePins={closePins}
                        onMsgListScroll={handleMsgListScroll}
                        onCloseContextMenus={closeContextMenus}
                    />
                </div>
            </main>

            {/* Member list */}
            {isDesktop && memberListOpen && !isDmView && <MemberListPanel members={members} />}

            {/* Image preview */}
            {imagePreview.open && (
                <ChatImagePreviewModal
                    attachments={imagePreview.attachments}
                    currentIndex={imagePreview.currentIndex}
                    onClose={closeImagePreview}
                    onPrev={prevImage}
                    onNext={nextImage}
                />
            )}

            <SidebarContextMenu />
            <ChannelModal isOpen={channelModalOpen} onClose={closeChannelModal} mode={channelModalMode} initialChannel={channelBeingEdited} preselectedCategoryId={preselectedCategoryId} />
            <CreateCategoryModal isOpen={categoryModalOpen} onClose={closeCategoryModal} />
            {(activeChannel || permissionsCategory) && (
                <ChatPermissionsDrawer
                    isOpen={permissionsDrawerOpen}
                    onClose={closePermissionsDrawer}
                    conversation={permissionsCategory ? null : activeChannel}
                    category={permissionsCategory}
                />
            )}
        </div>
    );
}
