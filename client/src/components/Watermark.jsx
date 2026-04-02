/**
 * ⚡ COMPONENT — PLATFORM WATERMARK
 * =============================================================================
 * Responsibility: Displays 'Powered by VETO.GG' based on organization tier.
 * Design: Minimalist, Rajdhani typography, subtle animation.
 * =============================================================================
 */

import React from 'react';
import { motion } from 'framer-motion';

const Watermark = ({ branding }) => {
    if (!branding) return null;

    const { plan, trial_count, trial_limit } = branding;

    // ── DISPLAY LOGIC ──
    let shouldShow = false;

    if (plan === 'free_individual') {
        shouldShow = true;
    } else if (plan === 'org_trial') {
        if (trial_count >= trial_limit) {
            shouldShow = true;
        }
    } else if (plan === 'org_pro' || plan === 'org_enterprise') {
        shouldShow = false;
    }

    if (!shouldShow) return null;

    return (
        <motion.a
            href="/"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 0.35, y: 0 }}
            transition={{ delay: 2, duration: 0.8 }}
            whileHover={{ opacity: 0.7, scale: 1.02 }}
            style={{
                position: 'absolute',
                bottom: '24px',
                right: '24px',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                textDecoration: 'none',
                color: '#fff',
                zIndex: 50,
                cursor: 'pointer',
                userSelect: 'none'
            }}
        >
            <span style={{
                fontFamily: 'Rajdhani, sans-serif',
                fontSize: '13px',
                fontWeight: 700,
                letterSpacing: '0.08em',
                textTransform: 'uppercase'
            }}>
                Powered by VETO.GG
            </span>
            
            {/* Simple Diamond Icon */}
            <svg 
                width="16" 
                height="16" 
                viewBox="0 0 24 24" 
                fill="none" 
                stroke="currentColor" 
                strokeWidth="2.5" 
                strokeLinecap="round" 
                strokeLinejoin="round"
                style={{ color: 'var(--brand-primary, #00d4ff)' }}
            >
                <path d="M12 2l9 10-9 10-9-10z" />
            </svg>
        </motion.a>
    );
};

export default Watermark;
