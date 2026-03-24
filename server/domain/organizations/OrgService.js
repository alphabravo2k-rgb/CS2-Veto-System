const supabase = require('../../infra/supabase');

/**
 * ⚡ DOMAIN LAYER — ORGANIZATION SERVICE
 * =============================================================================
 * Responsibility: Multi-tenant business logic, branding resolution, 
 * and organization-level configuration.
 * =============================================================================
 */

class OrgService {
    /**
     * Resolve branding for a specific organization.
     * @param {string} orgId - The UUID or slug of the organization.
     */
    async getBranding(orgId) {
        try {
            const { data, error } = await supabase
                .from('org_branding')
                .select('*')
                .eq('org_id', orgId)
                .single();

            if (error) {
                console.error(`[OrgService] Branding fetch error for ${orgId}:`, error.message);
                return null;
            }

            return data;
        } catch (err) {
            console.error(`[OrgService] Unexpected branding error:`, err);
            return null;
        }
    }

    /**
     * Get organization settings (e.g., match limits, enabled features).
     */
    async getSettings(orgId) {
        try {
            const { data, error } = await supabase
                .from('org_settings')
                .select('*')
                .eq('org_id', orgId)
                .single();

            if (error) {
                console.error(`[OrgService] Settings fetch error for ${orgId}:`, error.message);
                return null;
            }

            return data;
        } catch (err) {
            console.error(`[OrgService] Unexpected settings error:`, err);
            return null;
        }
    }

    /**
     * Update branding for an organization.
     */
    async updateBranding(orgId, brandingData) {
        const { data, error } = await supabase
            .from('org_branding')
            .update(brandingData)
            .eq('org_id', orgId)
            .select()
            .single();

        if (error) throw new Error(`[OrgService] Branding update failed: ${error.message}`);
        return data;
    }
}

module.exports = new OrgService();
