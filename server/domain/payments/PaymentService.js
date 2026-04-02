const supabase = require('../../infra/supabase');
const { log } = require('../../infra/auditLog');
const crypto = require('crypto');

/**
 * ⚡ DOMAIN LAYER — PAYMENT SERVICE (NOWPAYMENTS USDT)
 * =============================================================================
 * Responsibility: Secure invoice generation, webhook verification, 
 * and organization plan transitions via NOWPayments.
 * =============================================================================
 */

class PaymentService {
    /**
     * Create a new USDT (TRC20) invoice for an organization.
     */
    async createInvoice(orgId, planId, periodMonths = 1) {
        // 1. Get plan details
        const { data: plan, error: planErr } = await supabase
            .from('plans')
            .select('*')
            .eq('id', planId)
            .single();

        if (planErr || !plan) throw new Error('Invalid plan selected');

        const priceAmount = plan.price_usd * periodMonths;
        const orderId = `${orgId}-${Date.now()}`;

        // 2. Call NOWPayments API
        const response = await fetch('https://api.nowpayments.io/v1/payment', {
            method: 'POST',
            headers: {
                'x-api-key': process.env.NOWPAYMENTS_API_KEY,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                price_amount: priceAmount,
                price_currency: 'USD',
                pay_currency: 'USDTTRC20',
                order_id: orderId,
                ipn_callback_url: `${process.env.APP_URL}/api/payments/webhook`
            })
        });

        const npData = await response.json();
        if (!response.ok) {
            console.error('[PaymentService] NOWPayments Error:', npData);
            throw new Error(npData.message || 'Failed to generate payment address');
        }

        // 3. Store payment record
        const { data: payment, error: payErr } = await supabase
            .from('payments')
            .insert({
                id: orderId,
                org_id: orgId,
                amount_usd: priceAmount,
                amount_crypto: npData.pay_amount,
                currency: 'USDT',
                network: 'TRC20',
                status: 'pending',
                nowpayments_id: npData.payment_id,
                pay_address: npData.pay_address,
                plan: planId,
                period_months: periodMonths,
                expires_at: new Date(Date.now() + 60 * 60 * 1000).toISOString(), // 1 hour
                meta: npData
            })
            .select()
            .single();

        if (payErr) throw new Error(`Failed to store payment: ${payErr.message}`);

        return {
            invoiceId: payment.id,
            payAddress: payment.pay_address,
            payAmount: payment.amount_crypto,
            expiresAt: payment.expires_at
        };
    }

    /**
     * Handle incoming NOWPayments IPN webhook.
     */
    async handleWebhook(payload, signature) {
        // 1. Verify signature
        if (!this.verifySignature(payload, signature)) {
            console.error('[PaymentService] Invalid Webhook Signature');
            throw new Error('Invalid signature');
        }

        const { payment_status, order_id, payment_id } = payload;

        // 2. Update payment status
        if (payment_status === 'finished' || payment_status === 'confirmed') {
            const { data: payment } = await supabase
                .from('payments')
                .update({ 
                    status: 'confirmed', 
                    confirmed_at: new Date().toISOString() 
                })
                .eq('id', order_id)
                .select()
                .single();

            if (payment) {
                // Upgrade organization
                await supabase
                    .from('org_branding')
                    .update({ 
                        plan: payment.plan, 
                        trial_count: 0, 
                        is_registered: true 
                    })
                    .eq('org_id', payment.org_id);

                await log({ 
                    actor_id: 'SYSTEM', 
                    action: 'payment_confirmed', 
                    target_id: payment.org_id, 
                    meta: { payment_id, plan: payment.plan } 
                });
            }
        } else if (payment_status === 'expired') {
            await supabase
                .from('payments')
                .update({ status: 'expired' })
                .eq('id', order_id);
        }

        return { success: true };
    }

    /**
     * Verify NOWPayments HMAC-SHA512 signature.
     */
    verifySignature(payload, signature) {
        if (!signature || !process.env.NOWPAYMENTS_IPN_SECRET) return false;
        
        // NOWPayments sends payload as JSON, but we need sorted keys string for some versions,
        // or the raw body. Usually, it's the raw body string.
        const hmac = crypto.createHmac('sha512', process.env.NOWPAYMENTS_IPN_SECRET);
        const sortedPayload = Object.keys(payload).sort().reduce((acc, key) => {
            acc[key] = payload[key];
            return acc;
        }, {});
        
        const checkString = JSON.stringify(sortedPayload);
        hmac.update(checkString);
        const expected = hmac.digest('hex');
        
        return expected === signature;
    }

    /**
     * Fetch all payments for a specific organization.
     */
    async getOrgPayments(orgId) {
        const { data } = await supabase
            .from('payments')
            .select('*')
            .eq('org_id', orgId)
            .order('created_at', { ascending: false });
        return data || [];
    }

    /**
     * Fetch all platform-wide payments (Admin only).
     */
    async getAllPayments() {
        const { data } = await supabase
            .from('payments')
            .select('*, orgs(name)')
            .order('created_at', { ascending: false });
        return data || [];
    }

    /**
     * Platform Admin: Manually confirm a payment.
     */
    async manualApprove(paymentId, adminUserId) {
        const { data: payment } = await supabase
            .from('payments')
            .update({ 
                status: 'confirmed', 
                confirmed_at: new Date().toISOString(),
                meta: { manual_approved_by: adminUserId }
            })
            .eq('id', paymentId)
            .select()
            .single();

        if (payment) {
            await supabase
                .from('org_branding')
                .update({ 
                    plan: payment.plan, 
                    trial_count: 0, 
                    is_registered: true 
                })
                .eq('org_id', payment.org_id);

            await log({ 
                actor_id: adminUserId, 
                action: 'payment.manual_approve', 
                target_id: paymentId, 
                meta: { org_id: payment.org_id } 
            });
        }
    }

    /**
     * Platform Admin: Manually refund a payment.
     */
    async manualRefund(paymentId, adminUserId, reason) {
        await supabase
            .from('payments')
            .update({ status: 'refunded' })
            .eq('id', paymentId);

        await log({ 
            actor_id: adminUserId, 
            action: 'payment.refund', 
            target_id: paymentId, 
            meta: { reason } 
        });
    }
}

module.exports = new PaymentService();
