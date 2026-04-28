import React, { useEffect, useState } from 'react';
import { supabase } from '../../utils/supabase';
import { motion } from 'framer-motion';
import { ActivityIcon, UserIcon, HashIcon } from '../SharedUI';

export default function AuditLogViewer({ orgId }) {
    const [logs, setLogs] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchLogs = async () => {
            const { data, error } = await supabase
                .from('audit_logs')
                .select('*')
                .eq('meta->org_id', orgId) // Assuming org_id is stored in meta for platform logs
                .order('created_at', { ascending: false })
                .limit(50);
            
            if (data) setLogs(data);
            setLoading(false);
        };

        fetchLogs();
    }, [orgId]);

    if (loading) return <div style={{ padding: '40px', textAlign: 'center', opacity: 0.5 }}>FETCHING AUDIT TRAIL...</div>;

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {logs.length === 0 ? (
                <div style={{ padding: '40px', textAlign: 'center', opacity: 0.3, fontSize: '12px' }}>NO AUDIT DATA RECORDED YET</div>
            ) : (
                logs.map((log, i) => (
                    <motion.div 
                        key={log.id}
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: i * 0.03 }}
                        className="glass-panel" 
                        style={{ padding: '16px', display: 'flex', alignItems: 'center', gap: '20px', borderLeft: `3px solid ${log.action.includes('delete') ? '#ff4444' : '#00d4ff'}` }}
                    >
                        <div style={{ background: 'rgba(255,255,255,0.05)', padding: '10px', borderRadius: '8px' }}>
                            <ActivityIcon size={18} />
                        </div>
                        <div style={{ flex: 1 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                                <span style={{ fontWeight: 900, fontSize: '12px', letterSpacing: '1px' }}>{log.action.toUpperCase()}</span>
                                <span style={{ opacity: 0.3, fontSize: '10px' }}>•</span>
                                <span style={{ opacity: 0.5, fontSize: '10px' }}>{new Date(log.created_at).toLocaleString()}</span>
                            </div>
                            <div style={{ fontSize: '11px', opacity: 0.8 }}>
                                {log.meta?.message || `Action performed on target ${log.target_id}`}
                            </div>
                        </div>
                        <div style={{ textAlign: 'right', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                            <div style={{ fontSize: '9px', fontWeight: 900, opacity: 0.4, display: 'flex', alignItems: 'center', gap: '4px' }}>
                                <UserIcon size={10} /> {log.actor_id?.slice(0,8)}
                            </div>
                            <div style={{ fontSize: '9px', fontWeight: 900, opacity: 0.4, display: 'flex', alignItems: 'center', gap: '4px' }}>
                                <HashIcon size={10} /> {log.id}
                            </div>
                        </div>
                    </motion.div>
                ))
            )}
        </div>
    );
}
