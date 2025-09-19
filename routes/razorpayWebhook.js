// // razorpayWebhook.js
// const express = require('express');
// const router = express.Router();
// const crypto = require('crypto');
// const Order = require('../models/order');

// // Replace with your webhook secret from Razorpay dashboard
// const RAZORPAY_WEBHOOK_SECRET = process.env.RAZORPAY_WEBHOOK_SECRET;


// router.post('/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
//   const webhookSignature = req.headers['x-razorpay-signature'];

//   const expectedSignature = crypto
//     .createHmac('sha256', RAZORPAY_WEBHOOK_SECRET)
//     .update(req.body, 'utf-8')
//     .digest('hex');

//   if (expectedSignature !== webhookSignature) {
//     return res.status(400).send('Invalid signature');
//   }

//   const payload = JSON.parse(req.body.toString());
//   const { event, payload: eventData } = payload;

//   try {
//     if (['payment.captured', 'payment.failed', 'payment.refund.processed'].includes(event)) {
//       const paymentId = eventData.payment.entity.id;
//       const orderId = eventData.payment.entity.order_id;
//       let newStatus = '';

//       if (event === 'payment.captured') newStatus = 'Paid';
//       else if (event === 'payment.failed') newStatus = 'Failed';
//       else if (event === 'payment.refund.processed') newStatus = 'Refunded';

//       const order = await Order.findOne({ razorpayOrderId: orderId });
      
//       if (order) {
//         // Update only paymentInfo fields
//         order.paymentInfo = {
//           paymentId,
//           amount: eventData.payment.entity.amount / 100,
//           status,  // Razorpay payment status: 'captured', 'failed', 'refunded'
//           updatedAt: new Date(),
//         };
//         await order.save();
//       }

//     }

//     res.status(200).send('Webhook received');
//   } catch (error) {
//     // Use your logger here
//     console.error('Webhook error:', error);
//     res.status(500).send('Internal server error');
//   }
// });


// module.exports = router;



// // refund status:
// routes/razorpayWebhook.js - Enhanced with refund webhook handling
const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const Order = require('../models/order');
const { logger } = require('../utils/logger');

const RAZORPAY_WEBHOOK_SECRET = process.env.RAZORPAY_WEBHOOK_SECRET;

router.post('/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
  const webhookSignature = req.headers['x-razorpay-signature'];

  // Verify webhook signature
  const expectedSignature = crypto
    .createHmac('sha256', RAZORPAY_WEBHOOK_SECRET)
    .update(req.body, 'utf-8')
    .digest('hex');

  if (expectedSignature !== webhookSignature) {
    logger.error('Invalid webhook signature', { 
      expected: expectedSignature, 
      received: webhookSignature 
    });
    return res.status(400).send('Invalid signature');
  }

  const payload = JSON.parse(req.body.toString());
  const { event, payload: eventData } = payload;

  logger.info('Webhook received', { event, paymentId: eventData.payment?.entity?.id });

  try {
    // Handle Payment Events
    if (['payment.captured', 'payment.failed', 'payment.authorized'].includes(event)) {
      await handlePaymentWebhook(event, eventData);
    }
    
    // Handle Refund Events
    if (['refund.created', 'refund.processed', 'refund.speed_changed'].includes(event)) {
      await handleRefundWebhook(event, eventData);
    }

    res.status(200).send('Webhook received');
  } catch (error) {
    logger.error('Webhook processing error', { 
      event, 
      error: error.message, 
      stack: error.stack 
    });
    res.status(500).send('Internal server error');
  }
});

async function handlePaymentWebhook(event, eventData) {
  const paymentEntity = eventData.payment.entity;
  const paymentId = paymentEntity.id;
  const orderId = paymentEntity.order_id;
  
  logger.info('Processing payment webhook', { event, paymentId, orderId });

  // Find order by razorpayOrderId
  const order = await Order.findOne({ razorpayOrderId: orderId });
  
  if (!order) {
    logger.warn('Order not found for payment webhook', { orderId });
    return;
  }

  // Update payment info based on event
  let paymentStatus = '';
  switch (event) {
    case 'payment.captured':
      paymentStatus = 'captured';
      break;
    case 'payment.failed':
      paymentStatus = 'failed';
      break;
    case 'payment.authorized':
      paymentStatus = 'authorized';
      break;
  }

  order.paymentInfo = {
    paymentId,
    amount: paymentEntity.amount / 100, // Convert from paise to rupees
    status: paymentStatus,
    method: paymentEntity.method,
    updatedAt: new Date(paymentEntity.created_at * 1000),
  };

  // Update order status if payment failed
  if (event === 'payment.failed') {
    order.status = 'Cancelled';
    order.cancelReason = 'Payment failed';
    order.cancelledBy = 'system';
    order.cancelledAt = new Date();
  }

  await order.save();
  
  logger.info('Payment webhook processed successfully', { 
    orderId: order._id, 
    paymentStatus 
  });
}

async function handleRefundWebhook(event, eventData) {
  const refundEntity = eventData.refund.entity;
  const refundId = refundEntity.id;
  const paymentId = refundEntity.payment_id;
  
  logger.info('Processing refund webhook', { event, refundId, paymentId });

  // Find order by payment ID
  const order = await Order.findOne({ 'paymentInfo.paymentId': paymentId });
  
  if (!order) {
    logger.warn('Order not found for refund webhook', { paymentId });
    return;
  }

  // Calculate estimated settlement date based on refund speed
  const estimatedDays = refundEntity.speed_processed === 'optimum' ? 5 : 7;
  const estimatedSettlement = new Date();
  estimatedSettlement.setDate(estimatedSettlement.getDate() + estimatedDays);

  // Update refund info based on event
  switch (event) {
    case 'refund.created':
      order.refundInfo = {
        refundId,
        amount: refundEntity.amount / 100,
        status: refundEntity.status,
        speed: refundEntity.speed_requested || 'normal',
        reason: refundEntity.notes?.reason || 'Refund initiated',
        createdAt: new Date(refundEntity.created_at * 1000),
        estimatedSettlement,
        notes: `Refund initiated via webhook. Expected settlement in ${estimatedDays} business days.`
      };
      break;
      
    case 'refund.processed':
      if (order.refundInfo) {
        order.refundInfo.status = refundEntity.status;
        order.refundInfo.processedAt = new Date(refundEntity.processed_at * 1000);
        order.refundInfo.speed = refundEntity.speed_processed;
        order.refundInfo.notes = `Refund processed successfully. Amount should be credited within ${estimatedDays} business days.`;
      }
      // Update order status to reflect refund
      order.status = 'Refunded';
      break;
      
    case 'refund.speed_changed':
      if (order.refundInfo) {
        order.refundInfo.speed = refundEntity.speed_processed;
        const newEstimatedDays = refundEntity.speed_processed === 'optimum' ? 5 : 7;
        const newSettlement = new Date();
        newSettlement.setDate(newSettlement.getDate() + newEstimatedDays);
        order.refundInfo.estimatedSettlement = newSettlement;
        order.refundInfo.notes = `Refund speed updated to ${refundEntity.speed_processed}. Expected settlement in ${newEstimatedDays} business days.`;
      }
      break;
  }

  await order.save();
  
  logger.info('Refund webhook processed successfully', { 
    orderId: order._id, 
    refundId,
    refundStatus: refundEntity.status 
  });
}

// Health check endpoint for webhook
router.get('/webhook/health', (req, res) => {
  res.status(200).json({ 
    status: 'OK', 
    service: 'Razorpay Webhook Handler',
    timestamp: new Date().toISOString()
  });
});

// Test webhook endpoint (for development only)
if (process.env.NODE_ENV === 'development') {
  router.post('/webhook/test', express.json(), async (req, res) => {
    const { event, orderId, refundData } = req.body;
    
    try {
      if (event === 'refund.processed') {
        const order = await Order.findById(orderId);
        if (order && order.refundInfo) {
          order.refundInfo.status = 'processed';
          order.refundInfo.processedAt = new Date();
          order.status = 'Refunded';
          await order.save();
        }
      }
      
      res.status(200).json({ message: 'Test webhook processed' });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });
}

module.exports = router;