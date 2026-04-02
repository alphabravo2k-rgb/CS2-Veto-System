import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { ScanlineOverlay, GlassPanel, NeonText } from '../components/veto/VetoUIPrimitives';
import { ActivityIcon, ExternalLinkIcon } from '../components/SharedUI';
import useOrgBranding from '../hooks/useOrgBranding';

import { supabase } from '../utils/supabase.js';

/**
 * ⚡ UI LAYER — TOURNAMENT PUBLIC LIVE HUB
 * =============================================================================
 * Responsibility: Spectator-facing dashboard for real-time tournament tracking.
 * =============================================================================
 */
export default function TournamentPublic() {
    const { orgId, tournamentId } = useParams();
    const { branding } = useOrgBranding(orgId);
    const [matches, setMatches] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!tournamentId) return;

        async function initialFetch() {
            setLoading(true);
            const { data, error } = await supabase
                .from('veto_sessions')
                .select('*')
                .eq('tournament_id', tournamentId)
                .order('date', { ascending: false });
            
            if (!error && data) setMatches(data);
            setLoading(false);
        }

        initialFetch();

        // Realtime sync for live updates
        const channel = supabase.channel(`public_tournament:${tournamentId}`)
            .on(
                'postgres_changes',
                { event: '*', schema: 'public', table: 'veto_sessions', filter: `tournament_id=eq.${tournamentId}` },
                (payload) => {
                    if (payload.eventType === 'INSERT') {
                        setMatches(prev => [payload.new, ...prev]);
                    } else if (payload.eventType === 'UPDATE') {
                        setMatches(prev => prev.map(m => m.id === payload.new.id ? payload.new : m));
                    }
                }
            )
            .subscribe();

        return () => channel.unsubscribe();
    }, [tournamentId]);

    const accentColor = branding?.primary_color || '#00d4ff';

    return (
        <div style={{ minHeight: '100vh', background: '#050a14', color: '#fff', padding: '40px', position: 'relative', overflow: 'hidden' }}>
            <ScanlineOverlay />
            
            <header style={{ maxWidth: '1400px', margin: '0 auto 60px', textAlign: 'center', position: 'relative', zIndex: 10 }}>
                <Link to="/" style={{ opacity: 0.5, fontSize: '10px', color: '#fff', textDecoration: 'none', letterSpacing: '2px', fontWeight: 900 }}>&larr; BACK TO PLATFORM</Link>
                <div style={{ marginTop: '20px' }}>
                    <NeonText color={accentColor}><h1 style={{ fontSize: '3rem', margin: 0, fontWeight: 900 }}>{tournamentId.toUpperCase()}</h1></NeonText>
                    <div style={{ fontSize: '12px', letterSpacing: '4px', opacity: 0.6, fontWeight: 900, marginTop: '8px' }}>LIVE TOURNAMENT THEATER</div>
                </div>
            </header>

            <main style={{ maxWidth: '1400px', margin: '0 auto', position: 'relative', zIndex: 10 }}>
                {loading ? (
                    <div style={{ textAlign: 'center', padding: '100px', opacity: 0.5 }}>SYNCHRONIZING THEATER...</div>
                ) : (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: '24px' }}>
                        <AnimatePresence>
                            {matches.map((match, idx) => (
                                <motion.div 
                                    key={match.id}
                                    initial={{ opacity: 0, scale: 0.9 }}
                                    animate={{ opacity: 1, scale: 1 }}
                                    transition={{ delay: idx * 0.05 }}
                                >
                                    <GlassPanel style={{ padding: '24px', borderLeft: `4px solid ${match.finished ? 'rgba(255,255,255,0.1)' : accentColor}`, position: 'relative' }}>
                                        {!match.finished && (
                                            <div style={{ position: 'absolute', top: '12px', right: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                <div className="pulse-dot" style={{ width: '8px', height: '8px', background: '#00ff88', borderRadius: '50%' }} />
                                                <span style={{ fontSize: '9px', fontWeight: 900, color: '#00ff88', letterSpacing: '1px' }}>LIVE VETO</span>
                                            </div>
                                        )}

                                        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '20px', marginBottom: '24px' }}>
                                            <div style={{ textAlign: 'right', flex: 1 }}>
                                                <div style={{ fontSize: '14px', fontWeight: 900 }}>{match.team_a}</div>
                                                <div style={{ fontSize: '9px', opacity: 0.5 }}>ALPHA</div>
                                            </div>
                                            <div style={{ fontSize: '12px', fontWeight: 900, opacity: 0.2 }}>VS</div>
                                            <div style={{ textAlign: 'left', flex: 1 }}>
                                                <div style={{ fontSize: '14px', fontWeight: 900 }}>{match.team_b}</div>
                                                <div style={{ fontSize: '9px', opacity: 0.5 }}>BRAVO</div>
                                            </div>
                                        </div>

                                        <div style={{ background: 'rgba(0,0,0,0.3)', padding: '12px', borderRadius: '8px', fontSize: '11px', textAlign: 'center' }}>
                                            {match.finished ? (
                                                <div>
                                                    <span style={{ opacity: 0.5 }}>DECIDER:</span> <span style={{ color: accentColor, fontWeight: 900 }}>{match.decider_map || 'COMPLETED'}</span>
                                                </div>
                                            ) : (
                                                <div style={{ color: '#00d4ff', fontWeight: 700 }}>
                                                    {match.status === 'scheduled' ? 'WAITING FOR PLAYERS' : 'VETO IN PROGRESS'}
                                                </div>
                                            )}
                                        </div>

                                        <Link 
                                            to={`/org/${orgId}/tournament/${tournamentId}/veto/${match.id}`}
                                            style={{ marginTop: '20px', width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px', padding: '10px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', textDecoration: 'none', fontSize: '11px', fontWeight: 900, borderRadius: '8px' }}
                                        >
                                            <ActivityIcon size={14} /> SPECTATE THEATER
                                        </Link>
                                    </GlassPanel>
                                </motion.div>
                            ))}
                        </AnimatePresence>
                    </div>
                )}
            </main>

            <style>{`
                .pulse-dot { animation: pulse 2s infinite; }
                @keyframes pulse {
                    0% { transform: scale(1); opacity: 1; }
                    50% { transform: scale(1.5); opacity: 0.5; }
                    100% { transform: scale(1); opacity: 1; }
                }
            `}</style>
        </div>
    );
}
