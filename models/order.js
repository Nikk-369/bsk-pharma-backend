// // // models/Order.js
// // const mongoose = require('mongoose');

// // const orderSchema = new mongoose.Schema({
// //   userId: {
// //     type: mongoose.Schema.Types.ObjectId,
// //     required: true,
// //     ref: 'User',
// //   },
// //   items: [
// //     {
// //       productId: { type: mongoose.Schema.Types.ObjectId, required: true, ref: 'Product' },
// //       name: String,
// //       quantity: { type: Number, default: 1 },
// //       price: Number,
// //     }
// //   ],
// //   address: { type: String, required: true },
// //   phone: { type: String, required: true },
// //   totalAmount: { type: Number, required: true },
// //   status: { type: String, default: 'Pending' },
// //   paymentId: String,
// //   createdAt: { type: Date, default: Date.now }
// // });

// // module.exports = mongoose.model('Order', orderSchema);


// const mongoose = require('mongoose');

// const orderSchema = new mongoose.Schema({
//   userId: {
//     type: mongoose.Schema.Types.ObjectId,
//     required: true,
//     ref: 'User',
//   },
//   items: [
//     {
//       productId: { type: mongoose.Schema.Types.ObjectId, required: true, ref: 'Product' },
//       name: String,
//       quantity: { type: Number, default: 1 },
//       price: Number,
//     }
//   ],
//   address: { type: String, required: true },
//   phone: { type: String, required: true },
//   totalAmount: { type: Number, required: true },

//   // Add these fields for Razorpay integration
//   razorpayOrderId: { type: String }, // To store Razorpay order ID linked with this order
//   paymentInfo: {
//     paymentId: { type: String },
//     amount: { type: Number },
//     status: { type: String }, // e.g., 'captured', 'failed', 'refunded'
//     updatedAt: { type: Date }
//   },

//   status: { type: String, default: 'Pending' }, 
  
//   createdAt: { type: Date, default: Date.now }
// });

// module.exports = mongoose.model('Order', orderSchema);

// // tracking system:
// models/Order.js - Enhanced with refund tracking
const mongoose = require('mongoose');

const orderSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    required: true,
    ref: 'User',
  },
  items: [
    {
      productId: { type: mongoose.Schema.Types.ObjectId, required: true, ref: 'Product' },
      name: String,
      quantity: { type: Number, default: 1 },
      price: Number,
    }
  ],
  address: { type: String, required: true },
  phone: { type: String, required: true },
  totalAmount: { type: Number, required: true },

  // Razorpay integration fields
  razorpayOrderId: { type: String },
  paymentInfo: {
    paymentId: { type: String },
    amount: { type: Number },
    status: { type: String }, // 'captured', 'failed', 'refunded', 'authorized'
    updatedAt: { type: Date }
  },

  // Enhanced refund tracking
  refundInfo: {
    refundId: { type: String }, // Razorpay refund ID
    amount: { type: Number }, // Refund amount
    status: { type: String }, // 'processed', 'failed', 'pending'
    speed: { type: String }, // 'normal', 'optimum'
    reason: { type: String }, // Refund reason
    createdAt: { type: Date },
    processedAt: { type: Date },
    estimatedSettlement: { type: Date }, // When refund will reach customer
    notes: { type: String }
  },

  status: { type: String, default: 'Pending' }, // 'Pending', 'Delivered', 'Cancelled', 'Refunded'
  cancelReason: { type: String }, // Reason for cancellation
  cancelledBy: { type: String }, // 'admin', 'user', 'system'
  cancelledAt: { type: Date },
  
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Order', orderSchema);