// const express = require('express');
// const router = express.Router();
// const Order = require('../models/order');
// const { logger } = require("../utils/logger");

// // Create Order Route
// router.post('/createOrder', async (req, res) => {
//     const { userId, items, address, phone, totalAmount, paymentId } = req.body;

//     logger.info("Received createOrder request", { userId, itemCount: items?.length, totalAmount });

//     if (!userId || !items?.length || !address || !phone || !totalAmount) {
//         logger.warn("Missing required fields in createOrder request", { body: req.body });
//         return res.status(400).json({ message: "Missing required fields" });
//     }

//     try {
//         const newOrder = new Order({ userId, items, address, phone, totalAmount, paymentId });
//         await newOrder.save();

//         logger.info("Order created successfully", { orderId: newOrder._id, userId });

//         res.status(201).json({ message: "Order placed successfully", orderId: newOrder._id });
//     } catch (error) {
//         logger.error("Error placing order", { error: error.message, stack: error.stack });
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

// // 2: with razorpay integration
const express = require('express');
const router = express.Router();
const Order = require('../models/order');
const { logger } = require("../utils/logger");
const Razorpay = require('razorpay');

// Initialize Razorpay instance somewhere globally or per request
const razorpayInstance = new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID,
    key_secret: process.env.RAZORPAY_KEY_SECRET,
});

// option1: Create Order Route
// router.post('/createOrder', async (req, res) => {
//     const { userId, items, address, phone, totalAmount, paymentId, razorpayOrderId } = req.body;

//     logger.info("Received createOrder request", { userId, itemCount: items?.length, totalAmount });

//     if (!userId || !items?.length || !address || !phone || !totalAmount) {
//         logger.warn("Missing required fields in createOrder request", { body: req.body });
//         return res.status(400).json({ message: "Missing required fields" });
//     }

//     try {
//         const newOrder = new Order({ userId, items, address, phone, totalAmount, paymentId, razorpayOrderId });

//         await newOrder.save();

//         logger.info("Order created successfully", { orderId: newOrder._id, userId });

//         res.status(201).json({ message: "Order placed successfully", orderId: newOrder._id });
//     } catch (error) {
//         logger.error("Error placing order", { error: error.message, stack: error.stack });
//         res.status(500).json({ message: "Server error", error: error.message });
//     }
// });

// option2: 
router.post('/createOrder', async (req, res) => {
    const { userId, items, address, phone, totalAmount, paymentId } = req.body;

    // Debug log to see what's being received
    console.log("Received createOrder request:", {
        userId: !!userId,
        items: items?.length,
        address: !!address,
        phone: !!phone,
        totalAmount: !!totalAmount,
        paymentId: !!paymentId
    });

    // Better validation with specific error messages
    if (!userId) {
        return res.status(400).json({ message: "Missing required field: userId" });
    }
    if (!items?.length) {
        return res.status(400).json({ message: "Missing required field: items" });
    }
    if (!address) {
        return res.status(400).json({ message: "Missing required field: address" });
    }
    if (!phone) {
        return res.status(400).json({ message: "Missing required field: phone" });
    }
    if (!totalAmount) {
        return res.status(400).json({ message: "Missing required field: totalAmount" });
    }

    try {
        // 1. Create Razorpay Order via API
        const razorpayOrder = await razorpayInstance.orders.create({
            amount: totalAmount * 100,  // amount in paise
            currency: "INR",
            receipt: `receipt_order_${Date.now()}`,  // optional, unique ID
            payment_capture: 1,  // auto capture
        });

        // 2. Save order in your DB with razorpayOrderId
        const newOrder = new Order({
            userId,
            items,
            address,
            phone,
            totalAmount,
            paymentId,
            razorpayOrderId: razorpayOrder.id,
            paymentInfo: {},
        });
        await newOrder.save();

        console.log("Order created with razorpayOrderId:", razorpayOrder.id);

        res.status(201).json({
            message: "Order placed successfully",
            orderId: newOrder._id,
            razorpayOrderId: razorpayOrder.id,
            razorpayOrder,  // optional: send Razorpay order details if frontend needs it
        });
    } catch (error) {
        console.error("Error placing order:", error);
        res.status(500).json({ message: "Server error", error: error.message });
    }
});

// payment status from razorpay
router.get('/paymentStatus/:orderId', async (req, res) => {
    const { orderId } = req.params;

    try {
        // Fetch your order from DB to get razorpayOrderId
        const order = await Order.findById(orderId);
        if (!order) {
            return res.status(404).json({ message: "Order not found" });
        }

        // If no razorpayOrderId, return the existing paymentInfo or default
        if (!order.razorpayOrderId) {
            return res.status(200).json({
                paymentInfo: order.paymentInfo || {
                    status: 'pending',
                    amount: order.totalAmount,
                    paymentId: order.paymentId || null
                },
                razorpayOrder: null,
                razorpayPayments: []
            });
        }

        // Fetch latest Razorpay order details
        const razorpayOrder = await razorpayInstance.orders.fetch(order.razorpayOrderId);

        // Fetch all payments for this Razorpay order
        const payments = await razorpayInstance.orders.fetchPayments(order.razorpayOrderId);

        // Get the latest payment (if any)
        const latestPayment = payments.items.length ? payments.items[0] : null;

        // Update paymentInfo in your order DB
        if (latestPayment) {
            order.paymentInfo = {
                paymentId: latestPayment.id,
                amount: latestPayment.amount / 100,
                status: latestPayment.status, // 'captured', 'failed', etc.
                updatedAt: new Date(),
            };
            await order.save();
        }

        // Return payment info to frontend
        res.status(200).json({
            paymentInfo: order.paymentInfo || null,
            razorpayOrder,
            razorpayPayments: payments.items,
        });
    } catch (error) {
        console.error("Error fetching payment status:", error);
        res.status(500).json({ message: "Server error", error: error.message });
    }
});

// Check payment status by Razorpay Order ID (as suggested by Razorpay support)
router.get('/checkPaymentStatus/:razorpayOrderId', async (req, res) => {
    const { razorpayOrderId } = req.params;

    try {
        // Fetch Razorpay order details
        const razorpayOrder = await razorpayInstance.orders.fetch(razorpayOrderId);

        // Fetch all payments for this Razorpay order
        const payments = await razorpayInstance.orders.fetchPayments(razorpayOrderId);

        // Get the latest payment (if any)
        const latestPayment = payments.items.length ? payments.items[0] : null;

        // Find the order in our database
        const order = await Order.findOne({ razorpayOrderId: razorpayOrderId });

        // Update paymentInfo in your order DB if payment exists
        if (latestPayment && order) {
            order.paymentInfo = {
                paymentId: latestPayment.id,
                amount: latestPayment.amount / 100,
                status: latestPayment.status, // 'captured', 'failed', etc.
                updatedAt: new Date(),
            };
            await order.save();
        }

        // Return comprehensive payment info
        res.status(200).json({
            razorpayOrder,
            paymentInfo: latestPayment ? {
                paymentId: latestPayment.id,
                amount: latestPayment.amount / 100,
                status: latestPayment.status,
                method: latestPayment.method,
                createdAt: latestPayment.created_at,
            } : null,
            allPayments: payments.items,
            orderStatus: order ? order.status : null,
        });
    } catch (error) {
        console.error("Error checking payment status:", error);
        res.status(500).json({ message: "Server error", error: error.message });
    }
});

// Get Orders by User ID
router.get('/orders/:userId', async (req, res) => {
    const { userId } = req.params;

    logger.info("Received getOrders request", { userId });

    try {
        const orders = await Order.find({ userId });

        const totalCount = orders.length;

        logger.info("Fetched orders for user", { userId, orderCount: totalCount });

        res.status(200).json({
            orders,
            totalCount
        });
    } catch (error) {
        logger.error("Error fetching orders", {
            error: error.message,
            stack: error.stack
        });
        res.status(500).json({
            message: "Server error",
            error: error.message
        });
    }
});

// ✅ New Route: Get All Orders
router.get('/orders', async (req, res) => {
    logger.info("Received request to fetch all orders");

    try {
        const orders = await Order.find().sort({ createdAt: -1 }); // optional: newest first
        logger.info("Fetched all orders", { totalOrders: orders.length });
        res.status(200).json({ orders });
    } catch (error) {
        logger.error("Error fetching all orders", { error: error.message, stack: error.stack });
        res.status(500).json({ message: "Server error", error: error.message });
    }
});


// Get Total Order Count
router.get('/totalOrdercount', async (req, res) => {
    logger.info("Received request to get total order count");

    try {
        const count = await Order.countDocuments();
        logger.info("Fetched total order count", { count });
        res.status(200).json({ totalOrders: count });
    } catch (error) {
        logger.error("Error getting order count", { error: error.message, stack: error.stack });
        res.status(500).json({ message: "Server error", error: error.message });
    }
});


// Update Order Payment Info - using a simpler route
router.put('/updatePayment/:orderId', async (req, res) => {
    const { orderId } = req.params;
    const { paymentId, razorpayOrderId } = req.body;

    console.log("Payment update route hit:", { orderId, paymentId, razorpayOrderId });
    logger.info("Received request to update order payment", { orderId, paymentId });

    try {
        const updatedOrder = await Order.updateOne(
            { _id: orderId },
            {
                $set: {
                    paymentId: paymentId,
                    razorpayOrderId: razorpayOrderId
                }
            }
        );

        if (updatedOrder.matchedCount === 0) {
            logger.warn("Order not found for payment update", { orderId });
            return res.status(404).json({ message: "Order not found" });
        }

        logger.info("Order payment updated successfully", { orderId, paymentId });
        res.status(200).json({ message: "Order payment updated successfully" });
    } catch (error) {
        logger.error("Error updating order payment", { error: error.message, stack: error.stack });
        res.status(500).json({ message: "Server error", error: error.message });
    }
});

// Update Order Status by ID
router.put('/orders/:orderId/status', async (req, res) => {
    const { orderId } = req.params;
    const { status } = req.body;

    // Logging the received request for debugging purposes
    logger.info("Received request to update order status", { orderId, status });

    // Validation for status
    if (!status || !['Pending', 'Delivered', 'Cancelled'].includes(status)) {
        logger.warn("Invalid or missing status in update request", { status });
        return res.status(400).json({ message: "Invalid or missing status" });
    }

    try {
        // Attempting to update the order status
        const updatedOrder = await Order.updateOne(
            { _id: orderId }, // Find the order by ID
            { $set: { status: status } } // Update the status
        );

        // If no order was found with the given ID
        if (updatedOrder.matchedCount === 0) {
            logger.warn("Order not found for status update", { orderId });
            return res.status(404).json({ message: "Order not found" });
        }

        // If update was successful
        logger.info("Order status updated successfully", { orderId, status });

        // Respond with success message and updated order data
        res.status(200).json({ message: "Order status updated", order: { ...updatedOrder, status } });
    } catch (error) {
        // Logging the error for debugging purposes
        logger.error("Error updating order status", { error: error.message, stack: error.stack });

        // Respond with server error message
        res.status(500).json({ message: "Server error", error: error.message });
    }
});


// Test route to check if payment route is working
router.get('/test-payment-route', (req, res) => {
    res.json({ message: "Payment route is working" });
});

// Test route for updatePayment
router.get('/test-update-payment', (req, res) => {
    res.json({ message: "Update payment route is working" });
});

router.get('/', (req, res) => {
    res.send("API Working");
});
module.exports = router;

