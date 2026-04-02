const supabase = require('../../infra/supabase');

/**
 * ⚡ DOMAIN LAYER — ORGANIZATION SERVICE
 * =============================================================================
 * Responsibility: Multi-tenant business logic, branding resolution, 
 * and organization-level configuration using Supabase.
 * =============================================================================
 */

class OrgService {
    /**
     * Create a new organization and its initial branding.
     */
    async createOrg({ userId, name, slug, primaryColor, secondaryColor, logoUrl }) {
        if (!userId) throw new Error('User ID required');
        
        // 1. Create org
        const { data: org, error: orgErr } = await supabase
            .from('orgs')
            .insert({ id: slug, name, slug })
            .select()
            .single();

        if (orgErr) throw new Error(`Org creation failed: ${orgErr.message}`);

        // 2. Add creator as admin member
        const { error: memErr } = await supabase
            .from('org_members')
            .insert({ org_id: org.id, user_id: userId, role: 'admin' });

        if (memErr) console.error('[OrgService] Failed to add creator as admin:', memErr.message);

        // 3. Initialize branding
        const { error: brandErr } = await supabase
            .from('org_branding')
            .insert({ 
                org_id: org.id, 
                display_name: name, 
                primary_color: primaryColor || '#00d4ff', 
                secondary_color: secondaryColor || '#0a0f1e', 
                logo_url: logoUrl || null 
            });

        if (brandErr) console.error('[OrgService] Branding init failed:', brandErr.message);

        return org;
    }

    /**
     * Resolve branding for a specific organization.
     */
    async getBranding(orgId) {
        const { data, error } = await supabase
            .from('org_branding')
            .select('*')
            .eq('org_id', orgId)
            .single();

        if (error) return null;
        return data;
    }

    /**
     * Fetch all organizations where a user is a member with branding and stats.
     */
    async getUserOrgs(userId) {
        const { data, error } = await supabase
            .from('org_members')
            .select(`
                role,
                orgs (
                    id, name, slug, created_at,
                    org_branding (*),
                    tournaments (count)
                )
            `)
            .eq('user_id', userId);

        if (error) {
            console.error('[OrgService] getUserOrgs failed:', error.message);
            return [];
        }

        return data.map(m => ({
            ...m.orgs,
            userRole: m.role,
            branding: m.orgs.org_branding?.[0] || m.orgs.org_branding, // Handle potential array or single item
            tournamentCount: m.orgs.tournaments[0]?.count || 0
        }));
    }

    /**
     * Get organization with its branding in a single call.
     */
    async getOrgWithBranding(orgId) {
        const { data: org } = await supabase
            .from('orgs')
            .select('*, org_branding (*)')
            .eq('id', orgId)
            .single();

        return org;
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

    /**
     * Get all members of an organization.
     */
    async getMembers(orgId) {
        const { data, error } = await supabase
            .from('org_members')
            .select('user_id, role, users (username, display_name, avatar_url, email)')
            .eq('org_id', orgId);

        if (error) return [];
        return data;
    }

    /**
     * Add a member by email (resolves to UUID).
     */
    async addMember(orgId, { inviteEmail, role }) {
        // Resolve email to UUID
        const { data: user } = await supabase
            .from('users')
            .select('id')
            .eq('email', inviteEmail)
            .single();

        if (!user) throw new Error('User not found by email. They must register first.');

        const { data, error } = await supabase
            .from('org_members')
            .upsert({ org_id: orgId, user_id: user.id, role })
            .select()
            .single();

        if (error) throw new Error(`Member addition failed: ${error.message}`);
        return data;
    }
}

module.exports = new OrgService();
