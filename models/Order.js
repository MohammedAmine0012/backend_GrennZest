const mongoose = require('mongoose');

const orderSchema = new mongoose.Schema({
  orderNumber: {
    type: String,
    required: true,
    unique: true
  },
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  items: [{
    product: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Product',
      required: true
    },
    name: {
      type: String,
      required: true
    },
    quantity: {
      type: Number,
      required: true,
      min: 1
    },
    price: {
      type: Number,
      required: true,
      min: 0
    },
    image: String
  }],
  total: {
    type: Number,
    required: true,
    min: 0
  },
  status: {
    type: String,
    enum: ['pending', 'processing', 'shipped', 'delivered', 'cancelled'],
    default: 'pending'
  },
  paymentMethod: {
    type: String,
    required: true,
    enum: ['card', 'paypal', 'cash_on_delivery']
  },
  paymentStatus: {
    type: String,
    enum: ['pending', 'paid', 'failed', 'refunded'],
    default: 'pending'
  },
  shippingAddress: {
    street: String,
    city: String,
    postalCode: String,
    country: {
      type: String,
      default: 'Morocco'
    }
  },
  billingAddress: {
    street: String,
    city: String,
    postalCode: String,
    country: {
      type: String,
      default: 'Morocco'
    }
  },
  notes: String,
  trackingNumber: String,
  estimatedDelivery: Date,
  deliveredAt: Date,
  cancelledAt: Date,
  cancelledBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  cancellationReason: String
}, {
  timestamps: true
});

// Generate order number before saving
orderSchema.pre('save', async function(next) {
  if (this.isNew) {
    const count = await mongoose.model('Order').countDocuments();
    this.orderNumber = `CMD-${String(count + 1).padStart(4, '0')}`;
  }
  next();
});

// Calculate total before saving
orderSchema.pre('save', function(next) {
  if (this.items && this.items.length > 0) {
    this.total = this.items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  }
  next();
});

// Update product stock when order is created
orderSchema.post('save', async function(doc) {
  if (doc.status === 'pending') {
    const Product = mongoose.model('Product');
    for (const item of doc.items) {
      await Product.findByIdAndUpdate(
        item.product,
        { $inc: { stock: -item.quantity } }
      );
    }
  }
});

// Restore product stock when order is cancelled
orderSchema.post('findOneAndUpdate', async function(doc) {
  if (doc && this._update.status === 'cancelled' && doc.status !== 'cancelled') {
    const Product = mongoose.model('Product');
    for (const item of doc.items) {
      await Product.findByIdAndUpdate(
        item.product,
        { $inc: { stock: item.quantity } }
      );
    }
  }
});

module.exports = mongoose.model('Order', orderSchema); 