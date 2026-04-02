import React from 'react';
import { useNavigate } from 'react-router-dom';

export default function Footer() {
    const navigate = useNavigate();
    
    return (
        <footer style={{ background: '#03070e', borderTop: '1px solid rgba(255,255,255,0.05)', padding: '40px 20px', marginTop: 'auto', position: 'relative', zIndex: 10 }}>
            <div style={{ maxWidth: '1200px', margin: '0 auto', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '20px' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <div style={{ fontSize: '14px', fontWeight: 900, color: '#fff', letterSpacing: '2px' }}>VETO.GG</div>
                    <div style={{ fontSize: '10px', opacity: 0.4, fontWeight: 700, letterSpacing: '1px' }}>
                        THE INDUSTRY STANDARD VETO ENGINE
                    </div>
                </div>

                <div style={{ display: 'flex', gap: '32px', fontSize: '10px', fontWeight: 900, letterSpacing: '2px', opacity: 0.6 }}>
                    <span onClick={() => navigate('/support?tab=faq')} style={{ cursor: 'pointer' }}>FAQ</span>
                    <span onClick={() => navigate('/support?tab=manual')} style={{ cursor: 'pointer' }}>MANUAL</span>
                    <span onClick={() => navigate('/support?tab=help')} style={{ cursor: 'pointer' }}>HELP</span>
                    <span onClick={() => window.open('mailto:feedback@veto.gg')} style={{ cursor: 'pointer', color: '#00d4ff' }}>FEEDBACK</span>
                </div>

                <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: '9px', fontWeight: 900, opacity: 0.3, letterSpacing: '3px', marginBottom: '4px' }}>
                        CO-POWERED BY COMP-OS
                    </div>
                    <div style={{ fontSize: '10px', fontWeight: 900, color: '#fff', letterSpacing: '2px' }}>
                        ENGINEERED BY <span style={{ color: '#00d4ff' }}>ALPHABRAVO2K</span>
                    </div>
                </div>
            </div>
            
            <div style={{ maxWidth: '1200px', margin: '24px auto 0', padding: '16px 0 0', borderTop: '1px solid rgba(255,255,255,0.02)', display: 'flex', justifyContent: 'space-between', fontSize: '8px', opacity: 0.2, fontWeight: 900, letterSpacing: '2px' }}>
                <span>© 2026 VETO.GG • ALL RIGHTS RESERVED</span>
                <span>CRYPTOGRAPHICALLY SECURED TERMINAL</span>
            </div>
        </footer>
    );
}
