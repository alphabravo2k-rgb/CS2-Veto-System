import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { supabase } from '../utils/supabase';
import { AnimatedBackground, GlassPanel, NeonText } from '../components/SharedUI';
import TournamentBracket from '../components/tournament/TournamentBracket';

export default function PublicTournament() {
    const { tournamentId } = useParams();
    const [tournament, setTournament] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        async function fetchTournament() {
            const { data, error } = await supabase
                .from('tournaments')
                .select('*, orgs(name)')
                .eq('id', tournamentId)
                .single();
            
            if (!error) setTournament(data);
            setLoading(false);
            
            // SEO Meta Tags
            if (data) {
                document.title = `${data.name} | Veto Platform`;
                let metaDescription = document.querySelector('meta[name="description"]');
                if (metaDescription) metaDescription.content = `Watch the ${data.name} tournament progression and map vetoes live on the Veto Platform.`;
            }
        }
        fetchTournament();
    }, [tournamentId]);

    if (loading) return <div style={{ minHeight: '100vh', background: '#050a14' }} />;
    if (!tournament) return <div>Tournament Not Found</div>;

    return (
        <div style={{ minHeight: '100vh', background: '#050a14', color: '#fff', padding: '40px 20px' }}>
            <AnimatedBackground />
            
            <header style={{ maxWidth: '1200px', margin: '0 auto 60px', textAlign: 'center' }}>
                <div style={{ fontSize: '12px', letterSpacing: '4px', color: 'var(--brand-primary)', marginBottom: '12px', fontWeight: 900 }}>
                    {tournament.orgs?.name.toUpperCase()} PRESENTS
                </div>
                <h1 style={{ fontSize: '3.5rem', fontWeight: 900, margin: 0, letterSpacing: '2px' }}>{tournament.name}</h1>
                <div style={{ display: 'flex', justifyContent: 'center', gap: '20px', marginTop: '20px' }}>
                    <div style={{ padding: '6px 20px', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '50px', fontSize: '11px', fontWeight: 900, letterSpacing: '2px' }}>
                        {tournament.game?.toUpperCase() || 'CS2'}
                    </div>
                    <div style={{ padding: '6px 20px', background: 'rgba(0,255,136,0.1)', color: '#00ff88', borderRadius: '50px', fontSize: '11px', fontWeight: 900, letterSpacing: '2px' }}>
                        {tournament.status?.toUpperCase() || 'ACTIVE'}
                    </div>
                </div>
            </header>

            <main style={{ maxWidth: '1400px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '48px' }}>
                <section>
                    <h3 style={{ fontSize: '12px', letterSpacing: '4px', opacity: 0.4, marginBottom: '24px', textAlign: 'center' }}>TOURNAMENT BRACKET</h3>
                    <TournamentBracket tournamentId={tournamentId} />
                </section>

                <section style={{ maxWidth: '800px', margin: '0 auto', width: '100%' }}>
                    <h3 style={{ fontSize: '12px', letterSpacing: '4px', opacity: 0.4, marginBottom: '24px' }}>LATEST VETOES</h3>
                    <GlassPanel style={{ padding: '0' }}>
                        {/* We could fetch recent matches here */}
                        <div style={{ padding: '40px', textAlign: 'center', opacity: 0.3 }}>
                            NO RECENT VETOES COMPLETED
                        </div>
                    </GlassPanel>
                </section>
            </main>

            <footer style={{ marginTop: '100px', textAlign: 'center', borderTop: '1px solid rgba(255,255,255,0.05)', padding: '40px' }}>
                <Link to="/" style={{ color: 'var(--brand-primary)', textDecoration: 'none', fontWeight: 900, fontSize: '11px', letterSpacing: '2px' }}>
                    POWERED BY VETO SYSTEM CORE
                </Link>
            </footer>
        </div>
    );
}
