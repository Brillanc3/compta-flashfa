import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { fetchInviteByCode, joinInvite } from '../api/client';

export default function InviteAcceptPage() {
    const { code } = useParams();
    const navigate = useNavigate();
    const { user, isLoading: authLoading } = useAuth();

    const [invite, setInvite]   = useState(null);
    const [status, setStatus]   = useState('loading'); // loading | ready | expired | invalid | joining | error
    const [errorMsg, setErrorMsg] = useState('');

    useEffect(() => {
        if (authLoading) return;
        if (!user) {
            navigate(`/login?redirect=/invite/${code}`, { replace: true });
            return;
        }
        fetchInviteByCode(code)
            .then(data => {
                setInvite(data);
                setStatus('ready');
            })
            .catch(err => {
                const code410 = err?.response?.status === 410;
                const code404 = err?.response?.status === 404;
                if (code410) {
                    setStatus('expired');
                } else if (code404) {
                    setStatus('invalid');
                } else {
                    setStatus('error');
                    setErrorMsg(err?.response?.data?.message ?? 'Erreur inconnue');
                }
            });
    }, [code, user, authLoading, navigate]);

    const handleJoin = async () => {
        setStatus('joining');
        try {
            const guild = await joinInvite(code);
            navigate(`/dashboard/tchatv2/guilds/${guild.id}`, { replace: true });
        } catch (err) {
            setStatus('error');
            setErrorMsg(err?.response?.data?.message ?? 'Impossible de rejoindre le serveur');
        }
    };

    if (authLoading || status === 'loading') {
        return (
            <div style={styles.page}>
                <div style={styles.card}>
                    <p style={styles.text}>Chargement…</p>
                </div>
            </div>
        );
    }

    if (status === 'expired') {
        return (
            <div style={styles.page}>
                <div style={styles.card}>
                    <h2 style={styles.title}>Invitation expirée</h2>
                    <p style={styles.text}>Ce lien d'invitation n'est plus valide.</p>
                    <button style={styles.btnSecondary} onClick={() => navigate('/')}>
                        Retour à l'accueil
                    </button>
                </div>
            </div>
        );
    }

    if (status === 'invalid') {
        return (
            <div style={styles.page}>
                <div style={styles.card}>
                    <h2 style={styles.title}>Invitation invalide</h2>
                    <p style={styles.text}>Ce lien d'invitation n'existe pas.</p>
                    <button style={styles.btnSecondary} onClick={() => navigate('/')}>
                        Retour à l'accueil
                    </button>
                </div>
            </div>
        );
    }

    if (status === 'error') {
        return (
            <div style={styles.page}>
                <div style={styles.card}>
                    <h2 style={styles.title}>Erreur</h2>
                    <p style={styles.text}>{errorMsg}</p>
                    <button style={styles.btnSecondary} onClick={() => navigate('/')}>
                        Retour à l'accueil
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div style={styles.page}>
            <div style={styles.card}>
                <p style={styles.label}>Vous avez été invité à rejoindre</p>
                <h2 style={styles.guildName}>{invite?.guild?.name ?? 'Serveur inconnu'}</h2>
                {invite?.channel?.name && (
                    <p style={styles.channelName}>#{invite.channel.name}</p>
                )}
                {invite?.inviter?.username && (
                    <p style={styles.inviterText}>
                        Invité par <strong>{invite.inviter.username}</strong>
                    </p>
                )}
                {invite?.maxUses > 0 && (
                    <p style={styles.metaText}>
                        {invite.uses} / {invite.maxUses} utilisations
                    </p>
                )}
                <button
                    style={status === 'joining' ? { ...styles.btnPrimary, opacity: 0.7 } : styles.btnPrimary}
                    onClick={handleJoin}
                    disabled={status === 'joining'}
                >
                    {status === 'joining' ? 'Connexion…' : 'Rejoindre le serveur'}
                </button>
                <button style={styles.btnSecondary} onClick={() => navigate('/')}>
                    Annuler
                </button>
            </div>
        </div>
    );
}

const styles = {
    page: {
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#1a1b1e',
        fontFamily: 'sans-serif',
    },
    card: {
        background: '#2b2d31',
        borderRadius: '12px',
        padding: '40px 48px',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: '12px',
        minWidth: '320px',
        maxWidth: '440px',
        width: '100%',
        boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
    },
    label: {
        color: '#b5bac1',
        fontSize: '13px',
        margin: 0,
        textTransform: 'uppercase',
        letterSpacing: '0.06em',
    },
    guildName: {
        color: '#f2f3f5',
        fontSize: '22px',
        fontWeight: 700,
        margin: 0,
        textAlign: 'center',
    },
    channelName: {
        color: '#949ba4',
        fontSize: '14px',
        margin: 0,
    },
    inviterText: {
        color: '#949ba4',
        fontSize: '13px',
        margin: 0,
    },
    metaText: {
        color: '#72767d',
        fontSize: '12px',
        margin: 0,
    },
    text: {
        color: '#b5bac1',
        fontSize: '14px',
        margin: 0,
        textAlign: 'center',
    },
    title: {
        color: '#f2f3f5',
        fontSize: '20px',
        fontWeight: 700,
        margin: 0,
    },
    btnPrimary: {
        marginTop: '8px',
        width: '100%',
        padding: '12px 0',
        background: '#5865f2',
        color: '#fff',
        border: 'none',
        borderRadius: '8px',
        fontSize: '15px',
        fontWeight: 600,
        cursor: 'pointer',
    },
    btnSecondary: {
        width: '100%',
        padding: '10px 0',
        background: 'transparent',
        color: '#b5bac1',
        border: '1px solid #4e5058',
        borderRadius: '8px',
        fontSize: '14px',
        cursor: 'pointer',
    },
};
