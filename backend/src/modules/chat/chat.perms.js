// backend/src/modules/chat/chat.permissions.js
'use strict';

const { ChatPermissionFlags } = require('./chat.permissionResolver');

/**
 * Permissions Chat — catalog utilisé par le frontend.
 */
const PERMISSIONS = {
    VIEW_CHANNEL: {
        key: 'VIEW_CHANNEL',
        bit: ChatPermissionFlags.VIEW_CHANNEL,
        label: 'Voir le salon',
        description: "Autorise la visibilité du salon et la lecture de l'historique.",
    },
    SEND_MESSAGES: {
        key: 'SEND_MESSAGES',
        bit: ChatPermissionFlags.SEND_MESSAGES,
        label: 'Envoyer des messages',
        description: "Autorise l'envoi de messages dans ce salon.",
    },
    SEND_ATTACHMENTS: {
        key: 'SEND_ATTACHMENTS',
        bit: ChatPermissionFlags.SEND_ATTACHMENTS,
        label: 'Envoyer des fichiers',
        description: "Autorise l'envoi de pièces jointes.",
    },
    MANAGE_MESSAGES: {
        key: 'MANAGE_MESSAGES',
        bit: ChatPermissionFlags.MANAGE_MESSAGES,
        label: 'Gérer les messages',
        description: 'Permet de modifier ou supprimer les messages des autres.',
    },
    MANAGE_CHANNEL: {
        key: 'MANAGE_CHANNEL',
        bit: ChatPermissionFlags.MANAGE_CHANNEL,
        label: 'Gérer le salon',
        description: 'Permet de modifier le salon et ses permissions.',
    },
    ADD_MEMBERS: {
        key: 'ADD_MEMBERS',
        bit: ChatPermissionFlags.ADD_MEMBERS,
        label: 'Ajouter des membres',
        description: "Permet d'ajouter des membres au salon.",
    },
    REMOVE_MEMBERS: {
        key: 'REMOVE_MEMBERS',
        bit: ChatPermissionFlags.REMOVE_MEMBERS,
        label: 'Retirer des membres',
        description: 'Permet de retirer des membres du salon.',
    },
    PIN_MESSAGES: {
        key: 'PIN_MESSAGES',
        bit: ChatPermissionFlags.PIN_MESSAGES,
        label: 'Épingler des messages',
        description: "Permet d'épingler des messages dans le salon.",
    },
    MENTION_EVERYONE: {
        key: 'MENTION_EVERYONE',
        bit: ChatPermissionFlags.MENTION_EVERYONE,
        label: 'Mentionner @everyone',
        description: "Permet d'envoyer des notifications à tout le monde.",
    },
    MANAGE_CATEGORY_CHANNELS: {
        key: 'MANAGE_CATEGORY_CHANNELS',
        bit: ChatPermissionFlags.MANAGE_CATEGORY_CHANNELS,
        label: 'Gérer les salons de la catégorie',
        description: "Permet de créer, modifier et supprimer des salons dans cette catégorie.",
    },
};

const HIERARCHY = {
    SEND_MESSAGES: ['VIEW_CHANNEL'],
    SEND_ATTACHMENTS: ['VIEW_CHANNEL', 'SEND_MESSAGES'],
    MANAGE_MESSAGES: ['VIEW_CHANNEL', 'SEND_MESSAGES'],
    MANAGE_CHANNEL: ['VIEW_CHANNEL'],
    MANAGE_CATEGORY_CHANNELS: ['VIEW_CHANNEL'],
};

module.exports = { PERMISSIONS, HIERARCHY };
