import { useEffect, useRef, useState } from 'react';

const API_URL = import.meta.env.VITE_SOCKET_URL ? import.meta.env.VITE_SOCKET_URL.replace(/\/$/, '') : (window.location.hostname === "localhost" ? "http://localhost:3001" : "https://cs2-veto-server-gh3n.onrender.com");

const DEFAULT_BRANDING = {
    primary_color: '#00d4ff',
    secondary_color: '#0a0f1e',
    logo_url: null,
    display_name: null,
    banner_url: null,
    plan: 'free_individual',
    trial_count: 0,
    trial_limit: 3
};

export default function useOrgBranding(orgId) {
    const appliedRef = useRef(null);
    const [branding, setBranding] = useState(DEFAULT_BRANDING);
    const [isLoading, setIsLoading] = useState(false);

    useEffect(() => {
        if (!orgId || orgId === appliedRef.current) return;
        appliedRef.current = orgId;

        let cancelled = false;
        setIsLoading(true);

        async function fetchBranding() {
            try {
                const res = await fetch(`${API_URL}/api/orgs/${orgId}`);
                if (!res.ok || cancelled) {
                    setIsLoading(false);
                    return;
                }
                
                const data = await res.json();
                const fetchedBranding = data.org_branding?.[0] || data.org_branding || DEFAULT_BRANDING;
                
                // Inject CSS Variables
                const root = document.documentElement;
                root.style.setProperty('--brand-primary', fetchedBranding.primary_color || DEFAULT_BRANDING.primary_color);
                root.style.setProperty('--brand-secondary', fetchedBranding.secondary_color || DEFAULT_BRANDING.secondary_color);
                root.style.setProperty('--brand-logo', fetchedBranding.logo_url ? `url(${fetchedBranding.logo_url})` : 'none');
                root.style.setProperty('--brand-banner', fetchedBranding.banner_url ? `url(${fetchedBranding.banner_url})` : 'none');
                root.style.setProperty('--brand-name', JSON.stringify(fetchedBranding.display_name || data.name || 'Esports Platform'));

                if (!cancelled) {
                    setBranding({
                        ...fetchedBranding,
                        name: data.name
                    });
                }
            } catch (err) {
                console.error('[useOrgBranding] Error:', err);
                // Fallback to default
            } finally {
                if (!cancelled) setIsLoading(false);
            }
        }

        fetchBranding();
        return () => {
            cancelled = true;
        };
    }, [orgId]);

    return { branding, isLoading };
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
