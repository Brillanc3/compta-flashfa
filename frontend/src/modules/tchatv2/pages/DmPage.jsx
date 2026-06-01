import React, { useEffect, useState, useCallback, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { Menu, MessageSquare } from 'lucide-react';
import { useShallow } from 'zustand/react/shallow';
import { useMessageStore } from '../stores/messageStore';
import { useDmStore } from '../stores/dmStore';
import { fetchDmMessages, sendDmMessage, fetchDms } from '../api/client';
import { focusDmChannel, blurChannel } from '../api/socket';
import VirtualizedMessageList from '../components/MessageList/VirtualizedMessageList';
import Composer from '../components/Composer/Composer';

function dmDisplayName(dm) {
    if (!dm) return 'Message direct';
    if (dm.type === 'GROUP_DM' && dm.name) return dm.name;
    if (dm.recipients?.length === 1) return dm.recipients[0].username ?? 'DM';
    if (dm.recipients?.length > 1) return dm.recipients.map(r => r.username).join(', ');
    return 'Message direct';
}

const EMPTY = [];

export default function DmPage({ isMobile, onOpenChannels }) {
    const { channelId } = useParams();

    const dms    = useDmStore(s => s.dms);
    const setDms = useDmStore(s => s.setDms);

    const messages = useMessageStore(
        useShallow(s => (s.byChannel[String(channelId)] ?? []).map(id => s.byId[id]).filter(Boolean))
    );
    const pendingByChannel = useMessageStore(s => s.pendingByChannel);
    const prependMessages  = useMessageStore(s => s.prependMessages);
    const upsertMessage    = useMessageStore(s => s.upsertMessage);

    const [loading, setLoading] = useState(false);
    const [hasMore, setHasMore] = useState(true);
    const oldestIdRef = useRef(null);

    useEffect(() => {
        if (!dms.length) fetchDms().then(setDms).catch(() => {});
    }, [dms.length, setDms]);

    useEffect(() => {
        if (!channelId) return;
        const controller = new AbortController();
        focusDmChannel(channelId);
        oldestIdRef.current = null;
        setHasMore(true);
        setLoading(true);

        fetchDmMessages(channelId, { limit: 20 }, { signal: controller.signal })
            .then(msgs => {
                msgs.forEach(m => upsertMessage(channelId, m));
                if (msgs.length < 20) setHasMore(false);
                if (msgs.length > 0) oldestIdRef.current = msgs[0].id;
            })
            .catch(err => { if (err?.code === 'ERR_CANCELED') return; })
            .finally(() => setLoading(false));

        return () => { controller.abort(); blurChannel(channelId); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [channelId]);

    const handleLoadMore = useCallback(async () => {
        if (loading || !hasMore || !oldestIdRef.current || !channelId) return;
        setLoading(true);
        try {
            const msgs = await fetchDmMessages(channelId, { limit: 20, before: oldestIdRef.current });
            prependMessages(channelId, msgs);
            if (msgs.length < 20) setHasMore(false);
            if (msgs.length > 0) oldestIdRef.current = msgs[0].id;
        } catch { /* intentional */ }
        finally { setLoading(false); }
    }, [channelId, loading, hasMore, prependMessages]);

    const handleJumpTo = useCallback((messageId) => {
        const node = document.querySelector(`[data-message-id="${messageId}"]`);
        if (node) {
            node.scrollIntoView({ behavior: 'smooth', block: 'center' });
            node.classList.add('tv2-flash');
            setTimeout(() => node.classList.remove('tv2-flash'), 1500);
        }
    }, []);

    const dmSendFn = useCallback(async (body) => sendDmMessage(channelId, body), [channelId]);

    const activeDm = dms.find(d => String(d.id) === String(channelId));
    const dmName   = dmDisplayName(activeDm);
    const pending  = pendingByChannel[String(channelId)] ?? EMPTY;

    if (!channelId) {
        return (
            <div className="tv2-main">
                {isMobile && (
                    <div className="tv2-header">
                        <button className="tv2-icon-btn tv2-hamburger" onClick={onOpenChannels} aria-label="Menu">
                            <Menu size={20} />
                        </button>
                        <span className="tv2-header-title">Messages directs</span>
                    </div>
                )}
                <div className="tv2-dm-empty-state">
                    <MessageSquare size={48} className="tv2-dm-empty-icon" />
                    <p className="tv2-dm-empty-title">Vos messages directs</p>
                    <p className="tv2-dm-empty-sub">Sélectionnez une conversation ou créez-en une avec le bouton&nbsp;<strong>+</strong></p>
                </div>
            </div>
        );
    }

    return (
        <div className="tv2-main">
            <div className="tv2-header">
                {isMobile && (
                    <button className="tv2-icon-btn tv2-hamburger" onClick={onOpenChannels} aria-label="Menu">
                        <Menu size={20} />
                    </button>
                )}
                <span className="tv2-header-hash">@</span>
                <span className="tv2-header-title">{dmName}</span>
                <div className="tv2-header-spacer" />
            </div>

            <div className="tv2-main-row">
                <div className="tv2-main-col">
                    <VirtualizedMessageList
                        messages={messages}
                        pendingMessages={pending}
                        onLoadMore={handleLoadMore}
                        hasMore={hasMore}
                        loading={loading}
                        guildId={null}
                        channelId={channelId}
                        canManage={false}
                        onReplyTo={null}
                        onJumpTo={handleJumpTo}
                        firstUnreadId={null}
                    />
                    <Composer
                        channelId={channelId}
                        guildId={null}
                        replyTo={null}
                        onClearReply={null}
                        userPerms={0n}
                        sendFn={dmSendFn}
                    />
                </div>
            </div>
        </div>
    );
}
