import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '../utils/supabase';
import { motion, AnimatePresence } from 'framer-motion';
import MapCard from '../components/veto/MapCard';
import Countdown from '../components/veto/Countdown';

export default function EmbedVeto() {
    const { matchId } = useParams();
    const [gameState, setGameState] = useState(null);

    useEffect(() => {
        const fetchVeto = async () => {
            const { data } = await supabase.from('veto_sessions').select('*').eq('id', matchId).single();
            if (data) setGameState(data);
        };
        fetchVeto();

        const channel = supabase.channel(`veto-${matchId}`)
            .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'veto_sessions', filter: `id=eq.${matchId}` }, (payload) => {
                setGameState(payload.new);
            })
            .subscribe();

        return () => supabase.removeChannel(channel);
    }, [matchId]);

    if (!gameState) return null;

    return (
        <div style={{ width: '100%', height: '100%', background: 'transparent', overflow: 'hidden', padding: '10px', color: '#fff', fontFamily: 'Rajdhani' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
                <div style={{ display: 'flex', gap: '20px', alignItems: 'center' }}>
                    <div style={{ textAlign: 'right' }}>
                        <div style={{ fontSize: '18px', fontWeight: 900 }}>{gameState.team_a}</div>
                    </div>
                    <div style={{ padding: '4px 12px', background: 'rgba(255,255,255,0.05)', borderRadius: '4px', fontSize: '10px' }}>VS</div>
                    <div>
                        <div style={{ fontSize: '18px', fontWeight: 900 }}>{gameState.team_b}</div>
                    </div>
                </div>
                {gameState.use_timer && !gameState.finished && (
                    <div style={{ fontSize: '24px', fontWeight: 900, color: 'var(--brand-primary, #00d4ff)' }}>
                        <Countdown target={gameState.timer_ends_at} key={gameState.step} />
                    </div>
                )}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '10px' }}>
                {gameState.maps.map((m) => {
                    const pickIndex = gameState.logs.filter(l => l.includes('[PICK]')).findIndex(l => l.includes(m.name));
                    return (
                        <MapCard 
                            key={m.name}
                            map={m}
                            isInteractive={false}
                            mapOrderLabel={pickIndex !== -1 ? (pickIndex + 1).toString() : null}
                        />
                    );
                })}
            </div>
            
            <style>{`
                body { margin: 0; background: transparent; }
                .map-card { height: 100px !important; }
                .map-card h3 { font-size: 14px !important; }
            `}</style>
        </div>
    );
}
