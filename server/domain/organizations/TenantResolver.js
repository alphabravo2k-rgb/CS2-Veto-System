const supabase = require('../../infra/supabase');

/**
 * ⚡ DOMAIN LAYER — TENANT RESOLVER
 * =============================================================================
 * Responsibility: Translates organization slugs to UUIDs and fetches metadata.
 * This is the primary resolution engine for multi-tenant routing.
 * =============================================================================
 */

class TenantResolver {
    /**
     * Resolve an organization by its unique slug.
     * @param {string} slug - The URL-friendly organization name.
     */
    async resolveSlug(slug) {
        if (!slug) return null;

        const { data, error } = await supabase
            .from('orgs')
            .select('id, name, slug')
            .eq('slug', slug.toLowerCase())
            .single();

        if (error || !data) return null;
        return data;
    }

    /**
     * Get the full metadata (branding + info) for an organization.
     */
    async getMetadata(orgId) {
        const { data: org } = await supabase
            .from('orgs')
            .select('*')
            .eq('id', orgId)
            .single();

        if (!org) return null;

        const { data: branding } = await supabase
            .from('org_branding')
            .select('*')
            .eq('org_id', orgId)
            .single();

        return { ...org, branding };
    }
}

module.exports = new TenantResolver();
