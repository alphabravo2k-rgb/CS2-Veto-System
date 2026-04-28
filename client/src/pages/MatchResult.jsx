import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { supabase } from '../utils/supabase';
import { motion } from 'framer-motion';
import SEO from '../components/SEO';
import { AnimatedBackground, ShieldIcon, ActivityIcon, GlobeIcon } from '../components/SharedUI';
import { NeonText } from '../components/veto/VetoUIPrimitives';

export default function MatchResult() {
    const { matchId } = useParams();
    const [match, setMatch] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchMatch = async () => {
            const { data } = await supabase
                .from('veto_sessions')
                .select('*, orgs(name, branding)')
                .eq('id', matchId)
                .single();
            
            if (data) setMatch(data);
            setLoading(false);
        };
        fetchMatch();
    }, [matchId]);

    if (loading) return <div style={{ background: '#050a14', minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><AnimatedBackground /><div className="spinner" /></div>;
    if (!match) return <div style={{ background: '#050a14', minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>MATCH NOT FOUND</div>;

    const accentColor = match.orgs?.branding?.primary_color || '#00d4ff';

    return (
        <div style={{ minHeight: '100vh', background: '#050a14', color: '#fff', padding: '80px 20px' }}>
            <SEO title={`${match.team_a} vs ${match.team_b} - Match Result`} description={`Official match report for ${match.team_a} vs ${match.team_b}. Score: ${match.score_a ?? 0} - ${match.score_b ?? 0}.`} />
            <AnimatedBackground />
            
            <div style={{ maxWidth: '1000px', margin: '0 auto', textAlign: 'center', position: 'relative', zIndex: 10 }}>
                <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
                    <div style={{ fontSize: '12px', fontWeight: 900, letterSpacing: '4px', color: accentColor, marginBottom: '20px' }}>OFFICIAL MATCH REPORT</div>
                    <h1 style={{ fontSize: '4rem', fontWeight: 900, margin: '0 0 40px' }}>{match.team_a} <span style={{ opacity: 0.2 }}>VS</span> {match.team_b}</h1>
                    
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr', alignItems: 'center', gap: '40px', marginBottom: '80px' }}>
                        <div className="glass-panel" style={{ padding: '40px', textAlign: 'center', borderTop: match.winner_id === match.team_a_id ? `4px solid ${accentColor}` : 'none' }}>
                            <div style={{ fontSize: '4rem', fontWeight: 900 }}>{match.score_a ?? 0}</div>
                            <div style={{ fontWeight: 900, letterSpacing: '2px', opacity: 0.5 }}>{match.team_a.toUpperCase()}</div>
                        </div>
                        <div style={{ fontSize: '2rem', fontWeight: 900, opacity: 0.1 }}>:</div>
                        <div className="glass-panel" style={{ padding: '40px', textAlign: 'center', borderTop: match.winner_id === match.team_b_id ? `4px solid ${accentColor}` : 'none' }}>
                            <div style={{ fontSize: '4rem', fontWeight: 900 }}>{match.score_b ?? 0}</div>
                            <div style={{ fontWeight: 900, letterSpacing: '2px', opacity: 0.5 }}>{match.team_b.toUpperCase()}</div>
                        </div>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '32px', textAlign: 'left' }}>
                        <div className="glass-panel" style={{ padding: '32px' }}>
                            <h3 style={{ fontSize: '1rem', fontWeight: 900, letterSpacing: '2px', marginBottom: '24px', display: 'flex', alignItems: 'center', gap: '12px' }}>
                                <ActivityIcon size={18} color={accentColor} /> VETO LOG
                            </h3>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                {match.logs?.map((log, i) => (
                                    <div key={i} style={{ fontSize: '11px', paddingBottom: '12px', borderBottom: '1px solid rgba(255,255,255,0.05)', opacity: 0.7 }}>
                                        {log}
                                    </div>
                                ))}
                            </div>
                        </div>

                        <div className="glass-panel" style={{ padding: '32px' }}>
                            <h3 style={{ fontSize: '1rem', fontWeight: 900, letterSpacing: '2px', marginBottom: '24px', display: 'flex', alignItems: 'center', gap: '12px' }}>
                                <ShieldIcon size={18} color={accentColor} /> MATCH INFO
                            </h3>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                                <div>
                                    <div style={{ fontSize: '10px', opacity: 0.4, fontWeight: 900 }}>ORGANIZATION</div>
                                    <div style={{ fontWeight: 900 }}>{match.orgs?.name}</div>
                                </div>
                                <div>
                                    <div style={{ fontSize: '10px', opacity: 0.4, fontWeight: 900 }}>COMPETITION</div>
                                    <div style={{ fontWeight: 900 }}>{match.tournament_id?.toUpperCase()}</div>
                                </div>
                                <div>
                                    <div style={{ fontSize: '10px', opacity: 0.4, fontWeight: 900 }}>DATE</div>
                                    <div style={{ fontWeight: 900 }}>{new Date(match.finished_at || match.created_at).toLocaleString()}</div>
                                </div>
                                <Link to={`/org/${match.org_id}`} className="premium-button" style={{ marginTop: '20px', textAlign: 'center' }}>VIEW TOURNAMENT</Link>
                            </div>
                        </div>
                    </div>
                </motion.div>
            </div>
        </div>
    );
}
