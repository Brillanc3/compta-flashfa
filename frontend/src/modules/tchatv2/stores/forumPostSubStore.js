import { create } from 'zustand';

export const useForumPostSubStore = create((set, get) => ({
    byGuild: {},

    setPosts: (guildId, posts) =>
        set(s => ({ byGuild: { ...s.byGuild, [String(guildId)]: posts } })),

    addPost: (guildId, post) =>
        set(s => {
            const key = String(guildId);
            const existing = s.byGuild[key] ?? [];
            if (existing.some(p => String(p.id) === String(post.id))) return s;
            return { byGuild: { ...s.byGuild, [key]: [post, ...existing] } };
        }),

    removePost: (guildId, threadId) =>
        set(s => {
            const key = String(guildId);
            return {
                byGuild: {
                    ...s.byGuild,
                    [key]: (s.byGuild[key] ?? []).filter(p => String(p.id) !== String(threadId)),
                },
            };
        }),

    getPostsForForum: (guildId, forumChannelId) => {
        const posts = get().byGuild[String(guildId)] ?? [];
        return posts.filter(p => String(p.parentId) === String(forumChannelId));
    },
}));
