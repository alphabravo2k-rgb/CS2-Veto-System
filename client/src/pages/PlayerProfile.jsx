import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { motion } from 'framer-motion';

const API = import.meta.env.VITE_SOCKET_URL?.replace(/\/$/, '') || 'http://localhost:3001';

const REGION_LABELS = { EU: '🇪🇺 Europe', NA: '🌎 North America', SEA: '🌏 Southeast Asia', ME: '🌍 Middle East', Faceit: '🎯 Faceit' };
const PLATFORM_ICONS = { steam: '🎮', riot: '⚡', epic: '🎯', faceit: '🔥' };

export default function PlayerProfile() {
    const { userId } = useParams();
    const [profile, setProfile] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error,   setError]   = useState('');

    useEffect(() => {
        fetch(`${API}/api/players/${userId}`)
            .then(r => { if (!r.ok) throw new Error('Player not found'); return r.json(); })
            .then(setProfile)
            .catch(e => setError(e.message))
            .finally(() => setLoading(false));
    }, [userId]);

    if (loading) return <div className="profile-loading"><span className="spinner" /></div>;
    if (error)   return <div className="profile-error">❌ {error}</div>;

    return (
        <div className="profile-page">
            <div className="profile-bg" />
            <motion.div className="profile-card" initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }}>
                {/* Avatar + identity */}
                <div className="profile-header">
                    <div className="avatar-ring">
                        {profile.avatar_url ? (
                            <img src={profile.avatar_url} alt="avatar" className="profile-avatar" />
                        ) : (
                            <div className="avatar-placeholder">
                                {(profile.username || 'U').charAt(0).toUpperCase()}
                            </div>
                        )}
                    </div>
                    <div className="profile-identity">
                        <h1 className="profile-display-name">{profile.display_name || profile.username}</h1>
                        <p className="profile-username">@{profile.username}</p>
                        <div className="profile-badges">
                            {profile.country && <span className="badge">{profile.country}</span>}
                            {profile.server_region && <span className="badge badge-blue">{REGION_LABELS[profile.server_region] || profile.server_region}</span>}
                        </div>
                    </div>
                </div>

                {/* Bio */}
                {profile.bio && (
                    <div className="profile-bio">
                        <p>{profile.bio}</p>
                    </div>
                )}

                {/* Linked accounts */}
                {profile.linkedAccounts && profile.linkedAccounts.length > 0 && (
                    <div className="profile-section">
                        <h3 className="section-label">Linked Accounts</h3>
                        <div className="linked-accounts">
                            {profile.linkedAccounts.map(acc => (
                                <div key={acc.platform} className="linked-account">
                                    <span className="platform-icon">{PLATFORM_ICONS[acc.platform] || '🔗'}</span>
                                    <div>
                                        <span className="platform-name">{acc.platform.charAt(0).toUpperCase() + acc.platform.slice(1)}</span>
                                        {acc.platform_username && <span className="platform-username"> — {acc.platform_username}</span>}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* Member since */}
                <div className="profile-footer">
                    <span className="member-since">Member since {new Date(profile.created_at).toLocaleDateString('en-US', { year: 'numeric', month: 'long' })}</span>
                </div>
            </motion.div>

            <style>{`
                .profile-page { min-height:100vh; background:#050a14; display:flex; align-items:flex-start; justify-content:center; padding:48px 20px; font-family:'Inter',sans-serif; position:relative; }
                .profile-bg { position:absolute; inset:0; background-image:linear-gradient(rgba(0,212,255,0.03) 1px,transparent 1px),linear-gradient(90deg,rgba(0,212,255,0.03) 1px,transparent 1px); background-size:40px 40px; }
                .profile-loading, .profile-error { min-height:100vh; display:flex; align-items:center; justify-content:center; color:#ff6b6b; font-family:'Inter',sans-serif; }
                .spinner { width:32px; height:32px; border:3px solid rgba(0,212,255,0.2); border-top-color:#00d4ff; border-radius:50%; animation:spin .7s linear infinite; }
                @keyframes spin { to { transform:rotate(360deg); } }
                .profile-card { position:relative; z-index:1; background:rgba(255,255,255,0.03); border:1px solid rgba(0,212,255,0.15); border-radius:20px; width:100%; max-width:480px; overflow:hidden; }
                .profile-header { display:flex; align-items:flex-start; gap:20px; padding:32px 32px 0; }
                .avatar-ring { border-radius:50%; padding:3px; background:linear-gradient(135deg,#00d4ff,#0077cc); }
                .profile-avatar { width:80px; height:80px; border-radius:50%; object-fit:cover; display:block; border:2px solid #050a14; }
                .avatar-placeholder { width:80px; height:80px; border-radius:50%; background:rgba(0,212,255,0.15); display:flex; align-items:center; justify-content:center; font-size:32px; font-weight:800; color:#00d4ff; border:2px solid #050a14; }
                .profile-identity { flex:1; padding-top:4px; }
                .profile-display-name { font-size:22px; font-weight:800; color:#fff; margin:0 0 4px; }
                .profile-username { color:#3d5070; font-size:14px; margin:0 0 10px; }
                .profile-badges { display:flex; gap:8px; flex-wrap:wrap; }
                .badge { background:rgba(255,255,255,0.06); border:1px solid rgba(255,255,255,0.1); color:#8fa3c7; border-radius:20px; padding:3px 12px; font-size:12px; font-weight:600; }
                .badge-blue { background:rgba(0,212,255,0.08); border-color:rgba(0,212,255,0.2); color:#00d4ff; }
                .profile-bio { padding:20px 32px; color:#8fa3c7; font-size:14px; line-height:1.6; border-top:1px solid rgba(255,255,255,0.06); margin-top:20px; }
                .profile-bio p { margin:0; }
                .profile-section { padding:20px 32px; border-top:1px solid rgba(255,255,255,0.06); }
                .section-label { font-size:11px; font-weight:700; color:#3d5070; text-transform:uppercase; letter-spacing:1px; margin:0 0 14px; }
                .linked-accounts { display:flex; flex-direction:column; gap:10px; }
                .linked-account { display:flex; align-items:center; gap:12px; background:rgba(255,255,255,0.03); border-radius:10px; padding:10px 14px; }
                .platform-icon { font-size:18px; }
                .platform-name { font-size:13px; font-weight:700; color:#fff; }
                .platform-username { font-size:13px; color:#6b7fa3; }
                .profile-footer { padding:20px 32px; border-top:1px solid rgba(255,255,255,0.06); }
                .member-since { font-size:12px; color:#3d5070; }
            `}</style>
        </div>
    );
}
