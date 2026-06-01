import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Shield, X, Check, Minus } from 'lucide-react';
import { useRoleStore } from '../../stores/roleStore';
import { useMemberStore } from '../../stores/memberStore';
import { getChannelPermGroups, bitOf, bitsToString } from '../../lib/permissions';
import { upsertOverwrite, deleteOverwrite, fetchRoles } from '../../api/client';
import toast from 'react-hot-toast';

const EMPTY_ARR = [];

/* Tri-state: allow / neutral / deny — stored as (allow, deny) bitfields server-side. */
const STATES = ['neutral', 'allow', 'deny'];
const NEXT   = { neutral: 'allow', allow: 'deny', deny: 'neutral' };

function StateIcon({ state }) {
    if (state === 'allow') return <Check  size={14} />;
    if (state === 'deny')  return <X      size={14} />;
    return                       <Minus  size={14} />;
}

function PermRow({ name, label, desc, state, onCycle }) {
    return (
        <div className="tv2-perm-row">
            <div className="tv2-perm-info">
                <span className="tv2-perm-name">{label}</span>
                {desc && <span className="tv2-perm-desc">{desc}</span>}
            </div>
            <button
                type="button"
                className={`tv2-perm-tri is-${state}`}
                onClick={() => onCycle(name)}
                title={state}
            >
                <StateIcon state={state} />
            </button>
        </div>
    );
}

export default function ChannelPermissionsDrawer({ open, onClose, guildId, channel }) {
    const roles   = useRoleStore(s => s.byGuild[String(guildId)] || EMPTY_ARR);
    const setRoles= useRoleStore(s => s.setRoles);
    const members = useMemberStore(s => s.byGuild[String(guildId)] || EMPTY_ARR);
    const [target, setTarget] = useState(null);
    const [matrix, setMatrix] = useState({});

    useEffect(() => {
        if (!open || !guildId) return;
        if (roles.length === 0) {
            fetchRoles(guildId).then(rs => setRoles(guildId, rs)).catch(() => {});
        }
    }, [open, guildId, roles.length, setRoles]);

    useEffect(() => {
        if (!target || !channel) return;
        const typeInt = target.type === 'ROLE' ? 0 : 1;
        const ow = (channel.overwrites ?? []).find(o => String(o.targetId) === String(target.id) && o.type === typeInt);
        const allow = BigInt(ow?.allow ?? 0);
        const deny  = BigInt(ow?.deny  ?? 0);
        const m = {};
        getChannelPermGroups(channel?.type).flatMap(g => g.items).forEach(it => {
            const b = bitOf(it.flag);
            if ((allow & b) === b)      m[it.flag] = 'allow';
            else if ((deny & b) === b)  m[it.flag] = 'deny';
            else                        m[it.flag] = 'neutral';
        });
        setMatrix(m);
    }, [target?.id, target?.type, target, channel]);

    const cycle = (flag) => setMatrix(m => ({ ...m, [flag]: NEXT[m[flag] ?? 'neutral'] }));

    const save = async () => {
        if (!target || !channel) return;
        let allow = 0n, deny = 0n;
        for (const [flag, state] of Object.entries(matrix)) {
            const b = bitOf(flag);
            if (state === 'allow') allow |= b;
            if (state === 'deny')  deny  |= b;
        }
        try {
            await upsertOverwrite(guildId, channel.id, target.id, {
                type:  target.type,
                allow: bitsToString(allow),
                deny:  bitsToString(deny),
            });
            toast.success('Permissions enregistrées');
        } catch (e) {
            toast.error(e?.response?.data?.message ?? e?.message ?? 'Erreur lors de la sauvegarde');
        }
    };

    const removeOverwrite = async () => {
        if (!target || !channel) return;
        await deleteOverwrite(guildId, channel.id, target.id);
        setTarget(null);
    };

    if (!open) return null;

    return createPortal(
        <div className="tv2-drawer">
            <div className="tv2-drawer-head">
                <Shield size={16} />
                <div className="tv2-drawer-title">
                    {channel?.type === 4 ? 'Permissions de la catégorie' : 'Permissions du salon'}
                    <span className="tv2-drawer-sub">
                        {channel?.type === 4 ? channel?.name : `#${channel?.name}`}
                    </span>
                </div>
                <button className="tv2-icon-btn" onClick={onClose}><X size={16} /></button>
            </div>

            <div className="tv2-drawer-cols">
                <aside className="tv2-perm-targets">
                    <div className="tv2-perm-section">Rôles</div>
                    {roles.map(r => {
                        const active = target?.type === 'ROLE' && String(target?.id) === String(r.id);
                        return (
                            <button
                                key={r.id}
                                className={`tv2-perm-target ${active ? 'is-active' : ''}`}
                                onClick={() => setTarget({ type: 'ROLE', id: r.id, name: r.name, color: r.color })}
                            >
                                <span className="tv2-role-dot" style={{ background: r.color ? `#${r.color.toString(16).padStart(6, '0')}` : '#94a3b8' }} />
                                {r.name}
                            </button>
                        );
                    })}
                    <div className="tv2-perm-section">Membres</div>
                    {members.slice(0, 50).map(m => {
                        const active = target?.type === 'MEMBER' && String(target?.id) === String(m.userId ?? m.id);
                        return (
                            <button
                                key={m.userId ?? m.id}
                                className={`tv2-perm-target ${active ? 'is-active' : ''}`}
                                onClick={() => setTarget({ type: 'MEMBER', id: String(m.userId ?? m.id), name: m.nickname || m.user?.name || m.user?.username })}
                            >
                                {m.nickname || m.user?.name || m.user?.username || m.userId}
                            </button>
                        );
                    })}
                </aside>

                <main className="tv2-perm-main">
                    {!target ? (
                        <div className="tv2-empty">Sélectionnez un rôle ou un membre.</div>
                    ) : (
                        <>
                            <div className="tv2-perm-target-head">
                                <strong>{target.name}</strong>
                                <span className="tv2-tag">{target.type === 'ROLE' ? 'rôle' : 'membre'}</span>
                                <button className="tv2-link is-danger" onClick={removeOverwrite}>Réinitialiser</button>
                            </div>
                            {getChannelPermGroups(channel?.type).map(group => (
                                <section key={group.label} className="tv2-perm-group">
                                    <h4 className="tv2-perm-group-title">{group.label}</h4>
                                    {group.items.map(it => (
                                        <PermRow
                                            key={it.flag}
                                            name={it.flag}
                                            label={it.name}
                                            desc={it.desc}
                                            state={matrix[it.flag] ?? 'neutral'}
                                            onCycle={cycle}
                                        />
                                    ))}
                                </section>
                            ))}
                            <div className="tv2-perm-foot">
                                <button className="tv2-btn-ghost" onClick={() => setTarget(null)}>Fermer</button>
                                <button className="tv2-btn-solid" onClick={save}>Enregistrer</button>
                            </div>
                        </>
                    )}
                </main>
            </div>
        </div>,
        document.body
    );
}
