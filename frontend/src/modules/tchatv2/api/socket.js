import { io } from 'socket.io-client';

let socket = null;
let _activeChannelId = null;
let _activeGuildId   = null;

export function getSocket() {
    return socket;
}

export function connectSocket(token, { onConnect, onDisconnect, onError } = {}) {
    if (socket?.connected) return socket;

    socket = io('/v2', {
        path: '/socket.io/v2',
        auth: { token },
        transports: ['websocket'],
        reconnection: true,
        reconnectionDelay: 1000,
        reconnectionAttempts: Infinity,
    });

    socket.on('connect', () => {
        // Re-focus active channel after any reconnect (server loses room state)
        if (_activeChannelId) {
            socket.emit('CHANNEL_FOCUS', {
                channelId: _activeChannelId,
                ...(_activeGuildId ? { guildId: _activeGuildId } : {}),
            });
        }
        onConnect?.();
    });

    socket.on('disconnect', () => {
        onDisconnect?.();
    });

    socket.on('connect_error', (err) => {
        if (err.message === 'AUTH_FAILED') {
            onError?.('auth');
        }
    });

    return socket;
}

export function disconnectSocket() {
    socket?.disconnect();
    socket = null;
    _activeChannelId = null;
    _activeGuildId   = null;
}

/* Helpers to focus / blur a channel room */
export function focusChannel(channelId, guildId) {
    _activeChannelId = String(channelId);
    _activeGuildId   = guildId ? String(guildId) : null;
    socket?.emit('CHANNEL_FOCUS', { channelId: String(channelId), guildId: guildId ? String(guildId) : undefined });
}

export function focusDmChannel(channelId) {
    _activeChannelId = String(channelId);
    _activeGuildId   = null;
    socket?.emit('CHANNEL_FOCUS', { channelId: String(channelId) });
}

export function blurChannel(channelId) {
    if (_activeChannelId === String(channelId)) {
        _activeChannelId = null;
        _activeGuildId   = null;
    }
    socket?.emit('CHANNEL_BLUR', { channelId: String(channelId) });
}

export function emitTyping(channelId, guildId) {
    if (!guildId) return; // backend exige guildId pour les channels de guilde
    socket?.emit('TYPING_START', {
        channelId: String(channelId),
        guildId:   String(guildId),
    });
}
