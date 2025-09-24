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
const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const Order = require('../models/order');
const { logger } = require('../utils/logger');

const RAZORPAY_WEBHOOK_SECRET = process.env.RAZORPAY_WEBHOOK_SECRET;

// Middleware to log all webhook requests for debugging
router.use('/webhook', (req, res, next) => {
  logger.info('Webhook request received', {
    headers: req.headers,
    method: req.method,
    url: req.url,
    timestamp: new Date().toISOString()
  });
  next();
});

router.post('/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
  try {
    const webhookSignature = req.headers['x-razorpay-signature'];
    
    if (!webhookSignature) {
      logger.error('Missing webhook signature');
      return res.status(400).send('Missing signature header');
    }

    if (!RAZORPAY_WEBHOOK_SECRET) {
      logger.error('Webhook secret not configured');
      return res.status(500).send('Webhook secret not configured');
    }

    // Verify webhook signature
    const expectedSignature = crypto
      .createHmac('sha256', RAZORPAY_WEBHOOK_SECRET)
      .update(req.body, 'utf-8')
      .digest('hex');

    if (expectedSignature !== webhookSignature) {
      logger.error('Invalid webhook signature', {
        expected: expectedSignature,
        received: webhookSignature,
        bodyLength: req.body.length
      });
      return res.status(400).send('Invalid signature');
    }

    let payload;
    try {
      payload = JSON.parse(req.body.toString());
    } catch (parseError) {
      logger.error('Invalid JSON in webhook payload', { error: parseError.message });
      return res.status(400).send('Invalid JSON payload');
    }

    const { event, payload: eventData } = payload;

    logger.info('Valid webhook received', { 
      event, 
      entityId: eventData.payment?.entity?.id || eventData.order?.entity?.id || eventData.refund?.entity?.id,
      timestamp: new Date().toISOString()
    });

    // Handle different types of webhook events
    let processed = false;

    // Handle Payment Events
    if (['payment.captured', 'payment.failed', 'payment.authorized', 'payment.created'].includes(event)) {
      await handlePaymentWebhook(event, eventData);
      processed = true;
    }
    
    // Handle Order Events
    if (['order.paid'].includes(event)) {
      await handleOrderWebhook(event, eventData);
      processed = true;
    }
    
    // Handle Refund Events
    if (['refund.created', 'refund.processed', 'refund.failed', 'refund.speed_changed'].includes(event)) {
      await handleRefundWebhook(event, eventData);
      processed = true;
    }

    // Handle Settlement Events (for tracking when money reaches merchant account)
    if (['settlement.processed'].includes(event)) {
      await handleSettlementWebhook(event, eventData);
      processed = true;
    }

    if (!processed) {
      logger.warn('Unhandled webhook event type', { event });
    }

    res.status(200).json({ 
      success: true, 
      message: 'Webhook processed successfully',
      event,
      processed
    });

  } catch (error) {
    logger.error('Critical webhook processing error', { 
      error: error.message, 
      stack: error.stack,
      timestamp: new Date().toISOString()
    });
    res.status(500).send('Internal server error');
  }
});

async function handlePaymentWebhook(event, eventData) {
  const paymentEntity = eventData.payment.entity;
  const paymentId = paymentEntity.id;
  const orderId = paymentEntity.order_id;
  
  logger.info('Processing payment webhook', { event, paymentId, orderId });

  try {
    // Find order by razorpayOrderId
    const order = await Order.findOne({ razorpayOrderId: orderId });
    
    if (!order) {
      logger.warn('Order not found for payment webhook', { orderId, paymentId });
      return;
    }

    // Update payment info based on event
    let paymentStatus = '';
    switch (event) {
      case 'payment.created':
        // paymentStatus = 'created';
        paymentStatus = 'paid';
        break;
      case 'payment.captured':
        paymentStatus = 'captured';
        break;
      case 'payment.failed':
        paymentStatus = 'failed';
        break;
      case 'payment.authorized':
        paymentStatus = 'authorized';
        break;
      default:
        paymentStatus = paymentEntity.status || 'unknown';
    }

    // Always update payment info with the latest data
    order.paymentInfo = {
      paymentId,
      amount: paymentEntity.amount / 100, // Convert from paise to rupees
      status: paymentStatus,
      method: paymentEntity.method || 'unknown',
      updatedAt: new Date(),
      razorpayCreatedAt: paymentEntity.created_at ? new Date(paymentEntity.created_at * 1000) : null,
      // Store additional payment details for debugging
      fee: paymentEntity.fee ? paymentEntity.fee / 100 : 0,
      tax: paymentEntity.tax ? paymentEntity.tax / 100 : 0,
      acquirerData: paymentEntity.acquirer_data || {}
    };

    // Update order status based on payment status
    switch (event) {
      case 'payment.failed':
        order.status = 'Cancelled';
        order.cancelReason = `Payment failed: ${paymentEntity.error_description || 'Unknown error'}`;
        order.cancelledBy = 'system';
        order.cancelledAt = new Date();
        break;
        
      case 'payment.captured':
        // Payment successful - keep order as Pending for admin to process
        if (order.status === 'Cancelled') {
          // If order was previously cancelled due to payment failure, reactivate it
          order.status = 'Pending';
          order.cancelReason = null;
          order.cancelledBy = null;
          order.cancelledAt = null;
        }
        break;
        
      case 'payment.authorized':
        // Payment authorized but not captured yet
        if (order.status === 'Cancelled') {
          order.status = 'Pending'; // Reactivate if was cancelled
        }
        break;
    }

    await order.save();
    
    logger.info('Payment webhook processed successfully', { 
      orderId: order._id, 
      paymentStatus,
      paymentId,
      orderStatus: order.status
    });

  } catch (error) {
    logger.error('Error processing payment webhook', {
      error: error.message,
      stack: error.stack,
      paymentId,
      orderId
    });
    throw error; // Re-throw to trigger webhook retry
  }
}

async function handleOrderWebhook(event, eventData) {
  const orderEntity = eventData.order.entity;
  const razorpayOrderId = orderEntity.id;
  
  logger.info('Processing order webhook', { event, razorpayOrderId });

  try {
    // Find order by razorpayOrderId
    const order = await Order.findOne({ razorpayOrderId });
    
    if (!order) {
      logger.warn('Order not found for order webhook', { razorpayOrderId });
      return;
    }

    // Update order status based on order event
    switch (event) {
      case 'order.paid':
        // Order is fully paid - keep status as Pending until admin marks as Delivered
        if (order.status === 'Pending') {
          logger.info('Order payment completed', { orderId: order._id });
          // Could add a flag to indicate payment is complete
          order.paymentCompleted = true;
          order.paymentCompletedAt = new Date();
        }
        break;
    }

    await order.save();
    
    logger.info('Order webhook processed successfully', { 
      orderId: order._id, 
      event,
      orderStatus: order.status
    });

  } catch (error) {
    logger.error('Error processing order webhook', {
      error: error.message,
      stack: error.stack,
      razorpayOrderId
    });
    throw error;
  }
}

async function handleRefundWebhook(event, eventData) {
  const refundEntity = eventData.refund.entity;
  const refundId = refundEntity.id;
  const paymentId = refundEntity.payment_id;
  
  logger.info('Processing refund webhook', { event, refundId, paymentId });

  try {
    // Find order by payment ID
    const order = await Order.findOne({ 'paymentInfo.paymentId': paymentId });
    
    if (!order) {
      logger.warn('Order not found for refund webhook', { paymentId, refundId });
      return;
    }

    // Calculate estimated settlement date based on refund speed
    const refundSpeed = refundEntity.speed_processed || refundEntity.speed_requested || 'normal';
    const estimatedDays = refundSpeed === 'optimum' ? 5 : 7;
    const estimatedSettlement = new Date();
    estimatedSettlement.setDate(estimatedSettlement.getDate() + estimatedDays);

    // Update refund info based on event
    switch (event) {
      case 'refund.created':
        order.refundInfo = {
          refundId,
          amount: refundEntity.amount / 100,
          status: refundEntity.status || 'created',
          speed: refundSpeed,
          reason: refundEntity.notes?.reason || order.refundInfo?.reason || 'Refund initiated',
          createdAt: new Date(refundEntity.created_at * 1000),
          estimatedSettlement,
          notes: `Refund initiated via webhook. Expected settlement in ${estimatedDays} business days.`,
          // Additional tracking fields
          batchId: refundEntity.batch_id || null,
          receiptNumber: refundEntity.receipt || null
        };
        
        // Update order status to indicate refund is in progress
        if (order.status !== 'Cancelled') {
          order.status = 'Cancelled';
          order.cancelReason = order.cancelReason || 'Refund initiated';
          order.cancelledBy = order.cancelledBy || 'system';
          order.cancelledAt = order.cancelledAt || new Date();
        }
        break;
        
      case 'refund.processed':
        if (order.refundInfo && order.refundInfo.refundId === refundId) {
          order.refundInfo.status = refundEntity.status || 'processed';
          order.refundInfo.processedAt = new Date(refundEntity.processed_at * 1000);
          order.refundInfo.speed = refundEntity.speed_processed || order.refundInfo.speed;
          order.refundInfo.notes = `Refund processed successfully. Amount should be credited within ${estimatedDays} business days.`;
          
          // Update order status to reflect successful refund
          order.status = 'Refunded';
        } else {
          logger.warn('Refund processed webhook for unknown refund', { refundId, orderId: order._id });
        }
        break;
        
      case 'refund.failed':
        if (order.refundInfo && order.refundInfo.refundId === refundId) {
          order.refundInfo.status = 'failed';
          order.refundInfo.failedAt = new Date();
          order.refundInfo.notes = `Refund failed: ${refundEntity.error_description || 'Unknown error'}`;
          order.refundInfo.errorCode = refundEntity.error_code || null;
          order.refundInfo.errorDescription = refundEntity.error_description || null;
          
          // Keep order as cancelled but indicate refund failed
          order.status = 'Cancelled';
        }
        break;
        
      case 'refund.speed_changed':
        if (order.refundInfo && order.refundInfo.refundId === refundId) {
          const newSpeed = refundEntity.speed_processed || refundEntity.speed_requested;
          const newEstimatedDays = newSpeed === 'optimum' ? 5 : 7;
          const newSettlement = new Date();
          newSettlement.setDate(newSettlement.getDate() + newEstimatedDays);
          
          order.refundInfo.speed = newSpeed;
          order.refundInfo.estimatedSettlement = newSettlement;
          order.refundInfo.notes = `Refund speed updated to ${newSpeed}. Expected settlement in ${newEstimatedDays} business days.`;
        }
        break;
    }

    await order.save();
    
    logger.info('Refund webhook processed successfully', { 
      orderId: order._id, 
      refundId,
      refundStatus: order.refundInfo?.status,
      orderStatus: order.status
    });

  } catch (error) {
    logger.error('Error processing refund webhook', {
      error: error.message,
      stack: error.stack,
      refundId,
      paymentId
    });
    throw error;
  }
}

async function handleSettlementWebhook(event, eventData) {
  const settlementEntity = eventData.settlement.entity;
  const settlementId = settlementEntity.id;
  
  logger.info('Processing settlement webhook', { event, settlementId });

  try {
    // Settlement webhooks contain information about when money reaches merchant account
    // This can be useful for tracking but doesn't usually require order updates
    
    // Log settlement for tracking purposes
    logger.info('Settlement processed', {
      settlementId,
      amount: settlementEntity.amount / 100,
      fees: settlementEntity.fees / 100,
      tax: settlementEntity.tax / 100,
      utr: settlementEntity.utr,
      createdAt: new Date(settlementEntity.created_at * 1000)
    });

    // You could update orders to track settlement if needed
    // For now, just log the event

  } catch (error) {
    logger.error('Error processing settlement webhook', {
      error: error.message,
      settlementId
    });
    throw error;
  }
}

// Health check endpoint for webhook
router.get('/webhook/health', (req, res) => {
  res.status(200).json({ 
    status: 'OK', 
    service: 'Razorpay Webhook Handler',
    timestamp: new Date().toISOString(),
    webhookSecret: RAZORPAY_WEBHOOK_SECRET ? 'configured' : 'missing'
  });
});

// Test webhook endpoint (for development only)
if (process.env.NODE_ENV === 'development' || process.env.NODE_ENV === 'test') {
  router.post('/webhook/test', express.json(), async (req, res) => {
    const { event, orderId, refundData, paymentData } = req.body;
    
    try {
      logger.info('Processing test webhook', { event, orderId });
      
      const order = await Order.findById(orderId);
      if (!order) {
        return res.status(404).json({ error: 'Order not found' });
      }

      switch (event) {
        case 'payment.captured':
          order.paymentInfo = {
            ...order.paymentInfo,
            status: 'captured',
            updatedAt: new Date(),
            ...paymentData
          };
          break;
          
        case 'refund.processed':
          if (order.refundInfo) {
            order.refundInfo.status = 'processed';
            order.refundInfo.processedAt = new Date();
            order.status = 'Refunded';
            if (refundData) {
              Object.assign(order.refundInfo, refundData);
            }
          }
          break;
          
        case 'payment.failed':
          order.paymentInfo = {
            ...order.paymentInfo,
            status: 'failed',
            updatedAt: new Date()
          };
          order.status = 'Cancelled';
          order.cancelReason = 'Payment failed (test)';
          break;
      }
      
      await order.save();
      
      res.status(200).json({ 
        message: 'Test webhook processed', 
        orderId: order._id,
        orderStatus: order.status,
        paymentStatus: order.paymentInfo?.status
      });
    } catch (error) {
      logger.error('Test webhook error', { error: error.message });
      res.status(500).json({ error: error.message });
    }
  });
}

// Webhook status and stats endpoint
router.get('/webhook/stats', async (req, res) => {
  try {
    // Get some basic stats about orders and payments
    const totalOrders = await Order.countDocuments();
    const capturedPayments = await Order.countDocuments({ 'paymentInfo.status': 'captured' });
    const failedPayments = await Order.countDocuments({ 'paymentInfo.status': 'failed' });
    const refundedOrders = await Order.countDocuments({ status: 'Refunded' });
    const cancelledOrders = await Order.countDocuments({ status: 'Cancelled' });

    res.status(200).json({
      totalOrders,
      paymentStats: {
        captured: capturedPayments,
        failed: failedPayments,
        successRate: totalOrders > 0 ? ((capturedPayments / totalOrders) * 100).toFixed(2) + '%' : '0%'
      },
      orderStats: {
        refunded: refundedOrders,
        cancelled: cancelledOrders
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Error fetching webhook stats', { error: error.message });
    res.status(500).json({ error: 'Failed to fetch stats' });
  }
});

module.exports = router;