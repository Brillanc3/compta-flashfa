import React, { useEffect, useState } from 'react';
import { Plus, Trash2, Lock } from 'lucide-react';
import { useRoleStore } from '../../stores/roleStore';
import { fetchRoles, createRole, updateRole, deleteRole } from '../../api/client';
import { PERMISSION_GROUPS, bitOf, bitsToString, hasPerm } from '../../lib/permissions';
import ConfirmModal from '../Modal/ConfirmModal';

const EMPTY_ARR = [];
const COLOR_PRESETS = [
    0x99aab5, 0x1abc9c, 0x2ecc71, 0x3498db, 0x9b59b6, 0xe91e63,
    0xf1c40f, 0xe67e22, 0xe74c3c, 0x95a5a6, 0x607d8b, 0x000000,
];
function hex(c) { return '#' + (c ?? 0).toString(16).padStart(6, '0'); }

export default function RoleManager({ guildId, variant = 'settings' }) {
    const roles    = useRoleStore(s => s.byGuild[String(guildId)] || EMPTY_ARR);
    const setRoles = useRoleStore(s => s.setRoles);
    const upsert   = useRoleStore(s => s.upsertRole);
    const remove   = useRoleStore(s => s.removeRole);
    const [selectedId, setSel] = useState(null);
    const [delConfirm, setDel] = useState(false);

    useEffect(() => {
        if (!guildId) return;
        fetchRoles(guildId).then(rs => {
            setRoles(guildId, rs);
            if (rs.length > 0 && !selectedId) setSel(String(rs[0].id));
        }).catch(() => {});
    }, [guildId, selectedId, setRoles]);

    const role = roles.find(r => String(r.id) === String(selectedId)) ?? null;
    const bits = role ? BigInt(role.permissions ?? 0) : 0n;

    const onCreate = async () => {
        const r = await createRole(guildId, { name: 'nouveau-rôle', color: 0x99aab5 });
        upsert(guildId, r);
        setSel(String(r.id));
    };
    const onSaveField = async (patch) => {
        if (!role) return;
        const r = await updateRole(guildId, role.id, patch);
        upsert(guildId, r);
    };
    const toggleFlag = async (flag) => {
        if (!role) return;
        const b = bitOf(flag);
        const next = ((bits & b) === b) ? (bits & ~b) : (bits | b);
        const r = await updateRole(guildId, role.id, { permissions: bitsToString(next) });
        upsert(guildId, r);
    };
    const onDelete = async () => {
        if (!role) return;
        await deleteRole(guildId, role.id);
        remove(guildId, role.id);
        setSel(roles.find(r => r.id !== role.id)?.id ?? null);
        setDel(false);
    };

    const rootClass = variant === 'drawer' ? 'tv2-drawer-cols' : 'tv2-settings-roles';
    const listClass = variant === 'drawer' ? 'tv2-role-list'   : 'tv2-settings-roles-list';
    const mainClass = variant === 'drawer' ? 'tv2-perm-main'    : 'tv2-settings-roles-main';

    return (
        <div className={rootClass}>
            <aside className={listClass}>
                <button className="tv2-role-add" onClick={onCreate}>
                    <Plus size={14} /> Nouveau rôle
                </button>

                {roles.filter(r => String(r.id) === String(guildId)).map(r => (
                    <button key={r.id}
                        className={`tv2-role-row${String(selectedId) === String(r.id) ? ' is-active' : ''}`}
                        onClick={() => setSel(String(r.id))}>
                        <span className="tv2-role-dot" style={{ background: hex(r.color) }} />
                        <span className="tv2-role-name">{r.name}</span>
                    </button>
                ))}

                {roles.some(r => r.managed && String(r.id) !== String(guildId)) && (
                    <div className="tv2-perm-section">Rangs société</div>
                )}
                {roles.filter(r => r.managed && String(r.id) !== String(guildId)).map(r => (
                    <button key={r.id}
                        className={`tv2-role-row${String(selectedId) === String(r.id) ? ' is-active' : ''}`}
                        onClick={() => setSel(String(r.id))}>
                        <span className="tv2-role-dot" style={{ background: hex(r.color) }} />
                        <span className="tv2-role-name">{r.name}</span>
                        <Lock size={12} className="tv2-role-lock" />
                    </button>
                ))}

                {roles.some(r => !r.managed && String(r.id) !== String(guildId)) && (
                    <div className="tv2-perm-section">Rangs personnalisés</div>
                )}
                {roles.filter(r => !r.managed && String(r.id) !== String(guildId)).map(r => (
                    <button key={r.id}
                        className={`tv2-role-row${String(selectedId) === String(r.id) ? ' is-active' : ''}`}
                        onClick={() => setSel(String(r.id))}>
                        <span className="tv2-role-dot" style={{ background: hex(r.color) }} />
                        <span className="tv2-role-name">{r.name}</span>
                        {hasPerm(r.permissions, 'ADMINISTRATOR') && <span className="tv2-tag is-danger">admin</span>}
                    </button>
                ))}
            </aside>

            <main className={mainClass}>
                {!role ? (
                    <div className="tv2-empty">Sélectionnez un rôle.</div>
                ) : (
                    <>
                        <div className="tv2-role-head">
                            <label className="tv2-label">
                                <span>Nom du rôle</span>
                                <input className="tv2-input" value={role.name}
                                    onChange={e => upsert(guildId, { ...role, name: e.target.value })}
                                    onBlur={e => onSaveField({ name: e.target.value.trim() || role.name })} />
                            </label>
                            <label className="tv2-label">
                                <span>Couleur</span>
                                <div className="tv2-color-grid">
                                    {COLOR_PRESETS.map(c => (
                                        <button key={c} type="button"
                                            className={`tv2-color-chip${role.color === c ? ' is-active' : ''}`}
                                            style={{ background: hex(c) }}
                                            onClick={() => onSaveField({ color: c })} />
                                    ))}
                                </div>
                            </label>
                            <label className="tv2-check">
                                <input type="checkbox" checked={!!role.hoist}
                                    onChange={e => onSaveField({ hoist: e.target.checked })} />
                                <span><strong>Afficher séparément</strong><em>Hoist dans la liste des membres.</em></span>
                            </label>
                            <label className="tv2-check">
                                <input type="checkbox" checked={!!role.mentionable}
                                    onChange={e => onSaveField({ mentionable: e.target.checked })} />
                                <span><strong>Mentionnable</strong><em>Autorise @{role.name}.</em></span>
                            </label>
                        </div>

                        <h4 className="tv2-perm-group-title">Permissions</h4>
                        {PERMISSION_GROUPS.map(group => (
                            <section key={group.label} className="tv2-perm-group">
                                <h5 className="tv2-perm-subtitle">{group.label}</h5>
                                {group.items.map(it => {
                                    const on = (bits & bitOf(it.flag)) === bitOf(it.flag);
                                    return (
                                        <label key={it.flag} className="tv2-perm-row is-toggle">
                                            <div className="tv2-perm-info">
                                                <span className="tv2-perm-name">{it.name}</span>
                                                {it.desc && <span className="tv2-perm-desc">{it.desc}</span>}
                                            </div>
                                            <span className={`tv2-switch${on ? ' is-on' : ''}`}
                                                onClick={() => toggleFlag(it.flag)}>
                                                <span className="tv2-switch-knob" />
                                            </span>
                                        </label>
                                    );
                                })}
                            </section>
                        ))}

                        <div className="tv2-perm-foot">
                            {!role?.managed && String(role?.id) !== String(guildId) && (
                                <button className="tv2-btn-danger" onClick={() => setDel(true)}>
                                    <Trash2 size={14} /> Supprimer le rôle
                                </button>
                            )}
                            {(role?.managed || String(role?.id) === String(guildId)) && (
                                <p className="tv2-perm-managed-notice">
                                    <Lock size={12} />
                                    {role?.managed ? 'Rang géré par la société — non supprimable' : '@everyone — non supprimable'}
                                </p>
                            )}
                        </div>
                    </>
                )}
            </main>

            <ConfirmModal open={delConfirm} onClose={() => setDel(false)} onConfirm={onDelete}
                title={`Supprimer le rôle « ${role?.name} » ?`}
                body="Le rôle sera retiré de tous les membres." />
        </div>
    );
}
