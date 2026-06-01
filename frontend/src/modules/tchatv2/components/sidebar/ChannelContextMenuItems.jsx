import React from 'react';
import { Check, Link, BellOff, Bell, Settings, Link2, Webhook, Fingerprint, Trash2, FolderMinus } from 'lucide-react';
import { LEVEL, MUTE_FOREVER, useNotifSettingsStore } from '../../stores/notifSettingsStore';

const MUTE_DURATIONS = [
    { label: '15 minutes', ms: 15 * 60_000 },
    { label: '1 heure',    ms: 60 * 60_000 },
    { label: '3 heures',   ms: 3  * 60 * 60_000 },
    { label: '8 heures',   ms: 8  * 60 * 60_000 },
    { label: '24 heures',  ms: 24 * 60 * 60_000 },
];

const LEVEL_LABELS = [
    { value: LEVEL.DEFAULT,       label: 'Utiliser la catégorie par défaut' },
    { value: LEVEL.ALL_MESSAGES,  label: 'Tous les messages' },
    { value: LEVEL.MENTIONS_ONLY, label: '@mentions seulement' },
    { value: LEVEL.NONE,          label: 'Aucun message' },
];

export function buildChannelContextItems({
    channel,
    guildId,
    hasUnread,
    onMarkRead,
    onCopyLink,
    onOpenSettings,
    onInvite,
    onWebhook,
    onCopyId,
    onDelete,
    onRemoveFromCategory,
    canManage,
}) {
    const settings = useNotifSettingsStore.getState().getSettings(channel.id);
    const { level, isMuted } = settings;
    const updateSettings = (body) =>
        useNotifSettingsStore.getState().update(guildId, channel.id, body);

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
            icon:   <Link size={14} />,
            text:   'Copier le lien',
            action: onCopyLink,
        },
        {
            icon:    isMuted ? <BellOff size={14} /> : <Bell size={14} />,
            text:    isMuted ? 'Salon muet (modifier)' : 'Rendre le salon muet',
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
            { icon: <Settings size={14} />,     text: 'Paramètres',          action: onOpenSettings },
            { icon: <Link2 size={14} />,         text: 'Inviter des membres', action: onInvite },
            { icon: <Webhook size={14} />,       text: 'Gérer les webhooks',  action: onWebhook },
        );
        if (channel.parentId) {
            items.push(
                { type: 'separator' },
                { icon: <FolderMinus size={14} />, text: 'Retirer de la catégorie', action: onRemoveFromCategory },
            );
        }
        items.push(
            { type: 'separator' },
            { icon: <Fingerprint size={14} />,   text: "Copier l'ID",         action: onCopyId },
            { type: 'separator' },
            { icon: <Trash2 size={14} />,        text: 'Supprimer le salon',  danger: true, action: onDelete },
        );
    } else {
        items.push(
            { type: 'separator' },
            { icon: <Fingerprint size={14} />, text: "Copier l'ID", action: onCopyId },
        );
    }

    return items;
}

export { MUTE_FOREVER };
