import { useCallback, useEffect, useState } from 'react';
import { Node, Range, Text, Transforms } from 'slate';
import { getRanks, getCompanyEmployees } from '@/services/employeesService';

export function useInputMentions({ isDm, activeConversation, chatCompanyId, guildCompanyId, channelMembers }) {
    const [mentionQuery, setMentionQuery] = useState(null);
    const [mentionParticipants, setMentionParticipants] = useState([]);
    const [mentionRanks, setMentionRanks] = useState([]);

    useEffect(() => {
        if (isDm) {
            if (activeConversation?.otherUserId && activeConversation?.otherUserName) {
                setMentionParticipants([{ id: activeConversation.otherUserId, name: activeConversation.otherUserName }]);
            } else {
                setMentionParticipants([]);
            }
            setMentionRanks([]);
            return;
        }

        if (Array.isArray(channelMembers) && channelMembers.length > 0) {
            setMentionParticipants(channelMembers.map(m => ({ id: m.userId ?? m.id, name: m.name || m.username })));
        } else {
            const cid = guildCompanyId || chatCompanyId;
            if (cid) {
                getCompanyEmployees(cid)
                    .then(data => {
                        const list = Array.isArray(data) ? data : (data?.employees || []);
                        setMentionParticipants(list.map(e => ({ id: e.userId ?? e.id, name: e.user?.name ?? e.fullName ?? e.name ?? e.characterName ?? e.username ?? `Utilisateur ${e.userId ?? e.id}` })));
                    })
                    .catch(err => console.warn('getCompanyEmployees:', err));
            }
        }

        const cid = guildCompanyId || chatCompanyId;
        if (cid) {
            getRanks(cid)
                .then(data => setMentionRanks(Array.isArray(data) ? data.map(r => ({ id: r.id, name: r.name })) : []))
                .catch(err => console.warn('getRanks:', err));
        }
    }, [isDm, activeConversation, chatCompanyId, guildCompanyId, channelMembers]);

    const detectMentionTrigger = useCallback((editor) => {
        const sel = editor.selection;
        if (!sel || !Range.isCollapsed(sel)) { setMentionQuery(null); return; }
        const { anchor } = sel;
        try {
            const node = Node.get(editor, anchor.path);
            if (!Text.isText(node)) { setMentionQuery(null); return; }
            const textBefore = node.text.slice(0, anchor.offset);
            const match = textBefore.match(/@(\w*)$/);
            if (match) setMentionQuery(match[1]);
            else setMentionQuery(null);
        } catch { setMentionQuery(null); }
    }, []);

    const handleMentionSelect = useCallback((editor, token) => {
        const sel = editor.selection;
        if (!sel || !Range.isCollapsed(sel)) return;
        const { anchor } = sel;
        try {
            const node = Node.get(editor, anchor.path);
            if (!Text.isText(node)) return;
            const textBefore = node.text.slice(0, anchor.offset);
            const match = textBefore.match(/@(\w*)$/);
            if (!match) return;
            const start = { path: anchor.path, offset: anchor.offset - match[0].length };
            Transforms.select(editor, { anchor: start, focus: anchor });
            Transforms.insertText(editor, token + ' ');
        } catch { /* empty */ }
        setMentionQuery(null);
    }, []);

    return { mentionQuery, setMentionQuery, mentionParticipants, mentionRanks, detectMentionTrigger, handleMentionSelect };
}
