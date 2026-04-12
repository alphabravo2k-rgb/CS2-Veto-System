/**
 * ⚡ EDGE FUNCTION — CREATE PAYMENT
 * =============================================================================
 * Responsibility: Securely interface with NOWPayments API to generate invoices.
 * =============================================================================
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.100.0"

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

    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      throw new Error('Missing Authorization header')
    }

    const userClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    )
    
    const { data: { user }, error: userError } = await userClient.auth.getUser()
    if (userError || !user) throw new Error('Unauthorized')

    const { orgId, planId, periodMonths } = await req.json()
    if (!orgId || !planId || !periodMonths) throw new Error('Missing required fields')

    // Check if user is org admin
    const { data: membership, error: memError } = await supabase
      .from('org_members')
      .select('role')
      .eq('org_id', orgId)
      .eq('user_id', user.id)
      .single()

    if (memError || !membership || !['owner', 'admin'].includes(membership.role)) {
      throw new Error('Not authorized for this organization')
    }

    // Look up plan
    const { data: plan, error: planError } = await supabase
      .from('plans')
      .select('*')
      .eq('id', planId)
      .single()
    
    if (planError || !plan) throw new Error(`Plan not found: ${planId}`)

    const priceUsd = plan.price_usd * periodMonths
    const nowPaymentsKey = Deno.env.get('NOWPAYMENTS_API_KEY')
    if (!nowPaymentsKey) throw new Error('NOWPAYMENTS_API_KEY is not configured')

    const orderId = `${orgId}-${Date.now()}`

    // Call NOWPayments
    const nowResp = await fetch('https://api.nowpayments.io/v1/payment', {
      method: 'POST',
      headers: {
        'x-api-key': nowPaymentsKey,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        price_amount: priceUsd,
        price_currency: 'usd',
        pay_currency: 'USDTTRC20',
        order_id: orderId,
        ipn_callback_url: (Deno.env.get('APP_URL') || 'https://veto.gg') + '/functions/v1/payment-webhook'
      })
    })

    if (!nowResp.ok) {
      const txt = await nowResp.text()
      throw new Error(`NOWPayments API Error: ${txt}`)
    }

    const paymentData = await nowResp.json()
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString() // 1 hour estimate

    // Insert into DB
    const { error: insertError } = await supabase
      .from('payments')
      .insert({
        id: paymentData.payment_id.toString(),
        org_id: orgId,
        amount_usd: priceUsd,
        amount_crypto: paymentData.pay_amount,
        currency: 'USDTTRC20',
        network: 'TRC20',
        status: 'waiting',
        nowpayments_id: paymentData.payment_id.toString(),
        pay_address: paymentData.pay_address,
        plan: planId,
        period_months: periodMonths,
        invoice_url: paymentData.invoice_url,
        expires_at: expiresAt
      })

    if (insertError) throw new Error(`Failed to save payment: ${insertError.message}`)

    return new Response(
      JSON.stringify({
        invoiceId: paymentData.payment_id.toString(),
        payAddress: paymentData.pay_address,
        payAmount: paymentData.pay_amount,
        expiresAt: expiresAt
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (err: any) {
    console.error('[create-payment] ERROR:', err)
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
