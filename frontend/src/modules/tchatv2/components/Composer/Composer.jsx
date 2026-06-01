import React, { useState, useRef, useCallback, useEffect } from 'react';
import { Plus, X, Reply as ReplyIcon, Send, Paperclip, BarChart2, MessageSquarePlus, Smile } from 'lucide-react';
import toast from 'react-hot-toast';
import { sendMessage, uploadAttachments, createPoll } from '../../api/client';
import { emitTyping } from '../../api/socket';
import { useMessageStore } from '../../stores/messageStore';
import { useMemberStore } from '../../stores/memberStore';
import { useRoleStore } from '../../stores/roleStore';
import { useChannelStore } from '../../stores/channelStore';
import { useGuildEmojiStore } from '../../stores/guildEmojiStore';
import { useAuth } from '@/contexts/AuthContext';
import { hasPerm } from '../../lib/permissions';
import MentionPopover, { parseMentionContext, applyMention } from './MentionPopover';
import EmojiPickerPopover from './EmojiPickerPopover';
import CreateThreadModal from '../Thread/CreateThreadModal';
import PollComposer from '@/chat/components/PollComposer';

const EMPTY_ARR = [];
const MAX_CHARS = 2000;
const TYPING_THROTTLE_MS = 4000;

export default function Composer({ channelId, guildId, replyTo, onClearReply, userPerms = 0n, sendFn = null }) {
    const [content, setContent]       = useState('');
    const [uploading, setUploading]   = useState(false);
    const [uploadPct, setUploadPct]   = useState(0);
    const [mentionCtx, setMCtx]       = useState(null);
    const [menuOpen, setMenuOpen]     = useState(false);
    const [threadOpen, setThread]     = useState(false);
    const [showPoll, setShowPoll]     = useState(false);
    const [showEmojiPicker, setShowEmojiPicker] = useState(false);
    const [pendingFiles, setPendingFiles] = useState([]);
    const textareaRef   = useRef(null);
    const fileInputRef  = useRef(null);
    const menuRef       = useRef(null);
    const lastTypingRef = useRef(0);
    const { user }      = useAuth();

    const members  = useMemberStore(s => s.byGuild[String(guildId)] || EMPTY_ARR);
    const roles    = useRoleStore(s => s.byGuild[String(guildId)] || EMPTY_ARR);
    const channels = useChannelStore(s => s.byGuild[String(guildId)] || EMPTY_ARR);
    const guildEmojis     = useGuildEmojiStore(s => s.byGuild[String(guildId)] || EMPTY_ARR);
    const loadGuildEmojis = useGuildEmojiStore(s => s.load);

    const appendOptimistic  = useMessageStore(s => s.appendOptimistic);
    const resolveOptimistic = useMessageStore(s => s.resolveOptimistic);
    const markFailed        = useMessageStore(s => s.markFailed);
    const clearFailed       = useMessageStore(s => s.clearFailed);
    const setReadState      = useChannelStore(s => s.setReadState);

    const perms = typeof userPerms === 'bigint' ? userPerms : BigInt(userPerms ?? 0);
    const canAttach    = hasPerm(perms, 'ATTACH_FILES');
    const canThread    = hasPerm(perms, 'CREATE_PUBLIC_THREADS') || hasPerm(perms, 'CREATE_PRIVATE_THREADS');
    const canUseEmojis = hasPerm(perms, 'USE_EXTERNAL_EMOJIS');
    const pickerEmojis = canUseEmojis ? guildEmojis : [];

    useEffect(() => {
        if (guildId) loadGuildEmojis(guildId);
    }, [guildId, loadGuildEmojis]);

    // Auto-resize textarea whenever content changes (handles mount + post-send reset)
    useEffect(() => {
        const el = textareaRef.current;
        if (!el) return;
        el.style.height = 'auto';
        el.style.height = Math.min(el.scrollHeight, 200) + 'px';
    }, [content]);

    // Close menu on outside click
    useEffect(() => {
        if (!menuOpen) return;
        const handler = (e) => {
            if (menuRef.current && !menuRef.current.contains(e.target)) setMenuOpen(false);
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, [menuOpen]);

    const doSend = useCallback(async (text, nonce, pollData = null, attachmentIds = []) => {
        const optimistic = {
            nonce,
            id:               `pending-${nonce}`,
            content:          text,
            channelId:        String(channelId),
            authorId:         String(user?.id),
            authorUsername:   user?.username || user?.name || 'Moi',
            authorAvatarHash: user?.avatarHash || null,
            createdAt:        new Date().toISOString(),
            pending:          true,
            replyTo,
            retry:            () => { clearFailed(channelId, nonce); doSend(text, nonce, pollData, attachmentIds); },
        };
        appendOptimistic(channelId, optimistic);

        try {
            const body = { nonce };
            if (text) body.content = text;
            if (pollData) body.hasPoll = true;
            if (replyTo) body.referencedMessageId = String(replyTo.id);
            if (attachmentIds.length) body.attachmentIds = attachmentIds;
            const result = sendFn
                ? await sendFn(body)
                : await sendMessage(guildId, channelId, body);

            if (pollData) {
                try {
                    const poll = await createPoll(guildId, channelId, result.id, pollData);
                    resolveOptimistic(channelId, nonce, { ...result, poll });
                } catch {
                    resolveOptimistic(channelId, nonce, result);
                    toast.error('Le sondage n\'a pas pu être créé.');
                }
            } else {
                resolveOptimistic(channelId, nonce, result);
            }
            setReadState(channelId, result.id);
            onClearReply?.();
        } catch {
            markFailed(channelId, nonce);
        }
    }, [channelId, guildId, sendFn, user, replyTo, appendOptimistic, resolveOptimistic, markFailed, clearFailed, setReadState, onClearReply]);

    const updateMentionCtx = (el) => {
        const ctx = parseMentionContext(el.value, el.selectionStart);
        setMCtx(ctx);
    };

    const handleChange = useCallback((e) => {
        const val = e.target.value;
        if (val.length > MAX_CHARS) return;
        setContent(val);
        updateMentionCtx(e.target);

        const now = Date.now();
        if (channelId && guildId && now - lastTypingRef.current > TYPING_THROTTLE_MS) {
            lastTypingRef.current = now;
            emitTyping(channelId, guildId);
        }

        const el = textareaRef.current;
        if (el) {
            el.style.height = 'auto';
            el.style.height = Math.min(el.scrollHeight, 200) + 'px';
        }
    }, [channelId, guildId]);

    const handleFileDrop = useCallback((e) => {
        e.preventDefault();
        const files = Array.from(e.dataTransfer?.files ?? e.target.files ?? []);
        if (!files.length || !channelId) return;
        const entries = files.map(f => ({
            localId: crypto.randomUUID(),
            file: f,
            previewUrl: f.type.startsWith('image/') ? URL.createObjectURL(f) : null,
        }));
        setPendingFiles(prev => [...prev, ...entries]);
    }, [channelId]);

    const uploadAndSend = useCallback(async (text, nonce, pollData = null) => {
        let attachmentIds = [];
        if (pendingFiles.length) {
            setUploading(true);
            setUploadPct(0);
            try {
                const fd = new FormData();
                for (const { file } of pendingFiles) fd.append('files', file, file.name);
                const { attachments } = await uploadAttachments(
                    guildId, channelId, fd,
                    (evt) => { if (evt.lengthComputable) setUploadPct(Math.round((evt.loaded / evt.total) * 100)); },
                );
                attachmentIds = attachments.map(a => a.id);
                pendingFiles.forEach(({ previewUrl }) => { if (previewUrl) URL.revokeObjectURL(previewUrl); });
                setPendingFiles([]);
            } catch (err) {
                toast.error(err?.message ?? 'Échec de l\'envoi du fichier');
                setUploading(false);
                setUploadPct(0);
                return;
            } finally {
                setUploading(false);
                setUploadPct(0);
            }
        }
        doSend(text, nonce, pollData, attachmentIds);
    }, [pendingFiles, guildId, channelId, doSend]);

    const handleKeyDown = useCallback((e) => {
        if (mentionCtx && ['ArrowUp', 'ArrowDown', 'Enter', 'Tab'].includes(e.key)) return;
        if (e.key === 'Escape' && replyTo) { e.preventDefault(); onClearReply?.(); return; }
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            const text = content.trim();
            if (!text && !pendingFiles.length) return;
            setContent(''); setMCtx(null);
            const el = textareaRef.current;
            if (el) el.style.height = 'auto';
            uploadAndSend(text, crypto.randomUUID());
        }
    }, [content, pendingFiles, uploadAndSend, mentionCtx, replyTo, onClearReply]);

    const handleSendClick = useCallback(() => {
        const text = content.trim();
        if ((!text && !pendingFiles.length) || !channelId || uploading) return;
        setContent(''); setMCtx(null);
        const el = textareaRef.current;
        if (el) { el.style.height = 'auto'; el.focus(); }
        uploadAndSend(text, crypto.randomUUID());
    }, [content, channelId, uploading, pendingFiles, uploadAndSend]);

    const onPickMention = useCallback((item) => {
        const next = applyMention(content, mentionCtx, item.token);
        setContent(next);
        setMCtx(null);
        requestAnimationFrame(() => {
            const el = textareaRef.current;
            if (!el) return;
            el.focus();
            const pos = (mentionCtx?.start ?? 0) + item.token.length + 1;
            el.setSelectionRange(pos, pos);
        });
    }, [content, mentionCtx]);

    const handleEmojiSelect = useCallback((token) => {
        setShowEmojiPicker(false);
        const el = textareaRef.current;
        if (!el) { setContent(prev => prev + token); return; }
        const start = el.selectionStart ?? content.length;
        const end   = el.selectionEnd   ?? content.length;
        const next  = content.slice(0, start) + token + content.slice(end);
        if (next.length > MAX_CHARS) return;
        setContent(next);
        requestAnimationFrame(() => {
            el.focus();
            const pos = start + token.length;
            el.setSelectionRange(pos, pos);
            el.style.height = 'auto';
            el.style.height = Math.min(el.scrollHeight, 200) + 'px';
        });
    }, [content]);

    const handlePaste = useCallback((e) => {
        const items = Array.from(e.clipboardData?.items ?? []);
        const imageItems = items.filter(it => it.type.startsWith('image/'));
        if (!imageItems.length || !channelId) return;
        e.preventDefault();
        const entries = imageItems
            .map(it => it.getAsFile())
            .filter(Boolean)
            .map(f => ({
                localId: crypto.randomUUID(),
                file: f,
                previewUrl: URL.createObjectURL(f),
            }));
        if (entries.length) setPendingFiles(prev => [...prev, ...entries]);
    }, [channelId]);

    const handleAttachClick = () => {
        setMenuOpen(false);
        fileInputRef.current?.click();
    };

    const handleThreadClick = () => {
        setMenuOpen(false);
        setThread(true);
    };

    const handlePollConfirm = useCallback((pollData) => {
        setShowPoll(false);
        const text = content.trim();
        setContent('');
        setMCtx(null);
        const el = textareaRef.current;
        if (el) { el.style.height = 'auto'; }
        doSend(text, crypto.randomUUID(), pollData);
    }, [content, doSend]);

    const over75    = content.length > MAX_CHARS * 0.75;
    const remaining = MAX_CHARS - content.length;
    const countCls  = remaining <= 0 ? 'tv2-composer-count is-err'
                    : over75      ? 'tv2-composer-count is-warn'
                                  : 'tv2-composer-count';

    const menuItems = [
        canAttach && {
            icon: <Paperclip size={15} />,
            label: 'Joindre un fichier',
            action: handleAttachClick,
        },
        {
            icon: <BarChart2 size={15} />,
            label: 'Créer un sondage',
            action: () => { setMenuOpen(false); setShowPoll(true); },
        },
        canThread && {
            icon: <MessageSquarePlus size={15} />,
            label: 'Créer un fil',
            action: handleThreadClick,
        },
    ].filter(Boolean);

    return (
        <div className="tv2-composer-wrap" style={{ position: 'relative' }}>
            {showPoll && (
                <PollComposer
                    onConfirm={handlePollConfirm}
                    onCancel={() => setShowPoll(false)}
                />
            )}
            {pendingFiles.length > 0 && (
                <div className="tv2-pending-attachments">
                    {pendingFiles.map(a => (
                        <div key={a.localId} className="tv2-pending-attachment">
                            {a.previewUrl && (
                                <img src={a.previewUrl} alt={a.file.name} className="tv2-pending-attachment-preview" />
                            )}
                            <span className="tv2-pending-attachment-name">{a.file.name}</span>
                            <button
                                type="button"
                                className="tv2-icon-btn"
                                aria-label="Retirer"
                                onClick={() => {
                                    if (a.previewUrl) URL.revokeObjectURL(a.previewUrl);
                                    setPendingFiles(prev => prev.filter(x => x.localId !== a.localId));
                                }}
                            >
                                <X size={12} />
                            </button>
                        </div>
                    ))}
                </div>
            )}
            {uploading && (
                <div className="tv2-upload-progress">
                    <div className="tv2-upload-progress-bar" style={{ width: `${uploadPct}%` }} />
                    <span className="tv2-upload-progress-label">Envoi… {uploadPct}%</span>
                </div>
            )}
            {replyTo && (
                <div className="tv2-reply-bar">
                    <ReplyIcon size={13} />
                    <span>Réponse à <strong>{replyTo.authorNickname || replyTo.authorUsername}</strong></span>
                    <span className="tv2-reply-snippet">{(replyTo.content ?? '').slice(0, 80)}</span>
                    <button className="tv2-icon-btn" onClick={onClearReply} aria-label="Annuler la réponse">
                        <X size={14} />
                    </button>
                </div>
            )}
            <div
                className="tv2-composer"
                onDrop={handleFileDrop}
                onDragOver={e => e.preventDefault()}
            >
                {/* "+" button with popup menu */}
                <div className="tv2-composer-plus-wrap" ref={menuRef}>
                    <button
                        type="button"
                        className={`tv2-composer-icon ${menuOpen ? 'is-active' : ''}`}
                        aria-label="Actions"
                        disabled={!channelId}
                        onClick={() => setMenuOpen(v => !v)}
                    >
                        <Plus size={20} style={{ transition: 'transform 0.15s', transform: menuOpen ? 'rotate(45deg)' : 'none' }} />
                    </button>

                    {menuOpen && menuItems.length > 0 && (
                        <div className="tv2-composer-menu">
                            {menuItems.map((item, i) => (
                                <button
                                    key={i}
                                    type="button"
                                    className={`tv2-composer-menu-item ${item.disabled ? 'is-disabled' : ''}`}
                                    onClick={item.disabled ? undefined : item.action}
                                    disabled={item.disabled}
                                >
                                    {item.icon}
                                    <span>{item.label}</span>
                                    {item.disabled && <span className="tv2-composer-menu-badge">Bientôt</span>}
                                </button>
                            ))}
                        </div>
                    )}
                </div>

                {/* Hidden file input */}
                <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    multiple
                    style={{ display: 'none' }}
                    onChange={handleFileDrop}
                />

                <div className="tv2-composer-input-wrap">
                    <textarea
                        ref={textareaRef}
                        className="tv2-composer-textarea"
                        value={content}
                        onChange={handleChange}
                        onKeyDown={handleKeyDown}
                        onKeyUp={(e) => updateMentionCtx(e.target)}
                        onClick={(e) => updateMentionCtx(e.target)}
                        onBlur={() => setTimeout(() => setMCtx(null), 120)}
                        onPaste={handlePaste}
                        placeholder={channelId ? 'Envoyer un message — @ pour mentionner, # pour un salon' : 'Sélectionnez un channel'}
                        disabled={!channelId || uploading}
                        rows={1}
                    />
                    <MentionPopover
                        ctx={mentionCtx}
                        members={members}
                        roles={roles}
                        channels={channels}
                        guildEmojis={pickerEmojis}
                        onPick={onPickMention}
                    />
                </div>

                {over75 && <span className={countCls}>{remaining}</span>}

                <div className="tv2-composer-emoji-wrap">
                    <button
                        type="button"
                        className={`tv2-composer-icon ${showEmojiPicker ? 'is-active' : ''}`}
                        aria-label="Emojis"
                        title="Emojis"
                        disabled={!channelId}
                        onClick={() => setShowEmojiPicker(v => !v)}
                    >
                        <Smile size={20} />
                    </button>
                    {showEmojiPicker && (
                        <EmojiPickerPopover
                            guildEmojis={pickerEmojis}
                            onSelect={handleEmojiSelect}
                            onClose={() => setShowEmojiPicker(false)}
                        />
                    )}
                </div>

                <button
                    type="button"
                    className="tv2-composer-send"
                    onClick={handleSendClick}
                    disabled={!channelId || uploading || (content.trim().length === 0 && !pendingFiles.length)}
                    aria-label="Envoyer"
                    title="Envoyer (Entrée)"
                >
                    <Send size={18} />
                </button>
            </div>

            <CreateThreadModal
                open={threadOpen}
                onClose={() => setThread(false)}
                guildId={guildId}
                channelId={channelId}
            />
        </div>
    );
}
