import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Send, Edit3, X, Plus, Image as ImageIcon } from 'lucide-react';
import toast from 'react-hot-toast';
import { createEditor, Transforms } from 'slate';
import { Slate, Editable, ReactEditor, withReact } from 'slate-react';
import { withHistory } from 'slate-history';

import { useChatStore } from '../store/useChatStore';
import { useDmStore } from '../store/useDmStore';
import { useTheme } from '@/providers/ThemeProvider';
import MentionDropdown from '@/components/chat/MentionDropdown';
import { useWebSocket, OPCODES } from '@/contexts/WebSocketContext';

import {
    EMPTY_VALUE, safeValue, serialize, deserialize,
    decorateMarkdown, Leaf, Element, isHotkey, wrapWithToken,
} from '../utils/slateHelpers';
import { useInputAttachments, MAX_IMAGES_PER_MESSAGE, isImageFile } from '../hooks/useInputAttachments';
import { useInputMentions } from '../hooks/useInputMentions';
import InputEmojiButton from './input/InputEmojiButton';

export default function ChatInput({ channelId, isDm, conversationId, disabled, onSubmit, externalReplyTo, onClearReply, channelMembers, guildCompanyId }) {
    const sendMessage = useChatStore((s) => s.sendMessage);
    const dmSendMessage = useDmStore((s) => s.sendMessage);
    const editMessage = useChatStore((s) => s.editMessage);
    const messageBeingEdited = useChatStore((s) => s.messageBeingEdited);
    const stopEditing = useChatStore((s) => s.stopEditing);
    const { theme } = useTheme();
    const chatCompanyId = useChatStore((s) => s.initializedCompanyId);
    const activeConversation = useDmStore((s) => s.activeConversation);
    const { send, connected } = useWebSocket();

    const editor = useMemo(() => withHistory(withReact(createEditor())), []);
    const [value, setValue] = useState(EMPTY_VALUE);
    const [slateKey, setSlateKey] = useState(0);
    const [isSending, setIsSending] = useState(false);
    const [replyTo, setReplyTo] = useState(null);

    const fileInputRef = useRef(null);
    const isTypingRef = useRef(false);
    const typingTimeoutRef = useRef(null);
    const typingDebounceRef = useRef(null);

    const { attachments, addFiles, removeAttachment, clearAttachments } = useInputAttachments(messageBeingEdited);
    const { mentionQuery, setMentionQuery, mentionParticipants, mentionRanks, detectMentionTrigger, handleMentionSelect } = useInputMentions({
        isDm, activeConversation, chatCompanyId, guildCompanyId, channelMembers,
    });

    const text = useMemo(() => serialize(value), [value]);
    const trimmed = useMemo(() => text.trim(), [text]);
    const canSend = disabled ? false : (messageBeingEdited ? trimmed.length > 0 : (trimmed.length > 0 || attachments.length > 0));

    const emitTypingStart = useCallback(() => {
        if (!channelId || isDm || !connected || isTypingRef.current) return;
        isTypingRef.current = true;
        send(OPCODES.DISPATCH, { channelId: String(channelId) }, 'TYPING_START');
    }, [channelId, isDm, connected, send]);

    const emitTypingStop = useCallback(() => {
        if (!channelId || isDm || !connected || !isTypingRef.current) return;
        isTypingRef.current = false;
        send(OPCODES.DISPATCH, { channelId: String(channelId) }, 'TYPING_STOP');
    }, [channelId, isDm, connected, send]);

    useEffect(() => {
        if (externalReplyTo !== undefined) setReplyTo(externalReplyTo ?? null);
    }, [externalReplyTo]);

    useEffect(() => {
        setValue(EMPTY_VALUE);
        setSlateKey((k) => k + 1);
        setMentionQuery(null);
    }, [channelId, conversationId, setMentionQuery]);

    useEffect(() => {
        setValue(messageBeingEdited ? deserialize(messageBeingEdited.content || '') : EMPTY_VALUE);
        setSlateKey((k) => k + 1);
    }, [messageBeingEdited]);

    useEffect(() => {
        requestAnimationFrame(() => { try { ReactEditor.focus(editor); } catch { /* empty */ } });
    }, [editor, slateKey]);

    const submit = useCallback(async () => {
        if (isSending) return;

        if (messageBeingEdited) {
            if (!trimmed) return;
            try {
                setIsSending(true);
                await editMessage(channelId, messageBeingEdited.id, trimmed);
                stopEditing();
                setValue(EMPTY_VALUE);
                setSlateKey((k) => k + 1);
            } catch (err) {
                toast.error(err?.message || 'Impossible de modifier le message.');
            } finally { setIsSending(false); }
            return;
        }

        if (!trimmed && attachments.length === 0) return;
        emitTypingStop();
        clearTimeout(typingTimeoutRef.current);

        try {
            setIsSending(true);
            if (onSubmit) {
                await onSubmit({ content: trimmed || '', files: attachments.map((a) => a.file), replyToId: replyTo?.id ?? null });
            } else if (isDm) {
                await dmSendMessage(trimmed || '');
                if (attachments.length > 0) toast.error('Les pièces jointes ne sont pas encore supportées en messages privés.');
            } else {
                await sendMessage(channelId, { content: trimmed || '', files: attachments.map((a) => a.file), replyToId: replyTo?.id ?? null });
            }
            setReplyTo(null);
            onClearReply?.();
            setValue(EMPTY_VALUE);
            setSlateKey((k) => k + 1);
            clearAttachments();
        } catch (err) {
            toast.error(err?.message || "Impossible d'envoyer le message.");
        } finally { setIsSending(false); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [attachments, channelId, editMessage, isSending, messageBeingEdited, replyTo, sendMessage, stopEditing, trimmed, onSubmit, isDm, dmSendMessage, clearAttachments, emitTypingStop]);

    const onKeyDown = useCallback((e) => {
        if (e.isComposing || e.nativeEvent?.isComposing) return;
        if (mentionQuery !== null) {
            if (e.key === 'Enter' || e.key === 'ArrowUp' || e.key === 'ArrowDown') { e.preventDefault(); return; }
            if (e.key === 'Escape') { e.preventDefault(); setMentionQuery(null); return; }
        }
        if (e.key === 'Escape' && messageBeingEdited) {
            e.preventDefault(); stopEditing(); setValue(EMPTY_VALUE); setSlateKey((k) => k + 1); return;
        }
        if (e.key === 'Enter' && e.altKey) { e.preventDefault(); Transforms.insertText(editor, '\n'); return; }
        if (e.key === 'Enter' && !e.shiftKey && !e.ctrlKey && !e.metaKey && !e.altKey) { e.preventDefault(); submit(); return; }
        if (isHotkey(e, 'ctrl+b')) { e.preventDefault(); wrapWithToken(editor, '**'); return; }
        if (isHotkey(e, 'ctrl+i')) { e.preventDefault(); wrapWithToken(editor, '*'); return; }
        if (isHotkey(e, 'ctrl+u')) { e.preventDefault(); wrapWithToken(editor, '__'); return; }
        if (isHotkey(e, 'ctrl+shift+x')) { e.preventDefault(); wrapWithToken(editor, '~~'); return; }
    }, [editor, submit, messageBeingEdited, stopEditing, mentionQuery, setMentionQuery]);

    const onPaste = useCallback((e) => {
        if (messageBeingEdited) return;
        const images = Array.from(e.clipboardData?.items || []).filter(it => it.kind === 'file').map(it => it.getAsFile?.()).filter(f => f && isImageFile(f));
        if (images.length > 0) { e.preventDefault(); addFiles(images); }
    }, [addFiles, messageBeingEdited]);

    const onEmojiClick = useCallback((emojiData) => {
        Transforms.insertText(editor, emojiData.emoji);
        requestAnimationFrame(() => { try { ReactEditor.focus(editor); } catch { /* empty */ } });
    }, [editor]);

    return (
        <form onSubmit={(e) => { e.preventDefault(); submit(); }} className="relative">
            {replyTo && !messageBeingEdited && (
                <div className="absolute -top-10 left-0 right-0 flex items-center justify-between px-3 py-1.5 bg-cca-surface/80 border border-cca-border rounded-lg text-xs text-cca-textSecondary backdrop-blur-sm">
                    <span className="truncate">Réponse à <strong className="text-cca-textPrimary">{replyTo.authorName}</strong>: {String(replyTo.content ?? '').slice(0, 60)}{(replyTo.content?.length ?? 0) > 60 ? '…' : ''}</span>
                    <button type="button" onClick={() => { setReplyTo(null); onClearReply?.(); }} className="ml-2 text-cca-textSecondary/60 hover:text-cca-textPrimary shrink-0"><X className="w-3.5 h-3.5" /></button>
                </div>
            )}

            {messageBeingEdited && (
                <div className="absolute -top-12 left-0 right-0 flex items-center justify-between px-4 py-2 rounded-lg border border-brand-primary/30 bg-brand-primary/10 backdrop-blur-xl text-brand-primary text-xs shadow-lg font-bold animate-in slide-in-from-bottom-2 duration-300">
                    <div className="flex items-center gap-2"><Edit3 className="w-3.5 h-3.5" />Modification du message en cours...</div>
                    <button type="button" onClick={() => { stopEditing(); setValue(EMPTY_VALUE); setSlateKey((k) => k + 1); }} className="p-1 rounded-md hover:bg-brand-primary/20 transition-all active:scale-90" title="Annuler (Esc)"><X className="w-4 h-4" /></button>
                </div>
            )}

            {!messageBeingEdited && attachments.length > 0 && (
                <div className="mb-2 flex flex-wrap gap-2">
                    {attachments.map((a) => (
                        <div key={a.id} className="relative h-20 w-20 rounded-xl overflow-hidden border border-cca-border bg-cca-surface shadow-xl animate-in zoom-in-75 duration-200" title={a.file?.name || 'image'}>
                            <img src={a.url} alt={a.file?.name || 'preview'} className="h-full w-full object-cover" draggable={false} />
                            <button type="button" onClick={() => removeAttachment(a.id)} className="absolute top-1 right-1 inline-flex items-center justify-center h-6 w-6 rounded-lg bg-cca-base/80 hover:bg-red-500/80 border border-cca-border transition-all" title="Retirer"><X className="w-3 h-3 text-cca-textPrimary" /></button>
                        </div>
                    ))}
                </div>
            )}

            <div className="relative flex items-end gap-3 px-4 py-3 rounded-xl bg-cca-surface/60 backdrop-blur-xl border border-cca-border shadow-2xl focus-within:border-brand-primary/50 focus-within:ring-4 focus-within:ring-brand-primary/5 transition-all duration-300">
                <div className="relative flex flex-col gap-2">
                    <button type="button" disabled={!!messageBeingEdited} onClick={() => fileInputRef.current?.click()}
                        className={`p-2.5 rounded-xl border transition-all active:scale-95 ${messageBeingEdited ? 'bg-cca-base/40 border-cca-border/40 opacity-40 cursor-not-allowed' : 'bg-cca-base hover:bg-cca-surface border-cca-border text-cca-textSecondary hover:text-brand-primary shadow-sm'}`}
                        title={`Ajouter une image (max ${MAX_IMAGES_PER_MESSAGE}, 5MB, pas de GIF)`}>
                        <Plus className="w-4 h-4" />
                    </button>
                    <input ref={fileInputRef} type="file" className="hidden" accept="image/*" multiple onChange={(e) => { if (e.target.files?.length) addFiles(e.target.files); e.target.value = ''; }} />
                </div>

                <InputEmojiButton onEmojiClick={onEmojiClick} theme={theme} />

                {mentionQuery !== null && (
                    <div className="absolute bottom-full left-0 right-0 mb-1 z-50">
                        <MentionDropdown query={mentionQuery} participants={mentionParticipants} ranks={mentionRanks} isDm={isDm} onSelect={(token) => handleMentionSelect(editor, token)} onClose={() => setMentionQuery(null)} />
                    </div>
                )}

                <div className="flex-1">
                    <Slate key={slateKey} editor={editor} initialValue={safeValue(value)}
                        onChange={(v) => {
                            setValue(safeValue(v));
                            detectMentionTrigger(editor);
                            if (!isDm && channelId) {
                                clearTimeout(typingDebounceRef.current);
                                typingDebounceRef.current = setTimeout(emitTypingStart, 300);
                                clearTimeout(typingTimeoutRef.current);
                                typingTimeoutRef.current = setTimeout(emitTypingStop, 3000);
                            }
                        }}>
                        <Editable
                            placeholder={messageBeingEdited ? 'Modifier le message…' : 'Envoyer un message…'}
                            className="outline-none text-sm leading-6 whitespace-pre-wrap break-words text-cca-textPrimary max-h-60 overflow-y-auto"
                            spellCheck autoCorrect="off"
                            renderLeaf={(props) => <Leaf {...props} />}
                            renderElement={(props) => <Element {...props} />}
                            decorate={decorateMarkdown}
                            onKeyDown={onKeyDown}
                            onPaste={onPaste}
                        />
                    </Slate>
                    <div className="mt-2 text-[11px] text-cca-textSecondary/50 font-medium flex items-center gap-3">
                        <span className="opacity-80">Entrée = envoyer · ALT+Entrée = nouvelle ligne · Ctrl+B/I/U · Ctrl+Shift+X</span>
                        {!messageBeingEdited && (
                            <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-cca-base border border-cca-border">
                                <ImageIcon className="w-3 h-3" />
                                <span className="font-bold text-cca-textSecondary">{attachments.length}/{MAX_IMAGES_PER_MESSAGE}</span>
                            </span>
                        )}
                    </div>
                </div>

                <button type="submit" disabled={!canSend || isSending}
                    className={`p-2.5 rounded-xl border transition-all active:scale-95 flex items-center justify-center ${canSend && !isSending ? 'bg-brand-primary hover:bg-brand-dark border-brand-primary shadow-[0_0_15px_-3px_rgba(var(--brand-primary-rgb),0.4)]' : 'bg-cca-base border-cca-border opacity-30 cursor-default'}`}
                    title="Envoyer (Entrée)">
                    {isSending ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Send className="w-4 h-4 text-white" />}
                </button>
            </div>
        </form>
    );
}
