import React, { useCallback, useEffect, useMemo, useRef } from 'react';
import { Hash, Lock } from 'lucide-react';
import toast from 'react-hot-toast';
import { Virtuoso } from 'react-virtuoso';
import MessageGroup, { groupMessages } from './MessageGroup';
import TypingIndicator from './TypingIndicator';
import ChatInput from './ChatInput';
import PinnedMessagesPanel from './PinnedMessagesPanel';
import NewMessagesDivider from './NewMessagesDivider';
import { pinMessage as apiPinMessage, ackChannelRead } from '@/services/chatService';
import { useChatStore } from '../store/useChatStore';

export default function ChatMessageList({
    msgListRef,
    bottomRef,
    hasActiveEntity,
    canViewCurrent,
    canSendCurrent,
    currentIsLoading,
    channelMessages,
    currentUserId,
    canManage,
    channelId,
    isDmView,
    activeChannelId,
    activeConversationId,
    onEdit,
    onDelete,
    onReply,
    onJumpToMessage,
    onImageClick,
    members,
    ranks,
    replyTo,
    onClearReply,
    channelMembers,
    guildCompanyId,
    pinsOpen,
    onClosePins,
    onMsgListScroll,
    onCloseContextMenus,
}) {
    const readStateByChannel = useChatStore((s) => s.readStateByChannel);
    const lastReadId = channelId ? (readStateByChannel[String(channelId)] ?? null) : null;

    const ackTimerRef = useRef(null);
    const atBottomRef = useRef(false);

    const grouped = useMemo(
        () => (hasActiveEntity && canViewCurrent && !currentIsLoading)
            ? groupMessages(channelMessages)
            : [],
        [hasActiveEntity, canViewCurrent, currentIsLoading, channelMessages]
    );

    // Inject NewMessagesDivider before first unread group
    const virtualItems = useMemo(() => {
        if (!lastReadId || !grouped.length) return grouped.map((g) => ({ type: 'group', data: g }));
        const items = [];
        let inserted = false;
        for (const g of grouped) {
            if (!inserted) {
                const firstId = g.messages[0]?.id;
                if (firstId && BigInt(String(firstId)) > BigInt(lastReadId)) {
                    items.push({ type: 'divider', id: 'new-messages' });
                    inserted = true;
                }
            }
            items.push({ type: 'group', data: g });
        }
        return items;
    }, [grouped, lastReadId]);

    const handleDelete = useCallback(async (msgId) => {
        if (!channelId) return;
        try { await onDelete(channelId, msgId); }
        catch (e) { toast.error(e?.message || 'Impossible de supprimer le message.'); }
    }, [channelId, onDelete]);

    const handleReply = useCallback((msg) => {
        onReply({ id: msg.id, content: msg.content, authorName: msg.authorName });
    }, [onReply]);

    const handlePin = useCallback((msg) => {
        if (channelId) apiPinMessage(channelId, msg.id).catch(() => toast.error("Impossible d'épingler."));
    }, [channelId]);

    const renderItem = useCallback((_, item) => {
        if (item.type === 'divider') return <NewMessagesDivider />;
        return (
            <MessageGroup
                group={item.data}
                currentUserId={currentUserId}
                canManage={canManage}
                channelId={channelId}
                onEdit={onEdit}
                onDelete={handleDelete}
                onReply={handleReply}
                onJumpToMessage={onJumpToMessage}
                onPin={handlePin}
                onImageClick={onImageClick}
                members={members}
                ranks={ranks}
            />
        );
    }, [currentUserId, canManage, channelId, onEdit, handleDelete, handleReply, onJumpToMessage, handlePin, onImageClick, members, ranks]);

    const virtuosoComponents = useMemo(() => ({
        Header: () => <div className="h-3" />,
        Footer: () => <div ref={bottomRef} className="h-3" />,
        EmptyPlaceholder: () => (
            <div className="text-center text-cca-textSecondary/60 text-xs mt-6 italic">
                Aucun message pour l'instant.
            </div>
        ),
    }), [bottomRef]);

    const computeItemKey = useCallback((_, item) =>
        item.type === 'divider' ? 'new-messages-divider' : item.data.messages[0].id,
    []);

    // ACK debounced: fire 1s after user reaches bottom, only when visible
    const scheduleAck = useCallback(() => {
        if (!channelId || !atBottomRef.current || document.visibilityState !== 'visible') return;
        const lastMsg = channelMessages[channelMessages.length - 1];
        if (!lastMsg?.id) return;
        clearTimeout(ackTimerRef.current);
        ackTimerRef.current = setTimeout(() => {
            ackChannelRead(channelId, lastMsg.id).catch(() => {});
        }, 1000);
    }, [channelId, channelMessages]);

    const handleAtBottom = useCallback((atBottom) => {
        atBottomRef.current = atBottom;
        if (atBottom) scheduleAck();
    }, [scheduleAck]);

    useEffect(() => {
        const onVisible = () => { if (document.visibilityState === 'visible') scheduleAck(); };
        document.addEventListener('visibilitychange', onVisible);
        return () => {
            document.removeEventListener('visibilitychange', onVisible);
            clearTimeout(ackTimerRef.current);
        };
    }, [scheduleAck]);

    const showMessages = hasActiveEntity && canViewCurrent && !currentIsLoading;

    return (
        <div className="relative flex-1 overflow-hidden bg-cca-base border-t border-cca-border/40 backdrop-blur-2xl flex flex-col min-h-0">
            {/* NON-MESSAGE STATES */}
            {!hasActiveEntity && (
                <div className="flex-1 flex flex-col items-center justify-center text-cca-textSecondary">
                    <div className="mb-4 rounded-full bg-cca-surface border border-cca-border w-16 h-16 flex items-center justify-center">
                        <Hash className="w-7 h-7 text-cca-textSecondary/50" />
                    </div>
                    <p className="text-sm font-medium">Aucun salon sélectionné.</p>
                </div>
            )}
            {hasActiveEntity && !canViewCurrent && (
                <div className="flex-1 flex flex-col items-center justify-center text-cca-textSecondary">
                    <div className="mb-4 rounded-full bg-red-500/5 border border-red-500/20 w-16 h-16 flex items-center justify-center">
                        <Lock className="w-7 h-7 text-red-400" />
                    </div>
                    <p className="text-sm font-semibold text-red-100">Tu n'as pas accès à ce salon.</p>
                </div>
            )}
            {hasActiveEntity && canViewCurrent && currentIsLoading && (
                <div className="flex-1 flex justify-center py-6 text-xs text-cca-textSecondary animate-pulse">
                    Chargement des messages...
                </div>
            )}

            {/* VIRTUALIZED MESSAGE LIST */}
            {showMessages && (
                <Virtuoso
                    scrollerRef={(el) => { if (msgListRef) msgListRef.current = el; }}
                    style={{ flex: '1 1 0', minHeight: 0 }}
                    className="px-3 md:px-4 scrollbar-thin scrollbar-thumb-cca-border/50 scrollbar-track-transparent"
                    data={virtualItems}
                    computeItemKey={computeItemKey}
                    itemContent={renderItem}
                    followOutput="smooth"
                    initialTopMostItemIndex={virtualItems.length > 0 ? virtualItems.length - 1 : 0}
                    overscan={200}
                    components={virtuosoComponents}
                    atBottomStateChange={handleAtBottom}
                    onClick={onCloseContextMenus}
                    onScroll={onMsgListScroll}
                />
            )}

            {/* TYPING INDICATOR */}
            {!isDmView && activeChannelId && (
                <TypingIndicator channelId={activeChannelId} currentUserId={currentUserId} />
            )}

            {/* INPUT */}
            <div className="relative border-t border-cca-border/70 px-3 py-3 bg-cca-surface/90 backdrop-blur-xl">
                {!hasActiveEntity ? (
                    <div className="text-xs text-cca-textSecondary/60">Sélectionne un salon ou un DM pour écrire un message.</div>
                ) : !canViewCurrent ? (
                    <div className="text-xs text-cca-textSecondary flex items-center gap-2 italic">
                        <Lock className="w-4 h-4" /> Tu n'as pas accès à ce salon.
                    </div>
                ) : !canSendCurrent ? (
                    <div className="text-xs text-cca-textSecondary flex items-center gap-2 italic">
                        <Lock className="w-4 h-4" /> Tu ne peux pas écrire ici.
                    </div>
                ) : (
                    <ChatInput
                        channelId={isDmView ? null : activeChannelId}
                        isDm={isDmView}
                        conversationId={isDmView ? activeConversationId : null}
                        externalReplyTo={replyTo}
                        onClearReply={onClearReply}
                        channelMembers={isDmView ? null : channelMembers}
                        guildCompanyId={isDmView ? null : guildCompanyId}
                    />
                )}
            </div>

            {/* PINS PANEL */}
            {!isDmView && (
                <PinnedMessagesPanel
                    channelId={activeChannelId}
                    isOpen={pinsOpen}
                    onClose={onClosePins}
                />
            )}
        </div>
    );
}
