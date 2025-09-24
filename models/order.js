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
      price: { type: Number, required: true, min: 0 },
      _id: { type: mongoose.Schema.Types.ObjectId, auto: true }
    }
  ],
  address: { type: String, required: true, trim: true },
  phone: { type: String, required: true, trim: true },
  totalAmount: { type: Number, required: true, min: 0 },

  // Razorpay integration fields
  razorpayOrderId: {
    type: String,
    sparse: true, // Allows multiple null values but unique non-null values
    // index: true 
  },

  // Enhanced payment tracking
  paymentInfo: {
    paymentId: { type: String, sparse: true }, // Razorpay payment ID
    amount: { type: Number, min: 0 }, // Payment amount
    status: {
      type: String,
      enum: ['created', 'authorized', 'captured', 'failed', 'refunded', 'unknown'],
      default: 'created'
    },
    method: { type: String }, // Payment method (card, netbanking, upi, etc.)
    updatedAt: { type: Date, default: Date.now },
    razorpayCreatedAt: { type: Date }, // When payment was created in Razorpay

    // Additional payment details for debugging/tracking
    fee: { type: Number, default: 0 }, // Payment processing fee
    tax: { type: Number, default: 0 }, // Tax on fee
    acquirerData: {
      type: mongoose.Schema.Types.Mixed, // Bank reference number, etc.
      default: {}
    }
  },

  // Enhanced refund tracking
  refundInfo: {
    refundId: { type: String, sparse: true }, // Razorpay refund ID
    amount: { type: Number, min: 0 }, // Refund amount
    status: {
      type: String,
      enum: ['created', 'pending', 'processed', 'failed'],
      default: 'created'
    },
    speed: {
      type: String,
      enum: ['normal', 'optimum'],
      default: 'normal'
    }, // Refund processing speed
    reason: { type: String, trim: true }, // Refund reason
    createdAt: { type: Date }, // When refund was initiated
    processedAt: { type: Date }, // When refund was processed
    failedAt: { type: Date }, // When refund failed (if applicable)
    estimatedSettlement: { type: Date }, // Expected settlement date
    notes: { type: String, trim: true }, // Additional notes about refund

    // Additional refund tracking
    batchId: { type: String }, // Razorpay batch ID for bulk refunds
    receiptNumber: { type: String }, // Refund receipt number
    errorCode: { type: String }, // Error code if refund failed
    errorDescription: { type: String, trim: true } // Error description if failed
  },

  // Order status and lifecycle
  status: {
    type: String,
    enum: ['Pending', 'Delivered', 'Cancelled', 'Refunded'],
    default: 'Pending'
  },

  // Cancellation tracking
  cancelReason: { type: String, trim: true }, // Reason for cancellation
  cancelledBy: {
    type: String,
    enum: ['admin', 'user', 'system'],
    sparse: true
  }, // Who cancelled the order
  cancelledAt: { type: Date }, // When order was cancelled

  // Payment completion tracking (for webhook processing)
  paymentCompleted: { type: Boolean, default: false },
  paymentCompletedAt: { type: Date },

  // Order timestamps
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },

  // Delivery tracking (optional - for future use)
  deliveryInfo: {
    trackingNumber: { type: String, sparse: true },
    courier: { type: String, trim: true },
    estimatedDelivery: { type: Date },
    deliveredAt: { type: Date },
    deliveryNotes: { type: String, trim: true }
  }
}, {
  // Schema options
  timestamps: { createdAt: 'createdAt', updatedAt: 'updatedAt' }, // Automatic timestamps
  toJSON: { virtuals: true }, // Include virtuals in JSON output
  toObject: { virtuals: true }
});

// Indexes for better query performance
orderSchema.index({ userId: 1, createdAt: -1 }); // User orders by date
orderSchema.index({ razorpayOrderId: 1 }, { sparse: true }); // Razorpay order lookup
orderSchema.index({ 'paymentInfo.paymentId': 1 }, { sparse: true }); // Payment lookup
orderSchema.index({ 'refundInfo.refundId': 1 }, { sparse: true }); // Refund lookup
orderSchema.index({ status: 1, createdAt: -1 }); // Status-based queries
orderSchema.index({ createdAt: -1 }); // Recent orders

// Virtual for order total with items calculation (validation)
orderSchema.virtual('calculatedTotal').get(function () {
  return this.items.reduce((total, item) => total + (item.price * item.quantity), 0);
});

// Virtual for order age in days
orderSchema.virtual('ageInDays').get(function () {
  return Math.floor((Date.now() - this.createdAt) / (1000 * 60 * 60 * 24));
});

// Virtual for payment status label
orderSchema.virtual('paymentStatusLabel').get(function () {
  if (!this.paymentInfo || !this.paymentInfo.status) return 'Unknown';

  switch (this.paymentInfo.status.toLowerCase()) {
    case 'captured': return 'Paid';
    case 'authorized': return 'Authorized (Pending)';
    case 'failed': return 'Failed';
    case 'created': return 'Payment Initiated';
    default: return this.paymentInfo.status.charAt(0).toUpperCase() + this.paymentInfo.status.slice(1);
  }
});

// Pre-save middleware to validate total amount
orderSchema.pre('save', function (next) {
  // Validate that totalAmount matches sum of items
  const calculatedTotal = this.items.reduce((total, item) => {
    if (!item.price || !item.quantity || item.price < 0 || item.quantity < 1) {
      return next(new Error('Invalid item price or quantity'));
    }
    return total + (item.price * item.quantity);
  }, 0);

  if (Math.abs(this.totalAmount - calculatedTotal) > 0.01) { // Allow for floating point precision
    return next(new Error(`Total amount mismatch: expected ${calculatedTotal}, got ${this.totalAmount}`));
  }

  // Update timestamps
  this.updatedAt = new Date();

  // Auto-set payment completion if status changes to captured
  if (this.paymentInfo && this.paymentInfo.status === 'captured' && !this.paymentCompleted) {
    this.paymentCompleted = true;
    this.paymentCompletedAt = new Date();
  }

  next();
});

// Pre-save middleware to handle status transitions
orderSchema.pre('save', function (next) {
  if (this.isModified('status')) {
    const now = new Date();

    // Auto-set cancellation timestamp
    if (this.status === 'Cancelled' && !this.cancelledAt) {
      this.cancelledAt = now;
      if (!this.cancelledBy) {
        this.cancelledBy = 'system'; // Default if not specified
      }
    }

    // Clear cancellation data if status changes from Cancelled
    if (this.status !== 'Cancelled' && this.isModified('status') && this.cancelledAt) {
      this.cancelReason = undefined;
      this.cancelledBy = undefined;
      this.cancelledAt = undefined;
    }
  }

  next();
});

// Static method to find orders with payment issues
orderSchema.statics.findPaymentIssues = function () {
  return this.find({
    $or: [
      { 'paymentInfo.status': 'failed' },
      { 'paymentInfo.status': 'authorized', createdAt: { $lt: new Date(Date.now() - 24 * 60 * 60 * 1000) } }, // Authorized for over 24 hours
      { status: 'Pending', paymentInfo: { $exists: false } }, // No payment info
      { status: 'Pending', 'paymentInfo.status': { $in: [null, 'unknown'] } } // Unknown payment status
    ]
  });
};

// Static method to find orders needing refund processing
orderSchema.statics.findRefundPending = function () {
  return this.find({
    status: 'Cancelled',
    'paymentInfo.status': 'captured',
    $or: [
      { refundInfo: { $exists: false } },
      { 'refundInfo.refundId': { $exists: false } }
    ]
  });
};

// Instance method to check if order can be cancelled
orderSchema.methods.canBeCancelled = function () {
  return this.status === 'Pending' || this.status === 'Delivered';
};

// Instance method to check if refund is possible
orderSchema.methods.canBeRefunded = function () {
  return this.paymentInfo &&
    ['captured', 'authorized'].includes(this.paymentInfo.status) &&
    (!this.refundInfo || !this.refundInfo.refundId);
};

// Instance method to get estimated refund settlement date
orderSchema.methods.getEstimatedRefundSettlement = function () {
  if (!this.refundInfo || !this.refundInfo.estimatedSettlement) return null;

  const now = new Date();
  const settlement = new Date(this.refundInfo.estimatedSettlement);
  const diffTime = settlement - now;
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

  if (diffDays <= 0) return 'Should be settled';
  if (diffDays === 1) return 'Expected tomorrow';
  return `Expected in ${diffDays} days`;
};

module.exports = mongoose.model('Order', orderSchema);