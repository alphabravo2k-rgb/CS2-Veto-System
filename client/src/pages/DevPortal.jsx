import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '../utils/supabase';
import { AnimatedBackground, CodeIcon, KeyIcon, ActivityIcon, PlusIcon, TrashIcon, RefreshIcon, CheckIcon } from '../components/SharedUI';
import useAuthStore from '../store/useAuthStore';

export default function DevPortal() {
    const { orgId } = useParams();
    const { user } = useAuthStore();
    const [tab, setTab] = useState('keys');
    const [keys, setKeys] = useState([]);
    const [webhooks, setWebhooks] = useState([]);
    const [loading, setLoading] = useState(true);
    const [newKeyLabel, setNewKeyLabel] = useState('');
    const [isCreating, setIsCreating] = useState(false);

    useEffect(() => {
        const fetchData = async () => {
            const [keysRes, hooksRes] = await Promise.all([
                supabase.from('api_keys').select('*').eq('org_id', orgId),
                supabase.from('webhooks').select('*').eq('org_id', orgId)
            ]);
            
            if (keysRes.data) setKeys(keysRes.data);
            if (hooksRes.data) setWebhooks(hooksRes.data);
            setLoading(false);
        };
        fetchData();
    }, [orgId]);

    const createKey = async () => {
        if (!newKeyLabel) return;
        setIsCreating(true);
        const newKey = `vt_${Math.random().toString(36).substring(2, 15)}${Math.random().toString(36).substring(2, 15)}`;
        // In a real app, we would hash this. For the prototype, we store a hash and show the key once.
        const { data, error } = await supabase.from('api_keys').insert([{
            org_id: orgId,
            label: newKeyLabel,
            key_hash: newKey // prototype: storing plain for simplicity
        }]).select().single();
        
        if (data) {
            setKeys([data, ...keys]);
            setNewKeyLabel('');
            alert(`YOUR NEW API KEY (SAVE IT!): ${newKey}`);
        }
        setIsCreating(false);
    };

    const deleteKey = async (id) => {
        await supabase.from('api_keys').delete().eq('id', id);
        setKeys(keys.filter(k => k.id !== id));
    };

    const addWebhook = async () => {
        const url = window.prompt('Webhook URL:');
        if (!url) return;
        const secret = `whsec_${Math.random().toString(36).substring(2, 10)}`;
        const { data } = await supabase.from('webhooks').insert([{
            org_id: orgId,
            url,
            secret,
            events: ['veto.finished', 'match.reported']
        }]).select().single();
        if (data) setWebhooks([data, ...webhooks]);
    };

    if (loading) return <div style={{ background: '#050a14', minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><AnimatedBackground /><div className="spinner" /></div>;

    return (
        <div style={{ minHeight: '100vh', background: '#050a14', color: '#fff', padding: '40px' }}>
            <AnimatedBackground />
            <div style={{ maxWidth: '1000px', margin: '0 auto', position: 'relative', zIndex: 10 }}>
                <div style={{ marginBottom: '40px', display: 'flex', alignItems: 'center', gap: '20px' }}>
                    <div style={{ background: 'rgba(0,212,255,0.1)', padding: '16px', borderRadius: '16px' }}><CodeIcon size={32} color="#00d4ff" /></div>
                    <div>
                        <h1 style={{ fontSize: '2.5rem', fontWeight: 900, margin: 0, letterSpacing: '2px' }}>DEVELOPER PORTAL</h1>
                        <p style={{ opacity: 0.5, fontSize: '14px', margin: '4px 0 0' }}>Manage API credentials and outbound webhooks for {orgId}</p>
                    </div>
                </div>

                <div style={{ display: 'flex', gap: '32px', marginBottom: '40px', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                    {['keys', 'webhooks'].map(t => (
                        <button 
                            key={t}
                            onClick={() => setTab(t)}
                            style={{ background: 'none', border: 'none', padding: '16px 0', cursor: 'pointer', color: tab === t ? '#00d4ff' : 'rgba(255,255,255,0.3)', fontWeight: 900, letterSpacing: '2px', borderBottom: tab === t ? '2px solid #00d4ff' : '2px solid transparent', transition: 'all 0.3s' }}
                        >
                            {t.toUpperCase()}
                        </button>
                    ))}
                </div>

                <AnimatePresence mode="wait">
                    {tab === 'keys' ? (
                        <motion.div key="keys" initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }}>
                            <div className="glass-panel" style={{ padding: '32px', marginBottom: '32px' }}>
                                <h2 style={{ fontSize: '1.2rem', fontWeight: 900, marginBottom: '24px' }}>CREATE NEW API KEY</h2>
                                <div style={{ display: 'flex', gap: '16px' }}>
                                    <input 
                                        type="text" 
                                        value={newKeyLabel} 
                                        onChange={e => setNewKeyLabel(e.target.value)} 
                                        placeholder="e.g. Production Server" 
                                        style={{ flex: 1, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', padding: '12px 16px', borderRadius: '8px', color: '#fff' }}
                                    />
                                    <button onClick={createKey} disabled={isCreating} className="premium-button" style={{ padding: '0 32px' }}>
                                        {isCreating ? 'CREATING...' : 'GENERATE'}
                                    </button>
                                </div>
                            </div>

                            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                                {keys.map(k => (
                                    <div key={k.id} className="glass-panel" style={{ padding: '20px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
                                            <KeyIcon size={18} color="#00d4ff" />
                                            <div>
                                                <div style={{ fontWeight: 900, fontSize: '14px' }}>{k.label}</div>
                                                <div style={{ opacity: 0.3, fontSize: '10px', marginTop: '4px' }}>ID: {k.id} • CREATED {new Date(k.created_at).toLocaleDateString()}</div>
                                            </div>
                                        </div>
                                        <button onClick={() => deleteKey(k.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', opacity: 0.3, hover: { opacity: 1 } }}><TrashIcon size={16} color="#ff4444" /></button>
                                    </div>
                                ))}
                            </div>
                        </motion.div>
                    ) : (
                        <motion.div key="webhooks" initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '32px' }}>
                                <h2 style={{ fontSize: '1.2rem', fontWeight: 900 }}>OUTBOUND WEBHOOKS</h2>
                                <button className="premium-button" style={{ padding: '8px 24px', fontSize: '12px' }} onClick={addWebhook}>ADD ENDPOINT</button>
                            </div>

                            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                                {webhooks.length === 0 ? (
                                    <div style={{ padding: '80px', textAlign: 'center', opacity: 0.2 }}>NO WEBHOOKS CONFIGURED</div>
                                ) : webhooks.map(w => (
                                    <div key={w.id} className="glass-panel" style={{ padding: '24px' }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
                                            <div>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                                    <span style={{ padding: '4px 8px', background: '#00ff8822', color: '#00ff88', fontSize: '10px', fontWeight: 900, borderRadius: '4px' }}>ACTIVE</span>
                                                    <span style={{ fontWeight: 900 }}>{w.url}</span>
                                                </div>
                                                <div style={{ marginTop: '8px', opacity: 0.5, fontSize: '11px' }}>SECRET: {w.secret}</div>
                                            </div>
                                            <button onClick={() => {}} style={{ background: 'none', border: 'none', cursor: 'pointer', opacity: 0.3 }}><TrashIcon size={16} color="#ff4444" /></button>
                                        </div>
                                        <div style={{ display: 'flex', gap: '8px' }}>
                                            {w.events?.map(e => (
                                                <span key={e} style={{ fontSize: '9px', padding: '4px 8px', background: 'rgba(255,255,255,0.05)', borderRadius: '4px', opacity: 0.6 }}>{e.toUpperCase()}</span>
                                            ))}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>
        </div>
    );
}
