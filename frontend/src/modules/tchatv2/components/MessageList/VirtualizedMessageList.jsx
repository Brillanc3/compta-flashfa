import React, { useCallback, useMemo, useRef } from 'react';
import { Virtuoso } from 'react-virtuoso';
import MessageItem from './MessageItem';
import { usePresenceStore } from '../../stores/presenceStore';
import { useReadStateStore } from '../../stores/readStateStore';
import { useAuth } from '@/contexts/AuthContext';

function isSameAuthorAndClose(a, b) {
    if (!a || !b) return false;
    const sameAuthor = String(a.authorId ?? a.userId) === String(b.authorId ?? b.userId);
    if (!sameAuthor) return false;
    const diff = new Date(b.createdAt) - new Date(a.createdAt);
    return diff < 7 * 60 * 1000;
}

function compareBigId(a, b) {
    try { return BigInt(String(a)) > BigInt(String(b)); }
    catch { return false; }
}

function NewMessagesDivider() {
    return (
        <div className="tv2-new-divider">
            <span className="tv2-new-divider-line" />
            <span className="tv2-new-divider-label">Nouveaux messages</span>
            <span className="tv2-new-divider-line" />
        </div>
    );
}

const FRESH_WINDOW_MS = 8000;

export default function VirtualizedMessageList({
    messages, pendingMessages = [], onLoadMore, hasMore, loading = false,
    guildId, channelId, canManage = false, canUseEmojis = true, onReplyTo, onJumpTo, firstUnreadId = null,
}) {
    const statuses     = usePresenceStore(s => s.statuses);
    const readStates   = useReadStateStore(s => s.readStates);
    const { user }     = useAuth();
    const atBottomRef  = useRef(true);
    const dividerShownRef = useRef(false);

    const allItems = useMemo(() => [
        ...messages,
        ...pendingMessages.map(p => ({ ...p, id: `pending-${p.nonce}`, isPending: true })),
    ], [messages, pendingMessages]);

    // Reset divider shown flag when channel changes
    useMemo(() => { dividerShownRef.current = false; }, [channelId]);

    // Build a map: messageId -> userIds who read up to (at least) that message
    // We only show "vu par" on the most-recently-read message per reader
    const readByMessage = useMemo(() => {
        const channelMap = readStates[String(channelId)] ?? {};
        const myId = String(user?.id ?? '');
        // For each reader, find the message that most closely matches their lastReadMessageId
        const result = {}; // { messageId: Set<userId> }
        Object.entries(channelMap).forEach(([userId, lastReadMsgId]) => {
            if (userId === myId) return;
            // Find the highest message id <= lastReadMsgId in allItems
            let target = null;
            try {
                const readBig = BigInt(lastReadMsgId);
                for (let i = allItems.length - 1; i >= 0; i--) {
                    const item = allItems[i];
                    if (item.isPending) continue;
                    try {
                        if (BigInt(String(item.id)) <= readBig) { target = String(item.id); break; }
                    } catch { /* skip */ }
                }
            } catch { /* skip */ }
            if (target) {
                if (!result[target]) result[target] = new Set();
                result[target].add(userId);
            }
        });
        return result;
    }, [readStates, channelId, allItems, user?.id]);

    const handleTopReached = useCallback(() => {
        if (hasMore) onLoadMore?.();
    }, [hasMore, onLoadMore]);

    const itemContent = useCallback((index, item) => {
        const prev    = allItems[index - 1];
        const compact = isSameAuthorAndClose(prev, item);
        const status  = statuses[String(item.authorId ?? item.userId)];
        const readBy  = item.isPending ? [] : Array.from(readByMessage[String(item.id)] ?? []);

        // Show "Nouveaux messages" divider once before first unread message
        let divider = null;
        if (
            firstUnreadId &&
            !dividerShownRef.current &&
            !item.isPending &&
            compareBigId(item.id, firstUnreadId)
        ) {
            dividerShownRef.current = true;
            divider = <NewMessagesDivider />;
        }

        const isNew = item.isPending || (
            item.createdAt &&
            Date.now() - new Date(item.createdAt).getTime() < FRESH_WINDOW_MS
        );

        return (
            <>
                {divider}
                <MessageItem
                    message={item}
                    compact={compact && !divider}
                    presenceStatus={(compact && !divider) ? undefined : status}
                    guildId={guildId}
                    canManage={canManage}
                    canUseEmojis={canUseEmojis}
                    onReplyTo={onReplyTo}
                    onJumpTo={onJumpTo}
                    readBy={readBy}
                    isNew={isNew}
                />
            </>
        );
    }, [allItems, statuses, guildId, canManage, canUseEmojis, onReplyTo, onJumpTo, firstUnreadId, readByMessage]);

    return (
        <div key={channelId} className="tv2-msg-list-wrap">
            <Virtuoso
                style={{ flex: 1, overflowY: 'auto', minHeight: 0 }}
                data={allItems}
                itemContent={itemContent}
                initialTopMostItemIndex={allItems.length > 0 ? allItems.length - 1 : 0}
                followOutput={(isAtBottom) => {
                    atBottomRef.current = isAtBottom;
                    return isAtBottom ? 'smooth' : false;
                }}
                startReached={handleTopReached}
                components={{
                    Header: (hasMore && loading)
                        ? () => <div className="tv2-load-more">Chargement…</div>
                        : () => <div style={{ padding: 16 }} />,
                }}
            />
        </div>
    );
}
