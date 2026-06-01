import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { X, Plus, Send } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useMemberStore } from '../stores/memberStore';
import { useRoleStore } from '../stores/roleStore';
import { usePresenceStore } from '../stores/presenceStore';
import { hasPerm } from '../lib/permissions';
import { openDm, sendDmMessage, addMemberRole, removeMemberRole } from '../api/client';
import { useDmStore } from '../stores/dmStore';

const EMPTY_ARR = [];

const STATUS_COLOR = {
    online:  '#22c55e',
    idle:    '#eab308',
    dnd:     '#ef4444',
    offline: '#94a3b8',
};

const STATUS_LABEL = {
    online: 'En ligne',
    idle:   'Inactif',
    dnd:    'Ne pas déranger',
    offline: 'Hors ligne',
};

function roleColor(color) {
    if (!color) return 'rgb(var(--chat-text, 148 163 184))';
    return '#' + color.toString(16).padStart(6, '0');
}

export default function MemberProfilePopup({ member, guildId, anchorRect, onClose, isBot = false }) {
    const { user: me } = useAuth();
    const members  = useMemberStore(s => s.byGuild[String(guildId)] || EMPTY_ARR);
    const upsert   = useMemberStore(s => s.upsertMember);
    const roles    = useRoleStore(s => s.byGuild[String(guildId)] || EMPTY_ARR);
    const statuses = usePresenceStore(s => s.statuses);
    const upsertDm = useDmStore(s => s.upsertDm);
    const navigate = useNavigate();

    const popupRef    = useRef(null);
    const [dmText, setDmText]       = useState('');
    const [dmSending, setDmSending] = useState(false);
    const [rolePickerOpen, setRolePicker] = useState(false);
    const [roleLoading, setRoleLoading]   = useState(null);

    const myMember = members.find(m => String(m.userId ?? m.id) === String(me?.id));
    const myPerms  = BigInt(myMember?.cachedGuildPermissions ?? 0);
    const canManageRoles = hasPerm(myPerms, 'MANAGE_ROLES');

    const uid     = String(member.userId ?? member.id);
    const status  = statuses[uid] || 'offline';
    const name    = member.user?.name || member.user?.username || uid;
    const username = member.user?.username || uid;

    const avatarSrc = member.avatarHash
        ? `/avatars/${member.avatarHash}`
        : member.user?.imageUrl || null;
    const initial = (name[0] || '?').toUpperCase();

    const memberRoleIds = new Set(member.roleIds || []);
    const everyoneId = String(guildId);
    const assignedRoles = roles.filter(r =>
        memberRoleIds.has(String(r.id)) && String(r.id) !== everyoneId
    );
    const unassignedRoles = roles.filter(r =>
        !memberRoleIds.has(String(r.id)) && !r.managed && String(r.id) !== everyoneId
    );

    /* Position popup near anchor, keep in viewport */
    const style = usePopupPosition(anchorRect);

    /* Close on outside click / Escape */
    useEffect(() => {
        function onKey(e) { if (e.key === 'Escape') onClose(); }
        function onDown(e) {
            if (popupRef.current && !popupRef.current.contains(e.target)) onClose();
        }
        document.addEventListener('keydown', onKey);
        document.addEventListener('mousedown', onDown);
        return () => {
            document.removeEventListener('keydown', onKey);
            document.removeEventListener('mousedown', onDown);
        };
    }, [onClose]);

    async function handleAddRole(roleId) {
        setRoleLoading(roleId);
        try {
            await addMemberRole(guildId, uid, roleId);
            upsert(guildId, { ...member, roleIds: [...(member.roleIds || []), String(roleId)] });
        } catch { /* ignore */ }
        setRoleLoading(null);
        setRolePicker(false);
    }

    async function handleRemoveRole(roleId) {
        setRoleLoading(roleId);
        try {
            await removeMemberRole(guildId, uid, roleId);
            upsert(guildId, { ...member, roleIds: (member.roleIds || []).filter(r => String(r) !== String(roleId)) });
        } catch { /* ignore */ }
        setRoleLoading(null);
    }

    async function handleSendDm(e) {
        e.preventDefault();
        if (!dmText.trim()) return;
        setDmSending(true);
        try {
            const dm = await openDm(uid);
            upsertDm(dm);
            await sendDmMessage(String(dm.id), { content: dmText.trim() });
            navigate(`/dashboard/tchatv2/dm/${dm.id}`);
            onClose();
        } catch { /* ignore */ }
        setDmSending(false);
    }

    const isSelf = String(uid) === String(me?.id);

    return createPortal(
        <div
            ref={popupRef}
            style={style}
            className="tv2-member-popup"
        >
            {/* Header: avatar + close */}
            <div className="tv2-mp-header">
                <div className="tv2-mp-avatar-wrap">
                    {avatarSrc
                        ? <img src={avatarSrc} alt={name} className="tv2-mp-avatar" />
                        : <span className="tv2-mp-avatar tv2-mp-avatar--initial">{initial}</span>
                    }
                    <span
                        className="tv2-mp-status-dot"
                        style={{ background: STATUS_COLOR[status] }}
                        title={STATUS_LABEL[status]}
                    />
                </div>
                <button className="tv2-icon-btn tv2-mp-close" onClick={onClose} aria-label="Fermer">
                    <X size={14} />
                </button>
            </div>

            {/* Identity */}
            <div className="tv2-mp-identity">
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span className="tv2-mp-name">{name}</span>
                    {isBot && <span className="tv2-tag">Webhook</span>}
                </div>
                <span className="tv2-mp-username">@{username}</span>
                {!isBot && <span className="tv2-mp-status-label">{STATUS_LABEL[status]}</span>}
            </div>

            {/* Roles — masqué pour les webhooks */}
            {!isBot && (
                <div className="tv2-mp-roles-section">
                    <div className="tv2-mp-section-label">Rangs</div>
                    <div className="tv2-mp-roles">
                        {assignedRoles.map(r => {
                            const removable = canManageRoles && !isSelf && !r.managed;
                            return (
                                <span
                                    key={r.id}
                                    className="tv2-mp-role-chip"
                                    style={{ borderColor: roleColor(r.color), color: roleColor(r.color) }}
                                    title={removable ? 'Clic pour retirer' : r.name}
                                    onClick={removable ? () => handleRemoveRole(r.id) : undefined}
                                    role={removable ? 'button' : undefined}
                                >
                                    {roleLoading === String(r.id) ? '…' : r.name}
                                </span>
                            );
                        })}

                        {canManageRoles && !isSelf && (
                            <div className="tv2-mp-role-add-wrap">
                                <button
                                    className="tv2-mp-role-add-btn"
                                    onClick={() => setRolePicker(v => !v)}
                                    aria-label="Ajouter un rang"
                                    title="Ajouter un rang"
                                >
                                    <Plus size={12} />
                                </button>
                                {rolePickerOpen && unassignedRoles.length > 0 && (
                                    <div className="tv2-mp-role-picker">
                                        {unassignedRoles.map(r => (
                                            <button
                                                key={r.id}
                                                className="tv2-mp-role-picker-item"
                                                style={{ color: roleColor(r.color) }}
                                                onClick={() => handleAddRole(r.id)}
                                                disabled={roleLoading === String(r.id)}
                                            >
                                                {roleLoading === String(r.id) ? '…' : r.name}
                                            </button>
                                        ))}
                                        {unassignedRoles.length === 0 && (
                                            <span className="tv2-mp-role-picker-empty">Aucun rang disponible</span>
                                        )}
                                    </div>
                                )}
                            </div>
                        )}

                        {assignedRoles.length === 0 && <span className="tv2-mp-no-role">Aucun rang</span>}
                    </div>
                </div>
            )}

            {/* DM — masqué pour les webhooks */}
            {!isBot && !isSelf && (
                <form className="tv2-mp-dm" onSubmit={handleSendDm}>
                    <div className="tv2-mp-section-label">Message direct</div>
                    <div className="tv2-mp-dm-row">
                        <input
                            className="tv2-mp-dm-input"
                            placeholder={`Envoyer un message à ${name}…`}
                            value={dmText}
                            onChange={e => setDmText(e.target.value)}
                            disabled={dmSending}
                            autoFocus
                        />
                        <button
                            type="submit"
                            className="tv2-mp-dm-send"
                            disabled={dmSending || !dmText.trim()}
                            aria-label="Envoyer"
                        >
                            <Send size={14} />
                        </button>
                    </div>
                </form>
            )}
        </div>,
        document.body
    );
}

function usePopupPosition(anchorRect) {
    if (!anchorRect) return { position: 'fixed', top: 100, right: 20 };

    const POPUP_W = 260;
    const POPUP_H = 340;
    const MARGIN  = 8;
    const vw = window.innerWidth;
    const vh = window.innerHeight;

    let left = anchorRect.left - POPUP_W - MARGIN;
    if (left < MARGIN) left = anchorRect.right + MARGIN;
    if (left + POPUP_W > vw - MARGIN) left = vw - POPUP_W - MARGIN;

    let top = anchorRect.top;
    if (top + POPUP_H > vh - MARGIN) top = vh - POPUP_H - MARGIN;
    if (top < MARGIN) top = MARGIN;

    return { position: 'fixed', top, left, zIndex: 9999 };
}
