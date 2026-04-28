import React, { useEffect, useState } from 'react';
import { supabase } from '../../utils/supabase';
import { motion, AnimatePresence } from 'framer-motion';
import { BellIcon, CheckIcon, ShieldIcon } from '../SharedUI';
import { Link } from 'react-router-dom';

export default function NotificationBell({ userId }) {
    const [notifications, setNotifications] = useState([]);
    const [isOpen, setIsOpen] = useState(false);
    const unreadCount = notifications.filter(n => !n.read).length;

    useEffect(() => {
        if (!userId) return;

        const fetchNotifications = async () => {
            const { data } = await supabase
                .from('notifications')
                .select('*')
                .eq('user_id', userId)
                .order('created_at', { ascending: false })
                .limit(5);
            if (data) setNotifications(data);
        };

        fetchNotifications();

        const channel = supabase.channel(`notifications-${userId}`)
            .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${userId}` }, (payload) => {
                setNotifications(prev => [payload.new, ...prev]);
            })
            .subscribe();

        return () => supabase.removeChannel(channel);
    }, [userId]);

    const markAsRead = async (id) => {
        await supabase.from('notifications').update({ read: true }).eq('id', id);
        setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
    };

    return (
        <div style={{ position: 'relative' }}>
            <button 
                onClick={() => setIsOpen(!isOpen)}
                style={{ background: 'none', border: 'none', color: '#fff', cursor: 'pointer', position: 'relative', display: 'flex', alignItems: 'center' }}
            >
                <BellIcon size={20} />
                {unreadCount > 0 && (
                    <span style={{ position: 'absolute', top: '-5px', right: '-5px', background: '#ff4b2b', color: '#fff', fontSize: '9px', fontWeight: 900, width: '15px', height: '15px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '2px solid #0a0f1e' }}>
                        {unreadCount}
                    </span>
                )}
            </button>

            <AnimatePresence>
                {isOpen && (
                    <motion.div 
                        initial={{ opacity: 0, y: 10, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 10, scale: 0.95 }}
                        style={{ position: 'absolute', top: '100%', right: 0, marginTop: '15px', width: '300px', background: 'rgba(15, 20, 35, 0.98)', backdropFilter: 'blur(16px)', border: '1px solid rgba(255, 255, 255, 0.1)', borderRadius: '12px', padding: '16px', boxShadow: '0 15px 40px rgba(0,0,0,0.6)', zIndex: 1000 }}
                    >
                        <h4 style={{ fontSize: '11px', letterSpacing: '2px', fontWeight: 900, marginBottom: '16px', opacity: 0.5 }}>NOTIFICATIONS</h4>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                            {notifications.length === 0 ? (
                                <div style={{ textAlign: 'center', padding: '20px', fontSize: '11px', opacity: 0.3 }}>NO NEW MESSAGES</div>
                            ) : (
                                notifications.map(n => (
                                    <div key={n.id} onClick={() => markAsRead(n.id)} style={{ padding: '12px', background: n.read ? 'transparent' : 'rgba(255,255,255,0.03)', borderRadius: '8px', cursor: 'pointer', transition: '0.2s', border: n.read ? '1px solid transparent' : '1px solid rgba(0,212,255,0.1)' }}>
                                        <div style={{ fontSize: '12px', fontWeight: 700, marginBottom: '4px', display: 'flex', justifyContent: 'space-between' }}>
                                            {n.title}
                                            {!n.read && <div style={{ width: '6px', height: '6px', background: '#00d4ff', borderRadius: '50%' }} />}
                                        </div>
                                        <div style={{ fontSize: '11px', opacity: 0.6, lineHeight: 1.4 }}>{n.message}</div>
                                        <div style={{ fontSize: '9px', opacity: 0.3, marginTop: '8px' }}>{new Date(n.created_at).toLocaleTimeString()}</div>
                                    </div>
                                ))
                            )}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
