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
import { logAudit } from "../_shared/AuditService.ts"
import { triggerWebhooks } from "../_shared/WebhookService.ts"

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
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    
    let role = 'viewer'
    if (key === keys.admin || key === serviceKey) role = 'admin' // Watchdog or Admin key
    else if (key === keys.A) role = 'A'
    else if (key === keys.B) role = 'B'

    if (role === 'viewer') throw new Error('Unauthorized')

    // 3. Process Action via VetoEngine
    let result: any;
    const teamA = match.team_a || 'Team A'
    const teamB = match.team_b || 'Team B'
    const actingAs = role === 'admin' ? (match.sequence[match.step]?.t || role) : role
    const teamName = actingAs === 'A' ? teamA : teamB

    // Hydrate state for engine
    const state = {
      ...match,
      maps: typeof match.maps === 'string' ? JSON.parse(match.maps) : match.maps,
      sequence: typeof match.sequence === 'string' ? JSON.parse(match.sequence) : match.sequence,
      logs: typeof match.logs === 'string' ? JSON.parse(match.logs) : match.logs,
      ready: typeof match.ready === 'string' ? JSON.parse(match.ready) : match.ready,
      sideHistory: typeof match.side_history === 'string' ? JSON.parse(match.side_history) : match.side_history,
      coinFlip: typeof match.coin_flip === 'string' ? JSON.parse(match.coin_flip) : match.coin_flip,
      playedMaps: typeof match.played_maps === 'string' ? JSON.parse(match.played_maps) : match.played_maps,
      useTimer: match.use_timer,
      timerDuration: match.timer_duration,
      useCoinFlip: match.use_coin_flip,
      lastPickedMap: match.last_picked_map,
      timerEndsAt: match.timer_ends_at,
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
    } else if (action === 'timeout') {
      result = VetoEngine.timeout(state, teamA, teamB)
    } else if (action === 'revert') {
      if (role !== 'admin') throw new Error('Only admin can revert steps')
      result = VetoEngine.revertStep(state)
      await logAudit(supabase, {
        actor_id: role === 'admin' ? 'admin_key' : key,
        action: 'veto.revert',
        target_id: matchId,
        meta: { org_id: match.org_id, step: state.step }
      })
    } else {
      throw new Error(`Invalid action: ${action}`)
    }

    if (result.error) throw new Error(result.error)

    // 4. Handle Next Timer
    const finalState = result.state
    if (finalState.useTimer && !finalState.finished && (action !== 'ready' || (finalState.ready.A && finalState.ready.B))) {
        // If both teams are ready, or if an action was just taken, start the next timer
        const duration = finalState.timerDuration || 60
        finalState.timerEndsAt = new Date(Date.now() + duration * 1000).toISOString()
    } else if (finalState.finished) {
        finalState.timerEndsAt = null
    }

    // 4. Update Database
    const { error: updateError } = await supabase
      .from('veto_sessions')
      .update({
        step: finalState.step,
        maps: finalState.maps,
        logs: finalState.logs,
        finished: finalState.finished,
        last_picked_map: finalState.lastPickedMap,
        played_maps: finalState.playedMaps,
        ready: finalState.ready,
        side_history: finalState.sideHistory,
        coin_flip: finalState.coinFlip,
        sequence: finalState.sequence,
        timer_ends_at: finalState.timerEndsAt,
        status: finalState.finished ? 'finished' : 'veto_in_progress',
        finished_at: finalState.finished ? new Date().toISOString() : null
      })
      .eq('id', matchId)

    if (updateError) throw new Error(updateError.message)

    // 5. Auto-Advance Bracket
    if (finalState.finished && initialData.tournament_id) {
        const { data: bracket } = await supabase
            .from('tournament_brackets')
            .select('*')
            .eq('tournament_id', initialData.tournament_id)
            .single()

        if (bracket && bracket.structure) {
            const structure = bracket.structure
            let updated = false
            const winnerTeam = finalState.logs[finalState.logs.length - 1]?.includes(finalState.teamA) ? finalState.teamA : finalState.teamB
            const winnerId = finalState.logs[finalState.logs.length - 1]?.includes(finalState.teamA) ? initialData.team_a_id : initialData.team_b_id

            // Find current match in bracket
            for (const round of structure.rounds) {
                const matchNode = round.matches.find((m: any) => m.matchId === matchId || (m.teamA?.id === initialData.team_a_id && m.teamB?.id === initialData.team_b_id))
                if (matchNode) {
                    matchNode.winner = winnerId
                    updated = true
                    
                    // Propagate to next match
                    if (matchNode.nextMatchId) {
                        for (const r2 of structure.rounds) {
                            const nextNode = r2.matches.find((nm: any) => nm.id === matchNode.nextMatchId)
                            if (nextNode) {
                                nextNode[matchNode.nextMatchPosition] = { id: winnerId, name: winnerTeam }
                            }
                        }
                    }
                    break
                }
            }

            if (updated) {
                await supabase
                    .from('tournament_brackets')
                    .update({ structure })
                    .eq('id', bracket.id)
            }
        }
    }

    // 4. Outbound Webhook Integration
    if (finalState.finished) {
      await triggerWebhooks(supabase, match.org_id, 'veto.finished', {
        match_id: matchId,
        last_map: finalState.lastPickedMap,
        logs: finalState.logs
      })
    }

    return new Response(JSON.stringify({ success: true, state: finalState }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })

  } catch (err: any) {
    console.error('[veto-action] FULL ERROR:', err)
    return new Response(
      JSON.stringify({ 
        error: err.message,
        detail: err.stack || String(err),
        mode: "debug_200"
      }), 
      { status: 400, headers: { ...corsHeaders, 
        'Content-Type': 'application/json' } }
    )
  }
})
