import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { BracketGenerator } from '../_shared/BracketGenerator.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const { tournamentId, orgId, teams } = await req.json()

    // 1. Generate Structure
    const structure = BracketGenerator.generateSingleElimination(teams)

    // 2. Save to DB
    const { data: bracket, error: bracketError } = await supabase
      .from('tournament_brackets')
      .insert([{
        tournament_id: tournamentId,
        org_id: orgId,
        structure,
        status: 'active'
      }])
      .select()
      .single()

    if (bracketError) throw bracketError

    // 3. Link to Tournament
    await supabase
      .from('tournaments')
      .update({ bracket_id: bracket.id })
      .eq('id', tournamentId)

    return new Response(JSON.stringify({ success: true, bracketId: bracket.id, structure }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    })

  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    })
  }
})
