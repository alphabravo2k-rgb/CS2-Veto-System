import { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.100.0'

export async function validateSubscription(supabase: SupabaseClient, orgId: string | null, tournamentId: string | null) {
  if (!orgId || orgId === 'global') return { valid: true };

  const { data: org, error: orgErr } = await supabase
    .from('orgs')
    .select('plan_id, current_period_end, grace_period_ends, veto_credits')
    .eq('id', orgId)
    .single();

  if (orgErr || !org) return { valid: false, reason: 'Organization record missing or inaccessible.' };

  // 1. Fetch Plan Features
  const { data: plan } = await supabase.from('plans').select('features').eq('id', org.plan_id).single();
  const features = plan?.features || {};

  // 2. Expiry Check
  const now = new Date();
  const periodEnd = org.current_period_end ? new Date(org.current_period_end) : null;
  const graceEnd = org.grace_period_ends ? new Date(org.grace_period_ends) : null;

  if (periodEnd && now > periodEnd) {
    if (graceEnd && now < graceEnd) {
      // Grace period active
    } else {
      return { valid: false, reason: 'Subscription expired. Please renew to continue creating matches.' };
    }
  }

  // 3. Monthly Limit Check (e.g. Starter 20 vetoes)
  const maxVetoes = features.max_vetoes || -1;
  if (maxVetoes > 0) {
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0,0,0,0);

    const { count, error: countErr } = await supabase
      .from('veto_sessions')
      .select('*', { count: 'exact', head: true })
      .eq('org_id', orgId)
      .gte('created_at', startOfMonth.toISOString());

    if (!countErr && count! >= maxVetoes) {
      // Allow if they have credits
      if (org.veto_credits > 0) {
        return { valid: true, consumeCredit: true };
      }
      return { valid: false, reason: `Monthly quota reached (${count}/${maxVetoes}). Purchase credits or upgrade plan.` };
    }
  }

  // 4. Per-Event Payment (Tournament Plan)
  if (features.per_event && tournamentId) {
    const { data: tourney } = await supabase
      .from('tournaments')
      .select('per_event_paid')
      .eq('id', tournamentId)
      .single();
    
    if (tourney && !tourney.per_event_paid) {
      return { valid: false, reason: 'Tournament activation required. Visit dashboard to pay the per-event fee.' };
    }
  }

  return { valid: true };
}
