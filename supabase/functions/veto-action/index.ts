/**
 * ⚡ EDGE FUNCTION — VETO ACTION
 * =============================================================================
 * Responsibility: Securely handle PICK, BAN, READY, and COIN actions.
 * This replaces the Socket.io 'action' and 'team_ready' handlers.
 * =============================================================================
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.100.0"
import VetoEngine from "../_shared/VetoEngine.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const { matchId, action, data, key } = await req.json()

    // 1. Fetch current match state
    const { data: match, error: fetchError } = await supabase
      .from('veto_sessions')
      .select('*')
      .eq('id', matchId)
      .single()

    if (fetchError || !match) throw new Error('Match not found')
    if (match.finished) throw new Error('Match already finished')

    // 2. Authorize
    const keys = match.keys_data || {}
    let role = 'viewer'
    if (key === keys.admin) role = 'admin'
    else if (key === keys.A) role = 'A'
    else if (key === keys.B) role = 'B'

    if (role === 'viewer') throw new Error('Unauthorized')

    // 3. Process Action via VetoEngine
    let result: any;
    const teamA = match.teamA || 'Team A'
    const teamB = match.teamB || 'Team B'
    const actingAs = role === 'admin' ? (match.sequence[match.step]?.t || role) : role
    const teamName = actingAs === 'A' ? teamA : teamB

    // Hydrate state for engine
    const state = {
      ...match,
      maps: typeof match.maps === 'string' ? JSON.parse(match.maps) : match.maps,
      sequence: typeof match.sequence === 'string' ? JSON.parse(match.sequence) : match.sequence,
      logs: typeof match.logs === 'string' ? JSON.parse(match.logs) : match.logs,
      ready: typeof match.ready === 'string' ? JSON.parse(match.ready) : match.ready,
      coinFlip: typeof match.coinFlip === 'string' ? JSON.parse(match.coinFlip) : match.coinFlip,
      playedMaps: typeof match.playedMaps === 'string' ? JSON.parse(match.playedMaps) : match.playedMaps,
    }

    if (action === 'ready') {
      result = VetoEngine.setTeamReady(state, role, teamName)
    } else if (action === 'coin_call') {
      result = VetoEngine.coinCall(state, data.call, teamA)
    } else if (action === 'coin_decision') {
      result = VetoEngine.coinDecision(state, role, data.decision, teamName)
    } else if (action === 'ban') {
      result = VetoEngine.banMap(state, actingAs, data.mapName, teamName)
    } else if (action === 'pick') {
      result = VetoEngine.pickMap(state, actingAs, data.mapName, teamName)
    } else if (action === 'side') {
      result = VetoEngine.pickSide(state, actingAs, data.side, teamName)
    } else {
      throw new Error(`Invalid action: ${action}`)
    }

    if (result.error) throw new Error(result.error)

    // 4. Update Database
    const finalState = result.state
    const { error: updateError } = await supabase
      .from('veto_sessions')
      .update({
        step: finalState.step,
        maps: finalState.maps,
        logs: finalState.logs,
        finished: finalState.finished,
        lastPickedMap: finalState.lastPickedMap,
        playedMaps: finalState.playedMaps,
        ready: finalState.ready,
        coinFlip: finalState.coinFlip,
        sequence: finalState.sequence, // In case of coin flip swaps
      })
      .eq('id', matchId)

    if (updateError) throw new Error(updateError.message)

    return new Response(JSON.stringify({ success: true, state: finalState }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })

  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
