import React, { useEffect, useState, useCallback, useRef, Component } from 'react';
import { Routes, Route, useParams, useOutletContext } from 'react-router-dom';
import { useGuildStore } from '../stores/guildStore';
import { useChannelStore } from '../stores/channelStore';
import { fetchUserGuilds, fetchChannels, listSubscribedForumPosts } from '../api/client';
import { useForumPostSubStore } from '../stores/forumPostSubStore';
import { useV2Socket } from '../hooks/useV2Socket';
import { useChatHardRefresh } from '../hooks/useChatHardRefresh';
import { usePushNotifications } from '@/chat/hooks/usePushNotifications';
import CompanySidebar from '../components/sidebar/CompanySidebar';
import ChannelSidebar from '../components/sidebar/ChannelSidebar';
import DmSidebar from '../components/sidebar/DmSidebar';
import ChannelPage from './ChannelPage';
import DmPage from './DmPage';
import TchatV2Home from './TchatV2Home';
import '../styles/tchatv2.css';

class TchatErrorBoundary extends Component {
    constructor(props) { super(props); this.state = { error: null }; }
    static getDerivedStateFromError(err) { return { error: err }; }
    render() {
        if (this.state.error) {
            return (
                <div className="tv2-main" style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 12 }}>
                    <strong style={{ color: 'rgb(var(--chat-danger))' }}>Erreur de rendu tchatv2</strong>
                    <pre style={{ fontSize: 12, opacity: 0.7, whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>
                        {this.state.error?.message}
                    </pre>
                    <button className="tv2-btn-ghost" onClick={() => this.setState({ error: null })}>Réessayer</button>
                </div>
            );
        }
        return this.props.children;
    }
}

function useIsMobile(breakpoint = 768) {
    const [isMobile, setIsMobile] = useState(() =>
        typeof window !== 'undefined' && window.innerWidth <= breakpoint
    );
    useEffect(() => {
        const onResize = () => setIsMobile(window.innerWidth <= breakpoint);
        window.addEventListener('resize', onResize);
        return () => window.removeEventListener('resize', onResize);
    }, [breakpoint]);
    return isMobile;
}

function GuildLayout({ onOpenChannels, onOpenCompanies, isMobile }) {
    const { guildId }     = useParams();
    const setActiveGuild  = useGuildStore(s => s.setActiveGuildId);
    const setChannels     = useChannelStore(s => s.setChannels);

    useEffect(() => {
        if (!guildId) return;
        setActiveGuild(guildId);
        fetchChannels(guildId)
            .then(channels => setChannels(guildId, Array.isArray(channels) ? channels : []))
            .catch(() => {});
        listSubscribedForumPosts(guildId)
            .then(data => useForumPostSubStore.getState().setPosts(guildId, data.posts ?? []))
            .catch(() => {});
    }, [guildId, setActiveGuild, setChannels]);

    return (
        <Routes>
            <Route
                path="channels/:channelId"
                element={
                    <ChannelPage
                        guildId={guildId}
                        onOpenChannels={onOpenChannels}
                        onOpenCompanies={onOpenCompanies}
                        isMobile={isMobile}
                    />
                }
            />
            <Route index element={
                <div className="tv2-main">
                    {isMobile && (
                        <div className="tv2-header">
                            <button className="tv2-icon-btn tv2-hamburger" onClick={onOpenChannels} aria-label="Ouvrir les channels">
                                <HamburgerIcon />
                            </button>
                            <span className="tv2-header-title">Sélectionnez un channel</span>
                        </div>
                    )}
                    <div className="tv2-empty">Sélectionnez un channel</div>
                </div>
            } />
        </Routes>
    );
}

function HamburgerIcon() {
    return (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="3" y1="6"  x2="21" y2="6"  />
            <line x1="3" y1="12" x2="21" y2="12" />
            <line x1="3" y1="18" x2="21" y2="18" />
        </svg>
    );
}

export default function TchatV2Layout() {
    const { openMenu: openDashboard } = useOutletContext() ?? {};
    const setGuilds   = useGuildStore(s => s.setGuilds);
    const upsertGuild = useGuildStore(s => s.upsertGuild);
    useV2Socket();
    useChatHardRefresh();
    usePushNotifications('/api');

    const isMobile = useIsMobile();
    const [companyOpen, setCompanyOpen] = useState(false);
    const [channelsOpen, setChannelsOpen] = useState(false);

    useEffect(() => {
        fetchUserGuilds()
            .then(gs => setGuilds(Array.isArray(gs) ? gs : []))
            .catch(() => {});
    }, [setGuilds]);

    useEffect(() => {
        if (!isMobile) {
            setCompanyOpen(false);
            setChannelsOpen(false);
        }
    }, [isMobile]);

    const closeDrawers = useCallback(() => {
        setCompanyOpen(false);
        setChannelsOpen(false);
    }, []);

    // Opens both sidebars together — user can switch guild AND see channels in one tap
    const openChannels = useCallback(() => {
        setCompanyOpen(true);
        setChannelsOpen(true);
    }, []);
    const openCompanies = useCallback(() => setCompanyOpen(true), []);

    const showOverlay = isMobile && (companyOpen || channelsOpen);

    // Track open state in ref so swipe handler doesn't need it in deps
    const drawerOpenRef = useRef({ companyOpen, channelsOpen });
    drawerOpenRef.current = { companyOpen, channelsOpen };

    useEffect(() => {
        if (!isMobile) return;
        let startX = 0;
        let startY = 0;
        const onTouchStart = (e) => {
            startX = e.touches[0].clientX;
            startY = e.touches[0].clientY;
        };
        const onTouchEnd = (e) => {
            const dx = e.changedTouches[0].clientX - startX;
            const dy = Math.abs(e.changedTouches[0].clientY - startY);
            if (dy > Math.abs(dx) * 1.2) return; // vertical scroll, ignore
            if (startX < 24 && dx > 60) {
                setCompanyOpen(true);
                setChannelsOpen(true);
            } else if (dx < -80 && (drawerOpenRef.current.companyOpen || drawerOpenRef.current.channelsOpen)) {
                closeDrawers();
            }
        };
        document.addEventListener('touchstart', onTouchStart, { passive: true });
        document.addEventListener('touchend', onTouchEnd, { passive: true });
        return () => {
            document.removeEventListener('touchstart', onTouchStart);
            document.removeEventListener('touchend', onTouchEnd);
        };
    }, [isMobile, closeDrawers]);

    return (
        <TchatErrorBoundary>
        <div className="tv2-root">
            <CompanySidebar
                isOpen={!isMobile || companyOpen}
                onNavigate={closeDrawers}
            />

            <Routes>
                <Route
                    path="guilds/:guildId/*"
                    element={
                        <>
                            <ChannelSidebar
                                isOpen={!isMobile || channelsOpen}
                                companyOpen={companyOpen}
                                onNavigate={closeDrawers}
                                onOpenDashboard={isMobile ? openDashboard : undefined}
                            />
                            <GuildLayout
                                isMobile={isMobile}
                                onOpenChannels={openChannels}
                                onOpenCompanies={openCompanies}
                            />
                        </>
                    }
                />
                <Route
                    path="dm/*"
                    element={
                        <>
                            <DmSidebar
                                isOpen={!isMobile || channelsOpen}
                                companyOpen={companyOpen}
                                onNavigate={closeDrawers}
                                onOpenDashboard={isMobile ? openDashboard : undefined}
                            />
                            <Routes>
                                <Route
                                    path=":channelId"
                                    element={
                                        <DmPage
                                            isMobile={isMobile}
                                            onOpenChannels={openChannels}
                                        />
                                    }
                                />
                                <Route
                                    index
                                    element={
                                        <DmPage
                                            isMobile={isMobile}
                                            onOpenChannels={openChannels}
                                        />
                                    }
                                />
                            </Routes>
                        </>
                    }
                />
                <Route
                    index
                    element={
                        <TchatV2Home
                            onGuildCreated={upsertGuild}
                            isMobile={isMobile}
                            onOpenCompanies={openCompanies}
                        />
                    }
                />
            </Routes>

            <div
                className={`tv2-drawer-overlay${showOverlay ? ' is-open' : ''}`}
                onClick={closeDrawers}
                aria-hidden="true"
            />
        </div>
        </TchatErrorBoundary>
    );
}
