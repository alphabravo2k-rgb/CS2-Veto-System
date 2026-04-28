/**
 * ⚡ UI PRIMITIVES — HIGH-FIDELITY ESM SPORTS COMPONENTS
 * =============================================================================
 * Responsibility: Reusable atoms with neon-flicker, glassmorphism, and 
 * scanline effects to achieve a "UE5-level" visual fidelity.
 * =============================================================================
 */

import React from 'react';
import { motion } from 'framer-motion';

/**
 * NeonText — flickering text effect
 */
export const NeonText = ({ children, color = '#00d4ff', fontSize = '1rem', fontWeight = 900, letterSpacing = '4px', className = '' }) => (
    <motion.span
        className={`neon-text ${className}`}
        animate={{ 
            textShadow: [
                `0 0 10px ${color}, 0 0 20px ${color}`,
                `0 0 5px ${color}, 0 0 10px ${color}`,
                `0 0 10px ${color}, 0 0 20px ${color}`
            ],
            opacity: [1, 0.8, 1, 0.9, 1]
        }}
        transition={{ duration: 0.15, repeat: Infinity, repeatType: 'mirror' }}
        style={{ color: '#fff', fontSize, fontWeight, letterSpacing, textTransform: 'uppercase' }}
    >
        {children}
    </motion.span>
);

/**
 * ScanlineOverlay — holographic CRT scanline effect
 */
export const ScanlineOverlay = () => (
    <div style={{
        position: 'absolute',
        top: 0, left: 0, width: '100%', height: '100%',
        background: 'linear-gradient(rgba(18, 16, 16, 0) 50%, rgba(0, 0, 0, 0.1) 50%), linear-gradient(90deg, rgba(255, 0, 0, 0.03), rgba(0, 255, 0, 0.01), rgba(0, 0, 255, 0.03))',
        backgroundSize: '100% 4px, 3px 100%',
        pointerEvents: 'none',
        zIndex: 5,
        opacity: 0.4
    }} />
);

/**
 * GlassPanel — high-fidelity translucent container
 */
export const GlassPanel = ({ children, style = {}, className = '' }) => (
    <div 
        className={`glass-panel ${className}`}
        style={{
            background: 'rgba(5, 10, 20, 0.7)',
            backdropFilter: 'blur(12px) saturate(180%)',
            border: '1px solid rgba(255, 255, 255, 0.08)',
            boxShadow: '0 8px 32px 0 rgba(0, 0, 0, 0.6)',
            borderRadius: '16px',
            ...style
        }}
    >
        {children}
    </div>
);

/**
 * GlowButton — premium interactive button with hover glow
 */
export const GlowButton = ({ children, onClick, color = '#00d4ff', disabled = false, style = {} }) => (
    <motion.button
        whileHover={!disabled ? { scale: 1.02, boxShadow: `0 0 20px ${color}` } : {}}
        whileTap={!disabled ? { scale: 0.98 } : {}}
        onClick={onClick}
        disabled={disabled}
        style={{
            background: color,
            color: '#000',
            border: 'none',
            padding: '14px 28px',
            borderRadius: '12px',
            fontFamily: 'Rajdhani, sans-serif',
            fontWeight: 800,
            fontSize: '14px',
            letterSpacing: '2px',
            textTransform: 'uppercase',
            cursor: disabled ? 'default' : 'pointer',
            opacity: disabled ? 0.5 : 1,
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            ...style
        }}
    >
        {children}
    </motion.button>
);

export const NeonButton = ({ children, onClick, color = '#00d4ff', disabled = false, style = {}, variant = 'primary' }) => (
    <button
        onClick={onClick}
        disabled={disabled}
        style={{
            background: variant === 'ghost' ? 'transparent' : `${color}22`,
            border: `1px solid ${color}`,
            color: disabled ? 'rgba(255,255,255,0.3)' : '#fff',
            padding: '10px 24px',
            borderRadius: '8px',
            cursor: disabled ? 'not-allowed' : 'pointer',
            fontFamily: 'Rajdhani, sans-serif',
            fontWeight: 900,
            letterSpacing: '2px',
            fontSize: '12px',
            transition: 'all 0.2s',
            boxShadow: disabled ? 'none' : `0 0 12px ${color}44`,
            ...style
        }}
    >
        {children}
    </button>
);
