const supabase = require('../../infra/supabase');

/**
 * ⚡ DOMAIN LAYER — TRIAL GATE
 * =============================================================================
 * Responsibility: Enforces multi-tenant governance by checking match limits
 * for organizations on the 'trial' plan.
 * =============================================================================
 */

class TrialGate {
    /**
     * Check if an organization is allowed to host more matches.
     * @param {string} orgId - UUID
     * @throws {Error} - If limit exceeded
     */
    async checkLimit(orgId) {
        const { data: branding, error } = await supabase
            .from('org_branding')
            .select('plan, trial_count, trial_limit')
            .eq('org_id', orgId)
            .single();

        if (error || !branding) return true; // Fail open for safety if org branding missing

        if (branding.plan === 'trial') {
            if (branding.trial_count >= branding.trial_limit) {
                const err = new Error('Organization trial limit reached. Please upgrade to a production plan.');
                err.statusCode = 402; // Payment Required
                throw err;
            }
        }

        return true;
    }

    /**
     * Increment the match count for an organization after a successful veto start.
     */
    async incrementCount(orgId) {
        const { data: branding } = await supabase
            .from('org_branding')
            .select('trial_count')
            .eq('org_id', orgId)
            .single();

        if (!branding) return;

        await supabase
            .from('org_branding')
            .update({ trial_count: branding.trial_count + 1 })
            .eq('org_id', orgId);
    }
}

module.exports = new TrialGate();
