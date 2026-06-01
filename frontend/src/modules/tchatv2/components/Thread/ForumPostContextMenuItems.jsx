import React from 'react';
import { Check, BellOff, Bell, Link, BellMinus, FolderOpen, Unlock, Pin, Trash2, Fingerprint } from 'lucide-react';
import { LEVEL, useNotifSettingsStore } from '../../stores/notifSettingsStore';

const MUTE_DURATIONS = [
    { label: '15 minutes', ms: 15 * 60_000 },
    { label: '1 heure',    ms: 60 * 60_000 },
    { label: '3 heures',   ms: 3  * 60 * 60_000 },
    { label: '8 heures',   ms: 8  * 60 * 60_000 },
    { label: '24 heures',  ms: 24 * 60 * 60_000 },
];

const LEVEL_LABELS = [
    { value: LEVEL.ALL_MESSAGES,  label: 'Tous les messages' },
    { value: LEVEL.MENTIONS_ONLY, label: 'Mentions seulement' },
    { value: LEVEL.NONE,          label: 'Aucun message' },
];

export function buildForumPostContextItems({
    thread,
    guildId,
    hasUnread,
    canManage,
    onMarkRead,
    onUnfollow,
    onOpen,
    onToggleLock,
    onCopyLink,
    onTogglePin,
    onDelete,
    onCopyThreadId,
}) {
    const settings = useNotifSettingsStore.getState().getSettings(thread.id);
    const { level, isMuted } = settings;
    const isLocked = !!thread.threadMetadata?.locked;
    const isPinned = !!thread.threadMetadata?.pinned;

    const updateSettings = (body) =>
        useNotifSettingsStore.getState().update(guildId, thread.id, body);

    const muteSubmenu = [
        ...MUTE_DURATIONS.map(d => ({
            text:   `Pendant ${d.label}`,
            action: () => updateSettings({ muteDurationMs: d.ms }),
        })),
        {
            text:   "Jusqu'à ce que je le change",
            action: () => updateSettings({ muteForever: true }),
        },
        ...(isMuted ? [
            { type: 'separator' },
            { text: 'Réactiver les notifications', action: () => updateSettings({ unmute: true }) },
        ] : []),
    ];

    const notifSubmenu = LEVEL_LABELS.map(l => ({
        text:   l.label,
        active: level === l.value,
        icon:   level === l.value ? <Check size={14} /> : null,
        action: () => updateSettings({ level: l.value }),
    }));

    const items = [
        {
            icon:     <Check size={14} />,
            text:     'Marquer comme lu',
            disabled: !hasUnread,
            action:   onMarkRead,
        },
        {
            icon:   <BellMinus size={14} />,
            text:   'Ne plus suivre le post',
            action: onUnfollow,
        },
        {
            icon:   <FolderOpen size={14} />,
            text:   'Ouvrir le post',
            action: onOpen,
        },
        ...(canManage && isLocked ? [{
            icon:   <Unlock size={14} />,
            text:   'Déverrouiller le post',
            action: onToggleLock,
        }] : []),
        {
            icon:   <Link size={14} />,
            text:   'Copier le lien',
            action: onCopyLink,
        },
        {
            icon:    isMuted ? <BellOff size={14} /> : <Bell size={14} />,
            text:    isMuted ? 'Post muet (modifier)' : 'Rendre le post muet',
            submenu: muteSubmenu,
        },
        {
            icon:    <Bell size={14} />,
            text:    'Paramètres de notification',
            submenu: notifSubmenu,
        },
    ];

    if (canManage) {
        items.push(
            { type: 'separator' },
            {
                icon:   <Pin size={14} />,
                text:   isPinned ? 'Désépingler le post' : 'Épingler le post',
                action: onTogglePin,
            },
            {
                icon:   <Trash2 size={14} />,
                text:   'Supprimer le post',
                danger: true,
                action: onDelete,
            },
        );
    }

    items.push(
        { type: 'separator' },
        {
            icon:   <Fingerprint size={14} />,
            text:   "Copier l'identifiant du fil",
            action: onCopyThreadId,
        },
    );

    return items;
}
