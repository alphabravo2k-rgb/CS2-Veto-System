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
        
        // 🛡️ SECURITY: Check if user is suspended
        const { data: user } = await supabase.from('users').select('suspended').eq('id', userId).single();
        if (user?.suspended) throw new Error('Access denied: Account is suspended');
        
        if (!this.isSafeLogoUrl(logoUrl)) throw new Error('Invalid logo URL: XSS detected or unsupported format');
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
        if (brandingData.logo_url && !this.isSafeLogoUrl(brandingData.logo_url)) {
            throw new Error('Invalid logo URL: Potential XSS detected');
        }

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
     * Fixes Gap 4.2.1 & 4.2.2 (Monthly limits, Per-event pricing, PAYG).
     */
    async validateSubscription(orgId, tournamentId = null) {
        if (orgId === 'global' || !orgId) return { valid: true };

        const { data: org, error: orgErr } = await supabase
            .from('orgs')
            .select('plan_id, subscription_status, current_period_end, grace_period_ends, veto_credits')
            .eq('id', orgId)
            .single();

        if (orgErr || !org) return { valid: false, reason: 'Organization not found' };

        // 1. Fetch Plan Features
        const { data: plan } = await supabase.from('plans').select('features').eq('id', org.plan_id).single();
        const features = plan?.features || {};

        // 2. Check Expiry & Grace Period
        const now = new Date();
        const periodEnd = org.current_period_end ? new Date(org.current_period_end) : null;
        const graceEnd = org.grace_period_ends ? new Date(org.grace_period_ends) : null;

        if (periodEnd && now > periodEnd) {
            if (graceEnd && now < graceEnd) {
                // Inside Grace Period
            } else {
                return { valid: false, reason: 'Subscription expired. Please renew to continue.' };
            }
        }

        // 3. Check Monthly Usage (Starter Plan etc.)
        const maxVetoes = features.max_vetoes || -1;
        if (maxVetoes > 0) {
            const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
            const { count, error: countErr } = await supabase
                .from('veto_sessions')
                .select('*', { count: 'exact', head: true })
                .eq('org_id', orgId)
                .gte('created_at', startOfMonth);
            
            if (!countErr && count >= maxVetoes) {
                // If they have PAYG credits, allow them to consume 1 credit
                if (org.veto_credits > 0) {
                    return { valid: true, consumeCredit: true, warning: 'Monthly limit reached. Consuming 1 credit.' };
                }
                return { valid: false, reason: `Monthly limit reached (${maxVetoes}/${maxVetoes}). Upgrade for unlimited vetoes.` };
            }
        }

        // 4. Check Per-Event Payment (Tournament Plan)
        if (features.per_event && tournamentId) {
            const { data: tourney } = await supabase
                .from('tournaments')
                .select('per_event_paid')
                .eq('id', tournamentId)
                .single();
            
            if (tourney && !tourney.per_event_paid) {
                return { valid: false, reason: 'This tournament requires a per-event activation fee.' };
            }
        }

        return { 
            valid: true, 
            warning: periodEnd && now > periodEnd ? 'Subscription in grace period (ends in ' + Math.ceil((graceEnd - now) / (1000 * 60 * 60 * 24)) + ' days)' : null 
        };
    }

    /**
     * Consume a veto credit for an organization.
     */
    async consumeCredit(orgId) {
        const { error } = await supabase.rpc('decrement_veto_credits', { org_id: orgId });
        if (error) console.error('[OrgService] Failed to consume credit:', error.message);
    }

    /**
     * 🛡️ SECURITY: Robust Logo Validation
     * Detects malicious SVGs and suspicious base64 payloads.
     */
    isSafeLogoUrl(url) {
        if (!url) return true;
        if (url.length > 500000) return false; // 0.5MB limit

        // If it's a URL, check common patterns
        if (url.startsWith('http')) {
            const forbidden = ['<script', 'javascript:', 'onerror', 'onload'];
            return !forbidden.some(f => url.toLowerCase().includes(f));
        }

        // If it's base64 data URI
        if (url.startsWith('data:')) {
            if (!url.startsWith('data:image/')) return false;
            // Forbidden characters in decoded base64 (looking for script tags)
            const forbiddenRaw = ['<script', 'javascript:', 'onload=', 'onerror='];
            try {
                const decoded = Buffer.from(url.split(',')[1] || '', 'base64').toString('utf8');
                if (forbiddenRaw.some(f => decoded.toLowerCase().includes(f))) return false;
            } catch {
                return false;
            }
        }
        return true;
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
