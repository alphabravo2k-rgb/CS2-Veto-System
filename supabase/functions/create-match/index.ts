/**
 * ⚡ EDGE FUNCTION — CREATE MATCH
 * =============================================================================
 * Responsibility: Initialize a new veto session in Postgres and return keys.
 * This replaces the Socket.io 'create_match' handler.
 * =============================================================================
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.100.0"
import VetoEngine from "../_shared/VetoEngine.ts"
import { getDefaultMapPool } from "../_shared/sequences.ts"

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

    let user = null
    const authHeader = req.headers.get('Authorization')
    if (authHeader) {
      const userClient = createClient(
        Deno.env.get('SUPABASE_URL') ?? '',
        Deno.env.get('SUPABASE_ANON_KEY') ?? '',
        { global: { headers: { Authorization: authHeader } } }
      )
      const { data } = await userClient.auth.getUser()
      user = data?.user || null
    }
    // user may be null for anonymous quick veto — that is allowed

    const payload = await req.json()
    const {
      orgId, tournamentId, teamA, teamB, teamALogo, teamBLogo,
      format, customMapNames, customSequence,
      useTimer, useCoinFlip, timerDuration, tempWebhookUrl,
      gameId = 'cs2' // Default to CS2
    } = payload || {}

    // 1. Sanitize
    const safeTeamA = typeof teamA === 'string' ? teamA.trim().slice(0, 50) : 'Team A'
    const safeTeamB = typeof teamB === 'string' ? teamB.trim().slice(0, 50) : 'Team B'
    const safeOrgId = (!orgId || orgId === 'global') ? null : orgId;
    const safeTId = (!tournamentId || tournamentId === 'default') ? null : tournamentId;

    // 2. Map Pool & Game Logic
    let mapPool = []
    let activeSequence = null

    if (format === 'custom' && Array.isArray(customMapNames) && customMapNames.length > 0) {
      mapPool = customMapNames.map(n => ({ name: String(n).trim().slice(0, 50), customImage: null }))
      activeSequence = customSequence
    } else {
      // Fetch from Game Registry
      const { data: gameData } = await supabase.from('games').select('*').eq('id', gameId).single()
      const { data: mapData } = await supabase.from('global_maps').select('*').eq('game_id', gameId)
      
      if (gameData) activeSequence = gameData.default_sequence
      if (mapData) mapPool = mapData.map(m => ({ name: m.name, customImage: m.image_url }))
      else mapPool = getDefaultMapPool(format).map(n => ({ name: n, customImage: null }))
    }

    // 3. Initialize Veto
    const vetoState = VetoEngine.initializeVeto({
      format,
      mapPool,
      customSequence: activeSequence,
      useTimer: !!useTimer,
      timerDuration: parseInt(timerDuration) || 60,
      useCoinFlip: !!useCoinFlip,
    })

    // 4. Generate Keys
    const generateKey = (len = 16) => {
        const arr = new Uint8Array(len / 2);
        crypto.getRandomValues(arr);
        return Array.from(arr, b => b.toString(16).padStart(2, '0')).join('');
    };
    
    const roomId = generateKey(12);
    const keys = { admin: generateKey(16), A: generateKey(16), B: generateKey(16) };

    // 5. Insert into Postgres
    const { error: insertError } = await supabase
      .from('veto_sessions')
      .insert({
        id: roomId,
        org_id: safeOrgId,
        tournament_id: safeTId,
        date: new Date().toISOString(),
        keys_data: keys,
        team_a: safeTeamA,
        team_b: safeTeamB,
        team_a_logo: teamALogo || null,
        team_b_logo: teamBLogo || null,
        temp_webhook_url: tempWebhookUrl || null,
        game: gameId,
        format: vetoState.format,
        sequence: vetoState.sequence,
        step: vetoState.step,
        maps: vetoState.maps,
        logs: vetoState.logs,
        finished: vetoState.finished,
        last_picked_map: vetoState.lastPickedMap,
        played_maps: vetoState.playedMaps,
        use_timer: vetoState.useTimer,
        timer_duration: vetoState.timerDuration,
        use_coin_flip: vetoState.useCoinFlip,
        coin_flip: vetoState.coinFlip,
        ready: vetoState.ready,
        timer_ends_at: vetoState.timerEndsAt
      })

    if (insertError) throw new Error(insertError.message)

    return new Response(JSON.stringify({ matchId: roomId, roomId, keys }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })

  } catch (err: any) {
    console.error('[create-match] FULL ERROR:', err)
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
