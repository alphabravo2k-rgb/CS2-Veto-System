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
    async handleWebhook(payload, signature, rawBodyBuffer) {
        // 1. Verify signature
        if (!this.verifySignature(payload, signature, rawBodyBuffer)) {
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
                await this.activateSubscription(payment, payment_id);
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
     * Internal: Activate or renew a subscription period.
     */
    async activateSubscription(payment, externalRef) {
        const months = payment.period_months || 1;
        const startDate = new Date();
        const endDate = new Date();
        endDate.setMonth(startDate.getMonth() + months);

        // 1. Create subscription period record (Fixes Gap 2.3)
        await supabase
            .from('subscription_periods')
            .insert({
                org_id: payment.org_id,
                plan_id: payment.plan,
                starts_at: startDate.toISOString(),
                ends_at: endDate.toISOString(),
                status: 'active',
                payment_id: payment.id
            });

        // 2. Upgrade organization branding/status
        await supabase
            .from('org_branding')
            .update({ 
                plan: payment.plan, 
                trial_count: 0, 
                is_registered: true 
            })
            .eq('org_id', payment.org_id);

        // 3. Log event
        await log({ 
            actor_id: 'SYSTEM', 
            action: 'payment_confirmed', 
            target_id: payment.org_id, 
            meta: { payment_id: externalRef, plan: payment.plan, expires_at: endDate.toISOString() } 
        });

        // 4. TODO: Send Email Receipt (Gap 2.4)
        console.log(`[PaymentService] Subscription activated for Org ${payment.org_id}. Expires: ${endDate.toISOString()}`);
    }

    /**
     * Verify NOWPayments HMAC-SHA512 signature.
     * NOWPayments recommends using the raw body.
     */
    verifySignature(payload, signature, rawBodyBuffer) {
        if (!signature || !process.env.NOWPAYMENTS_IPN_SECRET) return false;
        
        const hmac = crypto.createHmac('sha512', process.env.NOWPAYMENTS_IPN_SECRET);
        
        if (rawBodyBuffer) {
            hmac.update(rawBodyBuffer);
        } else {
            // NOWPayments IPN verification often requires sorting keys alphabetically if raw body is missing
            const sortedPayload = Object.keys(payload).sort().reduce((acc, key) => {
                acc[key] = payload[key];
                return acc;
            }, {});
            
            const checkString = JSON.stringify(sortedPayload);
            hmac.update(checkString);
        }
        
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
            await this.activateSubscription(payment, `MANUAL-${adminUserId}`);
            
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
