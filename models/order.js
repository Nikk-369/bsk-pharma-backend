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

// // 2 tracking system:
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
      name: { type: String, required: true },
      quantity: { type: Number, default: 1, min: 1 },
      price: { type: Number, required: true, min: 0 }
    }
  ],
  address: { type: String, required: true, trim: true },
  phone: { type: String, required: true, trim: true },
  totalAmount: { type: Number, required: true, min: 0 },

  // Razorpay integration - simplified
  razorpayOrderId: { type: String, unique: true, sparse: true },
  
  // Simple payment tracking
  paymentInfo: {
    paymentId: { type: String }, // Razorpay payment ID
    amount: { type: Number, min: 0 }, // Payment amount
    status: {
      type: String,
      enum: ['pending', 'created', 'authorized', 'captured', 'failed', 'refunded'],
      default: 'pending'
    },
    method: { type: String }, // Payment method
    updatedAt: { type: Date, default: Date.now }
  },

  // Simple refund tracking
  refundInfo: {
    refundId: { type: String },
    amount: { type: Number, min: 0 },
    status: {
      type: String,
      enum: ['none', 'pending', 'processed', 'failed'],
      default: 'none'
    },
    reason: { type: String, trim: true },
    processedAt: { type: Date }
  },

  // Order status
  status: {
    type: String,
    enum: ['Pending', 'Delivered', 'Cancelled', 'Refunded'],
    default: 'Pending'
  },

  // Cancellation info
  cancelReason: { type: String, trim: true },
  cancelledBy: { type: String, enum: ['admin', 'user', 'system'] },
  cancelledAt: { type: Date },

}, {
  timestamps: true, // This creates createdAt and updatedAt automatically
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Simple indexes - no duplicates
orderSchema.index({ userId: 1, createdAt: -1 });
orderSchema.index({ razorpayOrderId: 1 });
orderSchema.index({ status: 1 });

// Pre-save middleware for validation
orderSchema.pre('save', function (next) {
  // Validate total amount
  const calculatedTotal = this.items.reduce((total, item) => {
    return total + (item.price * item.quantity);
  }, 0);

  if (Math.abs(this.totalAmount - calculatedTotal) > 0.01) {
    return next(new Error(`Total amount mismatch: expected ${calculatedTotal}, got ${this.totalAmount}`));
  }

  // Handle status changes
  if (this.isModified('status')) {
    if (this.status === 'Cancelled' && !this.cancelledAt) {
      this.cancelledAt = new Date();
      if (!this.cancelledBy) this.cancelledBy = 'system';
    }
  }

  next();
});

// Virtual for payment status label
orderSchema.virtual('paymentStatusLabel').get(function () {
  const status = this.paymentInfo?.status || 'pending';
  switch (status) {
    case 'captured': return 'Paid';
    case 'authorized': return 'Authorized';
    case 'failed': return 'Failed';
    case 'pending': return 'Pending';
    default: return status.charAt(0).toUpperCase() + status.slice(1);
  }
});

// Static method to find orders with issues
orderSchema.statics.findPaymentIssues = function () {
  return this.find({
    $or: [
      { 'paymentInfo.status': 'failed' },
      { status: 'Pending', 'paymentInfo.status': 'pending' }
    ]
  });
};

module.exports = mongoose.model('Order', orderSchema);