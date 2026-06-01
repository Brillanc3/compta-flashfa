import React, { useState, useMemo } from "react";
import {
    getPermissionCatalog,
    getConversationRankOverrides,
    getConversationUserOverrides,
    setConversationRankOverride,
    setConversationUserOverride,
} from "@/services/chatService";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { X, ChevronRight, ArrowLeft } from "lucide-react";
import { useChat } from "@/contexts/ChatContext";
import toast from "react-hot-toast";
import apiClient from "@/services/api";

/* ------------------------------------------------------
   Switch (allow / deny / neutral)
------------------------------------------------------ */
const Switch = ({ state, onChange }) => (
    <div className="flex items-center gap-1">
        <button
            className={`px-2 py-1 text-xs rounded border ${
                state === "allow"
                    ? "bg-green-600 border-green-400"
                    : "border-slate-600 hover:bg-slate-700"
            }`}
            onClick={() => onChange("allow")}
        >
            ✓
        </button>

        <button
            className={`px-2 py-1 text-xs rounded border ${
                state === "deny"
                    ? "bg-red-600 border-red-400"
                    : "border-slate-600 hover:bg-slate-700"
            }`}
            onClick={() => onChange("deny")}
        >
            ✕
        </button>

        <button
            className={`px-2 py-1 text-xs rounded border ${
                state === "neutral"
                    ? "bg-slate-700 border-slate-500"
                    : "border-slate-600 hover:bg-slate-700"
            }`}
            onClick={() => onChange("neutral")}
        >
            •
        </button>
    </div>
);

/* ------------------------------------------------------
   Main Drawer Component
------------------------------------------------------ */
const ChatPermissionsDrawer = ({ isOpen, onClose, conversation }) => {
    const { canManagePermissions } = useChat();
    const queryClient = useQueryClient();
    const conversationId = conversation?.id;

    /* ----------------------------------------------
       INTERNAL MINI-ROUTER (2 views)
    ---------------------------------------------- */
    const [view, setView] = useState("list"); // "list" | "rank" | "user"
    const [selectedRankId, setSelectedRankId] = useState(null);
    const [selectedUserId, setSelectedUserId] = useState(null);

    const openRankView = (id) => {
        setSelectedRankId(id);
        setSelectedUserId(null);
        setView("rank");
    };

    const openUserView = (id) => {
        setSelectedRankId(null);
        setSelectedUserId(id);
        setView("user");
    };

    const backToList = () => {
        setView("list");
        setSelectedRankId(null);
        setSelectedUserId(null);
    };

    /* ----------------------------------------------
       DATA: permissions catalog, overrides, employees
    ---------------------------------------------- */
    const { data: catalog = [] } = useQuery({
        queryKey: ["chat", "permissionCatalog"],
        queryFn: getPermissionCatalog,
        enabled: isOpen,
    });

    const { data: rankOverrides = [] } = useQuery({
        queryKey: ["chat", "rankOverrides", conversationId],
        queryFn: () => getConversationRankOverrides(conversationId),
        enabled: isOpen,
    });

    const { data: userOverrides = [] } = useQuery({
        queryKey: ["chat", "userOverrides", conversationId],
        queryFn: () => getConversationUserOverrides(conversationId),
        enabled: isOpen,
    });

    const { data: employeesData } = useQuery({
        queryKey: ["company", "employeesForChat"],
        queryFn: async () => {
            const res = await apiClient.get("/employees/users-for-chat");
            return res.data; // { users, ranks }
        },
        enabled: isOpen,
    });

    const users = employeesData?.users ?? [];
    const ranks = employeesData?.ranks ?? [];

    /* ----------------------------------------------
       GROUPED PERMISSIONS
    ---------------------------------------------- */
    const groupedCatalog = useMemo(() => {
        const g = {};
        catalog.forEach((p) => {
            if (!g[p.category]) g[p.category] = [];
            g[p.category].push(p);
        });
        return g;
    }, [catalog]);

    /* ----------------------------------------------
       MUTATIONS
    ---------------------------------------------- */
    const upsertRankOverride = useMutation({
        mutationFn: ({ rankId, allow, deny }) =>
            setConversationRankOverride({ conversationId, rankId, allow, deny }),
        onSuccess: () => {
            queryClient.invalidateQueries(["chat", "rankOverrides", conversationId]);
            toast.success("Permissions du rang mises à jour.");
        },
    });

    const upsertUserOverride = useMutation({
        mutationFn: ({ userId, allow, deny }) =>
            setConversationUserOverride({ conversationId, userId, allow, deny }),
        onSuccess: () => {
            queryClient.invalidateQueries(["chat", "userOverrides", conversationId]);
            toast.success("Permissions utilisateur mises à jour.");
        },
    });

    /* ----------------------------------------------
       DRAWER CLOSED
    ---------------------------------------------- */
    if (!isOpen) return null;

    /* ----------------------------------------------
       PERMISSION CHECK
    ---------------------------------------------- */
    if (!canManagePermissions) {
        return (
            <div className="fixed inset-0 z-40 flex">
                <div className="flex-1 bg-black/40" onClick={onClose} />
                <div className="w-[420px] bg-slate-950 p-4 border-l border-slate-800">
                    <div className="flex justify-between items-center">
                        <h2 className="font-semibold">Accès refusé</h2>
                        <button onClick={onClose}><X /></button>
                    </div>
                    <p className="mt-2 text-sm text-slate-400">
                        Vous n’avez pas la permission de modifier ce salon.
                    </p>
                </div>
            </div>
        );
    }

    /* ===================================================================================
       VIEW 1 : LISTE RANGS + UTILISATEURS
    =================================================================================== */
    const renderListView = () => {
        const rankIds = rankOverrides.map((ov) => ov.rankId);
        const userIds = userOverrides.map((ov) => ov.userId);

        return (
            <>
                <div className="text-xs uppercase text-slate-500 mb-3">Permissions du salon</div>
                <h2 className="font-semibold mb-4">#{conversation?.title}</h2>

                {/* RANGS */}
                <div className="mb-5">
                    <div className="font-semibold text-sm mb-2">Rangs</div>

                    {rankIds.length === 0 && (
                        <div className="text-sm text-slate-500 mb-2">Aucun rang</div>
                    )}

                    {rankIds.map((rid) => {
                        const r = ranks.find((rk) => rk.id === rid);
                        return (
                            <div
                                key={rid}
                                className="flex justify-between items-center px-3 py-2 bg-slate-900 hover:bg-slate-800 rounded cursor-pointer mb-1"
                                onClick={() => openRankView(Number(rid))}
                            >
                                <span>{r?.name || `Rang #${rid}`}</span>
                                <ChevronRight className="w-4 h-4 opacity-60" />
                            </div>
                        );
                    })}

                    {/* Bouton Ajouter */}
                    <button
                        className="mt-2 text-sm px-3 py-2 bg-slate-800 hover:bg-slate-700 rounded w-full text-left"
                        onClick={() => {
                            // On ouvre la vue de sélection
                            setView("addRank");
                        }}
                    >
                        + Ajouter un rang
                    </button>
                </div>

                {/* UTILISATEURS */}
                <div className="mb-5">
                    <div className="font-semibold text-sm mb-2">Utilisateurs</div>

                    {userIds.length === 0 && (
                        <div className="text-sm text-slate-500 mb-2">Aucun utilisateur</div>
                    )}

                    {userIds.map((uid) => {
                        const u = users.find((x) => x.userId === uid);
                        return (
                            <div
                                key={uid}
                                className="flex justify-between items-center px-3 py-2 bg-slate-900 hover:bg-slate-800 rounded cursor-pointer mb-1"
                                onClick={() => openUserView(uid)}
                            >
                                <span>{u?.fullName || `User #${uid}`}</span>
                                <ChevronRight className="w-4 h-4 opacity-60" />
                            </div>
                        );
                    })}

                    {/* Bouton Ajouter */}
                    <button
                        className="mt-2 text-sm px-3 py-2 bg-slate-800 hover:bg-slate-700 rounded w-full text-left"
                        onClick={() => {
                            setView("addUser");
                        }}
                    >
                        + Ajouter un utilisateur
                    </button>
                </div>
            </>
        );
    };

    /* ===================================================================================
       VIEW 2 : PERMISSIONS POUR UN RANG
    =================================================================================== */
    const renderRankView = () => {
        const ov = rankOverrides.find((x) => x.rankId === selectedRankId);
        const rank = ranks.find((x) => x.id === selectedRankId);

        if (!ov) return null;

        const allow = new Set(ov.allow);
        const deny = new Set(ov.deny);

        return (
            <>
                {/* HEADER */}
                <div className="flex items-center gap-2 mb-4">
                    <button onClick={backToList}>
                        <ArrowLeft />
                    </button>
                    <h2 className="font-semibold">
                        Permissions du rang : {rank?.name}
                    </h2>
                </div>

                {/* PERMISSIONS */}
                <div className="flex-1 overflow-y-auto space-y-4">
                    {Object.entries(groupedCatalog).map(([cat, perms]) => (
                        <div key={cat} className="border border-slate-800 rounded">
                            <div className="px-3 py-2 bg-slate-900 font-semibold text-xs uppercase">
                                {cat}
                            </div>

                            <div className="p-3 space-y-3">
                                {perms.map((perm) => {
                                    let state = "neutral";
                                    if (allow.has(perm.action)) state = "allow";
                                    else if (deny.has(perm.action)) state = "deny";

                                    return (
                                        <div key={perm.id}>
                                            <div className="flex justify-between items-center">
                                                <div className="text-sm">{perm.action}</div>
                                                <Switch
                                                    state={state}
                                                    onChange={(newState) => {
                                                        if (newState === "allow") {
                                                            allow.add(perm.action);
                                                            deny.delete(perm.action);
                                                        } else if (newState === "deny") {
                                                            deny.add(perm.action);
                                                            allow.delete(perm.action);
                                                        } else {
                                                            allow.delete(perm.action);
                                                            deny.delete(perm.action);
                                                        }

                                                        upsertRankOverride.mutate({
                                                            rankId: Number(selectedRankId),
                                                            allow: [...allow],
                                                            deny: [...deny],
                                                        });
                                                    }}
                                                />
                                            </div>
                                            <div className="text-xs text-slate-500 mt-1">
                                                {perm.description}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    ))}
                </div>
            </>
        );
    };

    /* ===================================================================================
       VIEW 3 : PERMISSIONS POUR UN UTILISATEUR
    =================================================================================== */
    const renderUserView = () => {
        const ov = userOverrides.find((x) => x.userId === selectedUserId);
        const usr = users.find((x) => x.userId === selectedUserId);

        if (!ov) return null;

        const allow = new Set(ov.allow);
        const deny = new Set(ov.deny);

        return (
            <>
                {/* HEADER */}
                <div className="flex items-center gap-2 mb-4">
                    <button onClick={backToList}>
                        <ArrowLeft />
                    </button>
                    <h2 className="font-semibold">
                        Permissions utilisateur : {usr?.fullName}
                    </h2>
                </div>

                {/* PERMISSIONS */}
                <div className="flex-1 overflow-y-auto space-y-4">
                    {Object.entries(groupedCatalog).map(([cat, perms]) => (
                        <div key={cat} className="border border-slate-800 rounded">
                            <div className="px-3 py-2 bg-slate-900 font-semibold text-xs uppercase">
                                {cat}
                            </div>

                            <div className="p-3 space-y-3">
                                {perms.map((perm) => {
                                    let state = "neutral";
                                    if (allow.has(perm.action)) state = "allow";
                                    else if (deny.has(perm.action)) state = "deny";

                                    return (
                                        <div key={perm.id}>
                                            <div className="flex justify-between items-center">
                                                <div className="text-sm">{perm.action}</div>
                                                <Switch
                                                    state={state}
                                                    onChange={(newState) => {
                                                        if (newState === "allow") {
                                                            allow.add(perm.action);
                                                            deny.delete(perm.action);
                                                        } else if (newState === "deny") {
                                                            deny.add(perm.action);
                                                            allow.delete(perm.action);
                                                        } else {
                                                            allow.delete(perm.action);
                                                            deny.delete(perm.action);
                                                        }

                                                        upsertUserOverride.mutate({
                                                            userId: Number(selectedUserId),
                                                            allow: [...allow],
                                                            deny: [...deny],
                                                        });
                                                    }}
                                                />
                                            </div>
                                            <div className="text-xs text-slate-500 mt-1">
                                                {perm.description}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    ))}
                </div>
            </>
        );
    };

    /* ===================================================================================
       VIEW SELECT RANK + SELECT USER (Ajouter)
    =================================================================================== */
    const renderAddRankView = () => (
        <>
            <div className="flex items-center gap-2 mb-4">
                <button onClick={backToList}><ArrowLeft /></button>
                <h2 className="font-semibold">Ajouter un rang</h2>
            </div>

            {ranks.map((r) => (
                <div
                    key={r.id}
                    className="px-3 py-2 bg-slate-900 hover:bg-slate-800 rounded cursor-pointer mb-2"
                    onClick={() => {
                        upsertRankOverride.mutate({
                            rankId: Number(r.id),
                            allow: [],
                            deny: [],
                        });
                        backToList();
                    }}
                >
                    {r.name}
                </div>
            ))}
        </>
    );

    const renderAddUserView = () => (
        <>
            <div className="flex items-center gap-2 mb-4">
                <button onClick={backToList}><ArrowLeft /></button>
                <h2 className="font-semibold">Ajouter un utilisateur</h2>
            </div>

            {users.map((u) => (
                <div
                    key={u.userId}
                    className="px-3 py-2 bg-slate-900 hover:bg-slate-800 rounded cursor-pointer mb-2"
                    onClick={() => {
                        upsertUserOverride.mutate({
                            userId: Number(u.userId),
                            allow: [],
                            deny: [],
                        });
                        backToList();
                    }}
                >
                    {u.fullName}
                </div>
            ))}
        </>
    );

    /* ===================================================================================
       FINAL RENDERED UI
    =================================================================================== */
    return (
        <div className="fixed inset-0 z-40 flex">
            <div className="flex-1 bg-black/40" onClick={onClose} />

            <div className="w-[520px] bg-slate-950 border-l border-slate-800 p-4 flex flex-col text-slate-100">

                {/* TOP CLOSE BUTTON */}
                <div className="flex justify-end mb-2">
                    <button onClick={onClose}><X /></button>
                </div>

                {/* ROUTER */}
                {view === "list" && renderListView()}
                {view === "rank" && renderRankView()}
                {view === "user" && renderUserView()}
                {view === "addRank" && renderAddRankView()}
                {view === "addUser" && renderAddUserView()}

            </div>
        </div>
    );
};

export default ChatPermissionsDrawer;
