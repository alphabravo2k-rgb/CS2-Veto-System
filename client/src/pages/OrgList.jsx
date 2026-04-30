import React, { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import useAuthStore from '../store/useAuthStore';
import { AnimatedBackground, ShieldIcon, ActivityIcon, UsersIcon, GlobeIcon, RefreshIcon, CheckIcon } from '../components/SharedUI';
import { supabase } from '../utils/supabase.js';

const OrgList = () => {
    const navigate = useNavigate();
    const { user } = useAuthStore();
    const [organizations, setOrganizations] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        if (user) fetchMyOrgs();
    }, [user]);

    const fetchMyOrgs = async () => {
        try {
            setIsLoading(true);
            
            // In the serverless schema, we query the orgs table.
            // If we have a many-to-many relationship (org_members), we would join there.
            // For now, let's assume the user can see all orgs or we filter by creator_id if that exists.
            const { data, error: fetchError } = await supabase
                .from('org_members')
                .select('role, orgs(*)')
                .eq('user_id', user.id);
            
            if (fetchError) throw fetchError;
            
            const normalized = (data || []).map(item => ({
                ...item.orgs,
                userRole: item.role,
                tournamentCount: 0
            }));

            setOrganizations(normalized);
        } catch (err) {
            console.error('[OrgList] Fetch error:', err);
            setError('Failed to sync organization data.');
        } finally {
            setIsLoading(false);
        }
    };

    // Stagger Animation Variants
    const containerVariants = {
        hidden: { opacity: 0 },
        visible: {
            opacity: 1,
            transition: { staggerChildren: 0.1 }
        }
    };

    const cardVariants = {
        hidden: { opacity: 0, y: 30, scale: 0.95 },
        visible: { 
            opacity: 1, 
            y: 0, 
            scale: 1,
            transition: { type: 'spring', stiffness: 100, damping: 15 }
        },
        hover: { y: -8, transition: { duration: 0.2 } }
    };

    if (isLoading) {
        return (
            <div style={{ minHeight: '80vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <motion.div 
                    animate={{ rotate: 360 }}
                    transition={{ repeat: Infinity, duration: 1, ease: 'linear' }}
                    style={{ width: '40px', height: '40px', border: '3px solid rgba(0, 212, 255, 0.1)', borderTopColor: '#00d4ff', borderRadius: '50%' }}
                />
            </div>
        );
    }

    return (
        <div style={{ 
            maxWidth: '1200px', 
            margin: '0 auto', 
            padding: '40px 20px',
            fontFamily: 'system-ui, -apple-system, sans-serif'
        }}>
            {/* Header Section */}
            <header style={{ marginBottom: '48px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
                <div>
                    <h1 style={{ 
                        fontFamily: 'Rajdhani, sans-serif', 
                        fontSize: '32px', 
                        fontWeight: 700, 
                        letterSpacing: '0.1em', 
                        color: '#fff',
                        margin: 0,
                        textTransform: 'uppercase'
                    }}>
                        My Organizations
                    </h1>
                    <div style={{ height: '4px', width: '60px', background: '#00d4ff', marginTop: '8px' }} />
                </div>
                
                {organizations.length > 0 && (
                    <button 
                        onClick={() => navigate('/orgs/create')}
                        style={{
                            background: 'rgba(0, 212, 255, 0.1)',
                            border: '1px solid #00d4ff',
                            color: '#00d4ff',
                            padding: '10px 20px',
                            borderRadius: '4px',
                            fontFamily: 'Rajdhani',
                            fontWeight: 700,
                            cursor: 'pointer',
                            textTransform: 'uppercase',
                            fontSize: '14px',
                            transition: 'all 0.2s'
                        }}
                        onMouseEnter={(e) => e.target.style.background = 'rgba(0, 212, 255, 0.2)'}
                        onMouseLeave={(e) => e.target.style.background = 'rgba(0, 212, 255, 0.1)'}
                    >
                        + Create New
                    </button>
                )}
            </header>

            {error && (
                <div style={{ padding: '20px', background: 'rgba(255, 68, 68, 0.1)', color: '#ff4444', borderRadius: '4px', marginBottom: '24px' }}>
                    {error}
                </div>
            )}

            <AnimatePresence mode="wait">
                {organizations.length === 0 ? (
                    <motion.div 
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className="empty-state"
                        style={{ 
                            textAlign: 'center', 
                            padding: '100px 0', 
                            background: 'rgba(255, 255, 255, 0.02)', 
                            borderRadius: '12px',
                            border: '1px dashed rgba(255, 255, 255, 0.1)'
                        }}
                    >
                        <p style={{ color: 'rgba(255, 255, 255, 0.5)', fontSize: '18px', marginBottom: '24px' }}>
                            You have no organizations yet.
                        </p>
                        <button 
                            onClick={() => navigate('/orgs/create')}
                            style={{
                                background: '#00d4ff',
                                color: '#000',
                                border: 'none',
                                padding: '14px 32px',
                                borderRadius: '4px',
                                fontFamily: 'Rajdhani',
                                fontWeight: 700,
                                cursor: 'pointer',
                                fontSize: '16px',
                                textTransform: 'uppercase'
                            }}
                        >
                            Create your first org
                        </button>
                    </motion.div>
                ) : (
                    <motion.div 
                        variants={containerVariants}
                        initial="hidden"
                        animate="visible"
                        style={{ 
                            display: 'grid', 
                            gridTemplateColumns: 'repeat(auto-fill, minmax(450px, 1fr))', 
                            gap: '24px' 
                        }}
                    >
                        {organizations.map((org) => (
                            <motion.div
                                key={org.id}
                                variants={cardVariants}
                                whileHover="hover"
                                style={{
                                    height: '240px',
                                    position: 'relative',
                                    borderRadius: '12px',
                                    overflow: 'hidden',
                                    background: '#1a1f2e',
                                    cursor: 'pointer',
                                    border: '1px solid rgba(255, 255, 255, 0.05)'
                                }}
                                onClick={() => navigate(`/org/${org.id}`)}
                            >
                                {/* Banner Background with Overlay */}
                                <div style={{
                                    position: 'absolute',
                                    inset: 0,
                                    backgroundImage: `url(${org.branding?.banner_url || 'https://i.ibb.co/68v8pXp/default-banner.jpg'})`,
                                    backgroundSize: 'cover',
                                    backgroundPosition: 'center',
                                    transition: 'transform 0.5s'
                                }} />
                                <div style={{
                                    position: 'absolute',
                                    inset: 0,
                                    background: 'linear-gradient(to top, rgba(10, 15, 30, 0.95) 40%, rgba(10, 15, 30, 0.4) 100%)'
                                }} />

                                {/* Card Content */}
                                <div style={{ position: 'relative', height: '100%', padding: '24px', display: 'flex', flexDirection: 'column' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                        <div style={{ 
                                            width: '48px', 
                                            height: '48px', 
                                            borderRadius: '50%', 
                                            border: '2px solid #00d4ff', 
                                            overflow: 'hidden',
                                            background: '#050a14',
                                            boxShadow: '0 4px 12px rgba(0, 0, 0, 0.5)'
                                        }}>
                                            <img 
                                                src={org.branding?.logo_url || 'https://i.ibb.co/0yLfyyQt/LOT-LOGO-03.jpg'} 
                                                style={{ width: '100%', height: '100%', objectFit: 'contain' }}
                                                alt="Logo"
                                            />
                                        </div>
                                        <div style={{
                                            background: org.userRole === 'admin' ? '#00d4ff' : 'rgba(255, 255, 255, 0.1)',
                                            color: org.userRole === 'admin' ? '#000' : '#fff',
                                            padding: '4px 12px',
                                            borderRadius: '20px',
                                            fontSize: '11px',
                                            fontWeight: 700,
                                            letterSpacing: '0.05em',
                                            textTransform: 'uppercase'
                                        }}>
                                            {org.userRole}
                                        </div>
                                    </div>

                                    <div style={{ marginTop: 'auto' }}>
                                        <h2 style={{ 
                                            fontFamily: 'Rajdhani, sans-serif', 
                                            fontSize: '24px', 
                                            fontWeight: 700, 
                                            color: '#fff',
                                            margin: '0 0 8px 0',
                                            textTransform: 'uppercase'
                                        }}>
                                            {org.name}
                                        </h2>
                                        <div style={{ display: 'flex', gap: '20px', color: 'rgba(255, 255, 255, 0.5)', fontSize: '13px' }}>
                                            <span>
                                                <strong style={{ color: '#00d4ff' }}>{org.tournamentCount}</strong> TOURNAMENTS
                                            </span>
                                            <span>
                                                SLUG: <strong style={{ color: '#fff' }}>{org.slug}</strong>
                                            </span>
                                        </div>
                                    </div>

                                    <div style={{ 
                                        position: 'absolute', 
                                        bottom: '24px', 
                                        right: '24px' 
                                    }}>
                                        <div style={{
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '8px',
                                            color: '#00d4ff',
                                            fontSize: '14px',
                                            fontWeight: 600,
                                            fontFamily: 'Rajdhani',
                                            textTransform: 'uppercase'
                                        }}>
                                            Open Dashboard ➔
                                        </div>
                                    </div>
                                </div>
                            </motion.div>
                        ))}
                    </motion.div>
                )}
            </AnimatePresence>

            <style>{`
                @media (max-width: 900px) {
                    .motion-div { grid-template-columns: 1fr !important; }
                }
            `}</style>
        </div>
    );
};

export default OrgList;
