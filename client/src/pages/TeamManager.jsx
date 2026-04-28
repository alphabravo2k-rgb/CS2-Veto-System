import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { motion, AnimatePresence } from 'framer-motion';
import { GlassPanel, NeonText, NeonButton } from '../components/veto/VetoUIPrimitives';

/**
 * 👥 UI LAYER — TEAM & ROSTER MANAGER
 * =============================================================================
 * Responsibility: Manage persistent team entities for organizations.
 * =============================================================================
 */

const TeamCard = ({ team, onRoster, onStats }) => {
    return (
        <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
        >
            <GlassPanel style={{ padding: '20px', textAlign: 'center', position: 'relative' }}>
                <img 
                    src={team.logo_url || 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iODAiIGhlaWdodD0iODAiIHZpZXdCb3g9IjAgMCA4MCA4MCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iODAiIGhlaWdodD0iODAiIHJ4PSIsIiBmaWxsPSIjMjAyNTM3Ii8+PHBhdGggZD0iTTQwIDIwTDYwIDUwaC00MEw0MCAyMHoiIGZpbGw9IiMwMGQ0ZmYiLz48L3N2Zz4='} 
                    alt={team.name}
                    style={{ width: '100px', height: '100px', objectFit: 'contain', marginBottom: '15px' }}
                />
                <h3 style={{ margin: '0 0 10px 0', fontSize: '1.5rem', fontWeight: 900 }}>{team.name}</h3>
                
                {/* 📈 TEAM STATS PREVIEW */}
                <div style={{ display: 'flex', justifyContent: 'center', gap: '20px', marginBottom: '20px', fontSize: '0.7rem', color: '#00d4ff' }}>
                    <div>WIN RATE: <span style={{ color: '#fff' }}>68%</span></div>
                    <div>STREAK: <span style={{ color: '#fff' }}>3W</span></div>
                </div>

                <div style={{ display: 'flex', gap: '10px', justifyContent: 'center' }}>
                    <button onClick={() => onRoster(team)} style={{ background: 'transparent', border: '1px solid #00d4ff', color: '#00d4ff', padding: '5px 15px', cursor: 'pointer', fontWeight: 900, fontSize: '0.7rem' }}>ROSTER</button>
                    <button onClick={() => onStats(team)} style={{ background: 'transparent', border: '1px solid #444', color: '#fff', padding: '5px 15px', cursor: 'pointer', fontWeight: 900, fontSize: '0.7rem' }}>STATS</button>
                    <button style={{ background: 'transparent', border: '1px solid #ff4444', color: '#ff4444', padding: '5px 15px', cursor: 'pointer', fontWeight: 900, fontSize: '0.7rem' }}>RETIRE</button>
                </div>
            </GlassPanel>
        </motion.div>
    );
};

const TeamManager = () => {
    const [teams, setTeams] = useState([]);
    const [loading, setLoading] = useState(true);
    const [isCreating, setIsCreating] = useState(false);
    const [newTeam, setNewTeam] = useState({ name: '', logo_url: '', org_id: '' });
    const [importUrl, setImportUrl] = useState('');

    useEffect(() => {
        fetchTeams();
    }, []);

    const fetchTeams = async () => {
        setLoading(true);
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        // Fetch user's organizations first to filter teams
        const { data: orgs } = await supabase
            .from('org_members')
            .select('org_id')
            .eq('user_id', user.id);

        if (orgs && orgs.length > 0) {
            const orgIds = orgs.map(o => o.org_id);
            const { data: teamData } = await supabase
                .from('teams')
                .select('*')
                .in('org_id', orgIds);
            setTeams(teamData || []);
            setNewTeam(prev => ({ ...prev, org_id: orgIds[0] }));
        }
        setLoading(false);
    };

    const handleCreateTeam = async (e) => {
        e.preventDefault();
        const { error } = await supabase
            .from('teams')
            .insert([newTeam]);
        
        if (!error) {
            setIsCreating(false);
            setNewTeam({ name: '', logo_url: '', org_id: newTeam.org_id });
            fetchTeams();
        }
    };

    const handleImport = async () => {
        // MOCK IMPORT LOGIC
        // In a real scenario, this would call a serverless function that scrapes HLTV/FACEIT
        if (importUrl.includes('hltv.org')) {
            setNewTeam(prev => ({
                ...prev,
                name: 'HLTV Team ' + Math.floor(Math.random() * 1000),
                logo_url: 'https://www.hltv.org/img/static/team/placeholder.png'
            }));
            alert('Drafted data from HLTV. Please review and save.');
        } else {
            alert('Only HLTV links are currently supported for auto-drafting.');
        }
    };

    return (
        <div style={{ padding: '40px', maxWidth: '1200px', margin: '0 auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '40px' }}>
                <NeonText fontSize="2.5rem">TEAM REPOSITORY</NeonText>
                <NeonButton onClick={() => setIsCreating(true)}>REGISTER NEW TEAM</NeonButton>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '30px' }}>
                <AnimatePresence>
                    {teams.map(team => (
                        <TeamCard key={team.id} team={team} onRoster={() => {}} onStats={() => {}} />
                    ))}
                </AnimatePresence>
            </div>

            {/* Create Modal */}
            {isCreating && (
                <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
                    <motion.div initial={{ y: 50, opacity: 0 }} animate={{ y: 0, opacity: 1 }}>
                        <GlassPanel style={{ width: '500px', padding: '40px' }}>
                            <h2 style={{ marginBottom: '30px' }}>REGISTER TEAM</h2>
                            
                            <div style={{ marginBottom: '20px' }}>
                                <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.8rem', color: '#00d4ff' }}>AUTO-IMPORT FROM HLTV</label>
                                <div style={{ display: 'flex', gap: '10px' }}>
                                    <input 
                                        style={{ flex: 1, background: 'rgba(0,0,0,0.3)', border: '1px solid #333', color: '#fff', padding: '12px' }}
                                        placeholder="https://www.hltv.org/team/..."
                                        value={importUrl}
                                        onChange={(e) => setImportUrl(e.target.value)}
                                    />
                                    <button onClick={handleImport} style={{ background: '#00d4ff', color: '#000', border: 'none', padding: '0 20px', fontWeight: 900, cursor: 'pointer' }}>FETCH</button>
                                </div>
                            </div>

                            <form onSubmit={handleCreateTeam}>
                                <div style={{ marginBottom: '20px' }}>
                                    <label style={{ display: 'block', marginBottom: '8px' }}>TEAM NAME</label>
                                    <input 
                                        style={{ width: '100%', background: 'rgba(0,0,0,0.3)', border: '1px solid #333', color: '#fff', padding: '12px' }}
                                        value={newTeam.name}
                                        onChange={(e) => setNewTeam({ ...newTeam, name: e.target.value })}
                                        required
                                    />
                                </div>
                                <div style={{ marginBottom: '30px' }}>
                                    <label style={{ display: 'block', marginBottom: '8px' }}>LOGO URL</label>
                                    <input 
                                        style={{ width: '100%', background: 'rgba(0,0,0,0.3)', border: '1px solid #333', color: '#fff', padding: '12px' }}
                                        value={newTeam.logo_url}
                                        onChange={(e) => setNewTeam({ ...newTeam, logo_url: e.target.value })}
                                    />
                                </div>
                                <div style={{ display: 'flex', gap: '20px' }}>
                                    <NeonButton type="submit" style={{ flex: 1 }}>SAVE TEAM</NeonButton>
                                    <button 
                                        type="button"
                                        onClick={() => setIsCreating(false)}
                                        style={{ flex: 1, background: 'transparent', border: '1px solid #ff4444', color: '#ff4444', fontWeight: 900, cursor: 'pointer' }}
                                    >
                                        CANCEL
                                    </button>
                                </div>
                            </form>
                        </GlassPanel>
                    </motion.div>
                </div>
            )}
        </div>
    );
};

export default TeamManager;
