// // 4:
// const express = require('express');
// const router = express.Router();
// const Order = require('../models/order');
// const Admin = require('../models/admin'); // Your user model
// const { logger } = require("../utils/logger");
// const Razorpay = require('razorpay');

// // Initialize Razorpay instance
// const razorpayInstance = new Razorpay({
//     key_id: process.env.RAZORPAY_KEY_ID,
//     key_secret: process.env.RAZORPAY_KEY_SECRET,
// });

// // Create Order Route - Complete with email integration
// router.post('/createOrder', async (req, res) => {
//     const { userId, items, address, phone, totalAmount } = req.body;

//     console.log("=== CREATE ORDER REQUEST ===");
//     console.log("Request body:", {
//         userId: !!userId,
//         items: items?.length,
//         address: !!address,
//         phone: !!phone,
//         totalAmount
//     });

//     // Comprehensive validation
//     if (!userId) {
//         return res.status(400).json({
//             success: false,
//             message: "User ID is required"
//         });
//     }

//     if (!items || !Array.isArray(items) || items.length === 0) {
//         return res.status(400).json({
//             success: false,
//             message: "Items are required and must be a non-empty array"
//         });
//     }

//     if (!address?.trim()) {
//         return res.status(400).json({
//             success: false,
//             message: "Address is required"
//         });
//     }

//     if (!phone?.trim()) {
//         return res.status(400).json({
//             success: false,
//             message: "Phone number is required"
//         });
//     }

//     if (!totalAmount || totalAmount <= 0) {
//         return res.status(400).json({
//             success: false,
//             message: "Valid total amount is required"
//         });
//     }

//     try {
//         // Fetch user details for email
//         const user = await Admin.findById(userId);
//         if (!user) {
//             return res.status(404).json({
//                 success: false,
//                 message: "User not found"
//             });
//         }

//         console.log("✅ User found:", user.email);

//         // Validate items structure
//         for (let i = 0; i < items.length; i++) {
//             const item = items[i];
//             if (!item.productId || !item.name || !item.quantity || item.quantity < 1 || !item.price || item.price < 0) {
//                 return res.status(400).json({
//                     success: false,
//                     message: `Invalid item at index ${i}. Each item needs productId, name, quantity (≥1), and price (≥0)`
//                 });
//             }
//         }

//         // Calculate and validate total
//         const calculatedTotal = items.reduce((total, item) => {
//             return total + (item.price * item.quantity);
//         }, 0);

//         if (Math.abs(totalAmount - calculatedTotal) > 0.01) {
//             return res.status(400).json({
//                 success: false,
//                 message: `Total amount mismatch. Expected: ${calculatedTotal}, Received: ${totalAmount}`
//             });
//         }

//         // Create Razorpay Order with customer details including email
//         const razorpayOrder = await razorpayInstance.orders.create({
//             amount: Math.round(totalAmount * 100), // Convert to paise
//             currency: "INR",
//             receipt: `receipt_${Date.now()}_${userId}`,
//             payment_capture: 1,
//             notes: {
//                 userId: userId,
//                 userEmail: user.email,
//                 userName: user.name,
//                 phone: phone,
//                 address: address
//             },
//             // Include customer information for dashboard
//             customer_details: {
//                 name: user.name || 'Customer',
//                 email: user.email,
//                 contact: phone
//             }
//         });

//         console.log("✅ Razorpay order created:", razorpayOrder.id);

//         // Create order in database with user email
//         const newOrder = new Order({
//             userId,
//             userEmail: user.email,
//             userName: user.name,
//             items: items.map(item => ({
//                 productId: item.productId,
//                 name: item.name.trim(),
//                 quantity: parseInt(item.quantity),
//                 price: parseFloat(item.price)
//             })),
//             address: address.trim(),
//             phone: phone.trim(),
//             totalAmount: parseFloat(totalAmount),
//             razorpayOrderId: razorpayOrder.id,
//             paymentInfo: {
//                 amount: totalAmount,
//                 status: 'created',
//                 updatedAt: new Date()
//             },
//             status: 'Pending'
//         });

//         const savedOrder = await newOrder.save();

//         console.log("✅ Order saved to database:", savedOrder._id);

//         logger.info("Order created successfully", {
//             orderId: savedOrder._id,
//             razorpayOrderId: razorpayOrder.id,
//             userId,
//             userEmail: user.email,
//             totalAmount
//         });

//         res.status(201).json({
//             success: true,
//             message: "Order created successfully",
//             orderId: savedOrder._id,
//             razorpayOrderId: razorpayOrder.id,
//             order: {
//                 _id: savedOrder._id,
//                 status: savedOrder.status,
//                 totalAmount: savedOrder.totalAmount,
//                 createdAt: savedOrder.createdAt,
//                 userEmail: savedOrder.userEmail,
//                 userName: savedOrder.userName
//             }
//         });

//     } catch (error) {
//         console.error("❌ Error creating order:", error);
//         logger.error("Order creation failed", {
//             error: error.message,
//             stack: error.stack,
//             userId,
//             totalAmount
//         });

//         // Handle specific MongoDB validation errors
//         if (error.name === 'ValidationError') {
//             const validationErrors = Object.values(error.errors).map(e => e.message);
//             return res.status(400).json({
//                 success: false,
//                 message: "Validation failed: " + validationErrors.join(', ')
//             });
//         }

//         // Handle duplicate key errors
//         if (error.code === 11000) {
//             return res.status(400).json({
//                 success: false,
//                 message: "Duplicate order detected. Please try again."
//             });
//         }

//         res.status(500).json({
//             success: false,
//             message: "Internal server error while creating order",
//             error: error.message
//         });
//     }
// });

// // Get Orders by User ID with complete information
// router.get('/orders/:userId', async (req, res) => {
//     const { userId } = req.params;

//     console.log("=== GET USER ORDERS ===");
//     console.log("User ID:", userId);

//     try {
//         const orders = await Order.find({ userId })
//             .sort({ createdAt: -1 })
//             .populate('items.productId', 'name media')
//             .lean();

//         console.log("✅ Found orders:", orders.length);

//         // Fetch live payment status for each order
//         const ordersWithLiveStatus = await Promise.all(
//             orders.map(async (order) => {
//                 if (order.razorpayOrderId) {
//                     try {
//                         const payments = await razorpayInstance.orders.fetchPayments(order.razorpayOrderId);
//                         const latestPayment = payments.items.length ? payments.items[0] : null;

//                         if (latestPayment && latestPayment.id !== order.paymentInfo?.paymentId) {
//                             // Update payment info with latest data
//                             await Order.findByIdAndUpdate(order._id, {
//                                 'paymentInfo.paymentId': latestPayment.id,
//                                 'paymentInfo.status': latestPayment.status,
//                                 'paymentInfo.method': latestPayment.method,
//                                 'paymentInfo.updatedAt': new Date()
//                             });

//                             order.paymentInfo = {
//                                 ...order.paymentInfo,
//                                 paymentId: latestPayment.id,
//                                 status: latestPayment.status,
//                                 method: latestPayment.method,
//                                 updatedAt: new Date()
//                             };
//                         }

//                         // Check for refunds if order is cancelled
//                         if (order.status === 'Cancelled' && latestPayment && latestPayment.status === 'captured') {
//                             try {
//                                 const refunds = await razorpayInstance.payments.fetchMultipleRefund(latestPayment.id);
//                                 if (refunds.items.length > 0) {
//                                     const latestRefund = refunds.items[0];
//                                     if (latestRefund.id !== order.refundInfo?.refundId) {
//                                         // Update refund info
//                                         const estimatedSettlement = new Date(latestRefund.created_at * 1000);
//                                         estimatedSettlement.setDate(estimatedSettlement.getDate() + (latestRefund.speed_processed === 'optimum' ? 5 : 7));

//                                         await Order.findByIdAndUpdate(order._id, {
//                                             'refundInfo.refundId': latestRefund.id,
//                                             'refundInfo.amount': latestRefund.amount / 100,
//                                             'refundInfo.status': latestRefund.status === 'processed' ? 'processed' : 'initiated',
//                                             'refundInfo.processedAt': latestRefund.processed_at ? new Date(latestRefund.processed_at * 1000) : null,
//                                             'refundInfo.estimatedSettlement': estimatedSettlement,
//                                             'refundInfo.speed': latestRefund.speed_processed || 'optimum'
//                                         });

//                                         order.refundInfo = {
//                                             ...order.refundInfo,
//                                             refundId: latestRefund.id,
//                                             amount: latestRefund.amount / 100,
//                                             status: latestRefund.status === 'processed' ? 'processed' : 'initiated',
//                                             processedAt: latestRefund.processed_at ? new Date(latestRefund.processed_at * 1000) : null,
//                                             estimatedSettlement: estimatedSettlement,
//                                             speed: latestRefund.speed_processed || 'optimum'
//                                         };
//                                     }
//                                 }
//                             } catch (refundError) {
//                                 console.log('No refunds found for payment:', latestPayment.id);
//                             }
//                         }
//                     } catch (paymentError) {
//                         console.log('Error fetching payment for order:', order._id, paymentError.message);
//                     }
//                 }
//                 return order;
//             })
//         );

//         logger.info("User orders fetched successfully", { userId, count: orders.length });

//         res.status(200).json({
//             success: true,
//             orders: ordersWithLiveStatus,
//             totalCount: orders.length
//         });

//     } catch (error) {
//         console.error("❌ Error fetching user orders:", error);
//         logger.error("Error fetching user orders", { error: error.message, userId });

//         res.status(500).json({
//             success: false,
//             message: "Failed to fetch orders",
//             error: error.message
//         });
//     }
// });

// // Get All Orders (Admin) with complete information
// router.get('/orders', async (req, res) => {
//     console.log("=== GET ALL ORDERS (ADMIN) ===");

//     try {
//         const orders = await Order.find()
//             .sort({ createdAt: -1 })
//             .populate('userId', 'name email phone')
//             .populate('items.productId', 'name media')
//             .lean();

//         console.log("✅ Found all orders:", orders.length);

//         logger.info("All orders fetched successfully", { count: orders.length });

//         res.status(200).json({
//             success: true,
//             orders: orders,
//             totalCount: orders.length
//         });

//     } catch (error) {
//         console.error("❌ Error fetching all orders:", error);
//         logger.error("Error fetching all orders", { error: error.message });

//         res.status(500).json({
//             success: false,
//             message: "Failed to fetch orders",
//             error: error.message
//         });
//     }
// });

// // Update Order Status with Smart Refund Processing - ONLY ADMINS CAN TRIGGER REFUNDS
// router.put('/orders/:orderId/status', async (req, res) => {
//     const { orderId } = req.params;
//     const { status, cancelReason } = req.body;

//     console.log("=== UPDATE ORDER STATUS ===");
//     console.log("Order ID:", orderId, "New Status:", status, "Reason:", cancelReason);

//     if (!['Pending', 'Delivered', 'Cancelled'].includes(status)) {
//         return res.status(400).json({
//             success: false,
//             message: "Invalid status. Must be Pending, Delivered, or Cancelled"
//         });
//     }

//     try {
//         const order = await Order.findById(orderId);
//         if (!order) {
//             return res.status(404).json({
//                 success: false,
//                 message: "Order not found"
//             });
//         }

//         let refundProcessed = false;

//         // If admin is cancelling and payment was captured, process automatic refund
//         if (status === 'Cancelled' && order.status !== 'Cancelled') {
//             // Check if payment exists and is captured
//             if (order.paymentInfo?.paymentId && order.paymentInfo?.status === 'captured') {
//                 console.log("💰 Processing automatic refund for cancelled order");

//                 try {
//                     const refund = await razorpayInstance.payments.refund(
//                         order.paymentInfo.paymentId,
//                         {
//                             amount: Math.round(order.totalAmount * 100),
//                             speed: 'optimum',
//                             notes: {
//                                 reason: cancelReason || 'Order cancelled by admin',
//                                 orderId: order._id.toString()
//                             },
//                             receipt: `refund_${order._id}_${Date.now()}`
//                         }
//                     );

//                     console.log("✅ Refund initiated:", refund.id);

//                     // Calculate estimated settlement date
//                     const estimatedSettlement = new Date();
//                     estimatedSettlement.setDate(estimatedSettlement.getDate() + 5); // 5 days for optimum

//                     // Update order with refund info
//                     order.refundInfo = {
//                         refundId: refund.id,
//                         amount: refund.amount / 100,
//                         status: 'initiated',
//                         reason: cancelReason || 'Order cancelled by admin',
//                         initiatedAt: new Date(),
//                         estimatedSettlement: estimatedSettlement,
//                         speed: 'optimum'
//                     };

//                     refundProcessed = true;

//                 } catch (refundError) {
//                     console.error("❌ Refund failed:", refundError);
//                     logger.error("Refund processing failed", {
//                         orderId,
//                         paymentId: order.paymentInfo.paymentId,
//                         error: refundError.message
//                     });

//                     // Continue with cancellation even if refund fails
//                     // Admin can manually process refund later
//                 }
//             }

//             // Update cancellation details
//             order.status = 'Cancelled';
//             order.cancelReason = cancelReason || 'Cancelled by admin';
//             order.cancelledBy = 'admin';
//             order.cancelledAt = new Date();

//         } else {
//             // Regular status update
//             order.status = status;
//         }

//         await order.save();

//         console.log("✅ Order status updated successfully");
//         logger.info("Order status updated", {
//             orderId,
//             newStatus: status,
//             refundInitiated: !!order.refundInfo?.refundId
//         });

//         res.status(200).json({
//             success: true,
//             message: "Order status updated successfully",
//             order: {
//                 _id: order._id,
//                 status: order.status,
//                 paymentInfo: order.paymentInfo,
//                 refundInfo: order.refundInfo,
//                 cancelReason: order.cancelReason,
//                 cancelledAt: order.cancelledAt
//             },
//             refundProcessed: refundProcessed
//         });

//     } catch (error) {
//         console.error("❌ Error updating order status:", error);
//         logger.error("Error updating order status", { orderId, error: error.message });

//         res.status(500).json({
//             success: false,
//             message: "Failed to update order status",
//             error: error.message
//         });
//     }
// });

// // Get Payment Status with complete details including Payment ID
// router.get('/paymentStatus/:orderId', async (req, res) => {
//     const { orderId } = req.params;

//     console.log("=== GET PAYMENT STATUS ===");
//     console.log("Order ID:", orderId);

//     try {
//         const order = await Order.findById(orderId);
//         if (!order) {
//             return res.status(404).json({
//                 success: false,
//                 message: "Order not found"
//             });
//         }

//         let latestPaymentInfo = order.paymentInfo;
//         let latestRefundInfo = order.refundInfo;
//         let razorpayPayments = [];
//         let razorpayRefunds = [];

//         // Fetch live data from Razorpay
//         if (order.razorpayOrderId) {
//             try {
//                 const payments = await razorpayInstance.orders.fetchPayments(order.razorpayOrderId);
//                 razorpayPayments = payments.items;

//                 const latestPayment = payments.items.length ? payments.items[0] : null;
//                 if (latestPayment) {
//                     latestPaymentInfo = {
//                         paymentId: latestPayment.id, // This ensures Payment ID is included
//                         amount: latestPayment.amount / 100,
//                         status: latestPayment.status,
//                         method: latestPayment.method,
//                         capturedAt: latestPayment.captured_at ? new Date(latestPayment.captured_at * 1000) : null,
//                         failedAt: latestPayment.failed_at ? new Date(latestPayment.failed_at * 1000) : null,
//                         updatedAt: new Date()
//                     };

//                     // Fetch refunds for this payment
//                     if (latestPayment.status === 'captured') {
//                         try {
//                             const refunds = await razorpayInstance.payments.fetchMultipleRefund(latestPayment.id);
//                             razorpayRefunds = refunds.items;

//                             if (refunds.items.length > 0) {
//                                 const latestRefund = refunds.items[0];
//                                 const estimatedSettlement = new Date(latestRefund.created_at * 1000);
//                                 estimatedSettlement.setDate(estimatedSettlement.getDate() + (latestRefund.speed_processed === 'optimum' ? 5 : 7));

//                                 latestRefundInfo = {
//                                     refundId: latestRefund.id,
//                                     amount: latestRefund.amount / 100,
//                                     status: latestRefund.status === 'processed' ? 'processed' : 'initiated',
//                                     reason: latestRefund.notes?.reason || 'Refund processed',
//                                     initiatedAt: new Date(latestRefund.created_at * 1000),
//                                     processedAt: latestRefund.processed_at ? new Date(latestRefund.processed_at * 1000) : null,
//                                     estimatedSettlement: estimatedSettlement,
//                                     speed: latestRefund.speed_processed || 'optimum'
//                                 };
//                             }
//                         } catch (refundError) {
//                             console.log('No refunds found for payment:', latestPayment.id);
//                         }
//                     }

//                     // Update order with latest info
//                     await Order.findByIdAndUpdate(orderId, {
//                         paymentInfo: latestPaymentInfo,
//                         refundInfo: latestRefundInfo
//                     });
//                 }
//             } catch (razorpayError) {
//                 console.error("Error fetching from Razorpay:", razorpayError.message);
//             }
//         }

//         res.status(200).json({
//             success: true,
//             paymentInfo: latestPaymentInfo,
//             refundInfo: latestRefundInfo,
//             razorpayPayments,
//             razorpayRefunds,
//             order: {
//                 _id: order._id,
//                 status: order.status,
//                 totalAmount: order.totalAmount,
//                 createdAt: order.createdAt,
//                 userEmail: order.userEmail
//             }
//         });

//     } catch (error) {
//         console.error("❌ Error fetching payment status:", error);
//         logger.error("Error fetching payment status", { orderId, error: error.message });

//         res.status(500).json({
//             success: false,
//             message: "Failed to fetch payment status",
//             error: error.message
//         });
//     }
// });

// // Capture Payment endpoint
// router.post('/capturePayment/:orderId', async (req, res) => {
//     const { orderId } = req.params;

//     console.log("=== CAPTURE PAYMENT ===");
//     console.log("Order ID:", orderId);

//     try {
//         const order = await Order.findById(orderId);
//         if (!order) {
//             return res.status(404).json({
//                 success: false,
//                 message: "Order not found"
//             });
//         }

//         if (!order.paymentInfo?.paymentId) {
//             return res.status(400).json({
//                 success: false,
//                 message: "No payment found for this order"
//             });
//         }

//         if (order.paymentInfo.status !== 'authorized') {
//             return res.status(400).json({
//                 success: false,
//                 message: "Payment is not in authorized state"
//             });
//         }

//         // Capture the payment
//         const capturedPayment = await razorpayInstance.payments.capture(
//             order.paymentInfo.paymentId,
//             Math.round(order.totalAmount * 100),
//             'INR'
//         );

//         // Update order with captured payment info
//         order.paymentInfo.status = 'captured';
//         order.paymentInfo.capturedAt = new Date();
//         order.paymentInfo.updatedAt = new Date();

//         await order.save();

//         console.log("✅ Payment captured successfully");

//         res.status(200).json({
//             success: true,
//             message: "Payment captured successfully",
//             paymentInfo: order.paymentInfo
//         });

//     } catch (error) {
//         console.error("❌ Error capturing payment:", error);
//         res.status(500).json({
//             success: false,
//             message: "Failed to capture payment",
//             error: error.message
//         });
//     }
// });

// // Manual refund endpoint for admins
// router.post('/orders/:orderId/refund', async (req, res) => {
//     const { orderId } = req.params;
//     const { amount, reason } = req.body;

//     try {
//         const order = await Order.findById(orderId);
//         if (!order) {
//             return res.status(404).json({
//                 success: false,
//                 message: "Order not found"
//             });
//         }

//         if (!order.paymentInfo?.paymentId || order.paymentInfo?.status !== 'captured') {
//             return res.status(400).json({
//                 success: false,
//                 message: "Cannot refund: Payment not captured"
//             });
//         }

//         if (order.refundInfo?.refundId) {
//             return res.status(400).json({
//                 success: false,
//                 message: "Refund already processed for this order"
//             });
//         }

//         const refundAmount = amount || order.totalAmount;
//         const refund = await razorpayInstance.payments.refund(
//             order.paymentInfo.paymentId,
//             {
//                 amount: Math.round(refundAmount * 100),
//                 speed: 'optimum',
//                 notes: { reason: reason || 'Manual refund by admin' }
//             }
//         );

//         // Update order with refund info
//         const estimatedSettlement = new Date();
//         estimatedSettlement.setDate(estimatedSettlement.getDate() + 5);

//         order.refundInfo = {
//             refundId: refund.id,
//             amount: refund.amount / 100,
//             status: 'initiated',
//             reason: reason || 'Manual refund by admin',
//             initiatedAt: new Date(),
//             estimatedSettlement: estimatedSettlement,
//             speed: 'optimum'
//         };

//         await order.save();

//         res.status(200).json({
//             success: true,
//             message: "Refund initiated successfully",
//             refund: order.refundInfo
//         });

//     } catch (error) {
//         console.error("Error processing refund:", error);
//         res.status(500).json({
//             success: false,
//             message: "Failed to process refund",
//             error: error.message
//         });
//     }
// });

// // Get refund status for specific order
// router.get('/orders/:orderId/refund-status', async (req, res) => {
//     const { orderId } = req.params;

//     try {
//         const order = await Order.findById(orderId);
//         if (!order) {
//             return res.status(404).json({
//                 success: false,
//                 message: "Order not found"
//             });
//         }

//         let refundInfo = order.refundInfo;

//         // If refund exists, fetch latest status from Razorpay
//         if (order.refundInfo?.refundId && order.paymentInfo?.paymentId) {
//             try {
//                 const refunds = await razorpayInstance.payments.fetchMultipleRefund(order.paymentInfo.paymentId);
//                 const latestRefund = refunds.items.find(r => r.id === order.refundInfo.refundId);

//                 if (latestRefund) {
//                     const estimatedSettlement = new Date(latestRefund.created_at * 1000);
//                     estimatedSettlement.setDate(estimatedSettlement.getDate() + (latestRefund.speed_processed === 'optimum' ? 5 : 7));

//                     refundInfo = {
//                         refundId: latestRefund.id,
//                         amount: latestRefund.amount / 100,
//                         status: latestRefund.status === 'processed' ? 'processed' : 'initiated',
//                         reason: order.refundInfo.reason || 'Refund processed',
//                         initiatedAt: new Date(latestRefund.created_at * 1000),
//                         processedAt: latestRefund.processed_at ? new Date(latestRefund.processed_at * 1000) : null,
//                         estimatedSettlement: estimatedSettlement,
//                         speed: latestRefund.speed_processed || 'optimum'
//                     };

//                     // Update in database
//                     await Order.findByIdAndUpdate(orderId, { refundInfo });
//                 }
//             } catch (error) {
//                 console.log('Error fetching refund status:', error.message);
//             }
//         }

//         res.status(200).json({
//             success: true,
//             refundInfo: refundInfo
//         });

//     } catch (error) {
//         console.error("Error fetching refund status:", error);
//         res.status(500).json({
//             success: false,
//             message: "Failed to fetch refund status",
//             error: error.message
//         });
//     }
// });

// // Get order count
// router.get('/totalOrdercount', async (req, res) => {
//     try {
//         const count = await Order.countDocuments();
//         res.status(200).json({
//             success: true,
//             totalOrders: count
//         });
//     } catch (error) {
//         console.error("Error getting order count:", error);
//         res.status(500).json({
//             success: false,
//             message: "Failed to get order count"
//         });
//     }
// });

// // Test route
// router.get('/test', (req, res) => {
//     res.json({
//         success: true,
//         message: "Order routes working!",
//         timestamp: new Date().toISOString()
//     });
// });

// module.exports = router;

// // final:
const express = require('express');
const router = express.Router();
const Order = require('../models/order');
const Admin = require('../models/admin');
const { logger } = require("../utils/logger");
const Razorpay = require('razorpay');

// Initialize Razorpay instance
const razorpayInstance = new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID,
    key_secret: process.env.RAZORPAY_KEY_SECRET,
});

// Create Order Route - Fixed refund initialization
router.post('/createOrder', async (req, res) => {
    const { userId, items, address, phone, totalAmount } = req.body;

    console.log("=== CREATE ORDER REQUEST ===");
    console.log("Request body:", {
        userId: !!userId,
        items: items?.length,
        address: !!address,
        phone: !!phone,
        totalAmount
    });

    // Comprehensive validation
    if (!userId) {
        return res.status(400).json({
            success: false,
            message: "User ID is required"
        });
    }

    if (!items || !Array.isArray(items) || items.length === 0) {
        return res.status(400).json({
            success: false,
            message: "Items are required and must be a non-empty array"
        });
    }

    if (!address?.trim()) {
        return res.status(400).json({
            success: false,
            message: "Address is required"
        });
    }

    if (!phone?.trim()) {
        return res.status(400).json({
            success: false,
            message: "Phone number is required"
        });
    }

    if (!totalAmount || totalAmount <= 0) {
        return res.status(400).json({
            success: false,
            message: "Valid total amount is required"
        });
    }

    try {
        // Fetch user details for email
        const user = await Admin.findById(userId);
        if (!user) {
            return res.status(404).json({
                success: false,
                message: "User not found"
            });
        }

        console.log("✅ User found:", user.email);

        // Validate items structure
        for (let i = 0; i < items.length; i++) {
            const item = items[i];
            if (!item.productId || !item.name || !item.quantity || item.quantity < 1 || !item.price || item.price < 0) {
                return res.status(400).json({
                    success: false,
                    message: `Invalid item at index ${i}. Each item needs productId, name, quantity (≥1), and price (≥0)`
                });
            }
        }

        // Calculate and validate total
        const calculatedTotal = items.reduce((total, item) => {
            return total + (item.price * item.quantity);
        }, 0);

        if (Math.abs(totalAmount - calculatedTotal) > 0.01) {
            return res.status(400).json({
                success: false,
                message: `Total amount mismatch. Expected: ${calculatedTotal}, Received: ${totalAmount}`
            });
        }

        // Create Razorpay Order with customer details including email
        const razorpayOrder = await razorpayInstance.orders.create({
            amount: Math.round(totalAmount * 100), // Convert to paise
            currency: "INR",
            receipt: `receipt_${Date.now()}_${userId}`,
            payment_capture: 1,
            notes: {
                userId: userId,
                userEmail: user.email,
                userName: user.name,
                phone: phone,
                address: address
            },
            customer_details: {
                name: user.name || 'Customer',
                email: user.email,
                contact: phone
            }
        });

        console.log("✅ Razorpay order created:", razorpayOrder.id);

        // Create order in database WITHOUT default refund status
        const newOrder = new Order({
            userId,
            userEmail: user.email,
            userName: user.name,
            items: items.map(item => ({
                productId: item.productId,
                name: item.name.trim(),
                quantity: parseInt(item.quantity),
                price: parseFloat(item.price)
            })),
            address: address.trim(),
            phone: phone.trim(),
            totalAmount: parseFloat(totalAmount),
            razorpayOrderId: razorpayOrder.id,
            paymentInfo: {
                amount: totalAmount,
                status: 'created',
                updatedAt: new Date()
            },
            // REMOVED: Default refundInfo initialization
            status: 'Pending'
        });

        const savedOrder = await newOrder.save();

        console.log("✅ Order saved to database:", savedOrder._id);

        logger.info("Order created successfully", {
            orderId: savedOrder._id,
            razorpayOrderId: razorpayOrder.id,
            userId,
            userEmail: user.email,
            totalAmount
        });

        res.status(201).json({
            success: true,
            message: "Order created successfully",
            orderId: savedOrder._id,
            razorpayOrderId: razorpayOrder.id,
            order: {
                _id: savedOrder._id,
                status: savedOrder.status,
                totalAmount: savedOrder.totalAmount,
                createdAt: savedOrder.createdAt,
                userEmail: savedOrder.userEmail,
                userName: savedOrder.userName
            }
        });

    } catch (error) {
        console.error("❌ Error creating order:", error);
        logger.error("Order creation failed", {
            error: error.message,
            stack: error.stack,
            userId,
            totalAmount
        });

        if (error.name === 'ValidationError') {
            const validationErrors = Object.values(error.errors).map(e => e.message);
            return res.status(400).json({
                success: false,
                message: "Validation failed: " + validationErrors.join(', ')
            });
        }

        if (error.code === 11000) {
            return res.status(400).json({
                success: false,
                message: "Duplicate order detected. Please try again."
            });
        }

        res.status(500).json({
            success: false,
            message: "Internal server error while creating order",
            error: error.message
        });
    }
});

// Update Order Status with GUARANTEED Refund Processing
router.put('/orders/:orderId/status', async (req, res) => {
    const { orderId } = req.params;
    const { status, cancelReason } = req.body;

    console.log("updated Order ID:", orderId);
    console.log("updated New Status:", status);
    console.log("updated Cancel Reason:", cancelReason);

    if (!['Pending', 'Delivered', 'Cancelled'].includes(status)) {
        return res.status(400).json({
            success: false,
            message: "Invalid status. Must be Pending, Delivered, or Cancelled"
        });
    }

    try {
        const order = await Order.findById(orderId);
        if (!order) {
            return res.status(404).json({
                success: false,
                message: "Order not found"
            });
        }

        console.log("Found order:", {
            id: order._id,
            currentStatus: order.status,
            paymentStatus: order.paymentInfo?.status,
            paymentId: order.paymentInfo?.paymentId,
            totalAmount: order.totalAmount
        });

        let refundProcessed = false;
        let refundDetails = null;

        // CRITICAL: Process refund when admin cancels AND payment is captured
        if (status === 'Cancelled' && order.status !== 'Cancelled') {
            console.log("🔍 Order is being cancelled - checking for refund eligibility...");

            // Check if payment exists and is captured
            if (order.paymentInfo?.paymentId && order.paymentInfo?.status === 'captured') {
                console.log("💰 Payment is captured - initiating automatic refund");
                console.log("Payment ID:", order.paymentInfo.paymentId);
                console.log("Amount to refund:", order.totalAmount);

                try {
                    // IMPORTANT: For small amounts, Razorpay charges fees
                    // For amounts less than ₹10, consider not processing automatic refund
                    if (order.totalAmount < 10) {
                        console.log("⚠️ Small amount detected - Razorpay fees may exceed refund amount");
                        console.log("Refund amount: ₹", order.totalAmount);
                        console.log("Expected fees: ₹10+");

                        // Still process the refund but warn about fees
                        const confirmRefund = true; // In production, you might want admin confirmation

                        if (!confirmRefund) {
                            console.log("❌ Refund cancelled due to high fees");
                            order.status = 'Cancelled';
                            order.cancelReason = `${cancelReason} (No refund - fees exceed amount)`;
                            order.cancelledBy = 'admin';
                            order.cancelledAt = new Date();

                            await order.save();

                            return res.status(200).json({
                                success: true,
                                message: "Order cancelled. Refund not processed due to high processing fees.",
                                order: order,
                                refundProcessed: false,
                                feeWarning: true
                            });
                        }
                    }

                    // Process the refund via Razorpay API
                    console.log("🔄 Calling Razorpay refund API...");
                    const refund = await razorpayInstance.payments.refund(
                        order.paymentInfo.paymentId,
                        {
                            amount: Math.round(order.totalAmount * 100), // Convert to paise
                            speed: 'optimum',
                            notes: {
                                reason: cancelReason || 'Order cancelled by admin',
                                orderId: order._id.toString(),
                                cancelledBy: 'admin',
                                originalAmount: order.totalAmount
                            },
                            receipt: `refund_${order._id}_${Date.now()}`
                        }
                    );

                    console.log("✅ Refund API call successful:");
                    console.log("Refund ID:", refund.id);
                    console.log("Refund Amount:", refund.amount / 100);
                    console.log("Refund Status:", refund.status);

                    // Calculate estimated settlement date (5-7 days for optimum speed)
                    const estimatedSettlement = new Date();
                    estimatedSettlement.setDate(estimatedSettlement.getDate() + 5);

                    // Update order with refund information
                    order.refundInfo = {
                        refundId: refund.id,
                        amount: refund.amount / 100, // Convert from paise to rupees
                        status: 'initiated', // Razorpay returns 'pending' initially, we set as 'initiated'
                        reason: cancelReason || 'Order cancelled by admin',
                        initiatedAt: new Date(),
                        estimatedSettlement: estimatedSettlement,
                        speed: 'optimum',
                        notes: `Automatic refund processed on order cancellation by admin`
                    };

                    refundProcessed = true;
                    refundDetails = order.refundInfo;

                    console.log("💾 Updated refund info in order:");
                    console.log(JSON.stringify(order.refundInfo, null, 2));

                    logger.info("Refund initiated successfully", {
                        orderId: order._id,
                        refundId: refund.id,
                        amount: refund.amount / 100,
                        paymentId: order.paymentInfo.paymentId,
                        reason: cancelReason
                    });

                } catch (refundError) {
                    console.error("❌ Refund API call failed:");
                    console.error("Error message:", refundError.message);
                    console.error("Error code:", refundError.error?.code);
                    console.error("Full error:", refundError);

                    logger.error("Refund processing failed", {
                        orderId,
                        paymentId: order.paymentInfo.paymentId,
                        error: refundError.message,
                        errorCode: refundError.error?.code,
                        amount: order.totalAmount
                    });

                    // Set refund as failed but still cancel the order
                    order.refundInfo = {
                        refundId: null,
                        amount: order.totalAmount,
                        status: 'failed',
                        reason: `Refund failed: ${refundError.message}`,
                        failedAt: new Date(),
                        notes: 'Automatic refund failed - admin should process manual refund via Razorpay dashboard'
                    };

                    console.log("⚠️ Refund failed but order will still be cancelled");
                }
            } else {
                console.log("ℹ️ No refund needed:");
                console.log("- Payment ID exists:", !!order.paymentInfo?.paymentId);
                console.log("- Payment status:", order.paymentInfo?.status);
                console.log("- Payment captured:", order.paymentInfo?.status === 'captured');
            }

            // Update cancellation details regardless of refund success/failure
            order.status = 'Cancelled';
            order.cancelReason = cancelReason || 'Cancelled by admin';
            order.cancelledBy = 'admin';
            order.cancelledAt = new Date();

        } else {
            // Regular status update (non-cancellation)
            console.log("📝 Regular status update to:", status);
            order.status = status;
        }

        // Save the order with all updates
        await order.save();
        console.log("💾 Order saved successfully");

        const responseMessage = status === 'Cancelled'
            ? `Order cancelled successfully! ${refundProcessed
                ? `Automatic refund of ₹${refundDetails?.amount} has been initiated. Refund ID: ${refundDetails?.refundId}. Settlement expected in 5-7 business days.`
                : order.refundInfo?.status === 'failed'
                    ? 'Automatic refund failed - please process manual refund via Razorpay dashboard.'
                    : 'No refund needed - payment was not captured.'
            }`
            : 'Order status updated successfully';

        console.log("📤 Sending response:", responseMessage);

        res.status(200).json({
            success: true,
            message: responseMessage,
            order: {
                _id: order._id,
                status: order.status,
                paymentInfo: order.paymentInfo,
                refundInfo: order.refundInfo,
                cancelReason: order.cancelReason,
                cancelledAt: order.cancelledAt
            },
            refundProcessed: refundProcessed,
            refundDetails: refundDetails
        });

    } catch (error) {
        console.error("❌ Error updating order status:", error);
        logger.error("Error updating order status", {
            orderId,
            error: error.message,
            stack: error.stack
        });

        res.status(500).json({
            success: false,
            message: "Failed to update order status",
            error: error.message
        });
    }
});

// Get Payment Status with enhanced refund tracking
router.get('/paymentStatus/:orderId', async (req, res) => {
    const { orderId } = req.params;

    console.log("=== GET PAYMENT STATUS ===");
    console.log("Order ID:", orderId);

    try {
        const order = await Order.findById(orderId);
        if (!order) {
            return res.status(404).json({
                success: false,
                message: "Order not found"
            });
        }

        let latestPaymentInfo = order.paymentInfo;
        let latestRefundInfo = order.refundInfo;
        let razorpayPayments = [];
        let razorpayRefunds = [];

        // Fetch live data from Razorpay
        if (order.razorpayOrderId) {
            try {
                const payments = await razorpayInstance.orders.fetchPayments(order.razorpayOrderId);
                razorpayPayments = payments.items;

                const latestPayment = payments.items.length ? payments.items[0] : null;
                if (latestPayment) {
                    latestPaymentInfo = {
                        paymentId: latestPayment.id,
                        amount: latestPayment.amount / 100,
                        status: latestPayment.status,
                        method: latestPayment.method,
                        capturedAt: latestPayment.captured_at ? new Date(latestPayment.captured_at * 1000) : null,
                        failedAt: latestPayment.failed_at ? new Date(latestPayment.failed_at * 1000) : null,
                        updatedAt: new Date()
                    };

                    // Fetch refunds for this payment if payment is captured
                    if (latestPayment.status === 'captured') {
                        try {
                            const refunds = await razorpayInstance.payments.fetchMultipleRefund(latestPayment.id);
                            razorpayRefunds = refunds.items;

                            if (refunds.items.length > 0) {
                                const latestRefund = refunds.items[0];
                                const estimatedSettlement = new Date(latestRefund.created_at * 1000);
                                estimatedSettlement.setDate(estimatedSettlement.getDate() +
                                    (latestRefund.speed_processed === 'optimum' ? 5 : 7));

                                latestRefundInfo = {
                                    refundId: latestRefund.id,
                                    amount: latestRefund.amount / 100,
                                    status: latestRefund.status === 'processed' ? 'processed' : 'initiated',
                                    reason: latestRefund.notes?.reason || order.cancelReason || 'Refund processed',
                                    initiatedAt: new Date(latestRefund.created_at * 1000),
                                    processedAt: latestRefund.processed_at ? new Date(latestRefund.processed_at * 1000) : null,
                                    estimatedSettlement: estimatedSettlement,
                                    speed: latestRefund.speed_processed || 'optimum',
                                    notes: latestRefund.notes?.reason || 'Refund from order cancellation'
                                };
                            } else {
                                // No refunds found but order might be cancelled - keep existing refundInfo or set to none
                                if (!order.refundInfo || order.refundInfo.status === 'none') {
                                    latestRefundInfo = {
                                        refundId: null,
                                        amount: 0,
                                        status: 'none',
                                        reason: null,
                                        initiatedAt: null,
                                        processedAt: null,
                                        estimatedSettlement: null,
                                        speed: 'optimum',
                                        notes: null
                                    };
                                }
                            }
                        } catch (refundError) {
                            console.log('No refunds found for payment:', latestPayment.id);
                            // Set refund info to none if no refunds exist
                            if (order.status !== 'Cancelled' || !order.refundInfo?.refundId) {
                                latestRefundInfo = {
                                    refundId: null,
                                    amount: 0,
                                    status: 'none',
                                    reason: null,
                                    initiatedAt: null,
                                    processedAt: null,
                                    estimatedSettlement: null,
                                    speed: 'optimum',
                                    notes: null
                                };
                            }
                        }
                    }

                    // Update order with latest info
                    await Order.findByIdAndUpdate(orderId, {
                        paymentInfo: latestPaymentInfo,
                        refundInfo: latestRefundInfo
                    });
                }
            } catch (razorpayError) {
                console.error("Error fetching from Razorpay:", razorpayError.message);
            }
        }

        res.status(200).json({
            success: true,
            paymentInfo: latestPaymentInfo,
            refundInfo: latestRefundInfo,
            razorpayPayments,
            razorpayRefunds,
            order: {
                _id: order._id,
                status: order.status,
                totalAmount: order.totalAmount,
                createdAt: order.createdAt,
                userEmail: order.userEmail
            }
        });

    } catch (error) {
        console.error("❌ Error fetching payment status:", error);
        logger.error("Error fetching payment status", { orderId, error: error.message });

        res.status(500).json({
            success: false,
            message: "Failed to fetch payment status",
            error: error.message
        });
    }
});

// Get refund status for specific order
router.get('/orders/:orderId/refund-status', async (req, res) => {
    const { orderId } = req.params;

    try {
        const order = await Order.findById(orderId);
        if (!order) {
            return res.status(404).json({
                success: false,
                message: "Order not found"
            });
        }

        let refundInfo = order.refundInfo;

        // If refund exists, fetch latest status from Razorpay
        if (order.refundInfo?.refundId && order.paymentInfo?.paymentId) {
            try {
                const refunds = await razorpayInstance.payments.fetchMultipleRefund(order.paymentInfo.paymentId);
                const latestRefund = refunds.items.find(r => r.id === order.refundInfo.refundId);

                if (latestRefund) {
                    const estimatedSettlement = new Date(latestRefund.created_at * 1000);
                    estimatedSettlement.setDate(estimatedSettlement.getDate() +
                        (latestRefund.speed_processed === 'optimum' ? 5 : 7));

                    refundInfo = {
                        refundId: latestRefund.id,
                        amount: latestRefund.amount / 100,
                        status: latestRefund.status === 'processed' ? 'processed' : 'initiated',
                        reason: order.refundInfo.reason || 'Refund processed',
                        initiatedAt: new Date(latestRefund.created_at * 1000),
                        processedAt: latestRefund.processed_at ? new Date(latestRefund.processed_at * 1000) : null,
                        estimatedSettlement: estimatedSettlement,
                        speed: latestRefund.speed_processed || 'optimum',
                        notes: order.refundInfo.notes
                    };

                    // Update in database
                    await Order.findByIdAndUpdate(orderId, { refundInfo });
                }
            } catch (error) {
                console.log('Error fetching refund status:', error.message);
            }
        }

        res.status(200).json({
            success: true,
            refundInfo: refundInfo
        });

    } catch (error) {
        console.error("Error fetching refund status:", error);
        res.status(500).json({
            success: false,
            message: "Failed to fetch refund status",
            error: error.message
        });
    }
});

// Get Orders by User ID with corrected refund status
router.get('/orders/:userId', async (req, res) => {
    const { userId } = req.params;

    console.log("=== GET USER ORDERS ===");
    console.log("User ID:", userId);

    try {
        const orders = await Order.find({ userId })
            .sort({ createdAt: -1 })
            .populate('items.productId', 'name media')
            .lean();

        console.log("✅ Found orders:", orders.length);

        // Fetch live payment and refund status for each order
        const ordersWithLiveStatus = await Promise.all(
            orders.map(async (order) => {
                if (order.razorpayOrderId) {
                    try {
                        const payments = await razorpayInstance.orders.fetchPayments(order.razorpayOrderId);
                        const latestPayment = payments.items.length ? payments.items[0] : null;

                        if (latestPayment && latestPayment.id !== order.paymentInfo?.paymentId) {
                            // Update payment info with latest data
                            await Order.findByIdAndUpdate(order._id, {
                                'paymentInfo.paymentId': latestPayment.id,
                                'paymentInfo.status': latestPayment.status,
                                'paymentInfo.method': latestPayment.method,
                                'paymentInfo.updatedAt': new Date()
                            });

                            order.paymentInfo = {
                                ...order.paymentInfo,
                                paymentId: latestPayment.id,
                                status: latestPayment.status,
                                method: latestPayment.method,
                                updatedAt: new Date()
                            };
                        }

                        // Check for refunds if order is cancelled and payment captured
                        if (order.status === 'Cancelled' && latestPayment && latestPayment.status === 'captured') {
                            try {
                                const refunds = await razorpayInstance.payments.fetchMultipleRefund(latestPayment.id);
                                if (refunds.items.length > 0) {
                                    const latestRefund = refunds.items[0];
                                    if (latestRefund.id !== order.refundInfo?.refundId) {
                                        // Update refund info
                                        const estimatedSettlement = new Date(latestRefund.created_at * 1000);
                                        estimatedSettlement.setDate(estimatedSettlement.getDate() +
                                            (latestRefund.speed_processed === 'optimum' ? 5 : 7));

                                        await Order.findByIdAndUpdate(order._id, {
                                            'refundInfo.refundId': latestRefund.id,
                                            'refundInfo.amount': latestRefund.amount / 100,
                                            'refundInfo.status': latestRefund.status === 'processed' ? 'processed' : 'initiated',
                                            'refundInfo.processedAt': latestRefund.processed_at ? new Date(latestRefund.processed_at * 1000) : null,
                                            'refundInfo.estimatedSettlement': estimatedSettlement,
                                            'refundInfo.speed': latestRefund.speed_processed || 'optimum'
                                        });

                                        order.refundInfo = {
                                            ...order.refundInfo,
                                            refundId: latestRefund.id,
                                            amount: latestRefund.amount / 100,
                                            status: latestRefund.status === 'processed' ? 'processed' : 'initiated',
                                            processedAt: latestRefund.processed_at ? new Date(latestRefund.processed_at * 1000) : null,
                                            estimatedSettlement: estimatedSettlement,
                                            speed: latestRefund.speed_processed || 'optimum'
                                        };
                                    }
                                } else {
                                    // No refunds found but order is cancelled - ensure refund status is accurate
                                    if (!order.refundInfo?.refundId) {
                                        await Order.findByIdAndUpdate(order._id, {
                                            'refundInfo.status': 'none'
                                        });
                                        order.refundInfo = { ...order.refundInfo, status: 'none' };
                                    }
                                }
                            } catch (refundError) {
                                console.log('No refunds found for payment:', latestPayment.id);
                                if (!order.refundInfo?.refundId) {
                                    order.refundInfo = { ...order.refundInfo, status: 'none' };
                                }
                            }
                        } else if (order.status !== 'Cancelled') {
                            // Order not cancelled, ensure no refund status unless already processed
                            if (!order.refundInfo?.refundId) {
                                order.refundInfo = { ...order.refundInfo, status: 'none' };
                            }
                        }
                    } catch (paymentError) {
                        console.log('Error fetching payment for order:', order._id, paymentError.message);
                    }
                }
                return order;
            })
        );

        logger.info("User orders fetched successfully", { userId, count: orders.length });

        res.status(200).json({
            success: true,
            orders: ordersWithLiveStatus,
            totalCount: orders.length
        });

    } catch (error) {
        console.error("Error fetching user orders:", error);
        logger.error("Error fetching user orders", { error: error.message, userId });

        res.status(500).json({
            success: false,
            message: "Failed to fetch orders",
            error: error.message
        });
    }
});

// Get All Orders (Admin) with complete information
router.get('/orders', async (req, res) => {
    console.log("=== GET ALL ORDERS (ADMIN) ===");

    try {
        const orders = await Order.find()
            .sort({ createdAt: -1 })
            .populate('userId', 'name email phone')
            .populate('items.productId', 'name media')
            .lean();

        console.log("Found all orders:", orders.length);

        logger.info("All orders fetched successfully", { count: orders.length });

        res.status(200).json({
            success: true,
            orders: orders,
            totalCount: orders.length
        });

    } catch (error) {
        console.error("Error fetching all orders:", error);
        logger.error("Error fetching all orders", { error: error.message });

        res.status(500).json({
            success: false,
            message: "Failed to fetch orders",
            error: error.message
        });
    }
});

// Capture Payment endpoint
router.post('/capturePayment/:orderId', async (req, res) => {
    const { orderId } = req.params;

    console.log("=== CAPTURE PAYMENT ===");
    console.log("Order ID:", orderId);

    try {
        const order = await Order.findById(orderId);
        if (!order) {
            return res.status(404).json({
                success: false,
                message: "Order not found"
            });
        }

        if (!order.paymentInfo?.paymentId) {
            return res.status(400).json({
                success: false,
                message: "No payment found for this order"
            });
        }

        if (order.paymentInfo.status !== 'authorized') {
            return res.status(400).json({
                success: false,
                message: "Payment is not in authorized state"
            });
        }

        // Capture the payment
        const capturedPayment = await razorpayInstance.payments.capture(
            order.paymentInfo.paymentId,
            Math.round(order.totalAmount * 100),
            'INR'
        );

        // Update order with captured payment info
        order.paymentInfo.status = 'captured';
        order.paymentInfo.capturedAt = new Date();
        order.paymentInfo.updatedAt = new Date();

        await order.save();

        console.log("Payment captured successfully");

        res.status(200).json({
            success: true,
            message: "Payment captured successfully",
            paymentInfo: order.paymentInfo
        });

    } catch (error) {
        console.error("Error capturing payment:", error);
        res.status(500).json({
            success: false,
            message: "Failed to capture payment",
            error: error.message
        });
    }
});

// Manual refund endpoint for admins
router.post('/orders/:orderId/refund', async (req, res) => {
    const { orderId } = req.params;
    const { amount, reason } = req.body;

    try {
        const order = await Order.findById(orderId);
        if (!order) {
            return res.status(404).json({
                success: false,
                message: "Order not found"
            });
        }

        if (!order.paymentInfo?.paymentId || order.paymentInfo?.status !== 'captured') {
            return res.status(400).json({
                success: false,
                message: "Cannot refund: Payment not captured"
            });
        }

        if (order.refundInfo?.refundId) {
            return res.status(400).json({
                success: false,
                message: "Refund already processed for this order"
            });
        }

        const refundAmount = amount || order.totalAmount;
        const refund = await razorpayInstance.payments.refund(
            order.paymentInfo.paymentId,
            {
                amount: Math.round(refundAmount * 100),
                speed: 'optimum',
                notes: { reason: reason || 'Manual refund by admin' }
            }
        );

        // Update order with refund info
        const estimatedSettlement = new Date();
        estimatedSettlement.setDate(estimatedSettlement.getDate() + 5);

        order.refundInfo = {
            refundId: refund.id,
            amount: refund.amount / 100,
            status: 'initiated',
            reason: reason || 'Manual refund by admin',
            initiatedAt: new Date(),
            estimatedSettlement: estimatedSettlement,
            speed: 'optimum'
        };

        await order.save();

        res.status(200).json({
            success: true,
            message: "Refund initiated successfully",
            refund: order.refundInfo
        });

    } catch (error) {
        console.error("Error processing refund:", error);
        res.status(500).json({
            success: false,
            message: "Failed to process refund",
            error: error.message
        });
    }
});

// Get order count
router.get('/totalOrdercount', async (req, res) => {
    try {
        const count = await Order.countDocuments();
        res.status(200).json({
            success: true,
            totalOrders: count
        });
    } catch (error) {
        console.error("Error getting order count:", error);
        res.status(500).json({
            success: false,
            message: "Failed to get order count"
        });
    }
});

// Test route
router.get('/test', (req, res) => {
    res.json({
        success: true,
        message: "Order routes working!",
        timestamp: new Date().toISOString()
    });
});

module.exports = router;
