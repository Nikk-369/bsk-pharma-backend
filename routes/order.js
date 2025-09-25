// // // with razorpay integration
// const express = require('express');
// const router = express.Router();
// const Order = require('../models/order');
// const { logger } = require("../utils/logger");
// const Razorpay = require('razorpay');

// // Initialize Razorpay instance somewhere globally or per request
// const razorpayInstance = new Razorpay({
//     key_id: process.env.RAZORPAY_KEY_ID,
//     key_secret: process.env.RAZORPAY_KEY_SECRET,
// });

// // option1: Create Order Route
// // router.post('/createOrder', async (req, res) => {
// //     const { userId, items, address, phone, totalAmount, paymentId, razorpayOrderId } = req.body;

// //     logger.info("Received createOrder request", { userId, itemCount: items?.length, totalAmount });

// //     if (!userId || !items?.length || !address || !phone || !totalAmount) {
// //         logger.warn("Missing required fields in createOrder request", { body: req.body });
// //         return res.status(400).json({ message: "Missing required fields" });
// //     }

// //     try {
// //         const newOrder = new Order({ userId, items, address, phone, totalAmount, paymentId, razorpayOrderId });

// //         await newOrder.save();

// //         logger.info("Order created successfully", { orderId: newOrder._id, userId });

// //         res.status(201).json({ message: "Order placed successfully", orderId: newOrder._id });
// //     } catch (error) {
// //         logger.error("Error placing order", { error: error.message, stack: error.stack });
// //         res.status(500).json({ message: "Server error", error: error.message });
// //     }
// // });

// // option2: 
// router.post('/createOrder', async (req, res) => {
//     const { userId, items, address, phone, totalAmount, paymentId } = req.body;

//     if (!userId || !items?.length || !address || !phone || !totalAmount) {
//         return res.status(400).json({ message: "Missing required fields" });
//     }

//     try {
//         // 1. Create Razorpay Order via API
//         const razorpayOrder = await razorpayInstance.orders.create({
//             amount: totalAmount * 100,  // amount in paise
//             currency: "INR",
//             receipt: `receipt_order_${Date.now()}`,  // optional, unique ID
//             payment_capture: 1,  // auto capture
//         });

//         // 2. Save order in your DB with razorpayOrderId
//         const newOrder = new Order({
//             userId,
//             items,
//             address,
//             phone,
//             totalAmount,
//             paymentId,
//             razorpayOrderId: razorpayOrder.id,
//             paymentInfo: {},
//         });
//         await newOrder.save();

//         res.status(201).json({
//             message: "Order placed successfully",
//             orderId: newOrder._id,
//             razorpayOrderId: razorpayOrder.id,
//             razorpayOrder,  // optional: send Razorpay order details if frontend needs it
//         });
//     } catch (error) {
//         console.error("Error placing order:", error);
//         res.status(500).json({ message: "Server error", error: error.message });
//     }
// });

// // payment status from razorpay
// router.get('/paymentStatus/:orderId', async (req, res) => {
//     const { orderId } = req.params;

//     try {
//         // Fetch your order from DB to get razorpayOrderId
//         const order = await Order.findById(orderId);
//         if (!order || !order.razorpayOrderId) {
//             return res.status(404).json({ message: "Order not found or missing Razorpay Order ID" });
//         }

//         // Fetch latest Razorpay order details
//         const razorpayOrder = await razorpayInstance.orders.fetch(order.razorpayOrderId);

//         // Fetch all payments for this Razorpay order
//         const payments = await razorpayInstance.orders.fetchPayments(order.razorpayOrderId);

//         // Get the latest payment (if any)
//         const latestPayment = payments.items.length ? payments.items[0] : null;

//         // Update paymentInfo in your order DB
//         if (latestPayment) {
//             order.paymentInfo = {
//                 paymentId: latestPayment.id,
//                 amount: latestPayment.amount / 100,
//                 status: latestPayment.status, // 'captured', 'failed', etc.
//                 updatedAt: new Date(),
//             };
//             await order.save();
//         }

//         // Return payment info to frontend
//         res.status(200).json({
//             paymentInfo: order.paymentInfo || null,
//             razorpayOrder,
//             razorpayPayments: payments.items,
//         });
//     } catch (error) {
//         console.error("Error fetching payment status:", error);
//         res.status(500).json({ message: "Server error", error: error.message });
//     }
// });

// // Get Orders by User ID
// router.get('/orders/:userId', async (req, res) => {
//     const { userId } = req.params;

//     logger.info("Received getOrders request", { userId });

//     try {
//         const orders = await Order.find({ userId });

//         const totalCount = orders.length;

//         logger.info("Fetched orders for user", { userId, orderCount: totalCount });

//         res.status(200).json({
//             orders,
//             totalCount
//         });
//     } catch (error) {
//         logger.error("Error fetching orders", {
//             error: error.message,
//             stack: error.stack
//         });
//         res.status(500).json({
//             message: "Server error",
//             error: error.message
//         });
//     }
// });

// // ✅ New Route: Get All Orders
// router.get('/orders', async (req, res) => {
//     logger.info("Received request to fetch all orders");

//     try {
//         const orders = await Order.find().sort({ createdAt: -1 }); // optional: newest first
//         logger.info("Fetched all orders", { totalOrders: orders.length });
//         res.status(200).json({ orders });
//     } catch (error) {
//         logger.error("Error fetching all orders", { error: error.message, stack: error.stack });
//         res.status(500).json({ message: "Server error", error: error.message });
//     }
// });


// // Get Total Order Count
// router.get('/totalOrdercount', async (req, res) => {
//     logger.info("Received request to get total order count");

//     try {
//         const count = await Order.countDocuments();
//         logger.info("Fetched total order count", { count });
//         res.status(200).json({ totalOrders: count });
//     } catch (error) {
//         logger.error("Error getting order count", { error: error.message, stack: error.stack });
//         res.status(500).json({ message: "Server error", error: error.message });
//     }
// });


// // Update Order Status by ID
// router.put('/orders/:orderId/status', async (req, res) => {
//     const { orderId } = req.params;
//     const { status } = req.body;

//     // Logging the received request for debugging purposes
//     logger.info("Received request to update order status", { orderId, status });

//     // Validation for status
//     if (!status || !['Pending', 'Delivered', 'Cancelled'].includes(status)) {
//         logger.warn("Invalid or missing status in update request", { status });
//         return res.status(400).json({ message: "Invalid or missing status" });
//     }

//     try {
//         // Attempting to update the order status
//         const updatedOrder = await Order.updateOne(
//             { _id: orderId }, // Find the order by ID
//             { $set: { status: status } } // Update the status
//         );

//         // If no order was found with the given ID
//         if (updatedOrder.matchedCount === 0) {
//             logger.warn("Order not found for status update", { orderId });
//             return res.status(404).json({ message: "Order not found" });
//         }

//         // If update was successful
//         logger.info("Order status updated successfully", { orderId, status });

//         // Respond with success message and updated order data
//         res.status(200).json({ message: "Order status updated", order: { ...updatedOrder, status } });
//     } catch (error) {
//         // Logging the error for debugging purposes
//         logger.error("Error updating order status", { error: error.message, stack: error.stack });

//         // Respond with server error message
//         res.status(500).json({ message: "Server error", error: error.message });
//     }
// });


// router.get('/', (req, res) => {
//     res.send("API Working");
// });
// module.exports = router;

// // 2 payment tracking:
const express = require('express');
const router = express.Router();
const Order = require('../models/order');
const { logger } = require("../utils/logger");
const Razorpay = require('razorpay');

// Initialize Razorpay instance
const razorpayInstance = new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID,
    key_secret: process.env.RAZORPAY_KEY_SECRET,
});

// Create Order Route - FIXED
router.post('/createOrder', async (req, res) => {
    const { userId, items, address, phone, totalAmount, paymentId } = req.body;

    console.log("=== CREATE ORDER REQUEST ===");
    console.log("Request body:", {
        userId: !!userId,
        items: items?.length,
        address: !!address,
        phone: !!phone,
        totalAmount,
        paymentId: !!paymentId
    });

    // Validation
    if (!userId) {
        return res.status(400).json({ message: "Missing required field: userId" });
    }
    if (!items || !Array.isArray(items) || items.length === 0) {
        return res.status(400).json({ message: "Missing required field: items (must be non-empty array)" });
    }
    if (!address) {
        return res.status(400).json({ message: "Missing required field: address" });
    }
    if (!phone) {
        return res.status(400).json({ message: "Missing required field: phone" });
    }
    if (!totalAmount || totalAmount <= 0) {
        return res.status(400).json({ message: "Invalid totalAmount" });
    }

    try {
        // Validate items structure
        for (let item of items) {
            if (!item.productId || !item.name || !item.quantity || !item.price) {
                return res.status(400).json({ 
                    message: "Invalid item structure. Each item needs productId, name, quantity, and price" 
                });
            }
        }

        // Create Razorpay Order
        const razorpayOrder = await razorpayInstance.orders.create({
            amount: Math.round(totalAmount * 100), // Convert to paise
            currency: "INR",
            receipt: `receipt_${Date.now()}_${userId}`,
            payment_capture: 1,
        });

        console.log("✅ Razorpay order created:", razorpayOrder.id);

        // Create order in database
        const newOrder = new Order({
            userId,
            items: items.map(item => ({
                productId: item.productId,
                name: item.name,
                quantity: item.quantity,
                price: item.price
            })),
            address,
            phone,
            totalAmount,
            razorpayOrderId: razorpayOrder.id,
            paymentInfo: {
                paymentId: paymentId || null,
                amount: totalAmount,
                status: 'created',
                updatedAt: new Date()
            },
            status: 'Pending'
        });

        const savedOrder = await newOrder.save();
        
        console.log("✅ Order saved to database:", savedOrder._id);
        
        logger.info("Order created successfully", {
            orderId: savedOrder._id,
            razorpayOrderId: razorpayOrder.id,
            userId,
            totalAmount
        });

        res.status(201).json({
            success: true,
            message: "Order created successfully",
            orderId: savedOrder._id,
            razorpayOrderId: razorpayOrder.id,
            razorpayOrder,
            order: savedOrder
        });

    } catch (error) {
        console.error("❌ Error creating order:", error);
        logger.error("Order creation failed", {
            error: error.message,
            stack: error.stack,
            userId,
            totalAmount
        });

        res.status(500).json({ 
            success: false,
            message: "Failed to create order", 
            error: error.message 
        });
    }
});

// Get Orders by User ID - SIMPLIFIED
router.get('/orders/:userId', async (req, res) => {
    const { userId } = req.params;

    console.log("=== GET ORDERS REQUEST ===");
    console.log("Getting orders for userId:", userId);

    try {
        const orders = await Order.find({ userId })
            .sort({ createdAt: -1 })
            .populate('items.productId', 'name')
            .lean(); // Use lean for better performance

        console.log("✅ Found orders:", orders.length);

        // Fetch live payment status for each order
        const ordersWithLiveStatus = await Promise.all(
            orders.map(async (order) => {
                if (order.razorpayOrderId) {
                    try {
                        const payments = await razorpayInstance.orders.fetchPayments(order.razorpayOrderId);
                        const latestPayment = payments.items.length ? payments.items[0] : null;
                        
                        if (latestPayment) {
                            order.paymentInfo = {
                                ...order.paymentInfo,
                                paymentId: latestPayment.id,
                                status: latestPayment.status,
                                method: latestPayment.method,
                                updatedAt: new Date()
                            };
                        }
                    } catch (paymentError) {
                        console.log('Error fetching payment for order:', order._id);
                    }
                }
                return order;
            })
        );

        logger.info("Orders fetched successfully", { userId, count: orders.length });

        res.status(200).json({
            success: true,
            orders: ordersWithLiveStatus,
            totalCount: orders.length
        });

    } catch (error) {
        console.error("❌ Error fetching orders:", error);
        logger.error("Error fetching orders", {
            error: error.message,
            userId
        });

        res.status(500).json({
            success: false,
            message: "Failed to fetch orders",
            error: error.message
        });
    }
});

// Get All Orders (for admin) - SIMPLIFIED
router.get('/orders', async (req, res) => {
    console.log("=== GET ALL ORDERS REQUEST (ADMIN) ===");

    try {
        const orders = await Order.find()
            .sort({ createdAt: -1 })
            .populate('userId', 'name email')
            .populate('items.productId', 'name')
            .lean();

        console.log("✅ Found all orders:", orders.length);

        // Optionally fetch live payment status (can be time-consuming for many orders)
        const ordersWithLiveStatus = orders; // Skip live status for admin view to improve performance

        logger.info("All orders fetched successfully", { count: orders.length });

        res.status(200).json({
            success: true,
            orders: ordersWithLiveStatus,
            totalCount: orders.length
        });

    } catch (error) {
        console.error("❌ Error fetching all orders:", error);
        logger.error("Error fetching all orders", { error: error.message });

        res.status(500).json({
            success: false,
            message: "Failed to fetch orders",
            error: error.message
        });
    }
});

// Update Order Status - SIMPLIFIED
router.put('/orders/:orderId/status', async (req, res) => {
    const { orderId } = req.params;
    const { status, cancelReason } = req.body;

    console.log("=== UPDATE ORDER STATUS ===");
    console.log("Order ID:", orderId, "New Status:", status);

    try {
        const order = await Order.findById(orderId);
        if (!order) {
            return res.status(404).json({ message: "Order not found" });
        }

        // Update order status
        order.status = status;
        if (status === 'Cancelled') {
            order.cancelReason = cancelReason || 'Cancelled by admin';
            order.cancelledBy = 'admin';
            order.cancelledAt = new Date();

            // Process refund if payment was captured
            if (order.paymentInfo?.status === 'captured' && order.paymentInfo?.paymentId) {
                try {
                    const refund = await razorpayInstance.payments.refund(
                        order.paymentInfo.paymentId,
                        {
                            amount: Math.round(order.totalAmount * 100),
                            speed: 'optimum',
                            notes: { reason: cancelReason || 'Order cancelled' }
                        }
                    );

                    order.refundInfo = {
                        refundId: refund.id,
                        amount: refund.amount / 100,
                        status: refund.status,
                        reason: cancelReason || 'Order cancelled',
                        processedAt: new Date()
                    };

                    console.log("✅ Refund processed:", refund.id);
                } catch (refundError) {
                    console.error("❌ Refund failed:", refundError.message);
                }
            }
        }

        await order.save();

        logger.info("Order status updated", { orderId, status });

        res.status(200).json({
            success: true,
            message: "Order status updated successfully",
            order
        });

    } catch (error) {
        console.error("❌ Error updating order status:", error);
        logger.error("Error updating order status", { orderId, error: error.message });

        res.status(500).json({
            success: false,
            message: "Failed to update order status",
            error: error.message
        });
    }
});

// Payment Status Route - SIMPLIFIED
router.get('/paymentStatus/:orderId', async (req, res) => {
    const { orderId } = req.params;

    try {
        const order = await Order.findById(orderId);
        if (!order) {
            return res.status(404).json({ message: "Order not found" });
        }

        let paymentInfo = order.paymentInfo;
        let razorpayPayments = [];

        // Fetch live payment status if razorpay order exists
        if (order.razorpayOrderId) {
            try {
                const payments = await razorpayInstance.orders.fetchPayments(order.razorpayOrderId);
                razorpayPayments = payments.items;
                
                const latestPayment = payments.items.length ? payments.items[0] : null;
                if (latestPayment) {
                    paymentInfo = {
                        paymentId: latestPayment.id,
                        amount: latestPayment.amount / 100,
                        status: latestPayment.status,
                        method: latestPayment.method,
                        updatedAt: new Date()
                    };

                    // Update in database
                    order.paymentInfo = paymentInfo;
                    await order.save();
                }
            } catch (razorpayError) {
                console.error("Error fetching payment status from Razorpay:", razorpayError.message);
            }
        }

        res.status(200).json({
            success: true,
            paymentInfo,
            refundInfo: order.refundInfo,
            razorpayPayments
        });

    } catch (error) {
        console.error("Error fetching payment status:", error);
        res.status(500).json({
            success: false,
            message: "Failed to fetch payment status",
            error: error.message
        });
    }
});

// Test route
router.get('/test', (req, res) => {
    res.json({ 
        message: "Order routes working!", 
        timestamp: new Date().toISOString() 
    });
});

module.exports = router;