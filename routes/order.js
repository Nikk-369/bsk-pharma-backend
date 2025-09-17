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

    if (!userId || !items?.length || !address || !phone || !totalAmount) {
        return res.status(400).json({ message: "Missing required fields" });
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
        if (!order || !order.razorpayOrderId) {
            return res.status(404).json({ message: "Order not found or missing Razorpay Order ID" });
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


router.get('/', (req, res) => {
    res.send("API Working");
});
module.exports = router;

