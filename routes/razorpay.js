const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const Order = require('../models/order'); // import your Order model

// Razorpay webhook endpoint
router.post('/webhook', async (req, res) => {
  const secret = 'YOUR_WEBHOOK_SECRET'; // use the same secret you set in Razorpay dashboard

  const shasum = crypto.createHmac('sha256', secret);
  shasum.update(JSON.stringify(req.body));
  const digest = shasum.digest('hex');

  if (digest !== req.headers['x-razorpay-signature']) {
    return res.status(401).json({ message: 'Invalid signature' });
  }

  const event = req.body.event;
  const payload = req.body.payload;

  try {
    if (event === 'payment.captured') {
      const paymentId = payload.payment.entity.id;
      const razorpayOrderId = payload.payment.entity.order_id;

      await Order.findOneAndUpdate(
        { razorpayOrderId },
        { status: 'Delivered', paymentId } // update status
      );
    } else if (event === 'payment.failed') {
      const paymentId = payload.payment.entity.id;
      const razorpayOrderId = payload.payment.entity.order_id;

      await Order.findOneAndUpdate(
        { razorpayOrderId },
        { status: 'Cancelled', paymentId }
      );
    } else if (event === 'payment.refund.processed') {
      const paymentId = payload.refund.entity.payment_id;
      const razorpayOrderId = payload.refund.entity.order_id;

      await Order.findOneAndUpdate(
        { razorpayOrderId },
        { status: 'Refunded', paymentId }
      );
    }

    res.json({ status: 'ok' });
  } catch (error) {
    console.error('Webhook error:', error);
    res.status(500).json({ status: 'error', error: error.message });
  }
});

module.exports = router;
