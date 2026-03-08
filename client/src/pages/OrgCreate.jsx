import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import useAuthStore from '../store/useAuthStore';

const COLOR_PRESETS = [
    '#00d4ff', '#ff6b35', '#a259ff', '#00ff9d',
    '#ffcc00', '#ff3c78', '#ffffff', '#ff9800',
];

export default function OrgCreate() {
    const navigate = useNavigate();
    const { authFetch, isAuthenticated } = useAuthStore();

    const [form, setForm] = useState({
        name: '', slug: '', primaryColor: '#00d4ff', secondaryColor: '#0a0f1e', logoUrl: '',
    });
    const [error, setError]   = useState('');
    const [loading, setLoading] = useState(false);

    const handle = (e) => {
        const { name, value } = e.target;
        setForm(f => ({ ...f, [name]: value }));
        // Auto-generate slug from name
        if (name === 'name') {
            const auto = value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40);
            setForm(f => ({ ...f, name: value, slug: auto }));
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        if (!isAuthenticated) {
            navigate('/login');
            return;
        }
        setLoading(true);
        try {
            const res = await authFetch('/api/orgs', {
                method: 'POST',
                body: JSON.stringify(form),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Failed to create org');
            navigate(`/org/${data.id}`);
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="page-dark">
            <div className="bg-grid" />
            <motion.div
                className="content-card"
                initial={{ opacity: 0, y: 24 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4 }}
            >
                <h1 className="page-title">
                    <span className="title-icon">🏢</span>
                    Create Organization
                </h1>
                <p className="page-subtitle">Your org is your tournament brand. You can customize it fully after creation.</p>

                {error && <div className="error-banner">{error}</div>}

                <form className="create-form" onSubmit={handleSubmit}>
                    <div className="form-section">
                        <h3 className="section-title">Organization Identity</h3>
                        <div className="form-group">
                            <label>Organization Name</label>
                            <input type="text" name="name" placeholder="e.g. NorthStar Esports" value={form.name} onChange={handle} required maxLength={100} />
                        </div>
                        <div className="form-group">
                            <label>URL Slug</label>
                            <div className="slug-preview">
                                <span className="slug-prefix">vetoapp.gg/</span>
                                <input type="text" name="slug" placeholder="northstar-esports" value={form.slug} onChange={handle} required maxLength={40} className="slug-input" />
                            </div>
                            <span className="form-hint">Lowercase letters, numbers, and hyphens only. Cannot be changed later.</span>
                        </div>
                    </div>

                    <div className="form-section">
                        <h3 className="section-title">Brand Colors</h3>
                        <div className="color-row">
                            <div className="form-group">
                                <label>Primary Color</label>
                                <div className="color-picker-row">
                                    <input type="color" name="primaryColor" value={form.primaryColor} onChange={handle} className="color-input" />
                                    <input type="text" name="primaryColor" value={form.primaryColor} onChange={handle} className="hex-input" placeholder="#00d4ff" maxLength={7} />
                                </div>
                                <div className="color-presets">
                                    {COLOR_PRESETS.map(c => (
                                        <button key={c} type="button" className="color-preset" style={{ background: c, outline: form.primaryColor === c ? `2px solid ${c}` : 'none', outlineOffset: '2px' }} onClick={() => setForm(f => ({ ...f, primaryColor: c }))} title={c} />
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="form-section">
                        <h3 className="section-title">Logo URL <span className="optional">optional</span></h3>
                        <div className="form-group">
                            <input type="url" name="logoUrl" placeholder="https://cdn.example.com/logo.png" value={form.logoUrl} onChange={handle} />
                        </div>
                    </div>

                    {/* Live Preview */}
                    <div className="brand-preview" style={{ '--p': form.primaryColor }}>
                        <div className="preview-header">
                            {form.logoUrl ? <img src={form.logoUrl} alt="logo" className="preview-logo" onError={(e) => e.target.style.display = 'none'} /> :
                                <div className="preview-logo-placeholder" style={{ background: form.primaryColor }} />
                            }
                            <span className="preview-name">{form.name || 'Your Org Name'}</span>
                        </div>
                        <div className="preview-badge" style={{ borderColor: form.primaryColor, color: form.primaryColor }}>
                            Preview
                        </div>
                    </div>

                    <button type="submit" className="btn-primary btn-full-wide" disabled={loading} id="org-create-submit">
                        {loading ? <span className="btn-spinner" /> : '🏢 Create Organization'}
                    </button>
                </form>
            </motion.div>

            <style>{`
                .page-dark { min-height:100vh; background:#050a14; display:flex; align-items:center; justify-content:center; font-family:'Inter',sans-serif; position:relative; overflow:hidden; }
                .bg-grid { position:absolute; inset:0; background-image:linear-gradient(rgba(0,212,255,0.04) 1px,transparent 1px),linear-gradient(90deg,rgba(0,212,255,0.04) 1px,transparent 1px); background-size:40px 40px; pointer-events:none; }
                .content-card { position:relative; z-index:1; background:rgba(255,255,255,0.03); border:1px solid rgba(0,212,255,0.15); border-radius:20px; padding:44px; width:100%; max-width:560px; backdrop-filter:blur(20px); box-shadow:0 24px 64px rgba(0,0,0,0.5); margin:40px 0; }
                .page-title { font-size:26px; font-weight:800; color:#fff; margin:0 0 8px; display:flex; align-items:center; gap:12px; }
                .title-icon { font-size:24px; }
                .page-subtitle { color:#6b7fa3; font-size:13px; margin:0 0 28px; }
                .error-banner { background:rgba(255,60,60,0.1); border:1px solid rgba(255,60,60,0.3); color:#ff6b6b; border-radius:10px; padding:12px 16px; font-size:13px; margin-bottom:20px; }
                .create-form { display:flex; flex-direction:column; gap:24px; }
                .form-section { display:flex; flex-direction:column; gap:14px; }
                .section-title { font-size:13px; font-weight:700; color:#8fa3c7; text-transform:uppercase; letter-spacing:1px; margin:0; }
                .form-group { display:flex; flex-direction:column; gap:6px; }
                .form-group label { font-size:13px; font-weight:600; color:#8fa3c7; }
                .form-group input { background:rgba(255,255,255,0.04); border:1px solid rgba(255,255,255,0.08); border-radius:10px; padding:11px 14px; color:#fff; font-size:14px; outline:none; transition:border-color .2s; }
                .form-group input:focus { border-color:rgba(0,212,255,0.4); }
                .form-group input::placeholder { color:#3d5070; }
                .form-hint { font-size:11px; color:#3d5070; }
                .optional { color:#3d5070; font-weight:400; font-size:11px; margin-left:4px; }
                .slug-preview { display:flex; align-items:center; background:rgba(255,255,255,0.04); border:1px solid rgba(255,255,255,0.08); border-radius:10px; overflow:hidden; }
                .slug-prefix { padding:11px 12px; color:#3d5070; font-size:13px; white-space:nowrap; border-right:1px solid rgba(255,255,255,0.06); }
                .slug-input { flex:1; background:transparent; border:none; outline:none; padding:11px 14px; color:#fff; font-size:14px; }
                .color-picker-row { display:flex; align-items:center; gap:10px; }
                .color-input { width:40px; height:36px; border:none; border-radius:8px; cursor:pointer; padding:0; background:none; }
                .hex-input { flex:1; background:rgba(255,255,255,0.04); border:1px solid rgba(255,255,255,0.08); border-radius:8px; padding:8px 12px; color:#fff; font-size:13px; outline:none; font-family:monospace; }
                .color-presets { display:flex; gap:6px; flex-wrap:wrap; margin-top:8px; }
                .color-preset { width:24px; height:24px; border-radius:50%; border:none; cursor:pointer; transition:transform .15s; }
                .color-preset:hover { transform:scale(1.2); }
                .brand-preview { border:1px solid rgba(255,255,255,0.08); border-radius:12px; padding:16px; display:flex; align-items:center; justify-content:space-between; background:rgba(255,255,255,0.02); border-top:2px solid var(--p,#00d4ff); }
                .preview-header { display:flex; align-items:center; gap:12px; }
                .preview-logo { width:36px; height:36px; border-radius:8px; object-fit:cover; }
                .preview-logo-placeholder { width:36px; height:36px; border-radius:8px; }
                .preview-name { font-size:15px; font-weight:700; color:#fff; }
                .preview-badge { border:1px solid; border-radius:20px; padding:4px 12px; font-size:11px; font-weight:700; }
                .btn-primary { background:linear-gradient(135deg,#00d4ff,#0077cc); color:#fff; border:none; border-radius:10px; padding:13px 24px; font-size:15px; font-weight:700; cursor:pointer; display:flex; align-items:center; justify-content:center; gap:8px; transition:opacity .2s; }
                .btn-primary:hover:not(:disabled) { opacity:.9; }
                .btn-primary:disabled { opacity:.5; cursor:not-allowed; }
                .btn-full-wide { width:100%; }
                .btn-spinner { width:18px; height:18px; border:2px solid rgba(255,255,255,0.3); border-top-color:#fff; border-radius:50%; animation:spin .7s linear infinite; }
                @keyframes spin { to { transform:rotate(360deg); } }
            `}</style>
        </div>
    );
}
