// razorpayWebhook.js
const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const Order = require('../models/order');

// Replace with your webhook secret from Razorpay dashboard
const RAZORPAY_WEBHOOK_SECRET = process.env.RAZORPAY_WEBHOOK_SECRET;

router.post('/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
  const webhookSignature = req.headers['x-razorpay-signature'];
  const body = req.body;

  // Verify signature
  const expectedSignature = crypto
    .createHmac('sha256', RAZORPAY_WEBHOOK_SECRET)
    .update(req.body)
    .digest('hex');

  if (expectedSignature !== webhookSignature) {
    return res.status(400).send('Invalid signature');
  }

  const payload = JSON.parse(req.body.toString());

  const { event, payload: eventData } = payload;

  try {
    if (event === 'payment.captured' || event === 'payment.failed' || event === 'payment.refund.processed') {
      const paymentId = eventData.payment.entity.id;
      const orderId = eventData.payment.entity.order_id;
      const status = eventData.payment.entity.status; // captured, failed, refunded

      // Update order in DB
      const order = await Order.findOne({ razorpayOrderId: orderId });
      if (order) {
        order.status = status === 'captured' ? 'Paid' :
                       status === 'failed' ? 'Failed' :
                       status === 'refunded' ? 'Refunded' : order.status;
        order.paymentInfo = {
          paymentId,
          amount: eventData.payment.entity.amount / 100,
          status: order.status,
          updatedAt: new Date(),
        };
        await order.save();
      }
    }

    res.status(200).send('Webhook received');
  } catch (error) {
    console.error('Webhook error:', error);
    res.status(500).send('Internal server error');
  }
});

module.exports = router;
