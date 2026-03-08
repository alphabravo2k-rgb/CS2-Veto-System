/**
 * useOrgBranding — fetches org branding and injects CSS custom properties
 * into document.documentElement for white-label theming across all components.
 */

import { useEffect, useRef } from 'react';

const API = import.meta.env.VITE_SOCKET_URL?.replace(/\/$/, '') || 'http://localhost:3001';

const DEFAULT_BRANDING = {
    primary_color: '#00d4ff',
    secondary_color: '#0a0f1e',
    logo_url: null,
    display_name: null,
    banner_url: null,
};

export default function useOrgBranding(orgId) {
    const appliedRef = useRef(null);

    useEffect(() => {
        if (!orgId || orgId === appliedRef.current) return;
        appliedRef.current = orgId;

        let cancelled = false;

        async function fetchBranding() {
            try {
                const res = await fetch(`${API}/api/orgs/${orgId}`);
                if (!res.ok || cancelled) return;
                const data = await res.json();
                const branding = data.branding || DEFAULT_BRANDING;

                const root = document.documentElement;
                root.style.setProperty('--brand-primary', branding.primary_color || DEFAULT_BRANDING.primary_color);
                root.style.setProperty('--brand-secondary', branding.secondary_color || DEFAULT_BRANDING.secondary_color);
                root.style.setProperty('--brand-logo', branding.logo_url ? `url(${branding.logo_url})` : 'none');
                root.style.setProperty('--brand-banner', branding.banner_url ? `url(${branding.banner_url})` : 'none');
                root.style.setProperty('--brand-name', JSON.stringify(branding.display_name || data.name || 'Esports Platform'));
            } catch {
                // Non-fatal — fall back to default brand colors already in CSS
            }
        }

        fetchBranding();
        return () => {
            cancelled = true;
        };
    }, [orgId]);
}

/**
 * Reset all brand CSS variables to platform defaults.
 * Call when leaving an org context (e.g., navigating to GlobalHome).
 */
export function resetBranding() {
    const root = document.documentElement;
    root.style.setProperty('--brand-primary', DEFAULT_BRANDING.primary_color);
    root.style.setProperty('--brand-secondary', DEFAULT_BRANDING.secondary_color);
    root.style.removeProperty('--brand-logo');
    root.style.removeProperty('--brand-banner');
    root.style.removeProperty('--brand-name');
}
