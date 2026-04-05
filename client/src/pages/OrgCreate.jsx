import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import useAuthStore from '../store/useAuthStore';
import { AnimatedBackground, ShieldIcon, RefreshIcon, GlobeIcon, CheckIcon } from '../components/SharedUI';

const COLOR_PRESETS = [
    '#00d4ff', '#ff6b35', '#a259ff', '#00ff9d',
    '#ffcc00', '#ff3c78', '#ffffff', '#ff9800',
];

/**
 * ⚡ UI LAYER — PREMIUM ORGANIZATION CREATOR
 * =============================================================================
 * Responsibility: Secure interface for initializing new organizations.
 * Features: Real-time brand preview, auto-slug generation, 
 *           and integrated identity vetting.
 * =============================================================================
 */
import { supabase } from '../utils/supabase.js';

export default function OrgCreate() {
    const navigate = useNavigate();
    const { user, isAuthenticated } = useAuthStore();

    const [form, setForm] = useState({
        name: '', slug: '', primaryColor: '#00d4ff', secondaryColor: '#0a0f1e', logoUrl: '',
    });
    const [error, setError]   = useState('');
    const [loading, setLoading] = useState(false);

    const handle = (e) => {
        const { name, value } = e.target;
        setForm(f => ({ ...f, [name]: value }));
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
            const orgId = crypto.randomUUID();
            
            const { data: orgData, error: orgError } = await supabase
                .from('orgs')
                .insert([{
                    id: orgId,
                    name: form.name.trim(),
                    slug: form.slug.trim(),
                    owner_id: user?.id || null
                }])
                .select()
                .single();

            if (orgError) throw orgError;

            const { error: brandingError } = await supabase
                .from('org_branding')
                .insert([{
                    org_id: orgId,
                    display_name: form.name.trim(),
                    primary_color: form.primaryColor,
                    secondary_color: form.secondaryColor,
                    logo_url: form.logoUrl || null,
                    plan: 'org_trial',
                    trial_count: 0,
                    trial_limit: 3,
                    is_registered: false
                }]);

            if (brandingError) throw brandingError;

            const { error: memberError } = await supabase
                .from('org_members')
                .insert([{
                    org_id: orgId,
                    user_id: user?.id,
                    role: 'admin'
                }]);

            if (memberError) throw memberError;

            navigate(`/org/${orgId}`);
        } catch (err) {
            setError(err.message.toUpperCase());
        } finally {
            setLoading(false);
        }
    };

    const accentColor = form.primaryColor || '#00d4ff';

    return (
        <div className="org-create-page" style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#050a14', padding: '60px 20px' }}>
            <AnimatedBackground />

            <motion.div
                className="glass-panel"
                initial={{ opacity: 0, scale: 0.95, y: 30 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                style={{ width: '100%', maxWidth: '600px', padding: '48px', position: 'relative' }}
            >
                <div style={{ textAlign: 'center', marginBottom: '40px' }}>
                    <h1 className="neon-text" style={{ fontSize: '1.8rem', fontWeight: 900, margin: 0 }}>Create Organization</h1>
                    <div style={{ fontSize: '10px', fontWeight: 900, opacity: 0.4, letterSpacing: '4px', marginTop: '4px' }}>Organization Registration</div>
                </div>

                {error && <div style={{ background: 'rgba(255,75,43,0.1)', border: '1px solid rgba(255,75,43,0.2)', color: '#ff4b2b', padding: '16px', borderRadius: '8px', marginBottom: '24px', fontSize: '12px', fontWeight: 900 }}>[ERR] {error}</div>}

                <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
                    
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                            <label style={{ fontSize: '10px', fontWeight: 900, opacity: 0.5, letterSpacing: '1px' }}>ORGANIZATION NAME</label>
                            <input style={inputStyle} name="name" value={form.name} onChange={handle} placeholder="e.g. ALPHA BRAVO ESPORTS" required />
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                            <label style={{ fontSize: '10px', fontWeight: 900, opacity: 0.5, letterSpacing: '1px' }}>ORGANIZATION SLUG (URL)</label>
                            <div style={{ position: 'relative' }}>
                                <span style={{ position: 'absolute', left: '16px', top: '50%', transform: 'translateY(-50%)', fontSize: '13px', opacity: 0.3, fontWeight: 700 }}>veto.gg/</span>
                                <input style={{ ...inputStyle, paddingLeft: '75px' }} name="slug" value={form.slug} onChange={handle} placeholder="unique-id" required />
                            </div>
                        </div>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                        <label style={{ fontSize: '10px', fontWeight: 900, opacity: 0.5, letterSpacing: '1px' }}>PRIMARY BRAND COLOR</label>
                        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                            <input type="color" name="primaryColor" value={form.primaryColor} onChange={handle} style={{ width: '48px', height: '48px', cursor: 'pointer', border: 'none', background: 'none' }} />
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                                {COLOR_PRESETS.map(c => (
                                    <button 
                                        key={c} type="button" 
                                        onClick={() => setForm(f => ({ ...f, primaryColor: c }))}
                                        style={{ width: '24px', height: '24px', borderRadius: '50%', border: '2px solid transparent', background: c, cursor: 'pointer', borderColor: form.primaryColor === c ? '#fff' : 'transparent', transition: 'all 0.2s', boxShadow: form.primaryColor === c ? `0 0 10px ${c}` : 'none' }} 
                                    />
                                ))}
                            </div>
                        </div>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        <label style={{ fontSize: '10px', fontWeight: 900, opacity: 0.5, letterSpacing: '1px' }}>LOGO URL (OPTIONAL)</label>
                        <input style={inputStyle} type="url" name="logoUrl" value={form.logoUrl} onChange={handle} placeholder="https://..." />
                    </div>

                    {/* LIVE PREVIEW CARD */}
                    <div className="glass-panel" style={{ padding: '24px', background: 'rgba(0,0,0,0.4)', borderTop: `4px solid ${accentColor}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                            <div style={{ width: '40px', height: '40px', borderRadius: '8px', background: form.logoUrl ? 'transparent' : accentColor, overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center', border: `1px solid ${accentColor}44` }}>
                                {form.logoUrl ? <img src={form.logoUrl} alt="preview" style={{ width: '100%', height: '100%', objectFit: 'cover' }} onError={e => e.target.style.display='none'} /> : <ShieldIcon size={20} color="#000" />}
                            </div>
                            <span style={{ fontWeight: 900, fontSize: '1rem', letterSpacing: '1px' }}>{form.name || "NEW ORGANIZATION"}</span>
                        </div>
                        <div style={{ fontSize: '9px', fontWeight: 900, letterSpacing: '2px', color: accentColor, border: `1px solid ${accentColor}44`, padding: '4px 10px', borderRadius: '4px' }}>LIVE PREVIEW</div>
                    </div>

                    <button type="submit" className="premium-button" style={{ width: '100%', padding: '18px' }} disabled={loading}>
                        {loading ? <RefreshIcon className="spin" size={16} /> : 'CREATE ORGANIZATION'}
                    </button>

                </form>
            </motion.div>

            <style>{`
                .spin { animation: spin 1s linear infinite; }
                @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
            `}</style>
        </div>
    );
}

const inputStyle = {
    background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.1)',
    padding: '16px', borderRadius: '12px', color: '#fff', outline: 'none',
    fontWeight: 700, width: '100%', boxSizing: 'border-box'
};
