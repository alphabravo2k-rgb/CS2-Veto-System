/**
 * ⚡ EDGE FUNCTION — CREATE MATCH
 * =============================================================================
 * Responsibility: Initialize a new veto session in Postgres and return keys.
 * This replaces the Socket.io 'create_match' handler.
 * =============================================================================
 */

import { serve } from "https://deno.land/std/http/server.ts"
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

    const payload = await req.json()
    const {
      orgId, tournamentId, teamA, teamB, teamALogo, teamBLogo,
      format, customMapNames, customSequence,
      useTimer, useCoinFlip, timerDuration, tempWebhookUrl
    } = payload || {}

    // 1. Sanitize
    const safeTeamA = typeof teamA === 'string' ? teamA.trim().slice(0, 50) : 'Team A'
    const safeTeamB = typeof teamB === 'string' ? teamB.trim().slice(0, 50) : 'Team B'
    const safeOrgId = orgId || 'global'
    const safeTId = tournamentId || 'default'

    // 2. Map Pool
    let mapPool = getDefaultMapPool(format).map(n => ({ name: n, customImage: null }))
    if (format === 'custom' && Array.isArray(customMapNames) && customMapNames.length > 0) {
      mapPool = customMapNames.map(n => ({ name: String(n).trim().slice(0, 50), customImage: null }))
    }

    // 3. Initialize Veto
    const vetoState = VetoEngine.initializeVeto({
      format,
      mapPool,
      customSequence: format === 'custom' ? customSequence : null,
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
        teamA: safeTeamA,
        teamB: safeTeamB,
        teamALogo,
        teamBLogo,
        tempWebhookUrl,
        ...vetoState
      })

    if (insertError) throw new Error(insertError.message)

    return new Response(JSON.stringify({ roomId, keys }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })

  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
