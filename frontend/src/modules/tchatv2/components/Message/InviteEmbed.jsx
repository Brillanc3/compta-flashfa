import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Users } from 'lucide-react';
import { fetchInviteByCode, joinInvite } from '../../api/client';
import { useGuildStore } from '../../stores/guildStore';

const INVITE_RE = /(?:https?:\/\/)?(?:www\.)?jipeg-corporation\.eu\/invite\/([A-Za-z0-9_-]+)/g;

export function extractInviteCodes(content) {
    if (!content) return [];
    const codes = [];
    const re = new RegExp(INVITE_RE.source, 'g');
    let m;
    while ((m = re.exec(content)) !== null) {
        if (!codes.includes(m[1])) codes.push(m[1]);
    }
    return codes;
}

function InviteCard({ code }) {
    const navigate = useNavigate();
    const guilds   = useGuildStore(s => s.guilds);
    const [invite, setInvite]   = useState(null);
    const [status, setStatus]   = useState('loading'); // loading | ready | expired | invalid | joining | joined
    const [error, setError]     = useState('');

    useEffect(() => {
        fetchInviteByCode(code)
            .then(data => {
                setInvite(data);
                const alreadyMember = data?.guild?.id != null &&
                    guilds.some(g => String(g.id) === String(data.guild.id));
                setStatus(alreadyMember ? 'joined' : 'ready');
            })
            .catch(err => {
                const s = err?.response?.status;
                setStatus(s === 410 ? 'expired' : s === 404 ? 'invalid' : 'ready');
                if (s !== 410 && s !== 404) setError(err?.response?.data?.message ?? 'Erreur');
            });
    }, [code, guilds]);

    const handleJoin = async () => {
        setStatus('joining');
        try {
            const guild = await joinInvite(code);
            setStatus('joined');
            navigate(`/dashboard/tchatv2/guilds/${guild.id}`);
        } catch (err) {
            setStatus('ready');
            setError(err?.response?.data?.message ?? 'Impossible de rejoindre');
        }
    };

    const guildName = invite?.guild?.name ?? 'Serveur inconnu';
    const channelName = invite?.channel?.name;
    const inviterName = invite?.inviter?.user?.name ?? invite?.inviter?.username;
    const memberCount = invite?.guild?.approximateMemberCount ?? invite?.guild?._count?.members ?? null;

    return (
        <div className="tv2-invite-embed">
            <div className="tv2-invite-embed-label">Vous avez été invité à rejoindre</div>
            <div className="tv2-invite-embed-body">
                <div className="tv2-invite-embed-icon" aria-hidden="true">
                    {guildName[0]?.toUpperCase() ?? '?'}
                </div>
                <div className="tv2-invite-embed-info">
                    <div className="tv2-invite-embed-guild">{guildName}</div>
                    <div className="tv2-invite-embed-meta">
                        {channelName && <span>#{channelName}</span>}
                        {channelName && inviterName && <span className="tv2-invite-embed-sep">·</span>}
                        {inviterName && <span>Invité par {inviterName}</span>}
                        {memberCount != null && (
                            <>
                                <span className="tv2-invite-embed-sep">·</span>
                                <span className="tv2-invite-embed-members"><Users size={11} /> {memberCount}</span>
                            </>
                        )}
                    </div>
                    {(status === 'expired' || status === 'invalid') && (
                        <div className="tv2-invite-embed-expired">
                            {status === 'expired' ? 'Invitation expirée' : 'Invitation invalide'}
                        </div>
                    )}
                    {error && <div className="tv2-invite-embed-expired">{error}</div>}
                </div>
                {status !== 'expired' && status !== 'invalid' && (
                    <button
                        className={`tv2-invite-embed-btn${status === 'joined' ? ' is-joined' : ''}`}
                        onClick={status === 'joined' ? undefined : handleJoin}
                        disabled={status === 'loading' || status === 'joining' || status === 'joined'}
                    >
                        {status === 'joining' ? 'Connexion…' : status === 'joined' ? 'Rejoint !' : 'Rejoindre'}
                    </button>
                )}
            </div>
        </div>
    );
}

export default function InviteEmbed({ content }) {
    const codes = extractInviteCodes(content);
    if (codes.length === 0) return null;
    return (
        <>
            {codes.map(code => <InviteCard key={code} code={code} />)}
        </>
    );
}
