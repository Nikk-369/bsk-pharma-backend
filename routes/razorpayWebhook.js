// razorpayWebhook.js
const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const Order = require('../models/order');

// Replace with your webhook secret from Razorpay dashboard
const RAZORPAY_WEBHOOK_SECRET = process.env.RAZORPAY_WEBHOOK_SECRET;


router.post('/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
  const webhookSignature = req.headers['x-razorpay-signature'];

  const expectedSignature = crypto
    .createHmac('sha256', RAZORPAY_WEBHOOK_SECRET)
    .update(req.body, 'utf-8')
    .digest('hex');

  if (expectedSignature !== webhookSignature) {
    return res.status(400).send('Invalid signature');
  }

  const payload = JSON.parse(req.body.toString());
  const { event, payload: eventData } = payload;

  try {
    if (['payment.captured', 'payment.failed', 'payment.refund.processed'].includes(event)) {
      const paymentId = eventData.payment.entity.id;
      const orderId = eventData.payment.entity.order_id;
      let newStatus = '';

      if (event === 'payment.captured') newStatus = 'Paid';
      else if (event === 'payment.failed') newStatus = 'Failed';
      else if (event === 'payment.refund.processed') newStatus = 'Refunded';

      const order = await Order.findOne({ razorpayOrderId: orderId });
      // if (order) {
      //   order.status = newStatus || order.status;
      //   order.paymentInfo = {
      //     paymentId,
      //     amount: eventData.payment.entity.amount / 100,
      //     status: order.status,
      //     updatedAt: new Date(),
      //   };
      //   await order.save();
      // }

      if (order) {
        // Update only paymentInfo fields
        order.paymentInfo = {
          paymentId,
          amount: eventData.payment.entity.amount / 100,
          status: newStatus,  // Razorpay payment status: 'captured', 'failed', 'refunded'
          updatedAt: new Date(),
        };
        await order.save();
      }

    }

    res.status(200).send('Webhook received');
  } catch (error) {
    // Use your logger here
    console.error('Webhook error:', error);
    res.status(500).send('Internal server error');
  }
});


module.exports = router;
