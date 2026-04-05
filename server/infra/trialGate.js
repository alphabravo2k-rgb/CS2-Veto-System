const supabase = require('../infra/supabase');

/**
 * ⚡ INFRA LAYER — TRIAL GATE
 * =============================================================================
 * Responsibility: Enforcement of match limits and subscription tiers.
 * Prevents creation of matches if the organization has exceeded its quota.
 * =============================================================================
 */

async function checkMatchLimit(orgId) {
    if (!orgId) return { allowed: true }; // Global/System matches are unlimited

    try {
        // 1. Fetch org Tier and Current Match Count
        const { data: org, error: orgError } = await supabase
            .from('org_branding')
            .select('plan, trial_limit, trial_count')
            .eq('org_id', orgId)
            .single();

        if (orgError) {
            console.warn(`[TrialGate] Could not fetch settings for ${orgId}, allowing by default.`);
            return { allowed: true };
        }

        // 2. Enforcement Logic
        if (org.plan === 'free_individual' || org.plan === 'trial') {
            const limit = org.trial_limit || 10;
            if (org.trial_count >= limit) {
                return { 
                    allowed: false, 
                    reason: `MATCH LIMIT REACHED (${org.trial_count}/${limit}). Please upgrade your plan at portal.veto.gg` 
                };
            }
        }

        return { allowed: true };
    } catch (err) {
        console.error(`[TrialGate] Critical enforcement error:`, err);
        return { allowed: true }; // Fail open to prevent service disruption
    }
}

async function incrementMatchCount(orgId) {
    if (!orgId) return;
    
    // Using an RPC call or a direct update for atomicity
    const { error } = await supabase.rpc('increment_match_count', { org_id: orgId });
    
    if (error) {
        // Fallback to manual increment if RPC is missing
        await supabase
            .rpc('increment_matches_created', { x: 1 }) // Common supabase pattern if defined
            .eq('org_id', orgId);
    }
}

module.exports = { checkMatchLimit, incrementMatchCount };
