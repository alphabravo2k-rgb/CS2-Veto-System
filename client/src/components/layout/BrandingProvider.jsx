import React, { createContext, useContext, useEffect } from 'react';
import { useParams, useLocation } from 'react-router-dom';
import useOrgBranding, { resetBranding } from '../../hooks/useOrgBranding';

const BrandingContext = createContext(null);

/**
 * ⚡ UI LAYER — BRANDING PROVIDER
 * =============================================================================
 * Responsibility: Watches the URL for organizational context (orgId) and 
 * triggers branding injection through the useOrgBranding hook.
 * Resets branding to platform defaults when leaving an org context.
 * =============================================================================
 */
export const BrandingProvider = ({ children }) => {
    const { orgId } = useParams();
    const location = useLocation();

    // The hook handles the side-effect of fetching and injecting CSS vars
    useOrgBranding(orgId);

    // Reset branding if we move to a non-org path (e.g., GlobalHome or Login)
    useEffect(() => {
        const pathParts = location.pathname.split('/').filter(Boolean);
        const isOrgPath = pathParts[0] === 'org' || (pathParts.length >= 3 && pathParts[2] === 'veto');
        
        if (!orgId && !isOrgPath) {
            resetBranding();
        }
    }, [location.pathname, orgId]);

    return (
        <BrandingContext.Provider value={{ currentOrgId: orgId }}>
            {children}
        </BrandingContext.Provider>
    );
};

export const useBranding = () => useContext(BrandingContext);

export default BrandingProvider;
