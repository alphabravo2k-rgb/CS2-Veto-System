const express = require('express');
const PaymentService = require('../domain/payments/PaymentService');
const { requireAuth, requireOrgAdmin, requirePlatformAdmin } = require('../middleware/auth');

/**
 * ⚡ ROUTE — PAYMENT SYSTEM (REST)
 * =============================================================================
 * Responsibility: Secure standard payment management API.
 * =============================================================================
 */

const router = express.Router();

/**
 * POST /api/payments/create
 * Generates NOWPayments USDT TRC20 invoice.
 */
router.post('/create', requireAuth, requireOrgAdmin, async (req, res) => {
    try {
        const { planId, periodMonths } = req.body;
        const result = await PaymentService.createInvoice(req.orgId, planId, periodMonths);
        res.json(result);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

/**
 * POST /api/payments/webhook
 * Handlers NOWPayments IPN. Note: No user auth — uses signature verification.
 */
router.post('/webhook', async (req, res) => {
    try {
        const signature = req.headers['x-nowpayments-sig'];
        const result = await PaymentService.handleWebhook(req.body, signature);
        res.json(result);
    } catch (err) {
        console.error('[Payments Webhook Error]', err.message);
        res.status(400).json({ error: 'Webhook processing failed' });
    }
});

/**
 * GET /api/payments/org/:orgId
 * Fetches billing history for an organization.
 */
router.get('/org/:orgId', requireAuth, requireOrgAdmin, async (req, res) => {
    try {
        const payments = await PaymentService.getOrgPayments(req.orgId);
        res.json(payments);
    } catch (err) {
        res.status(500).json({ error: 'Failed to fetch billing history' });
    }
});

/**
 * GET /api/payments/all
 * Platform-wide payment auditing (Admin only).
 */
router.get('/all', requireAuth, requirePlatformAdmin, async (req, res) => {
    try {
        const payments = await PaymentService.getAllPayments();
        res.json(payments);
    } catch (err) {
        res.status(500).json({ error: 'Failed to fetch platform payments' });
    }
});

/**
 * POST /api/payments/:id/approve
 * Platform Admin: Force-confirm a payment (e.g. manual bank transfer).
 */
router.post('/:id/approve', requireAuth, requirePlatformAdmin, async (req, res) => {
    try {
        await PaymentService.manualApprove(req.params.id, req.user.id);
        res.json({ message: 'Payment confirmed manually' });
    } catch (err) {
        res.status(500).json({ error: 'Failed to approve payment' });
    }
});

/**
 * POST /api/payments/:id/refund
 * Platform Admin: Refund a payment record.
 */
router.post('/:id/refund', requireAuth, requirePlatformAdmin, async (req, res) => {
    try {
        const { reason } = req.body;
        await PaymentService.manualRefund(req.params.id, req.user.id, reason);
        res.json({ message: 'Payment marked as refunded' });
    } catch (err) {
        res.status(500).json({ error: 'Failed to refund payment' });
    }
});

module.exports = router;
