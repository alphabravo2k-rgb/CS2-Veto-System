/**
 * ⚡ COMP-OS — AUTH VERIFICATION GUARD
 * =============================================================================
 * Responsibility: Intercepts Supabase email-link redirects and renders 
 *                 a high-end "Identity Verified" celebratory theater.
 * VERSION       : v1.0.0 (PREMIUM)
 * =============================================================================
 */

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '../../utils/supabase.js';

const ShieldGlow = ({ color }) => (
    <div style={{ position: 'relative', width: '100px', height: '100px', margin: '0 auto 24px' }}>
        <motion.div 
            animate={{ scale: [1, 1.2, 1], opacity: [0.3, 0.6, 0.3] }}
            transition={{ duration: 2, repeat: Infinity }}
            style={{ position: 'absolute', inset: -20, borderRadius: '50%', background: `radial-gradient(circle, ${color} 0%, transparent 70%)` }}
        />
        <div style={{ position: 'relative', zIndex: 2, width: '100%', height: '100%', background: '#050a14', borderRadius: '50%', border: `3px solid ${color}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                <path d="m9 12 2 2 4-4" />
            </svg>
        </div>
    </div>
);

export default function AuthVerificationGuard() {
    const [showSuccess, setShowSuccess] = useState(false);
    const [isDismissing, setIsDismissing] = useState(false);

    useEffect(() => {
        // Detect the #access_token fragment which Supabase lands on after email confirm
        const hash = window.location.hash;
        if (hash && (hash.includes('access_token=') || hash.includes('type=signup'))) {
            setShowSuccess(true);
            // Cleanup the hash from URL for a professional look
            window.history.replaceState(null, null, window.location.pathname);
        }

        // Also listen for auth event just in case
        const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
            if (event === 'SIGNED_IN' && !session?.user?.last_sign_in_at) {
                // If last_sign_in_at is null, this is likely their first activation
                setShowSuccess(true);
            }
        });

        return () => subscription.unsubscribe();
    }, []);

    const dismiss = () => {
        setIsDismissing(true);
        setTimeout(() => {
            setShowSuccess(false);
            setIsDismissing(false);
        }, 500);
    };

    return (
        <AnimatePresence>
            {showSuccess && (
                <div style={{ position: 'fixed', inset: 0, zIndex: 99999, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(20px)' }}>
                    <motion.div 
                        initial={{ opacity: 0, scale: 0.9, rotateY: -30 }}
                        animate={{ opacity: 1, scale: 1, rotateY: 0 }}
                        exit={{ opacity: 0, scale: 1.1, filter: 'blur(10px)' }}
                        style={{ width: '100%', maxWidth: '440px', padding: '48px', textAlign: 'center', background: '#050a14', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '32px', boxShadow: '0 0 100px rgba(0,212,255,0.15)', position: 'relative', overflow: 'hidden' }}
                    >
                        {/* Digital Scanline Background */}
                        <div style={{ position: 'absolute', inset: 0, background: 'repeating-linear-gradient(transparent, transparent 2px, rgba(255,255,255,0.02) 2px, rgba(255,255,255,0.02) 4px)', pointerEvents: 'none' }} />

                        <ShieldGlow color="#00d4ff" />

                        <div style={{ position: 'relative', zIndex: 10 }}>
                            <h2 style={{ fontSize: '10px', color: '#00d4ff', fontWeight: 900, letterSpacing: '4px', marginBottom: '16px' }}>SIGNAL ESTABLISHED</h2>
                            <h1 style={{ fontSize: '2rem', fontWeight: 900, margin: 0, color: '#fff' }}>IDENTITY VERIFIED</h1>
                            <p style={{ fontSize: '14px', opacity: 0.5, marginTop: '16px', lineHeight: 1.6, fontWeight: 500 }}>
                                Your cryptographic signature has been validated. <br />
                                Access to the Veto Theater is now granted.
                            </p>

                            <motion.button 
                                whileHover={{ scale: 1.05 }}
                                whileTap={{ scale: 0.95 }}
                                onClick={dismiss}
                                style={{ marginTop: '32px', width: '100%', padding: '16px 24px', background: '#00d4ff', color: '#000', border: 'none', borderRadius: '12px', fontWeight: 900, fontSize: '12px', letterSpacing: '2px', cursor: 'pointer', boxShadow: '0 10px 20px rgba(0,212,255,0.2)' }}
                            >
                                SYSTEM INITIALIZE
                            </motion.button>
                        </div>

                        {/* Tech Corner Accents */}
                        <div style={{ position: 'absolute', top: '20px', left: '20px', width: '20px', height: '2px', background: '#00d4ff', opacity: 0.4 }} />
                        <div style={{ position: 'absolute', top: '20px', left: '20px', width: '2px', height: '20px', background: '#00d4ff', opacity: 0.4 }} />
                        <div style={{ position: 'absolute', bottom: '20px', right: '20px', width: '20px', height: '2px', background: '#00d4ff', opacity: 0.4 }} />
                        <div style={{ position: 'absolute', bottom: '20px', right: '20px', width: '2px', height: '20px', background: '#00d4ff', opacity: 0.4 }} />
                    </motion.div>
                </div>
            )}
        </AnimatePresence>
    );
}
