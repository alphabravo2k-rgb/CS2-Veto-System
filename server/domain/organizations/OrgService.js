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

    /**
     * Create an invite code for an organization.
     * Fixes Gap 2.5 (Invite link system)
     */
    async createInvite(orgId, { creatorId, role = 'member', expiresDays = 7, limit = 1 }) {
        const code = Math.random().toString(36).substring(2, 10).toUpperCase();
        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + expiresDays);

        const { data, error } = await supabase
            .from('org_invites')
            .insert({
                org_id: orgId,
                code,
                created_by: creatorId,
                role,
                expires_at: expiresAt.toISOString(),
                usage_limit: limit
            })
            .select()
            .single();

        if (error) throw new Error(`Invite creation failed: ${error.message}`);
        return data;
    }

    /**
     * Join an organization via invite code.
     */
    async joinByInvite(userId, code) {
        // 1. Resolve code
        const { data: invite, error: invErr } = await supabase
            .from('org_invites')
            .select('*')
            .eq('code', code)
            .single();

        if (invErr || !invite) throw new Error('Invalid or expired invite code');
        if (new Date() > new Date(invite.expires_at)) throw new Error('Invite code has expired');
        if (invite.usage_count >= invite.usage_limit) throw new Error('Invite usage limit reached');

        // 2. Add member
        const { error: memErr } = await supabase
            .from('org_members')
            .insert({ org_id: invite.org_id, user_id: userId, role: invite.role });

        if (memErr) throw new Error(`Failed to join: ${memErr.message}`);

        // 3. Increment usage
        await supabase
            .from('org_invites')
            .update({ usage_count: invite.usage_count + 1 })
            .eq('id', invite.id);

        return { orgId: invite.org_id, role: invite.role };
    }

    /**
     * Check if an organization is eligible to create a new match.
     * Fixes Gap 2.3 & 2.4 (Expiry tracking, Grace period).
     */
    async validateSubscription(orgId) {
        if (orgId === 'global') return { valid: true };

        // 1. Fetch Org Branding/Status
        const { data: branding, error: brandingErr } = await supabase
            .from('org_branding')
            .select('*')
            .eq('org_id', orgId)
            .single();

        if (brandingErr || !branding) {
            return { valid: false, reason: 'Organization not found or inactive' };
        }

        // 2. Handle Trial Plan
        if (branding.plan === 'trial') {
            if (branding.trial_count >= branding.trial_limit) {
                return { valid: false, reason: 'Trial limit reached. Please upgrade to continue.' };
            }
            return { valid: true, type: 'trial' };
        }

        // 3. Handle Paid Plans (Check Subscription Periods)
        const { data: periods, error: periodsErr } = await supabase
            .from('subscription_periods')
            .select('*')
            .eq('org_id', orgId)
            .eq('status', 'active')
            .order('end_date', { ascending: false })
            .limit(1);

        if (periodsErr || !periods || periods.length === 0) {
            return { valid: false, reason: 'No active subscription found. Please renew.' };
        }

        const activePeriod = periods[0];
        const now = new Date();
        const endDate = new Date(activePeriod.end_date);
        
        const GRACE_PERIOD_DAYS = 3;
        const graceDate = new Date(endDate);
        graceDate.setDate(graceDate.getDate() + GRACE_PERIOD_DAYS);

        if (now > graceDate) {
            return { valid: false, reason: `Subscription expired on ${endDate.toLocaleDateString()}. Grace period ended.` };
        }

        if (now > endDate) {
            return { 
                valid: true, 
                warning: `Subscription expired on ${endDate.toLocaleDateString()}. You are currently in a grace period.` 
            };
        }

        return { valid: true };
    }

    /**
     * Increment the trial count for an organization.
     */
    async incrementTrial(orgId) {
        if (orgId === 'global') return;
        
        const { data: branding } = await supabase
            .from('org_branding')
            .select('plan, trial_count')
            .eq('org_id', orgId)
            .single();

        if (branding && branding.plan === 'trial') {
            await supabase
                .from('org_branding')
                .update({ trial_count: (branding.trial_count || 0) + 1 })
                .eq('org_id', orgId);
        }
    }
}

module.exports = new OrgService();
