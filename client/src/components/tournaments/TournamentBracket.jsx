import React from 'react';
import { motion } from 'framer-motion';
import { GlassPanel, NeonText } from '../components/veto/VetoUIPrimitives';

/**
 * 🏆 UI LAYER — TOURNAMENT BRACKET VISUALIZER
 * =============================================================================
 * Responsibility: Display tournament progression in a standard bracket view.
 * =============================================================================
 */
const TournamentBracket = ({ structure }) => {
    if (!structure || !structure.rounds) return <div style={{ textAlign: 'center', padding: '40px' }}>No bracket generated yet.</div>;

    return (
        <div style={{ 
            display: 'flex', 
            gap: '60px', 
            padding: '40px', 
            overflowX: 'auto',
            minHeight: '600px',
            alignItems: 'center'
        }}>
            {structure.rounds.map((round, rIndex) => (
                <div key={rIndex} style={{ 
                    display: 'flex', 
                    flexDirection: 'column', 
                    justifyContent: 'space-around',
                    height: '100%',
                    minWidth: '280px'
                }}>
                    <h3 style={{ 
                        textAlign: 'center', 
                        color: '#00d4ff', 
                        fontSize: '0.9rem', 
                        fontWeight: 900, 
                        letterSpacing: '2px',
                        marginBottom: '20px'
                    }}>
                        {round.name.toUpperCase()}
                    </h3>

                    <div style={{ 
                        display: 'flex', 
                        flexDirection: 'column', 
                        gap: '40px',
                        justifyContent: 'center',
                        flex: 1
                    }}>
                        {round.matches.map((match, mIndex) => (
                            <BracketMatch key={match.id} match={match} />
                        ))}
                    </div>
                </div>
            ))}
        </div>
    );
};

const BracketMatch = ({ match }) => {
    return (
        <motion.div 
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            style={{ position: 'relative' }}
        >
            <GlassPanel style={{ padding: '12px', width: '240px', borderLeft: '4px solid #00d4ff' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <TeamSmallLogo src={match.teamA?.logo} />
                        <span style={{ fontWeight: 900, fontSize: '0.9rem', color: match.teamA?.id === 'bye' ? '#555' : '#fff' }}>
                            {match.teamA?.name}
                        </span>
                    </div>
                    {match.winner === match.teamA?.id && <div style={{ color: '#00ff88', fontSize: '10px' }}>W</div>}
                </div>
                <div style={{ height: '1px', background: 'rgba(255,255,255,0.1)', margin: '8px 0' }} />
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <TeamSmallLogo src={match.teamB?.logo} />
                        <span style={{ fontWeight: 900, fontSize: '0.9rem', color: match.teamB?.id === 'bye' ? '#555' : '#fff' }}>
                            {match.teamB?.name}
                        </span>
                    </div>
                    {match.winner === match.teamB?.id && <div style={{ color: '#00ff88', fontSize: '10px' }}>W</div>}
                </div>

                {match.matchId && (
                    <a 
                        href={`/veto/${match.matchId}`} 
                        style={{ 
                            display: 'block', 
                            marginTop: '10px', 
                            fontSize: '10px', 
                            color: '#00d4ff', 
                            textDecoration: 'none', 
                            textAlign: 'center',
                            background: 'rgba(0,212,255,0.1)',
                            padding: '4px'
                        }}
                    >
                        GO TO VETO
                    </a>
                )}
            </GlassPanel>

            {/* Connecting Lines */}
            {match.nextMatchId && (
                <div style={{
                    position: 'absolute',
                    right: '-60px',
                    top: '50%',
                    width: '60px',
                    height: '2px',
                    background: 'rgba(0,212,255,0.2)',
                    zIndex: -1
                }} />
            )}
        </motion.div>
    );
};

const TeamSmallLogo = ({ src }) => (
    <img 
        src={src || 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAiIGhlaWdodD0iMjAiIHZpZXdCb3g9IjAgMCAyMCAyMCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMjAiIGhlaWdodD0iMjAiIHJ4PSIsIiBmaWxsPSIjMjAyNTM3Ii8+PC9zdmc+' } 
        alt="logo" 
        style={{ width: '20px', height: '20px', objectFit: 'contain' }} 
    />
);

export default TournamentBracket;
