'use strict';

// Valeurs canoniques Discord (BigInt)
const Permission = Object.freeze({
    CREATE_INSTANT_INVITE:      1n << 0n,
    KICK_MEMBERS:               1n << 1n,
    BAN_MEMBERS:                1n << 2n,
    ADMINISTRATOR:              1n << 3n,
    MANAGE_CHANNELS:            1n << 4n,
    MANAGE_GUILD:               1n << 5n,
    ADD_REACTIONS:              1n << 6n,
    VIEW_AUDIT_LOG:             1n << 7n,
    PRIORITY_SPEAKER:           1n << 8n,
    STREAM:                     1n << 9n,
    VIEW_CHANNEL:               1n << 10n,
    SEND_MESSAGES:              1n << 11n,
    SEND_TTS_MESSAGES:          1n << 12n,
    MANAGE_MESSAGES:            1n << 13n,
    EMBED_LINKS:                1n << 14n,
    ATTACH_FILES:               1n << 15n,
    READ_MESSAGE_HISTORY:       1n << 16n,
    MENTION_EVERYONE:           1n << 17n,
    USE_EXTERNAL_EMOJIS:        1n << 18n,
    VIEW_GUILD_INSIGHTS:        1n << 19n,
    CONNECT:                    1n << 20n,
    SPEAK:                      1n << 21n,
    MUTE_MEMBERS:               1n << 22n,
    DEAFEN_MEMBERS:             1n << 23n,
    MOVE_MEMBERS:               1n << 24n,
    USE_VAD:                    1n << 25n,
    CHANGE_NICKNAME:            1n << 26n,
    MANAGE_NICKNAMES:           1n << 27n,
    MANAGE_ROLES:               1n << 28n,
    MANAGE_WEBHOOKS:            1n << 29n,
    MANAGE_EMOJIS_AND_STICKERS: 1n << 30n,
    USE_APPLICATION_COMMANDS:   1n << 31n,
    REQUEST_TO_SPEAK:           1n << 32n,
    MANAGE_EVENTS:              1n << 33n,
    MANAGE_THREADS:             1n << 34n,
    CREATE_PUBLIC_THREADS:      1n << 35n,
    CREATE_PRIVATE_THREADS:     1n << 36n,
    USE_EXTERNAL_STICKERS:      1n << 37n,
    SEND_MESSAGES_IN_THREADS:   1n << 38n,
    USE_EMBEDDED_ACTIVITIES:    1n << 39n,
    MODERATE_MEMBERS:           1n << 40n,
});

const ChannelType = Object.freeze({
    GUILD_TEXT:        0,
    DM:                1,
    GUILD_VOICE:       2,
    GROUP_DM:          3,
    GUILD_CATEGORY:    4,
    GUILD_ANNOUNCEMENT:5,
    ANNOUNCEMENT_THREAD: 10,
    PUBLIC_THREAD:     11,
    PRIVATE_THREAD:    12,
    GUILD_STAGE_VOICE: 13,
    GUILD_DIRECTORY:   14,
    GUILD_FORUM:       15,
});

const MessageType = Object.freeze({
    DEFAULT:                              0,
    RECIPIENT_ADD:                        1,
    RECIPIENT_REMOVE:                     2,
    CALL:                                 3,
    CHANNEL_NAME_CHANGE:                  4,
    CHANNEL_ICON_CHANGE:                  5,
    CHANNEL_PINNED_MESSAGE:               6,
    USER_JOIN:                            7,
    GUILD_BOOST:                          8,
    GUILD_BOOST_TIER_1:                   9,
    GUILD_BOOST_TIER_2:                   10,
    GUILD_BOOST_TIER_3:                   11,
    CHANNEL_FOLLOW_ADD:                   12,
    GUILD_DISCOVERY_DISQUALIFIED:         14,
    GUILD_DISCOVERY_REQUALIFIED:          15,
    GUILD_DISCOVERY_GRACE_PERIOD_INITIAL_WARNING: 16,
    GUILD_DISCOVERY_GRACE_PERIOD_FINAL_WARNING:   17,
    THREAD_CREATED:                       18,
    REPLY:                                19,
    CHAT_INPUT_COMMAND:                   20,
    THREAD_STARTER_MESSAGE:               21,
    GUILD_INVITE_REMINDER:                22,
    CONTEXT_MENU_COMMAND:                 23,
    AUTO_MODERATION_ACTION:               24,
});

const OverwriteType = Object.freeze({
    ROLE:   0,
    MEMBER: 1,
});

const MentionType = Object.freeze({
    USER:     'USER',
    ROLE:     'ROLE',
    CHANNEL:  'CHANNEL',
    EVERYONE: 'EVERYONE',
    HERE:     'HERE',
});

const AuditLogActionType = Object.freeze({
    GUILD_UPDATE:              1,
    CHANNEL_CREATE:            10,
    CHANNEL_UPDATE:            11,
    CHANNEL_DELETE:            12,
    CHANNEL_OVERWRITE_CREATE:  13,
    CHANNEL_OVERWRITE_UPDATE:  14,
    CHANNEL_OVERWRITE_DELETE:  15,
    MEMBER_KICK:               20,
    MEMBER_PRUNE:              21,
    MEMBER_BAN_ADD:            22,
    MEMBER_BAN_REMOVE:         23,
    MEMBER_UPDATE:             24,
    MEMBER_ROLE_UPDATE:        25,
    MEMBER_MOVE:               26,
    MEMBER_DISCONNECT:         27,
    BOT_ADD:                   28,
    ROLE_CREATE:               30,
    ROLE_UPDATE:               31,
    ROLE_DELETE:               32,
    INVITE_CREATE:             40,
    INVITE_UPDATE:             41,
    INVITE_DELETE:             42,
    WEBHOOK_CREATE:            50,
    WEBHOOK_UPDATE:            51,
    WEBHOOK_DELETE:            52,
    MESSAGE_DELETE:            72,
    MESSAGE_BULK_DELETE:       73,
    MESSAGE_PIN:               74,
    MESSAGE_UNPIN:             75,
    THREAD_CREATE:             110,
    THREAD_UPDATE:             111,
    THREAD_DELETE:             112,
    TIMEOUT:                   24,
});

/**
 * @param {bigint} perms permission bitfield actuel
 * @param {bigint} flag  flag à vérifier
 * @returns {boolean}
 */
function hasPermission(perms, flag) {
    const p = BigInt(perms);
    const f = BigInt(flag);
    if ((p & Permission.ADMINISTRATOR) === Permission.ADMINISTRATOR) return true;
    return (p & f) === f;
}

/**
 * @param {...bigint} flags
 * @returns {bigint}
 */
function combinePermissions(...flags) {
    return flags.reduce((acc, f) => acc | BigInt(f), 0n);
}

module.exports = {
    Permission,
    ChannelType,
    MessageType,
    OverwriteType,
    MentionType,
    AuditLogActionType,
    hasPermission,
    combinePermissions,
};
