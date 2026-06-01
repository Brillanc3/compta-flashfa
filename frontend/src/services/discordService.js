// frontend/src/services/discordService.js
import apiClient from './api';

export const getDiscordConfig = async () => {
    const res = await apiClient.get('/discord/config');
    return { config: res.data.data, clientId: res.data.clientId ?? null };
};

export const saveDiscordConfig = async (payload) => {
    const res = await apiClient.post('/discord/config', payload);
    return res.data.data;
};

export const deleteDiscordConfig = async () => {
    const res = await apiClient.delete('/discord/config');
    return res.data;
};

export const getGuildRoles = async (guildId = null) => {
    const params = guildId ? { guildId } : {};
    const res = await apiClient.get('/discord/guild-roles', { params });
    return res.data.roles;
};

export const verifyBot = async (guildId) => {
    const res = await apiClient.post('/discord/verify-bot', { guildId });
    return { inGuild: res.data.inGuild, guild: res.data.guild ?? null };
};

export const syncAllDiscord = async () => {
    const res = await apiClient.post('/discord/sync');
    return res.data;
};
