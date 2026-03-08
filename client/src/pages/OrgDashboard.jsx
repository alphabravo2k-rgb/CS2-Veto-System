import React, { useEffect, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import useAuthStore from '../store/useAuthStore';
import useOrgBranding from '../hooks/useOrgBranding';

const API = import.meta.env.VITE_SOCKET_URL?.replace(/\/$/, '') || 'http://localhost:3001';

export default function OrgDashboard() {
    const { orgId } = useParams();
    const navigate = useNavigate();
    const { authFetch, user } = useAuthStore();
    useOrgBranding(orgId);

    const [org,         setOrg]         = useState(null);
    const [tournaments, setTournaments] = useState([]);
    const [members,     setMembers]     = useState([]);
    const [tab,         setTab]         = useState('tournaments');
    const [loading,     setLoading]     = useState(true);
    const [error,       setError]       = useState('');

    // Branding edit state
    const [editBranding, setEditBranding] = useState(false);
    const [branding, setBranding] = useState({ displayName: '', primaryColor: '#00d4ff', secondaryColor: '#0a0f1e', logoUrl: '' });
    const [savingBrand, setSavingBrand] = useState(false);

    useEffect(() => {
        (async () => {
            try {
                const [orgRes, tRes] = await Promise.all([
                    fetch(`${API}/api/orgs/${orgId}`),
                    fetch(`${API}/api/orgs/${orgId}/tournaments`),
                ]);
                if (!orgRes.ok) throw new Error('Organization not found');
                const orgData = await orgRes.json();
                const tData   = tRes.ok ? await tRes.json() : [];
                setOrg(orgData);
                setTournaments(tData);
                if (orgData.branding) {
                    setBranding({
                        displayName:     orgData.branding.display_name || orgData.name || '',
                        primaryColor:    orgData.branding.primary_color || '#00d4ff',
                        secondaryColor:  orgData.branding.secondary_color || '#0a0f1e',
                        logoUrl:         orgData.branding.logo_url || '',
                    });
                }
            } catch (e) {
                setError(e.message);
            } finally {
                setLoading(false);
            }
        })();
    }, [orgId]);

    const loadMembers = async () => {
        try {
            const res = await authFetch(`/api/orgs/${orgId}/members`);
            if (res.ok) setMembers(await res.json());
        } catch {}
    };

    useEffect(() => {
        if (tab === 'members') loadMembers();
    }, [tab]);

    const saveBranding = async () => {
        setSavingBrand(true);
        try {
            const res = await authFetch(`/api/orgs/${orgId}/branding`, {
                method: 'PATCH',
                body: JSON.stringify(branding),
            });
            if (!res.ok) throw new Error((await res.json()).error);
            const updated = await res.json();
            setOrg(updated);
            setEditBranding(false);
            window.location.reload(); // Re-apply CSS vars
        } catch (e) {
            alert(e.message);
        } finally {
            setSavingBrand(false);
        }
    };

    const createTournament = async () => {
        const name = window.prompt('Tournament name:');
        if (!name) return;
        const res = await authFetch(`/api/orgs/${orgId}/tournaments`, {
            method: 'POST',
            body: JSON.stringify({ name, defaultFormat: 'bo3', gameModule: 'cs2' }),
        });
        if (res.ok) {
            const t = await res.json();
            setTournaments(ts => [t, ...ts]);
        }
    };

    const primaryColor = org?.branding?.primary_color || '#00d4ff';

    if (loading) return <div className="org-loading"><span className="spinner" /></div>;
    if (error)   return <div className="org-error">❌ {error} — <Link to="/">Home</Link></div>;

    return (
        <div className="org-page">
            {/* Banner */}
            <div className="org-banner" style={{ background: `linear-gradient(135deg, ${primaryColor}22, #050a1400)`, borderBottom: `1px solid ${primaryColor}30` }}>
                <div className="org-banner-inner">
                    <div className="org-header-left">
                        {org.branding?.logo_url ? (
                            <img src={org.branding.logo_url} alt="org logo" className="org-logo" />
                        ) : (
                            <div className="org-logo-placeholder" style={{ background: primaryColor }}>
                                {(org.name || 'O').charAt(0).toUpperCase()}
                            </div>
                        )}
                        <div>
                            <h1 className="org-name" style={{ color: primaryColor }}>{org.branding?.display_name || org.name}</h1>
                            <p className="org-id">/{orgId}</p>
                        </div>
                    </div>
                    <div className="org-header-right">
                        <button className="btn-brand" style={{ background: primaryColor }} onClick={() => setEditBranding(true)}>
                            🎨 Customize
                        </button>
                        <Link to={`/org/${orgId}/tournament`} className="btn-brand-outline" style={{ borderColor: primaryColor, color: primaryColor }}>
                            + New Match
                        </Link>
                    </div>
                </div>
            </div>

            <div className="org-body">
                {/* Tab nav */}
                <div className="tab-nav">
                    {['tournaments', 'members'].map(t => (
                        <button key={t} className={`tab-btn ${tab === t ? 'active' : ''}`} style={{ '--accent': primaryColor }} onClick={() => setTab(t)}>
                            {t.charAt(0).toUpperCase() + t.slice(1)}
                        </button>
                    ))}
                </div>

                {/* Tab content */}
                <motion.div key={tab} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.2 }}>
                    {tab === 'tournaments' && (
                        <div className="panel">
                            <div className="panel-header">
                                <h2 className="panel-title">Tournaments</h2>
                                <button className="btn-sm" style={{ background: primaryColor }} onClick={createTournament}>+ New Tournament</button>
                            </div>
                            {tournaments.length === 0 ? (
                                <div className="empty-state">No tournaments yet. Create one to get started.</div>
                            ) : (
                                <div className="tournament-grid">
                                    {tournaments.map(t => (
                                        <motion.div
                                            key={t.id}
                                            className="tournament-card"
                                            style={{ '--accent': primaryColor }}
                                            whileHover={{ y: -3 }}
                                            onClick={() => navigate(`/org/${orgId}/tournament/${t.id}`)}
                                        >
                                            <div className="t-badge" style={{ background: `${primaryColor}20`, color: primaryColor }}>
                                                {t.game_module?.toUpperCase() || 'CS2'}
                                            </div>
                                            <h3 className="t-name">{t.name}</h3>
                                            <div className="t-meta">
                                                <span className="t-format">{t.defaultFormat?.toUpperCase()}</span>
                                                <span className={`t-status status-${t.status || 'active'}`}>{t.status || 'active'}</span>
                                            </div>
                                        </motion.div>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}

                    {tab === 'members' && (
                        <div className="panel">
                            <div className="panel-header">
                                <h2 className="panel-title">Members</h2>
                            </div>
                            {members.length === 0 ? (
                                <div className="empty-state">No members loaded or you are not an admin.</div>
                            ) : (
                                <div className="members-list">
                                    {members.map(m => (
                                        <div key={m.id} className="member-row">
                                            <div className="member-avatar" style={{ background: primaryColor }}>
                                                {(m.username || 'U').charAt(0).toUpperCase()}
                                            </div>
                                            <div className="member-info">
                                                <span className="member-name">{m.display_name || m.username}</span>
                                                <span className="member-handle">@{m.username}</span>
                                            </div>
                                            <span className={`role-badge role-${m.role}`}>{m.role}</span>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}
                </motion.div>
            </div>

            {/* Branding modal */}
            {editBranding && (
                <div className="modal-overlay" onClick={() => setEditBranding(false)}>
                    <div className="modal-card" onClick={e => e.stopPropagation()}>
                        <h2 className="modal-title">Customize Branding</h2>
                        <div className="form-fields">
                            <div className="form-group"><label>Display Name</label><input type="text" value={branding.displayName} onChange={e => setBranding(b => ({ ...b, displayName: e.target.value }))} /></div>
                            <div className="form-group"><label>Primary Color</label><div style={{ display: 'flex', gap: 10 }}><input type="color" value={branding.primaryColor} onChange={e => setBranding(b => ({ ...b, primaryColor: e.target.value }))} style={{ width: 40, border: 'none' }} /><input type="text" value={branding.primaryColor} onChange={e => setBranding(b => ({ ...b, primaryColor: e.target.value }))} style={{ flex: 1 }} /></div></div>
                            <div className="form-group"><label>Logo URL</label><input type="url" value={branding.logoUrl} onChange={e => setBranding(b => ({ ...b, logoUrl: e.target.value }))} placeholder="https://..." /></div>
                        </div>
                        <div className="modal-actions">
                            <button className="btn-ghost" onClick={() => setEditBranding(false)}>Cancel</button>
                            <button className="btn-primary" onClick={saveBranding} disabled={savingBrand}>
                                {savingBrand ? <span className="btn-spinner" /> : 'Save'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            <style>{`
                * { box-sizing: border-box; }
                .org-page { min-height:100vh; background:#050a14; color:#fff; font-family:'Inter',sans-serif; }
                .org-loading { min-height:100vh; display:flex; align-items:center; justify-content:center; background:#050a14; }
                .spinner { width:36px; height:36px; border:3px solid rgba(0,212,255,0.2); border-top-color:#00d4ff; border-radius:50%; animation:spin .7s linear infinite; }
                @keyframes spin { to { transform:rotate(360deg); } }
                .org-error { min-height:100vh; display:flex; align-items:center; justify-content:center; color:#ff6b6b; font-family:'Inter',sans-serif; gap:8px; }
                .org-banner { padding:32px 40px 28px; }
                .org-banner-inner { max-width:1100px; margin:0 auto; display:flex; align-items:center; justify-content:space-between; flex-wrap:wrap; gap:16px; }
                .org-header-left { display:flex; align-items:center; gap:20px; }
                .org-logo { width:64px; height:64px; border-radius:12px; object-fit:cover; }
                .org-logo-placeholder { width:64px; height:64px; border-radius:12px; display:flex; align-items:center; justify-content:center; font-size:28px; font-weight:800; color:#fff; }
                .org-name { font-size:28px; font-weight:800; margin:0 0 4px; }
                .org-id { color:#3d5070; font-size:13px; margin:0; }
                .org-header-right { display:flex; gap:12px; }
                .btn-brand { border:none; border-radius:10px; padding:10px 20px; font-size:14px; font-weight:700; cursor:pointer; color:#fff; }
                .btn-brand-outline { border:1px solid; border-radius:10px; padding:10px 20px; font-size:14px; font-weight:700; cursor:pointer; text-decoration:none; display:inline-flex; align-items:center; }
                .org-body { max-width:1100px; margin:0 auto; padding:32px 40px; }
                .tab-nav { display:flex; gap:4px; margin-bottom:24px; border-bottom:1px solid rgba(255,255,255,0.06); padding-bottom:0; }
                .tab-btn { background:transparent; border:none; color:#6b7fa3; font-size:14px; font-weight:600; padding:10px 20px; cursor:pointer; border-bottom:2px solid transparent; transition:all .2s; margin-bottom:-1px; }
                .tab-btn.active { color:var(--accent,#00d4ff); border-bottom-color:var(--accent,#00d4ff); }
                .panel { background:rgba(255,255,255,0.02); border:1px solid rgba(255,255,255,0.06); border-radius:16px; padding:24px; }
                .panel-header { display:flex; align-items:center; justify-content:space-between; margin-bottom:20px; }
                .panel-title { font-size:18px; font-weight:700; margin:0; }
                .btn-sm { border:none; border-radius:8px; padding:8px 16px; font-size:13px; font-weight:700; cursor:pointer; color:#fff; }
                .empty-state { color:#3d5070; text-align:center; padding:40px; font-size:14px; }
                .tournament-grid { display:grid; grid-template-columns:repeat(auto-fill,minmax(240px,1fr)); gap:16px; }
                .tournament-card { background:rgba(255,255,255,0.03); border:1px solid rgba(255,255,255,0.06); border-top:2px solid var(--accent,#00d4ff); border-radius:12px; padding:20px; cursor:pointer; transition:transform .2s; }
                .t-badge { display:inline-block; border-radius:6px; padding:3px 10px; font-size:11px; font-weight:700; margin-bottom:12px; }
                .t-name { font-size:15px; font-weight:700; margin:0 0 10px; color:#fff; }
                .t-meta { display:flex; align-items:center; gap:8px; }
                .t-format { font-size:11px; color:#6b7fa3; font-weight:700; text-transform:uppercase; }
                .t-status { font-size:11px; border-radius:20px; padding:2px 10px; font-weight:700; }
                .status-active { background:rgba(0,255,100,0.1); color:#00ff9d; }
                .status-completed { background:rgba(100,100,100,0.1); color:#6b7fa3; }
                .members-list { display:flex; flex-direction:column; gap:10px; }
                .member-row { display:flex; align-items:center; gap:14px; padding:12px; background:rgba(255,255,255,0.02); border-radius:10px; }
                .member-avatar { width:36px; height:36px; border-radius:50%; display:flex; align-items:center; justify-content:center; font-size:15px; font-weight:700; color:#fff; }
                .member-info { flex:1; display:flex; flex-direction:column; gap:2px; }
                .member-name { font-size:14px; font-weight:600; }
                .member-handle { font-size:12px; color:#3d5070; }
                .role-badge { font-size:11px; border-radius:20px; padding:3px 10px; font-weight:700; }
                .role-admin { background:rgba(0,212,255,0.1); color:#00d4ff; }
                .role-member { background:rgba(255,255,255,0.06); color:#6b7fa3; }
                .modal-overlay { position:fixed; inset:0; background:rgba(0,0,0,0.7); display:flex; align-items:center; justify-content:center; z-index:100; }
                .modal-card { background:#0d1829; border:1px solid rgba(0,212,255,0.2); border-radius:18px; padding:32px; width:100%; max-width:440px; }
                .modal-title { font-size:20px; font-weight:700; margin:0 0 24px; }
                .form-fields { display:flex; flex-direction:column; gap:16px; margin-bottom:24px; }
                .form-group { display:flex; flex-direction:column; gap:6px; }
                .form-group label { font-size:12px; font-weight:600; color:#8fa3c7; text-transform:uppercase; letter-spacing:.5px; }
                .form-group input { background:rgba(255,255,255,0.04); border:1px solid rgba(255,255,255,0.08); border-radius:8px; padding:10px 12px; color:#fff; font-size:14px; outline:none; }
                .modal-actions { display:flex; justify-content:flex-end; gap:10px; }
                .btn-ghost { background:transparent; border:1px solid rgba(255,255,255,0.1); color:#8fa3c7; border-radius:8px; padding:10px 18px; font-size:14px; cursor:pointer; }
                .btn-primary { background:linear-gradient(135deg,#00d4ff,#0077cc); color:#fff; border:none; border-radius:8px; padding:10px 20px; font-size:14px; font-weight:700; cursor:pointer; display:flex; align-items:center; gap:8px; }
                .btn-spinner { width:14px; height:14px; border:2px solid rgba(255,255,255,0.3); border-top-color:#fff; border-radius:50%; animation:spin .7s linear infinite; }
            `}</style>
        </div>
    );
}
