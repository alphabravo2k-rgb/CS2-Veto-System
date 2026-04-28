import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { logAudit } from "../_shared/AuditService.ts"

Deno.serve(async (req) => {
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  )

  try {
    console.log('[SubscriptionWorker] Running check...')
    
    // 1. Find organizations with expired subscriptions
    const now = new Date().toISOString();
    const { data: expiredOrgs, error: fetchErr } = await supabase
      .from('orgs')
      .select('id, plan_id, subscription_status')
      .lt('current_period_end', now)
      .neq('subscription_status', 'canceled')
      .neq('plan_id', 'individual');

    if (fetchErr) throw fetchErr;

    console.log(`[SubscriptionWorker] Found ${expiredOrgs?.length || 0} expired orgs.`)

    for (const org of (expiredOrgs || [])) {
      const expiryDate = new Date(org.current_period_end);
      const graceThreshold = new Date();
      graceThreshold.setDate(graceThreshold.getDate() - 3);

      if (expiryDate < graceThreshold) {
        // Hard Downgrade after 3 days
        console.log(`[SubscriptionWorker] Hard Downgrading org ${org.id} (Grace Period Expired).`)
        await supabase
          .from('orgs')
          .update({ 
            plan_id: 'individual', 
            subscription_status: 'canceled',
            grace_period_ends: null 
          })
          .eq('id', org.id);

        await logAudit(supabase, {
          actor_id: 'system_worker',
          action: 'org.downgraded',
          target_id: org.id,
          meta: { reason: 'grace_period_expired', previous_plan: org.plan_id }
        });
      } else {
        // In Grace Period
        console.log(`[SubscriptionWorker] Org ${org.id} entered grace period.`)
        const graceEnd = new Date(expiryDate);
        graceEnd.setDate(graceEnd.getDate() + 3);

        await supabase
          .from('orgs')
          .update({ 
            subscription_status: 'past_due',
            grace_period_ends: graceEnd.toISOString()
          })
          .eq('id', org.id);
      }
    }

    return new Response(JSON.stringify({ success: true, processed: expiredOrgs?.length || 0 }), {
      headers: { 'Content-Type': 'application/json' },
    })

  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }
})
