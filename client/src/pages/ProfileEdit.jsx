import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import useAuthStore from '../store/useAuthStore';

const REGIONS  = ['EU','NA','SEA','ME','Faceit'];
const PLATFORMS = [
    { id: 'steam',  label: '🎮 Steam',  placeholder: 'Steam64 ID (e.g. 76561198...)' },
    { id: 'riot',   label: '⚡ Riot',   placeholder: 'GameName#TAG' },
    { id: 'faceit', label: '🔥 FACEIT', placeholder: 'FACEIT username' },
];

export default function ProfileEdit() {
    const navigate = useNavigate();
    const { authFetch, user } = useAuthStore();

    const [profile, setProfile] = useState(null);
    const [form, setForm] = useState({ username: '', displayName: '', country: '', serverRegion: '', bio: '', avatarUrl: '' });
    const [loading,  setLoading]  = useState(true);
    const [saving,   setSaving]   = useState(false);
    const [error,    setError]    = useState('');
    const [success,  setSuccess]  = useState('');

    // Platform link state
    const [linkPlatform, setLinkPlatform] = useState({ platform: '', platformId: '', platformUsername: '' });
    const [linkSaving, setLinkSaving] = useState(false);

    useEffect(() => {
        authFetch('/api/players/me')
            .then(r => r.json())
            .then(data => {
                setProfile(data);
                setForm({
                    username:     data.username || '',
                    displayName:  data.display_name || '',
                    country:      data.country || '',
                    serverRegion: data.server_region || '',
                    bio:          data.bio || '',
                    avatarUrl:    data.avatar_url || '',
                });
            })
            .catch(() => setError('Failed to load profile'))
            .finally(() => setLoading(false));
    }, []);

    const handleSave = async (e) => {
        e.preventDefault();
        setError(''); setSuccess(''); setSaving(true);
        try {
            const res = await authFetch('/api/players/me', {
                method: 'PATCH',
                body: JSON.stringify({
                    username:     form.username,
                    displayName:  form.displayName,
                    country:      form.country || null,
                    serverRegion: form.serverRegion || null,
                    bio:          form.bio || null,
                    avatarUrl:    form.avatarUrl || null,
                }),
            });
            const data = await res.json();
            if (!res.ok) {
                const msg = data.lockedUntil
                    ? `Username locked until ${new Date(data.lockedUntil).toLocaleDateString()}`
                    : data.error;
                throw new Error(msg);
            }
            setProfile(data);
            setSuccess('Profile saved!');
        } catch (err) {
            setError(err.message);
        } finally {
            setSaving(false);
        }
    };

    const handleLinkPlatform = async () => {
        setLinkSaving(true);
        try {
            const res = await authFetch('/api/players/me/accounts', {
                method: 'POST',
                body: JSON.stringify(linkPlatform),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error);
            setProfile(p => ({ ...p, linkedAccounts: [...(p?.linkedAccounts || []).filter(a => a.platform !== linkPlatform.platform), { platform: linkPlatform.platform, platform_username: linkPlatform.platformUsername, platform_id: linkPlatform.platformId }] }));
            setLinkPlatform({ platform: '', platformId: '', platformUsername: '' });
            setSuccess('Account linked!');
        } catch (err) {
            setError(err.message);
        } finally {
            setLinkSaving(false);
        }
    };

    const usernameLockedUntil = profile?.usernameLockedUntil
        ? new Date(profile.usernameLockedUntil).toLocaleDateString()
        : null;

    if (loading) return <div className="pf-loading"><span className="spinner" /></div>;

    return (
        <div className="pf-page">
            <div className="pf-bg" />
            <div className="pf-content">
                <motion.div className="pf-card" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
                    <div className="pf-card-header">
                        <h1 className="pf-title">Edit Profile</h1>
                        <button className="btn-ghost-sm" onClick={() => navigate(-1)}>← Back</button>
                    </div>

                    {error   && <div className="pf-error">{error}</div>}
                    {success && <div className="pf-success">{success}</div>}

                    <form onSubmit={handleSave} className="pf-form">
                        <div className="pf-section">
                            <h3 className="pf-section-label">Identity</h3>
                            <div className="form-row-2">
                                <div className="form-group">
                                    <label>
                                        Username
                                        {usernameLockedUntil && <span className="lock-badge">🔒 Locked until {usernameLockedUntil}</span>}
                                    </label>
                                    <input
                                        type="text" value={form.username}
                                        onChange={e => setForm(f => ({ ...f, username: e.target.value }))}
                                        disabled={!!usernameLockedUntil}
                                        placeholder="your_handle"
                                    />
                                </div>
                                <div className="form-group">
                                    <label>Display Name</label>
                                    <input type="text" value={form.displayName} onChange={e => setForm(f => ({ ...f, displayName: e.target.value }))} placeholder="How others see you" />
                                </div>
                            </div>
                        </div>

                        <div className="pf-section">
                            <h3 className="pf-section-label">Bio</h3>
                            <textarea className="pf-textarea" value={form.bio} onChange={e => setForm(f => ({ ...f, bio: e.target.value }))} placeholder="Tell the community about yourself..." maxLength={500} rows={3} />
                            <span className="char-count">{form.bio.length}/500</span>
                        </div>

                        <div className="pf-section">
                            <h3 className="pf-section-label">Location & Region</h3>
                            <div className="form-row-2">
                                <div className="form-group">
                                    <label>Country</label>
                                    <input type="text" value={form.country} onChange={e => setForm(f => ({ ...f, country: e.target.value }))} placeholder="e.g. Germany" />
                                </div>
                                <div className="form-group">
                                    <label>Server Region</label>
                                    <select value={form.serverRegion} onChange={e => setForm(f => ({ ...f, serverRegion: e.target.value }))} className="pf-select">
                                        <option value="">Select region</option>
                                        {REGIONS.map(r => <option key={r} value={r}>{r}</option>)}
                                    </select>
                                </div>
                            </div>
                        </div>

                        <div className="pf-section">
                            <h3 className="pf-section-label">Avatar URL</h3>
                            <div className="avatar-row">
                                {form.avatarUrl && <img src={form.avatarUrl} alt="preview" className="avatar-preview" onError={e => e.target.style.display='none'} />}
                                <input type="url" value={form.avatarUrl} onChange={e => setForm(f => ({ ...f, avatarUrl: e.target.value }))} placeholder="https://..." className="pf-input" />
                            </div>
                        </div>

                        <button type="submit" className="btn-primary" disabled={saving}>
                            {saving ? <span className="btn-spinner" /> : '💾 Save Changes'}
                        </button>
                    </form>
                </motion.div>

                {/* Platform linking */}
                <motion.div className="pf-card" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
                    <h2 className="pf-title">Linked Accounts</h2>
                    {profile?.linkedAccounts?.length > 0 && (
                        <div className="linked-list">
                            {profile.linkedAccounts.map(acc => (
                                <div key={acc.platform} className="linked-item">
                                    <span className="platform-chip">{acc.platform}</span>
                                    <span className="platform-user">{acc.platform_username || acc.platform_id}</span>
                                </div>
                            ))}
                        </div>
                    )}
                    <div className="link-form">
                        <select value={linkPlatform.platform} onChange={e => setLinkPlatform(l => ({ ...l, platform: e.target.value }))} className="pf-select">
                            <option value="">Choose Platform</option>
                            {PLATFORMS.map(p => <option key={p.id} value={p.id}>{p.label}</option>)}
                        </select>
                        {linkPlatform.platform && (
                            <>
                                <input type="text" value={linkPlatform.platformId} onChange={e => setLinkPlatform(l => ({ ...l, platformId: e.target.value }))} placeholder={PLATFORMS.find(p => p.id === linkPlatform.platform)?.placeholder || 'ID'} className="pf-input" />
                                <input type="text" value={linkPlatform.platformUsername} onChange={e => setLinkPlatform(l => ({ ...l, platformUsername: e.target.value }))} placeholder="Display name (optional)" className="pf-input" />
                                <button className="btn-primary" onClick={handleLinkPlatform} disabled={linkSaving}>
                                    {linkSaving ? <span className="btn-spinner" /> : 'Link Account'}
                                </button>
                            </>
                        )}
                    </div>
                </motion.div>
            </div>

            <style>{`
                .pf-page { min-height:100vh; background:#050a14; font-family:'Inter',sans-serif; position:relative; }
                .pf-bg { position:absolute; inset:0; background-image:linear-gradient(rgba(0,212,255,0.03) 1px,transparent 1px),linear-gradient(90deg,rgba(0,212,255,0.03) 1px,transparent 1px); background-size:40px 40px; }
                .pf-loading { min-height:100vh; display:flex; align-items:center; justify-content:center; background:#050a14; }
                .spinner { width:32px; height:32px; border:3px solid rgba(0,212,255,0.2); border-top-color:#00d4ff; border-radius:50%; animation:spin .7s linear infinite; }
                @keyframes spin { to { transform:rotate(360deg); } }
                .pf-content { position:relative; z-index:1; max-width:680px; margin:0 auto; padding:44px 20px; display:flex; flex-direction:column; gap:24px; }
                .pf-card { background:rgba(255,255,255,0.03); border:1px solid rgba(0,212,255,0.12); border-radius:20px; padding:32px; }
                .pf-card-header { display:flex; align-items:center; justify-content:space-between; margin-bottom:24px; }
                .pf-title { font-size:20px; font-weight:800; color:#fff; margin:0 0 20px; }
                .btn-ghost-sm { background:transparent; border:1px solid rgba(255,255,255,0.1); color:#8fa3c7; border-radius:8px; padding:7px 14px; font-size:13px; cursor:pointer; }
                .pf-error { background:rgba(255,60,60,0.1); border:1px solid rgba(255,60,60,0.3); color:#ff6b6b; border-radius:10px; padding:10px 14px; font-size:13px; margin-bottom:20px; }
                .pf-success { background:rgba(0,255,100,0.07); border:1px solid rgba(0,255,100,0.2); color:#00ff9d; border-radius:10px; padding:10px 14px; font-size:13px; margin-bottom:20px; }
                .pf-form { display:flex; flex-direction:column; gap:22px; }
                .pf-section { display:flex; flex-direction:column; gap:12px; }
                .pf-section-label { font-size:11px; font-weight:700; color:#3d5070; text-transform:uppercase; letter-spacing:1px; margin:0; }
                .form-row-2 { display:grid; grid-template-columns:1fr 1fr; gap:14px; }
                .form-group { display:flex; flex-direction:column; gap:6px; }
                .form-group label { font-size:13px; font-weight:600; color:#8fa3c7; display:flex; align-items:center; gap:8px; }
                .lock-badge { background:rgba(255,150,0,0.1); border-radius:20px; padding:2px 8px; font-size:11px; color:#ffcc00; }
                .form-group input, .pf-input { background:rgba(255,255,255,0.04); border:1px solid rgba(255,255,255,0.08); border-radius:10px; padding:10px 14px; color:#fff; font-size:14px; outline:none; transition:border-color .2s; }
                .form-group input:focus, .pf-input:focus { border-color:rgba(0,212,255,0.4); }
                .form-group input:disabled { opacity:.4; cursor:not-allowed; }
                .pf-textarea { background:rgba(255,255,255,0.04); border:1px solid rgba(255,255,255,0.08); border-radius:10px; padding:12px 14px; color:#fff; font-size:14px; outline:none; resize:vertical; font-family:inherit; width:100%; }
                .char-count { font-size:11px; color:#3d5070; text-align:right; }
                .pf-select { background:rgba(255,255,255,0.04); border:1px solid rgba(255,255,255,0.08); border-radius:10px; padding:10px 14px; color:#fff; font-size:14px; outline:none; }
                .avatar-row { display:flex; align-items:center; gap:12px; }
                .avatar-preview { width:44px; height:44px; border-radius:50%; object-fit:cover; }
                .btn-primary { background:linear-gradient(135deg,#00d4ff,#0077cc); color:#fff; border:none; border-radius:10px; padding:12px 24px; font-size:14px; font-weight:700; cursor:pointer; display:inline-flex; align-items:center; gap:8px; }
                .btn-primary:disabled { opacity:.5; cursor:not-allowed; }
                .btn-spinner { width:14px; height:14px; border:2px solid rgba(255,255,255,0.3); border-top-color:#fff; border-radius:50%; animation:spin .7s linear infinite; }
                .linked-list { display:flex; flex-direction:column; gap:8px; margin-bottom:20px; }
                .linked-item { display:flex; align-items:center; gap:10px; padding:10px 14px; background:rgba(255,255,255,0.03); border-radius:10px; }
                .platform-chip { background:rgba(0,212,255,0.1); color:#00d4ff; border-radius:20px; padding:3px 10px; font-size:12px; font-weight:700; text-transform:capitalize; }
                .platform-user { color:#8fa3c7; font-size:13px; }
                .link-form { display:flex; flex-direction:column; gap:10px; }
                @media (max-width:520px) { .form-row-2 { grid-template-columns:1fr; } .pf-content { padding:24px 12px; } }
            `}</style>
        </div>
    );
}
