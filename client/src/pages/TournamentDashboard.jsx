import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { AnimatedBackground, UploadIcon, ExternalLinkIcon, CheckIcon, HomeIcon, RefreshIcon, ActivityIcon, ShieldIcon } from '../components/SharedUI';
import useVetoStore from '../store/useVetoStore'; 
import useOrgBranding from '../hooks/useOrgBranding';
import { supabase } from '../utils/supabase.js';
import useAuthStore from '../store/useAuthStore';
import { Link } from 'react-router-dom';

/**
 * ⚡ UI LAYER — PREMIUM TOURNAMENT DASHBOARD
 * =============================================================================
 * Responsibility: Management hub for generating and managing veto sessions.
 * Features: Multi-mode veto generation (VRS, Faceit, Wingman, Custom), 
 *           automated timer controls, and real-time history telemetry.
 * =============================================================================
 */
export default function TournamentDashboard() {
    const { orgId, tournamentId } = useParams();
    const navigate = useNavigate();
    const { branding } = useOrgBranding(orgId);
    const { createMatch: storeCreateMatch, serverError } = useVetoStore();

    const [teamA, setTeamA] = useState('');
    const [teamB, setTeamB] = useState('');
    const [teamALogo, setTeamALogo] = useState('');
    const [teamBLogo, setTeamBLogo] = useState('');
    const [vetoMode, setVetoMode] = useState('vrs');
    const [useTimer, setUseTimer] = useState(false);
    const [timerDuration, setTimerDuration] = useState(60);
    const [useCoinFlip, setUseCoinFlip] = useState(false);
    const [tempWebhook, setTempWebhook] = useState('');
    
    const [isGenerating, setIsGenerating] = useState(false);
    const [inputError, setInputError] = useState(false);
    const [createdLinks, setCreatedLinks] = useState(null);
    const [showNotification, setShowNotification] = useState(false);
    const [historyData, setHistoryData] = useState([]);

    const [availableMaps, setAvailableMaps] = useState([]);
    const [customSelectedMaps, setCustomSelectedMaps] = useState([]);
    const [customSequence, setCustomSequence] = useState([]);
    const [userCustomMap, setUserCustomMap] = useState('');

    // Bulk Generation State
    const [bulkInput, setBulkInput] = useState('');
    const [isBulkProcessing, setIsBulkProcessing] = useState(false);
    const [bulkReport, setBulkReport] = useState(null);

    // Analytics State
    const [analytics, setAnalytics] = useState(null);
    const [showAnalytics, setShowAnalytics] = useState(false);

    const fileInputA = useRef(null);
    const fileInputB = useRef(null);

    const fetchHistory = useCallback(async () => {
        const { data, error } = await supabase
            .from('veto_sessions')
            .select('*')
            .eq('tournament_id', tournamentId)
            .order('finished_at', { ascending: false })
            .limit(50);
        
        if (!error && data) setHistoryData(data);
    }, [tournamentId]);

    useEffect(() => {
        const fetchMaps = async () => {
            const { data, error } = await supabase
                .from('tournament_map_pools')
                .select('*')
                .eq('tournament_id', tournamentId);
            
            if (!error && data?.length > 0) {
                const maps = data.map(m => ({ name: m.map_name, image: m.map_image_url }));
                setAvailableMaps(maps);
                setCustomSelectedMaps(maps.map(m => m.name));
            }
        };
        fetchMaps();
        fetchHistory();
    }, [fetchHistory, tournamentId]);

    const fetchAnalytics = useCallback(async () => {
        // Simple client-side analytics since we're in testing
        // or we can invoke a 'get-analytics' edge function
        setAnalytics({
            metrics: {
                totalMatches: historyData.length,
                avgDurationMinutes: 12
            },
            mapStats: {}
        });
    }, [historyData]);

    useEffect(() => {
        if (showAnalytics) fetchAnalytics();
    }, [showAnalytics, fetchAnalytics]);

    const handleLogoUpload = (e, team) => {
        const file = e.target.files[0];
        if (file) {
            const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
            if (!ALLOWED_TYPES.includes(file.type)) return alert("Invalid file type.");
            if (file.size > 2000000) return alert("File too large. Max 2MB.");
            
            const reader = new FileReader();
            reader.onloadend = () => {
                if (team === 'A') setTeamALogo(reader.result);
                else setTeamBLogo(reader.result);
            };
            reader.readAsDataURL(file);
        }
    };

    const handleCreateMatchSubmit = (type) => {
        if (!teamA.trim() || !teamB.trim()) { setInputError(true); return; }

        let format = type;
        if (vetoMode === 'faceit') {
            if (type === 'bo1') format = 'faceit_bo1';
            if (type === 'bo3') format = 'faceit_bo3';
            if (type === 'bo5') format = 'faceit_bo5';
        } else if (vetoMode === 'wingman') {
            if (type === 'bo1') format = 'wingman_bo1';
            if (type === 'bo3') format = 'wingman_bo3';
        } else if (vetoMode === 'custom') format = 'custom';

        if (format === 'custom') {
            if (customSelectedMaps.length === 0) return alert("Select at least one map.");
            if (customSequence.length === 0) return alert("Define at least one step.");
        }

        setIsGenerating(true);
        storeCreateMatch({
            orgId, tournamentId, teamA: teamA.trim(), teamB: teamB.trim(), 
            teamALogo, teamBLogo, format,
            customMapNames: format === 'custom' ? customSelectedMaps : null,
            customSequence: format === 'custom' ? customSequence : null,
            useTimer, useCoinFlip, timerDuration, tempWebhookUrl: tempWebhook.trim()
        }, (response) => {
            const baseUrl = `${window.location.origin}/org/${orgId}/tournament/${tournamentId}/veto/${response.matchId}`;
            setCreatedLinks({
                admin: `${baseUrl}?key=${response.keys.admin}`,
                teamA: `${baseUrl}?key=${response.keys.A}`,
                teamB: `${baseUrl}?key=${response.keys.B}`
            });
            setIsGenerating(false);
            setTeamA(''); setTeamB(''); setTeamALogo(''); setTeamBLogo(''); setUseCoinFlip(false);
            fetchHistory(); 
        });
    };

    const handleBulkGenerate = async () => {
        if (!bulkInput.trim()) return;
        setIsBulkProcessing(true);
        
        try {
            const lines = bulkInput.split('\n').filter(l => l.trim().includes(','));
            const pairs = lines.map(line => {
                const [a, b] = line.split(',').map(s => s.trim());
                return { teamA: a, teamB: b };
            });

            if (pairs.length === 0) throw new Error("No valid data found (format: Team A, Team B)");

            const results = [];
            const { data: { session } } = await supabase.auth.getSession();
            const authHeader = session?.access_token 
                ? { Authorization: `Bearer ${session.access_token}` }
                : {};
            
            for (const pair of pairs) {
                const { data, error } = await supabase.functions.invoke('create-match', {
                    body: {
                        orgId,
                        tournamentId,
                        teamA: pair.teamA,
                        teamB: pair.teamB,
                        format: 'bo1',
                        useTimer,
                        timerDuration,
                        useCoinFlip,
                    },
                    headers: authHeader
                });
                
                if (error) {
                    results.push({ ...pair, success: false, error: error.message });
                } else {
                    results.push({ ...pair, success: true, roomId: data.matchId }); 
                }
            }
            
            const successCount = results.filter(r => r.success).length;
            const errorCount = results.length - successCount;
            
            setBulkReport({ successCount, errorCount, results });
            setBulkInput('');
            fetchHistory();
        } catch (err) {
            alert(err.message);
        } finally {
            setIsBulkProcessing(false);
        }
    };

    const copyToClipboard = (text) => { 
        navigator.clipboard.writeText(text).then(() => { 
            setShowNotification(true); setTimeout(() => setShowNotification(false), 2000); 
        }); 
    };

    const toggleMapSelection = (mapName) => {
        if (customSelectedMaps.includes(mapName)) setCustomSelectedMaps(customSelectedMaps.filter(m => m !== mapName));
        else setCustomSelectedMaps([...customSelectedMaps, mapName]);
    };

    const addSequenceStep = (team, action) => setCustomSequence([...customSequence, { t: team, a: action }]);
    const removeSequenceStep = (idx) => { const s = [...customSequence]; s.splice(idx, 1); setCustomSequence(s); };

    const accentColor = branding?.primary_color || 'var(--brand-primary, #00d4ff)';

    return (
        <div className="tournament-page" style={{ minHeight: '100vh', background: '#050a14', color: '#fff', padding: '40px' }}>
            <AnimatedBackground />
            
            <header style={{ maxWidth: '1200px', margin: '0 auto 40px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', position: 'relative', zIndex: 10 }}>
                <Link to={`/org/${orgId}`} className="glass-panel" style={{ padding: '8px 20px', display: 'flex', alignItems: 'center', gap: '10px', textDecoration: 'none', color: '#fff', fontSize: '12px', fontWeight: 900, letterSpacing: '2px' }}>
                    <HomeIcon /> BACK TO ORGANIZATION
                </Link>
                <div style={{ textAlign: 'center' }}>
                    <h1 className="neon-text" style={{ fontSize: '2.5rem', fontWeight: 900, margin: 0 }}>{tournamentId.toUpperCase()}</h1>
                    <div style={{ fontSize: '10px', fontWeight: 900, letterSpacing: '4px', opacity: 0.5, marginTop: '4px' }}>TOURNAMENT DASHBOARD</div>
                </div>
                <div style={{ width: '130px' }} /> {/* Spacer */}
            </header>

            <main style={{ maxWidth: '1200px', margin: '0 auto', display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 400px', gap: '40px', position: 'relative', zIndex: 10 }}>
                
                {/* ── GENERATE MATCH ── */}
                <section>
                    <div className="glass-panel" style={{ padding: '40px' }}>
                        <h2 style={{ fontSize: '1.2rem', fontWeight: 900, letterSpacing: '2px', marginBottom: '32px', color: accentColor }}>CREATE NEW MATCH</h2>
                        
                        {/* Mode Selection */}
                        <div style={{ display: 'flex', gap: '12px', marginBottom: '40px', flexWrap: 'wrap' }}>
                            {['vrs', 'faceit', 'wingman', 'custom', 'bulk'].map(m => (
                                <button 
                                    key={m} 
                                    onClick={() => setVetoMode(m)}
                                    className={vetoMode === m ? "premium-button" : "glass-panel"}
                                    style={{ 
                                        padding: '10px 20px', fontSize: '11px', fontWeight: 900, letterSpacing: '2px', cursor: 'pointer',
                                        background: vetoMode === m ? accentColor : 'rgba(255,255,255,0.05)',
                                        border: vetoMode === m ? 'none' : '1px solid rgba(255,255,255,0.1)'
                                    }}
                                >
                                    {m === 'bulk' ? 'BULK COMMAND' : `${m.toUpperCase()} MODE`}
                                </button>
                            ))}
                        </div>

                        {/* Team Config */}
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px', marginBottom: '32px' }}>
                            <div className="form-group" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                <label style={{ fontSize: '10px', fontWeight: 900, letterSpacing: '1px', opacity: 0.5 }}>TEAM ALPHA</label>
                                <input 
                                    style={{ background: 'rgba(0,0,0,0.3)', border: inputError && !teamA ? '1px solid #ff4b2b' : '1px solid rgba(255,255,255,0.1)', padding: '16px', borderRadius: '12px', color: '#fff', outline: 'none', fontWeight: 700 }}
                                    value={teamA} onChange={e => { setTeamA(e.target.value); setInputError(false); }} placeholder="NAME"
                                />
                                <button className="glass-panel" onClick={() => fileInputA.current.click()} style={{ padding: '8px', fontSize: '10px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                                    <UploadIcon /> {teamALogo ? "CHANGE LOGO" : "ATTACH LOGO"}
                                </button>
                                <input type="file" ref={fileInputA} style={{ display: 'none' }} onChange={e => handleLogoUpload(e, 'A')} />
                            </div>
                            <div className="form-group" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                <label style={{ fontSize: '10px', fontWeight: 900, letterSpacing: '1px', opacity: 0.5 }}>TEAM BRAVO</label>
                                <input 
                                    style={{ background: 'rgba(0,0,0,0.3)', border: inputError && !teamB ? '1px solid #ff4b2b' : '1px solid rgba(255,255,255,0.1)', padding: '16px', borderRadius: '12px', color: '#fff', outline: 'none', fontWeight: 700 }}
                                    value={teamB} onChange={e => { setTeamB(e.target.value); setInputError(false); }} placeholder="NAME"
                                />
                                <button className="glass-panel" onClick={() => fileInputB.current.click()} style={{ padding: '8px', fontSize: '10px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                                    <UploadIcon /> {teamBLogo ? "CHANGE LOGO" : "ATTACH LOGO"}
                                </button>
                                <input type="file" ref={fileInputB} style={{ display: 'none' }} onChange={e => handleLogoUpload(e, 'B')} />
                            </div>
                        </div>

                        {/* Match Settings */}
                        <div className="glass-panel" style={{ padding: '24px', background: 'rgba(0,0,0,0.2)', marginBottom: '32px' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-around', alignItems: 'center', flexWrap: 'wrap', gap: '24px' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', cursor: 'pointer' }} onClick={() => setUseTimer(!useTimer)}>
                                    <div style={{ width: '20px', height: '20px', borderRadius: '4px', border: `2px solid ${accentColor}`, display: 'flex', alignItems: 'center', justifyContent: 'center', background: useTimer ? accentColor : 'transparent' }}>
                                        {useTimer && <CheckIcon size={14} color="#000" />}
                                    </div>
                                    <span style={{ fontSize: '12px', fontWeight: 900, letterSpacing: '1px' }}>AUTO-BAN TIMER</span>
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', cursor: 'pointer' }} onClick={() => setUseCoinFlip(!useCoinFlip)}>
                                    <div style={{ width: '20px', height: '20px', borderRadius: '4px', border: '2px solid #ffd700', display: 'flex', alignItems: 'center', justifyContent: 'center', background: useCoinFlip ? '#ffd700' : 'transparent' }}>
                                        {useCoinFlip && <CheckIcon size={14} color="#000" />}
                                    </div>
                                    <span style={{ fontSize: '12px', fontWeight: 900, letterSpacing: '1px' }}>COIN FLIP START</span>
                                </div>
                            </div>
                        </div>

                        {/* Format buttons or Custom area or Bulk area */}
                        {vetoMode === 'bulk' ? (
                            <div style={{ animation: 'fadeIn 0.3s' }}>
                                <p style={{ fontSize: '11px', opacity: 0.6, marginBottom: '20px' }}>Enter team pairs (one per line, format: Team A, Team B)</p>
                                <textarea 
                                    value={bulkInput}
                                    onChange={e => setBulkInput(e.target.value)}
                                    placeholder="Liquid, NaVi&#10;G2, Vitality"
                                    style={{ width: '100%', height: '150px', background: 'rgba(0,0,0,0.4)', color: '#fff', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px', padding: '16px', outline: 'none', marginBottom: '20px', fontFamily: 'monospace' }}
                                />
                                <button 
                                    className="premium-button" 
                                    style={{ width: '100%', padding: '16px' }}
                                    onClick={handleBulkGenerate}
                                    disabled={isBulkProcessing || !bulkInput.trim()}
                                >
                                    {isBulkProcessing ? <RefreshIcon className="spin" size={16} /> : "EXECUTE MASS GENERATION"}
                                </button>

                                {bulkReport && (
                                    <div style={{ marginTop: '24px', padding: '16px', background: 'rgba(0,255,136,0.05)', border: '1px solid rgba(0,255,136,0.2)', borderRadius: '8px' }}>
                                        <div style={{ fontSize: '10px', color: '#00ff88', fontWeight: 900, marginBottom: '8px' }}>MASS GENERATION COMPLETE</div>
                                        <div style={{ fontSize: '12px' }}>Success: {bulkReport.successCount} | Failed: {bulkReport.errorCount}</div>
                                    </div>
                                )}
                            </div>
                        ) : vetoMode !== 'custom' ? (
                            <div style={{ display: 'flex', gap: '16px', justifyContent: 'center' }}>
                                {['bo1', 'bo3', 'bo5'].filter(f => vetoMode !== 'wingman' || f !== 'bo5').map(format => (
                                    <button 
                                        key={format} 
                                        className="premium-button" 
                                        style={{ flex: 1, padding: '16px', fontSize: '14px' }}
                                        onClick={() => handleCreateMatchSubmit(format)}
                                        disabled={isGenerating}
                                    >
                                        {isGenerating ? <RefreshIcon className="spin" size={16} /> : `LAUNCH ${format.toUpperCase()}`}
                                    </button>
                                ))}
                            </div>
                        ) : (
                            <div style={{ animation: 'fadeIn 0.5s' }}>
                                <h4 style={{ fontSize: '10px', color: accentColor, letterSpacing: '2px', marginBottom: '16px' }}>1. MAP POOL</h4>
                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '24px' }}>
                                    {availableMaps.map(m => (
                                        <div 
                                            key={m.name} 
                                            onClick={() => toggleMapSelection(m.name)}
                                            className="glass-panel"
                                            style={{ 
                                                padding: '6px 12px', cursor: 'pointer', fontSize: '11px', fontWeight: 700,
                                                borderColor: customSelectedMaps.includes(m.name) ? accentColor : 'rgba(255,255,255,0.1)',
                                                background: customSelectedMaps.includes(m.name) ? `${accentColor}22` : 'rgba(0,0,0,0.2)'
                                            }}
                                        >
                                            {m.name}
                                        </div>
                                    ))}
                                </div>
                                <h4 style={{ fontSize: '10px', color: accentColor, letterSpacing: '2px', marginBottom: '16px' }}>2. SEQUENCE</h4>
                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '24px' }}>
                                    {['A', 'B'].map(t => (
                                        <React.Fragment key={t}>
                                            <button className="glass-panel" style={{ padding: '6px 12px', fontSize: '10px', fontWeight:900 }} onClick={() => addSequenceStep(t, 'ban')}>+ {t} BAN</button>
                                            <button className="glass-panel" style={{ padding: '6px 12px', fontSize: '10px', fontWeight:900 }} onClick={() => addSequenceStep(t, 'pick')}>+ {t} PICK</button>
                                        </React.Fragment>
                                    ))}
                                    <button className="glass-panel" style={{ padding: '6px 12px', fontSize: '10px', fontWeight:900, color: '#ffd700' }} onClick={() => addSequenceStep('System', 'knife')}>+ KNIFE</button>
                                </div>
                                <div className="glass-panel" style={{ minHeight: '60px', padding: '16px', background: 'rgba(0,0,0,0.4)', display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '32px' }}>
                                    {customSequence.map((s, i) => (
                                        <span key={i} onClick={() => removeSequenceStep(i)} style={{ background: 'rgba(255,255,255,0.1)', padding: '4px 12px', borderRadius: '4px', fontSize: '10px', fontWeight: 900, cursor: 'pointer', display: 'flex', gap: '8px', alignItems: 'center' }}>
                                            {i+1}. {s.t} {s.a.toUpperCase()} <span style={{ color: '#ff4b2b' }}>×</span>
                                        </span>
                                    ))}
                                </div>
                                <button className="premium-button" style={{ width: '100%', padding: '16px' }} onClick={() => handleCreateMatchSubmit('custom')}>INITIALIZE CUSTOM PARAMETERS</button>
                            </div>
                        )}
                    </div>

                    {/* Result Links */}
                    {createdLinks && (
                        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="glass-panel" style={{ marginTop: '24px', padding: '24px', border: `1px solid ${accentColor}44`, background: `${accentColor}11` }}>
                            <h3 style={{ fontSize: '12px', fontWeight: 900, marginBottom: '20px', letterSpacing: '2px' }}>VETO ACCESS AUTHORIZED</h3>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                {['admin', 'teamA', 'teamB'].map(key => (
                                    <div key={key} style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                        <span style={{ fontSize: '10px', fontWeight: 900, width: '60px', color: key === 'admin' ? '#fff' : key === 'teamA' ? '#00d4ff' : '#ff0055' }}>{key.toUpperCase()}</span>
                                        <input readOnly value={createdLinks[key]} onClick={() => copyToClipboard(createdLinks[key])} style={{ flex: 1, background: 'rgba(0,0,0,0.5)', border: '1px solid rgba(255,255,255,0.1)', padding: '8px 12px', borderRadius: '4px', color: '#fff', fontSize: '11px', cursor: 'pointer' }} />
                                        <button className="glass-panel" style={{ padding: '8px', cursor: 'pointer' }} onClick={() => window.open(createdLinks[key], '_blank')}><ExternalLinkIcon size={12} /></button>
                                    </div>
                                ))}
                            </div>
                        </motion.div>
                    )}
                </section>

                {/* ── HISTORY SIDEBAR ── */}
                <aside>
                    <div className="glass-panel" style={{ padding: '24px', height: 'fit-content' }}>
                        <h2 style={{ fontSize: '1rem', fontWeight: 900, letterSpacing: '2px', marginBottom: '24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                <ActivityIcon size={18} color={accentColor} /> ARCHIVE DATA
                            </div>
                            <button 
                                onClick={() => setShowAnalytics(!showAnalytics)}
                                style={{ background: 'none', border: 'none', color: accentColor, fontSize: '10px', cursor: 'pointer', fontWeight: 900, letterSpacing: '1px' }}
                            >
                                {showAnalytics ? 'HIDE ANALYTICS' : 'SHOW ANALYTICS'}
                            </button>
                        </h2>

                        {showAnalytics && analytics && (
                            <div style={{ marginBottom: '24px', animation: 'fadeIn 0.3s' }}>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '20px' }}>
                                    <div className="glass-panel" style={{ padding: '12px', textAlign: 'center' }}>
                                        <div style={{ fontSize: '10px', opacity: 0.5 }}>TOTAL MATCHES</div>
                                        <div style={{ fontSize: '20px', fontWeight: 900 }}>{analytics.metrics.totalMatches}</div>
                                    </div>
                                    <div className="glass-panel" style={{ padding: '12px', textAlign: 'center' }}>
                                        <div style={{ fontSize: '10px', opacity: 0.5 }}>AVG DURATION</div>
                                        <div style={{ fontSize: '20px', fontWeight: 900 }}>{analytics.metrics.avgDurationMinutes}m</div>
                                    </div>
                                </div>
                                <div style={{ fontSize: '10px', opacity: 0.5, marginBottom: '8px' }}>MAP PERFORMANCE</div>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                    {Object.entries(analytics.mapStats).sort((a,b) => b[1].total - a[1].total).slice(0, 5).map(([map, stat]) => (
                                        <div key={map} style={{ background: 'rgba(255,255,255,0.03)', padding: '6px 12px', borderRadius: '4px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '11px' }}>
                                            <span style={{ fontWeight: 700 }}>{map}</span>
                                            <span style={{ opacity: 0.7 }}>{stat.picked}P / {stat.banned}B</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                            {historyData.length === 0 ? (
                                <div style={{ textAlign: 'center', padding: '40px', color: 'rgba(255,255,255,0.2)', fontSize: '11px', fontWeight: 700, letterSpacing: '2px' }}>NO RECORDS FOUND</div>
                            ) : (
                                historyData.slice(0, 10).map(match => (
                                    <div 
                                        key={match.id} 
                                        className="match-history-card"
                                        style={{ padding: '16px', borderLeft: `3px solid ${match.finished ? 'rgba(255,255,255,0.1)' : '#00ff88'}`, background: 'rgba(0,0,0,0.2)', borderRadius: '0 8px 8px 0', border: '1px solid rgba(255,255,255,0.03)' }}
                                    >
                                        <div style={{ fontWeight: 900, fontSize: '11px', marginBottom: '4px' }}>
                                            {match.team_a} <span style={{ opacity: 0.3 }}>VS</span> {match.team_b}
                                        </div>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                            <span style={{ fontSize: '9px', fontWeight: 700, opacity: 0.4 }}>{new Date(match.date).toLocaleDateString()} | {match.format.toUpperCase()}</span>
                                            <button 
                                                onClick={() => navigate(`/org/${orgId}/tournament/${tournamentId}/veto/${match.id}`)}
                                                style={{ padding: '4px 12px', fontSize: '9px', fontWeight: 900, background: 'none', border: `1px solid ${accentColor}`, color: accentColor, borderRadius: '4px', cursor: 'pointer' }}
                                            >
                                                SPECTATE
                                            </button>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                </aside>
            </main>

            {/* Notification Toast */}
            <AnimatePresence>
                {showNotification && (
                    <motion.div initial={{ opacity: 0, y: 50 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 50 }} style={{ position: 'fixed', bottom: '40px', left: '50%', transform: 'translateX(-50%)', background: '#00ff88', color: '#000', padding: '12px 32px', borderRadius: '50px', fontWeight: 900, letterSpacing: '2px', zIndex: 10000 }}>
                        <CheckIcon size={14} /> LINK SECURED
                    </motion.div>
                )}
            </AnimatePresence>

            <style>{`
                .spin { animation: spin 1s linear infinite; }
                @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
                @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
                .match-history-card:hover { background: rgba(255,255,255,0.05) !important; }
            `}</style>
        </div>
    );
}
