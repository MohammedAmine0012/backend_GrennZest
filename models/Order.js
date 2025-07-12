const mongoose = require('mongoose');

const orderItemSchema = new mongoose.Schema({
  productId: {
    type: String,
    required: true
  },
  name: {
    type: String,
    required: true
  },
  price: {
    type: Number,
    required: true
  },
  quantity: {
    type: Number,
    required: true,
    min: 1
  },
  image: {
    type: String,
    required: true
  }
});

const orderSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  items: [orderItemSchema],
  total: {
    type: Number,
    required: true
  },
  status: {
    type: String,
    enum: ['En attente', 'Confirmée', 'En préparation', 'Expédiée', 'Livrée', 'Annulée'],
    default: 'En attente'
  },
  paymentMethod: {
    type: String,
    enum: ['Stripe', 'PayPal', 'Livraison'],
    required: true
  },
  shippingAddress: {
    street: String,
    city: String,
    postalCode: String,
    country: String
  },
  deliveryInstructions: {
    type: String,
    default: ''
  },
  orderNumber: {
    type: String,
    unique: true
  }
}, {
  timestamps: true
});

// Generate order number before saving
orderSchema.pre('save', async function(next) {
  if (!this.orderNumber) {
    const count = await this.constructor.countDocuments();
    this.orderNumber = `CMD-${String(count + 1).padStart(4, '0')}`;
  }
  next();
});

module.exports = mongoose.model('Order', orderSchema); 