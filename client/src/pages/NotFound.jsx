import React from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { AnimatedBackground } from '../components/SharedUI';

/**
 * ⚡ UI LAYER — PREMIUM 404 EXPERIENCE
 * =============================================================================
 * Responsibility: Secure fallback for invalid routes.
 * Features: Hardware-accelerated neon signaling, deep-blur glass panels,
 *           and integrated navigation recovery.
 * =============================================================================
 */
export default function NotFound() {
    const navigate = useNavigate();
    
    return (
        <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: '#050a14', color: '#fff', position: 'relative' }}>
            <AnimatedBackground />

            <motion.div 
                className="glass-panel"
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                style={{ padding: '64px', textAlign: 'center', maxWidth: '480px', position: 'relative', zIndex: 10 }}
            >
                <motion.h1 
                    className="neon-text"
                    animate={{ textShadow: ['0 0 20px rgba(255,75,43,0.4)', '0 0 40px rgba(255,75,43,0.8)', '0 0 20px rgba(255,75,43,0.4)'] }}
                    transition={{ duration: 2, repeat: Infinity }}
                    style={{ fontSize: '8rem', color: '#ff4b2b', margin: 0, fontWeight: 900, lineHeight: 1 }}
                >
                    404
                </motion.h1>
                
                <div style={{ fontSize: '12px', fontWeight: 900, letterSpacing: '6px', color: '#ff4b2b', marginTop: '16px', opacity: 0.8 }}>
                    PAGE NOT FOUND
                </div>
                
                <p style={{ margin: '32px 0', fontSize: '14px', color: 'rgba(255,255,255,0.4)', fontWeight: 600, lineHeight: 1.6 }}>
                    The address you entered does not correspond to any known page on the Veto.GG platform.
                </p>

                <button 
                    onClick={() => navigate('/')} 
                    className="premium-button"
                    style={{ padding: '16px 32px' }}
                >
                    RETURN TO HOMEPAGE
                </button>
            </motion.div>
        </div>
    );
}
