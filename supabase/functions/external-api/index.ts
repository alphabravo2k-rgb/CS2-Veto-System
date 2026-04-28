/**
 * ⚡ EDGE FUNCTION — EXTERNAL API
 * =============================================================================
 * Responsibility: Provide a public REST interface for 3rd party integrations.
 * Features: Match results retrieval, API key validation (future).
 * =============================================================================
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.100.0"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  const url = new URL(req.url)
  const pathParts = url.pathname.split('/').filter(Boolean)
  
  // Route: /match/:id
  if (pathParts[0] === 'match') {
    const matchId = pathParts[1]
    if (!matchId) return new Response(JSON.stringify({ error: 'Match ID required' }), { status: 400, headers: corsHeaders })

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const { data, error } = await supabase
      .from('veto_sessions')
      .select('id, team_a, team_b, maps, logs, finished, last_picked_map, played_maps, game, date')
      .eq('id', matchId)
      .single()

    if (error || !data) return new Response(JSON.stringify({ error: 'Match not found' }), { status: 404, headers: corsHeaders })

    return new Response(JSON.stringify(data), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  return new Response(JSON.stringify({ message: 'Veto Platform API v1' }), { headers: corsHeaders })
})
