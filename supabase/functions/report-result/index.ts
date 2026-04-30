import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { logAudit } from "../_shared/AuditService.ts"
import { triggerWebhooks } from "../_shared/WebhookService.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const { matchId, scoreA, scoreB, winnerId, key } = await req.json()

    // 1. Verify Admin Key
    const { data: sessionData, error: fetchErr } = await supabase
      .from('veto_sessions')
      .select('team_a, team_b, org_id')
      .eq('id', matchId)
      .single()

    if (fetchErr || !sessionData) throw new Error('Match not found')

    const { data: keysData, error: keysErr } = await supabase
      .from('veto_keys')
      .select('keys_data')
      .eq('match_id', matchId)
      .single()

    if (keysErr || !keysData) throw new Error('Keys not found')
    if (keysData.keys_data.admin !== key) throw new Error('Unauthorized: Admin key required')

    // 2. Update Session
    const { error: updateErr } = await supabase
      .from('veto_sessions')
      .update({
        score_a: scoreA,
        score_b: scoreB,
        winner_id: winnerId,
        result_reported_at: new Date().toISOString()
      })
      .eq('id', matchId)

    if (updateErr) throw updateErr

    // 3. Audit & Webhooks
    await logAudit(supabase, {
      actor_id: 'admin_key',
      action: 'match.reported',
      target_id: matchId,
      meta: { org_id: sessionData.org_id, score_a: scoreA, score_b: scoreB, winner_id: winnerId }
    })

    await triggerWebhooks(supabase, sessionData.org_id, 'match.reported', {
      match_id: matchId,
      score_a: scoreA,
      score_b: scoreB,
      winner_id: winnerId
    })

    // 3. ELO Calculation (Simplified)
    // In a real system, we'd fetch all players in team_a and team_b
    // For now, let's assume team_a and team_b IDs are in the session
    // and we update the 'elo' of those users.
    
    // Placeholder for ELO Logic
    // const K = 32;
    // ... logic ...

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })

  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
