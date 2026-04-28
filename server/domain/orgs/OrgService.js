const supabase = require('../../infra/supabase');

/**
 * ⚡ DOMAIN LAYER — ORG SERVICE
 * =============================================================================
 * Responsibility: Handle organization-level logic, including subscription
 * validation and trial management.
 * =============================================================================
 */

class OrgService {
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
        
        // GRACE PERIOD LOGIC (Fixes Gap 2.4)
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
                .update({ trial_count: branding.trial_count + 1 })
                .eq('org_id', orgId);
        }
    }
}

module.exports = new OrgService();
